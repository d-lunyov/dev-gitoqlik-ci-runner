const qrsInteract = require('qrs-interact');
const log = require(`../logger`).log;
const fs = require(`fs`);
const https = require('https');

const updateQlikAppcontentFiles = function (files, qlikServer) {
    if (!files || files.length === 0) {
        return;
    }

    log(`[QRS] Connecting to ${qlikServer.host}...`);
    const qrsSession = new qrsInteract({
        hostname: qlikServer.host,
        portNumber: qlikServer.qrsPort,
        certificates: {
            certFile: qlikServer.cert,
            keyFile: qlikServer.key
        }
    });

    return Promise.all(files.map(async file => {
        log(`[QRS] Uploading file ${file.name}...`);
        return qrsSession.Post(
            `appcontent/${qlikServer.appId}/uploadfile?externalpath=${encodeURIComponent(file.name)}&overwrite=true`,
            file.content,
            `image/*`)
            .then(data => {
                log(`[QRS] Upload file ${file.name} success`, data);
                return Promise.resolve();
            })
            .catch(error => {
                log(`[QRS] Error while uploading file ${file.name}`, error)
                return Promise.resolve();
            });

    }));
}

function createApp(qlikServer, appName) {
    const makeHttpRequest = function() {
        return new Promise((resolve, reject) => {
            const requestParams = {
                method: 'POST',
                path: '/api/hub/v1/apps',
                rejectUnauthorized: false,
                host: qlikServer.host,
                port: qlikServer.port,
                cert: fs.readFileSync(qlikServer.cert),
                key: fs.readFileSync(qlikServer.key),
                gzip: true,
                json: true
            };
            let finalBody = JSON.stringify({"data": {"type": "App", "attributes": {"name": appName}}});

            var req = https.request(requestParams, (res) => {
                var responseString = "";
                var statusCode = res.statusCode;
                res.on('error', function(err) {
                    reject(new Error("QRS response error:" + err));
                });
                res.on('data', function(data) {
                    responseString += data;
                });
                res.on('end', function() {
                    if (statusCode == 200 || statusCode == 201 || statusCode == 204) {
                        var jsonResponse = "";
                        if (responseString.length != 0) {
                            try {
                                jsonResponse = JSON.parse(responseString);
                            } catch (e) {
                                resolve({
                                    "statusCode": statusCode,
                                    "body": responseString
                                });
                            }
                        }
                        resolve({
                            "statusCode": statusCode,
                            "body": jsonResponse
                        });
                    } else {
                        reject(new Error("Received error code: " + statusCode + '::' + responseString));
                    }
                });
            }).on('error', function(err) {
                reject(new Error("QRS request error:" + err));
            });
            req.write(finalBody);
            req.end();
        });
    }

    log(`[QRS] Connecting to ${qlikServer.host}...`);
    return makeHttpRequest();
}

module.exports = {
    updateQlikAppcontentFiles,
    createApp
}