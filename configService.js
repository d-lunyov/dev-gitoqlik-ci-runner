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
            case `GITLAB`:
                shellWorker = `./pushConfigChanges_gitlab.sh`;
                args.push(`-GITLAB_USER_NAME`);args.push(argv.GITLAB_USER_NAME);
                args.push(`-GITLAB_USER_EMAIL`);args.push(argv.GITLAB_USER_EMAIL);
                args.push(`-CI_GIT_TOKEN`);args.push(argv.CI_GIT_TOKEN);
                args.push(`-CI_REPOSITORY_URL`);args.push(argv.CI_REPOSITORY_URL);
                args.push(`-CI_DEFAULT_BRANCH`);args.push(argv.CI_DEFAULT_BRANCH);
                break;
            case `GITHUB`:
            default:
                shellWorker = `./pushConfigChanges_github.sh`;
                args.push(`-GITHUB_USER_NAME`);args.push(`gitoqlik_ci_update`);
                args.push(`-GITHUB_USER_EMAIL`);args.push(`gitoqlik_ci@exmaple.com`);
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