const qsocks = require(`qsocks`);
const configReader = require(`./configReader`);
const log = require(`./logger`).log;
const appDataReader = require(`./appDataReader`);

const start = async function() {
    log(`Reading config file...`);
    const qlikServers = configReader.getQlikServers();
    log(`Get config success`, qlikServers);

    log(`Reading Gitoqlik application data...`);
    const appData = await appDataReader.getAppData();
    log(`Read Gitoqlik application data success`, appData);

    for (let i = 0; i < qlikServers.length; i++) {
        try {
            const qlikServer = qlikServers[i];

            log(`Connecting to the ${qlikServer.host}:${qlikServer.port || 4747}...`);
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

            let appHandle;
            try {
                appHandle = await connection.openDoc(qlikServer.appId, `` , ``, ``, true);
            } catch (error) {
                // Catch App already open in different mode
                // Try switch to another mode
                if (error.code === 1009) {
                    appHandle = await connection.openDoc(qlikServer.appId);
                } else {
                    throw error;
                }
            }
            const appProperties = await appHandle.getAppProperties();
            console.log(`Qlik Application Data: `, appProperties);
        } catch(error) {
            log(`Skipping ${qlikServer.host}`);
            log(`ERROR: `, error);
            continue;
        }
    }

    process.exit(0);
}

start();