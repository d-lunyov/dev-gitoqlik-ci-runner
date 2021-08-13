const Promise = require('bluebird');
const METHODS = require('./assemble-blueprint');
const resolveDeletions = require('./resolve-deletions');
const log = require(`../logger`).log;

function apply(app, blueprint, isImport) {
    let applyErrors = [];
    const METHODS_MAP = ['sheets', 'measures', 'dimensions', 'masterobjects', 'snapshots', 'stories',
        'variables', 'bookmarks', 'appprops', 'properties', 'fields', 'alternatestates'];

    return Promise.resolve()
        .then(function () {
            if (blueprint.script) {
                return app.setScript(blueprint.script);
            }
        })
        .then(function () {
            return app.getAllInfos();
        })
        .then(function (info) {
            return info.qInfos.map(function (zip) {
                return zip.qId;
            });
        })
        .then(function (appObjectList) {
            return Promise.each(METHODS_MAP, async function (method) {
                log("[CS] apply ", {method});
                if (blueprint[method] && blueprint[method].length) {
                    return Promise.all(blueprint[method].map(function (definition) {
                        return METHODS[method](app, definition, appObjectList, blueprint)
                            .catch(function (error) {
                                if (error instanceof Error) {
                                    error = error.message;
                                    // Catch JS exceptions
                                } else if (typeof error === "object") {
                                    // Catch Qlik sense qsocks errors
                                    try {
                                        error.objectType = method;
                                        error = JSON.stringify(error);
                                    } catch(JSONerr) {
                                    }
                                }
                            applyErrors.push(error);
                        });
                    }))
                } else {
                    return Promise.resolve();
                }
            })
        })
        .then(function () {
            if (!isImport && blueprint.blueprintObjectList && blueprint.blueprintObjectList.qInfos) {
                return resolveDeletions(app, blueprint);
            }
        })
        .then(function () {
            return app.doSave();
        })
        .then(function () {
            return app.saveObjects();
        })
        .catch(function (error) {
            applyErrors.push(JSON.stringify(error));
            return Promise.resolve();
        })
        .then(function () {
            return Promise.resolve({success: true, applyErrors});
        });
};

module.exports = {
    apply: apply
};