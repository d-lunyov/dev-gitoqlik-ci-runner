const qrsInteract = require('qrs-interact');
const log = require(`../logger`).log;

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

module.exports = {
    updateQlikAppcontentFiles
}