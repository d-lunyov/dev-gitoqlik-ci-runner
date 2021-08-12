const qsocks = require(`qsocks`);
const configReader = require(`./configReader`);
const log = require(`./logger`).log;

function readDirAsync() {
    return new Promise((resolve, reject) => {
        fs.readdir('../', (err, files) => {
            if (err) {
                return resolve(err);
            }
            return resolve(files);
        });
    });
}
readDirAsync()
    .then(files => {
        console.log(`DIR:`);
        console.log(files)
    })


const start = async function() {
    log(`Reading config file...`);
    const qlikServers = configReader.getQlikServers();
    log(`Get config success`, qlikServers);

    /*for (let i = 0; i < qlikServers.length; i++) {
        try {
            const qlikServer = qlikServers[i];

            log(`Connecting to the qlikServer.host:${qlikServer.port || 4747}...`);
            const connection = await qsocks.Connect({
                ca: [configReader.getCertificate(qlikServer.ca)],
                key: configReader.getCertificate(qlikServer.key),
                cert: configReader.getCertificate(qlikServer.cert),
                isSecure: true,
                host: qlikServer.host,
                port: qlikServer.port || 4747,
                headers: {
                    "X-Qlik-User": `UserDirectory=${encodeURIComponent(qlikServer.userDirectory)}; UserId=${encodeURIComponent(qlikServer.userId)}`,
                },
                debug: true
            });

            const docs = await connection.getDocList();

            log(`Docs: `, docs);
        } catch(error) {
            log(`ERROR: `, error);
        }
    }*/
}

start();