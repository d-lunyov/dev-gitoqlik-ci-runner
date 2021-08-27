const qsocks = require(`qsocks`);
const appDataReader = require(`./appDataReader`);
const configService = require(`./configService`);
const log = require(`./logger`).log;
const qdes = require(`./qdes/qdes`);
const qrs = require(`./qdes/qrs`);

const openQsocks = async function(qlikServerConfig) {
    return qsocks.Connect({
        ca: [configService.getCertificate(qlikServerConfig.ca)],
        key: configService.getCertificate(qlikServerConfig.key),
        cert: configService.getCertificate(qlikServerConfig.cert),
        isSecure: true,
        host: qlikServerConfig.host,
        port: qlikServerConfig.port || 4747,
        headers: {
            "X-Qlik-User": `UserDirectory=${encodeURIComponent(qlikServerConfig.userDirectory)}; UserId=${encodeURIComponent(qlikServerConfig.userId)}`,
        },
        debug: false
    });
}

const createApp = async function(connection, appName) {
    return connection.createApp(appName);
}

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
    // When creating a new Qlik app, it may be linked to the CI config for the own server.
    // So we have to made a commit to the Gitoqlik repository with the updated CI config
    let isConfigChanged = false;

    log(`Reading config file...`);
    const qlikServers = configService.getQlikServers();
    log(`Get config success`, qlikServers);

    log(`Reading Gitoqlik application data...`);
    const appData = await appDataReader.getAppData();
    log(`Read Gitoqlik application data success`, appData);

    for (let i = 0; i < qlikServers.length; i++) {
        const qlikServerConfig = qlikServers[i];
        if (!qlikServerConfig.enabled) {
            continue;
        }

        try {
            log(`Connecting to the ${qlikServerConfig.host}:${qlikServerConfig.port || 4747}...`);
            const connection = await openQsocks(qlikServerConfig);
            log(`Connection success`)

            if (qlikServerConfig.createNewApp) {
                log(`Creating new app ...`);
                let createdAppData = await createApp(connection, qlikServerConfig.createNewAppName);
                if (!createdAppData.qSuccess) {
                    throw new Error(`Create new app failed`);
                }
                qlikServerConfig.appId = createdAppData.qAppId;
                log(`Create app success, id: ${qlikServerConfig.appId}`);

                if (qlikServerConfig.linkNewAppToCI) {
                    isConfigChanged = true;
                    qlikServerConfig.createNewApp = false;
                    qlikServerConfig.linkNewAppToCI = false;
                    delete qlikServerConfig.createNewAppName;
                    configService.writeQlikServers(qlikServers);
                }
            }

            log(`Opening app ${qlikServerConfig.appId}...`);
            let appHandle = await openDoc(connection, qlikServerConfig.appId);
            log(`Open app success`);

            log(`Updating thumbnail urls with new app id...`);
            updateThumbnailUrls(appData, qlikServerConfig.appId);

            if (appData.appcontent) {
                log(`Updating binary files...`)
                await qrs.updateQlikAppcontentFiles(appData.appcontent, qlikServerConfig);
                log(`Updating binary files done.`)
            }

            if (appData.script) {
                try {
                    log(`Updating application reload script...`);
                    await appHandle.setScript(appData.script);
                    log(`Update application reload script success`);
                } catch (error) {
                    log(`ERROR update application reload script`, error);
                }
            }

            if (qlikServerConfig.doReload) {
                try {
                    log(`Reloading application data...`);
                    await appHandle.doReload(0, false, false);
                    log(`Reload application data success`);
                } catch (error) {
                    log(`ERROR reload application data`, error);
                }
            }

            log(`Updating Qlik application with Gitoqlik data...`);
            const updateData = await qdes.apply(appHandle, appData);
            if (updateData.applyErrors.length) {
                log(`Update done with errors: ${updateData.applyErrors.join(";")}`)
            } else {
                log(`Update success`);
            }
        } catch(error) {
            log(`Skipping ${qlikServerConfig.host}`);
            log(`ERROR: `, error);
            continue;
        }
    }

    if (isConfigChanged) {
        // Make a commit
        try {
            log(`Pushing CI/config.json changes to the Gitoqlik repository`);
            await configService.pushCommitChanges();
            log(`Push success`);
        } catch (error) {
            log(`Error while pushing CI/config.json changes to the Gitoqlik repository`, error);
        }
    }

    process.exit(0);
}

log(`environment`);
log(process.env);
log(`end environment`);
start();