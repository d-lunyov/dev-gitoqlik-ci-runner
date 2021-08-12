const fs = require("fs");
const path = require("path");
const resolvePath = (filename) =>  path.resolve(__dirname, `./`, filename);

getQlikServers = function () {
    const readConfig = (filename) => fs.readFileSync(resolvePath(filename));

    const config = JSON.parse(readConfig(`config.json`));
    return config.qlikServers || [];
}

getCertificate = function(filePath) {
    const readCert = (filename) => fs.readFileSync(resolvePath(filename));

    return readCert(filePath);
}

module.exports = {
    getQlikServers,
    getCertificate
}