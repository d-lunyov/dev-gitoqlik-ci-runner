const qrsInteract = require('qrs-interact');
const configService = require(`../configService`);
const log = require(`../logger`).log;

const updateQlikAppcontentFiles = function (files, qlikServerConfig) {
    if (!files || files.length === 0) {
        return;
    }

    log(`[QRS] Connecting to ${qlikServerConfig.host}...`);
    const config = {
        hostname: qlikServerConfig.host,
        portNumber: qlikServerConfig.qrsPort
    };

    let authMethod = configService.getAuthMethod(qlikServerConfig);
    if (!authMethod) {
        return Promise.reject(new Error(`Invalid authentication config for the server ${qlikServerConfig.host}`));
    }
    if (authMethod === "jwt") {
        config.headers = {
            "Authorization": `Bearer ${qlikServerConfig.jwt.token}`
        };
        config.virtualProxyPrefix = qlikServerConfig.jwt.virtualProxyPrefix;
    } else if (authMethod === "cert") {
        config.certificates = {
            certFile: qlikServerConfig.cert,
                keyFile: qlikServerConfig.key
        }
    }

    const qrsSession = new qrsInteract(config);

    return Promise.all(files.map(async file => {
        log(`[QRS] Uploading file ${file.name}...`);
        return qrsSession.Post(
            `appcontent/${qlikServerConfig.appId}/uploadfile?externalpath=${encodeURIComponent(file.name)}&overwrite=true`,
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

module.exports = {
    updateQlikAppcontentFiles
}