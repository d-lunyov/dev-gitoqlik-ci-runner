const fs = require("fs");
const path = require("path");
const spawn = require('child_process').spawn;
const log = require(`./logger`).log;

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
        const argv = require('minimist')(process.argv.slice(2));
        log(`Available CI variables: `, argv);
        const serverType = argv.SERVER_TYPE;

        let shellWorker = `./pushConfigChanges_github.sh`;
        const args = [];
        switch (serverType) {
            case `GITHUB`:
                shellWorker = `./pushConfigChanges_github.sh`;
                args.push(`-GITHUB_USER_NAME ${argv.GITHUB_USER_NAME}`);
                args.push(`-GITHUB_USER_EMAIL ${argv.GITHUB_USER_EMAIL}`);
                break;
            case `GITLAB`:
                shellWorker = `./pushConfigChanges_gitlab.sh`;
                args.push(`-GITLAB_USER_NAME ${argv.GITLAB_USER_NAME}`);
                args.push(`-GITLAB_USER_EMAIL ${argv.GITLAB_USER_EMAIL}`);
                args.push(`-CI_GIT_TOKEN ${argv.CI_GIT_TOKEN}`);
                args.push(`-CI_REPOSITORY_URL ${argv.CI_REPOSITORY_URL}`);
                args.push(`-CI_DEFAULT_BRANCH ${argv.CI_DEFAULT_BRANCH}`);
                break;
        }

        const app = spawn(`sh`, [path.join(__dirname, shellWorker), ...args], { stdio: 'inherit' });
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