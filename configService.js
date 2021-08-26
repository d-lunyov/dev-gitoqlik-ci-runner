const fs = require("fs");
const path = require("path");
const spawn = require('child_process').spawn;

const resolvePath = (filename) =>  path.resolve(`./`, filename);
const readFile = (filename) => fs.readFileSync(resolvePath(filename), `utf8`);
const writeFile = (filename, data) => fs.writeFileSync(resolvePath(filename), data, `utf8`);

const getQlikServers = function () {
    const config = JSON.parse(readFile(`CI/config.json`));
    return config.qlikServers || [];
}

const getCertificate = function(filePath) {
    return readFile(filePath);
}

const getFullConfig = function() {
    return JSON.parse(readFile(`CI/config.json`));
}

const writeQlikServers = function(qlikServers) {
    const config = getFullConfig();
    config.qlikServers = qlikServers;
    writeFile(`CI/config.json`, JSON.stringify(config, null, 2));
}

const pushCommitChanges = function() {
    return new Promise((resolve, reject) => {
        const app = spawn(`sh`, [path.join(__dirname, './pushConfigChanges.sh')], { stdio: 'inherit' });
        app.on('close', code => {
            if(code !== 0){
                const err = new Error(`Invalid status code: ${code}`);
                err.code = code;
                return reject(err);
            }
            return resolve(code);
        });
        app.on('error', reject);
    });
}

module.exports = {
    getQlikServers,
    getCertificate,
    writeQlikServers,
    pushCommitChanges
}