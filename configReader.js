const fs = require("fs");
const path = require("path");

const resolvePath = (filename) =>  path.resolve(`./`, filename);
const readFile = (filename) => fs.readFileSync(resolvePath(filename), `utf8`);

const getQlikServers = function () {
    const config = JSON.parse(readFile(`CI/config.json`));
    return config.qlikServers || [];
}

const getCertificate = function(filePath) {
    return readFile(filePath);
}

module.exports = {
    getQlikServers,
    getCertificate
}