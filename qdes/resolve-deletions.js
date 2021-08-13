var Promise = require('bluebird');
const Options = require(`../options`);

/**
 * Manages object removal in a blueprint.
 *
 * @param {Object} app qsocks app connection
 * @param {Object} blueprint Blueprint definition
 * @returns {Object} Returns Promise
 */
function resolveDeletions(app, blueprint) {
    const LIST = ['measure', 'dimension', 'masterobject', 'snapshot', 'variable', 'story', 'sheet', 'bookmark'];
    const bluePrintObjects = blueprint.blueprintObjectList && blueprint.blueprintObjectList.qInfos.filter(function (d) {
        return LIST.indexOf(d.qType) !== -1
    });

    return app.getAllInfos()
        .then(function (allInfos) {
            const appObjects = allInfos.qInfos.filter(function (d) {
                return LIST.indexOf(d.qType) !== -1
            });
            // Filter app  list for current blueprint
            return appObjects.filter(function (d) {
                return bluePrintObjects.map(function (d) {
                    return d.qId;
                }).indexOf(d.qId) === -1
            })
        })
        .then(function (objectsForDeletion) {
            if (objectsForDeletion.length) {
                return Promise.all(objectsForDeletion.map(function (d) {
                    if (d.qType === 'measure') {
                        return app.destroyMeasure(d.qId)
                    }
                    if (d.qType === 'dimension') {
                        return app.destroyDimension(d.qId)
                    }
                    if (d.qType === 'snapshot') {
                        return app.destroyBookmark(d.qId)
                    }
                    if (d.qType === 'variable') {
                        return app.destroyVariableById(d.qId);
                    }
                    if (d.qType === 'bookmark') {
                        return app.destroyBookmark(d.qId);
                    }
                    // Generic Obects
                    return app.destroyObject(d.qId);
                }))
            } else {
                // Nothing to delete, resolve promise.
                return Promise.resolve()
            }
        })
        // Deleting alternate states
        .then(function () {
            return app.getAppLayout();
        })
        .then(appLayout => {
            if (!blueprint.alternatestates) {
                return [];
            }
            return appLayout.qStateNames.filter(appStateName => {
                return blueprint.alternatestates.indexOf(appStateName) === -1;
            });
        })
        .then(alternateStatesToDelete => {
            return Promise.all(alternateStatesToDelete.map(stateToDelete => {
                return app.removeAlternateState(stateToDelete);
            }));
        });
};
module.exports = resolveDeletions;