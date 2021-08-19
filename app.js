const qsocks = require(`qsocks`);
const configReader = require(`./configReader`);
const log = require(`./logger`).log;
const appDataReader = require(`./appDataReader`);
const qdes = require(`./qdes/qdes`);
const qrs = require(`./qdes/qrs`);

const openDoc = async function(connection, appId) {
    let appHandle;
    try {
        appHandle = await connection.openDoc(appId, `` , ``, ``, true);
    } catch (error) {
        // Catch App already open in different mode
        // Try switch to another mode
        if (error.code === 1009) {
            appHandle = await connection.openDoc(appId);
        } else {
            throw error;
        }
    }
    return appHandle;
}

const updateThumbnailUrls = function (appData, appId) {
    const replaceAppidInPath = function(path) {
        return path.replace(/appcontent\/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}/i, `appcontent/${appId}`);
    }

    let properties = appData.properties;
    if (properties && properties.qThumbnail && properties.qThumbnail.qUrl) {
        properties.qThumbnail.qUrl = replaceAppidInPath(properties.qThumbnail.qUrl);
        log(`new properties thumb url: `, properties.qThumbnail.qUrl);
    }

    let props = appData.appprops && appData.appprops[0];
    if (props && props.qProperty.sheetLogoThumbnail.qStaticContentUrlDef.qUrl) {
        props.qProperty.sheetLogoThumbnail.qStaticContentUrlDef.qUrl = replaceAppidInPath(props.qProperty.sheetLogoThumbnail.qStaticContentUrlDef.qUrl);
        log(`new props thumb url: `, props.qProperty.sheetLogoThumbnail.qStaticContentUrlDef.qUrl);
    }

    appData.sheets && appData.sheets.forEach(sheet => {
        if (sheet.qProperty.thumbnail.qStaticContentUrlDef && sheet.qProperty.thumbnail.qStaticContentUrlDef.qUrl) {
            sheet.qProperty.thumbnail.qStaticContentUrlDef.qUrl = replaceAppidInPath(sheet.qProperty.thumbnail.qStaticContentUrlDef.qUrl);
            log(`new sheet thumb url: `, sheet.qProperty.thumbnail.qStaticContentUrlDef.qUrl);
        }
    });
}

const start = async function() {
    log(`Reading config file...`);
    const qlikServers = configReader.getQlikServers();
    log(`Get config success`, qlikServers);

    log(`Reading Gitoqlik application data...`);
    const appData = await appDataReader.getAppData();
    log(`Read Gitoqlik application data success`, appData);

    for (let i = 0; i < qlikServers.length; i++) {
        const qlikServer = qlikServers[i];

        try {
            log(`Updating thumbnail urls with new app id...`);
            updateThumbnailUrls(appData, qlikServer.appId);

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
                debug: false
            });

            log(`Opening an app ${qlikServer.appId}...`);
            let appHandle = await openDoc(connection, qlikServer.appId);

            log(`Updating Qlik applications with Gitoqlik data...`);
            const updateData = await qdes.apply(appHandle, appData, false);
            log(`UpdateData: `, updateData);

            if (updateData.applyErrors.length) {
                log(`Update done with errors: ${updateData.applyErrors.join(";")}`)
            } else {
                log(`Update success`);
            }

            if (appData.appcontent) {
                log(`Updating binary files...`)
                await qrs.updateQlikAppcontentFiles(appData.appcontent, qlikServer);
                log(`Updating binary files done.`)
            }
        } catch(error) {
            log(`Skipping ${qlikServer.host}`);
            log(`ERROR: `, error);
            continue;
        }
    }

    process.exit(0);
}

start();