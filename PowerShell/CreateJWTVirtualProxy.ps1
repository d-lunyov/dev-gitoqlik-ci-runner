<#
    This script is a part of the Gitoqlok CI tool.

    Working process:
    1) Connect to the local Qlik server
    2) Export a new certificate to use with JWT proxy
    3) Create a new Virtual Proxy with JWT auth, using local Qlik Sense certificate
    4) Use "Central" Server Balancing Node with the new Virtual Proxy
    5) Use user-defined host for the Host Allow List
    6) Update a Central proxy - add created Virtal proxy to associated items
    7) Generate a JWT to use with the created Virtual Proxy
#>

$qlik_userId = "Administrator" # Should be replaced by user input from config
$qlik_userDirectory = "." # Should be replaced by user input from config
$jwt_websocketCrossOriginWhiteList = @("dev2.datanomix.pro", "QS-DEV.datanomix.local", "89.106.234.24")  # Should be replaced by user input from config

Write-Output "Installing module to interact with Qlik Server..."
if (-not (Get-Module -ListAvailable -Name Qlik-Cli)) {
    Install-Module Qlik-Cli -Force
}

function Write-ColorOutput($ForegroundColor)
{
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    else {
        $input | Write-Output
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

Write-ColorOutput red ("Warning! Due executing this script, the Central proxy of the Qlik Server will be restarted.")
Write-ColorOutput red ("The sessions for this proxy will be ended and the users logged out. Continue?")
$continueResponse = Read-Host "Type [y] to continue, any other to abort"
if (-not ($continueResponse -eq "y")) {
    Exit
}

Write-Output "Connectig to the Qlik Server..."
try {
    Connect-Qlik localhost -TrustAllCerts
    #Get-PfxCertificate "C:\PS\_cert\dev2.datanomix.pro_pfx\client.pfx" | Connect-Qlik "QS-DEV.datanomix.local" -UserName "DATANOMIX.PRO\teacher@datanomix.pro" -TrustAllCerts
}
catch {
    Write-Output "Can't connect, exiting."
    Write-Output $_
}

Write-Output "Exporting certificate..."
$jwt_certRandomMachineName = "gitoqlok-ci-$(Get-Random -Minimum 1000000 -Maximum 9999999)"
$jwt_certificatePath = Export-QlikCertificate -machineNames @($jwt_certRandomMachineName) -exportFormat "Pem"
$jwt_certificatePath += "\$($jwt_certRandomMachineName)"
Write-Output "Export success, path: $($jwt_certificatePath)"

Write-Output "Detecting central Node id..."
$qlik_centralNode = Get-QlikNode -filter 'isCentral eq true'
Write-Output "Central Node id: $($qlik_centralNode.id)"

$jwt_prefix = "gitoqlok-ci-jwt"
$jwt_description = "JWT auth used by Gitoqlok CI"
$jwt_sessionCookieHeaderName = "X-Qlik-Session-gitoqlok-ci-jwt"
$jwt_loadBalancingServerNodes = @($qlik_centralNode.id)
$jwt_jwtPublicKeyCertificate = Get-Content -Path "$($jwt_certificatePath)\client.pem"
$jwt_jwtAttributeUserId = "userId"
$jwt_jwtAttributeUserDirectory = "userDirectory"

Write-Output "Creating Virtual Proxy..."
$createdVirtualProxy = New-QlikVirtualProxy -prefix $jwt_prefix -description $jwt_description -sessionCookieHeaderName $jwt_sessionCookieHeaderName -loadBalancingServerNodes $jwt_loadBalancingServerNodes -websocketCrossOriginWhiteList $jwt_websocketCrossOriginWhiteList -authenticationMethod 'JWT' -jwtPublicKeyCertificate "$jwt_jwtPublicKeyCertificate" -jwtAttributeUserId $jwt_jwtAttributeUserId -jwtAttributeUserDirectory $jwt_jwtAttributeUserDirectory
Write-Output "Success, id: $($createdVirtualProxy.id)"

Write-Output "Linking Virtual Proxy to the Central Proxy..."
$qlik_centralProxy = Get-QlikProxy -full -filter "serverNodeConfiguration.id eq $($qlik_centralNode.id)"
Write-Output "Central Proxy ID $($qlik_centralProxy.id)"

# Keep all existing virtual proxies for the Central proxy as list of IDs
$centralProxy_virtualProxies = foreach ($virtualProxy in $qlik_centralProxy.settings.virtualProxies) {
    $virtualProxy.id
}

# And add a newely created Virtual proxy ID
$centralProxy_virtualProxies += ($createdVirtualProxy.id)

# Update Central proxy
Write-Output "Updating Central Proxy..."
Update-QlikProxy -id $qlik_centralProxy.id -virtualProxies $centralProxy_virtualProxies

# ======================================= Generate JWT Section =====================================
if ([int]$PSVersionTable.PSVersion.Major -gt 5) {
    $jwt_privateKey =  Get-Content -Path  "$($jwt_certificatePath)\client_key.pem" -AsByteStream
} else {
    $jwt_privateKey =  Get-Content -Path  "$($jwt_certificatePath)\client_key.pem" -Encoding Byte -Raw
}

Write-Output "Installing modules to generate JWT..."
if (-not (Get-Module -ListAvailable -Name BAMCIS.Crypto)) {
    Install-Module BAMCIS.Crypto -Force
}

Import-Module -Name BAMCIS.Crypto

Function New-JwtHeader {
    param (
        [Parameter(Mandatory = $True)]
        [string]
        $Algorithm,

        [string]
        $Type = 'JWT',

        [hashtable]
        $ExtraClaims = @{}
    )

    $header = @{
        alg = $Algorithm
        typ = $Type
    } + $ExtraClaims

    $header
}

Function New-JwtPayload {
    param (
        [Parameter(Mandatory = $True)]
        [string]
        $Issuer,

        [Parameter(Mandatory = $True)]
        [int]
        $ExpiryTimestamp,

        [hashtable]
        $ExtraClaims = @{}
    )

    $payload = @{
        iss = $Issuer
        exp = $ExpiryTimestamp
    } + $ExtraClaims

    $payload
}
Function Convert-HashtableToJsonBase64 {
    param (
        [Parameter(Mandatory = $True)]
        [hashtable]
        $Hashtable
    )

    $json = $Hashtable | ConvertTo-Json -Compress
    $jsonbase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($json)).Split('=')[0].Replace('+', '-').Replace('/', '_')

    $jsonbase64
}

Function Convert-JsonBase64ToHashtable {
    param (
        [Parameter(Mandatory = $True)]
        [string]
        $JsonBase64
    )

    $JsonBase64 = $JsonBase64 -replace '-', '+' -replace '_', '/'
    switch ($JsonBase64.Length % 4) {
        0 { break }
        2 { $JsonBase64 += '==' }
        3 { $JsonBase64 += '=' }
    }

    $json = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($JsonBase64))
    $hashtable = $json | ConvertFrom-Json -AsHashtable

    $hashtable
}
Function Get-SignatureRS {
    param (
        [Parameter(Mandatory = $True)]
        [string]
        $Algorithm,

        [Parameter(Mandatory = $True)]
        [System.Byte[]]
        $SecretKey,

        [Parameter(Mandatory = $True)]
        [string]
        $ToBeSigned
    )

    $SigningAlgorithm = switch ($Algorithm) {
        "RS256" {[Security.Cryptography.HashAlgorithmName]::SHA256}
        "RS384" {[Security.Cryptography.HashAlgorithmName]::SHA384}
        "RS512" {[Security.Cryptography.HashAlgorithmName]::SHA512}
        Default {Write-Error -Message ('Unsupported algorithm: ' + $Algorithm)}
    }

    $rsa = ConvertFrom-PEM -PEM ([System.Text.Encoding]::UTF8.GetString($SecretKey))

    $Signature = [Convert]::ToBase64String(
        $rsa.SignData(
            [System.Text.Encoding]::UTF8.GetBytes($ToBeSigned),
            $SigningAlgorithm,
            [Security.Cryptography.RSASignaturePadding]::Pkcs1
        )
    ).Split('=')[0].Replace('+', '-').Replace('/', '_')

    $Signature
}
Function New-JWT {
    param (
        [Parameter(Mandatory = $True)]
        [string]
        $Algorithm,

        [string]
        $Type = 'JWT',

        [hashtable]
        $HeaderClaims = @{},

        [Parameter(Mandatory = $True)]
        [string]
        $Issuer,

        [Parameter(Mandatory = $True)]
        [int]
        $ExpiryTimestamp,

        [hashtable]
        $PayloadClaims = @{},

        [Parameter(Mandatory = $True)]
        [System.Byte[]]
        $SecretKey
    )

    $header = New-JwtHeader -Algorithm $Algorithm -Type $Type -ExtraClaims $HeaderClaims
    $payload = New-JwtPayload -Issuer $Issuer -ExpiryTimestamp $ExpiryTimestamp -ExtraClaims $PayloadClaims

    $headerBase64 = Convert-HashtableToJsonBase64 -Hashtable $header
    $payloadBase64 = Convert-HashtableToJsonBase64 -Hashtable $payload

    $ToBeSigned = $headerBase64 + "." + $payloadBase64
    $signature = switch -Wildcard ($Algorithm) {
        'RS???' { Get-SignatureRS -Algorithm $Algorithm -SecretKey $SecretKey -ToBeSigned $ToBeSigned }
        Default { Write-Error -Message ('Unsupported algorithm: ' + $Algorithm) }
    }

    $token = $ToBeSigned + "." + $signature
    $token
}

$exp = [DateTimeOffset]::Now.ToUnixTimeSeconds() + 157680000 # 5 years

$jwtPayload = @{
    userId = $qlik_userId
    userDirectory = $qlik_userDirectory
}

$jwt = New-JWT -Algorithm 'RS256' -Issuer 'Gitoqlok' -SecretKey $jwt_privateKey -ExpiryTimestamp $exp -PayloadClaims $jwtPayload

Write-Output "Virtual Proxy with JWT auth created successfully. Copy JWT for use in the Gitoqlok CI configuration:" $jwt