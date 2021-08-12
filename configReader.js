const fs = require("fs");
const path = require("path");
const log = require(`./logger`).log;

getQlikServers = function () {
    const resolveConfigPath = (filename) =>  path.resolve(__dirname, `./`, filename);
    const readConfig = (filename) => fs.readFileSync(resolveConfigPath(filename));

    const config = JSON.parse(readConfig(`config.json`));
    return config.qlikServers || [];
}

getCertificate = function(filePath) {
    const resolveCertPath = (filename) =>  path.resolve(__dirname, `./`, filename);
    const readCert = (filename) => fs.readFileSync(resolveCertPath(filename));

    return readCert(filePath);
}

module.exports = {
    getQlikServers,
    getCertificate
}