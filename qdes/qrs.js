const configReader = require(`../configReader`);
const qrsInteract = require('qrs-interact');
const log = require(`../logger`).log;

const updateQlikAppcontentFiles = function (files, qlikServer) {
    if (!files || files.length === 0) {
        return;
    }

    log(`[QRS] Connecting to ${qlikServer.host}...`);
    const qrsSession = new qrsInteract({
        hostname: qlikServer.host,
        certificates: {
            certFile: qlikServer.cert,
            keyFile: qlikServer.key
        }
    });

    return Promise.all(files.map(async file => {
        log(`[QRS] Sending file ${file.name}...`);
        /*const fd = new FormData();
        fd.append('file', file.content, file.name);*/
        qrsSession.Post(
            `appcontent/${qlikServer.appId}/uploadfile?externalpath=${encodeURIComponent(file.name)}&overwrite=true`,
            file.content,
            `'multipart/form-data'`)
            .then(data => {
                log(`[QRS] Send file ${file.name} success`, data);
            })
            .catch(error => {
                log(`Error while uploading file ${file.name}`, error)
                return Promise.resolve();
            });

    }));
}

module.exports = {
    updateQlikAppcontentFiles
}