const Promise = require('bluebird');

// Accessor function to flatten array of arrays
const flatten = function (a, b) {
    return a.concat(b);
};

const addCreatedIdToBlueprint = function (handle, type, blueprint) {
    // Case when app object id's does not equals blueprintobjectlist (merge branch to master)
    handle.getProperties()
        .then(function (props) {
            if (blueprint.blueprintObjectList) {
                blueprint.blueprintObjectList.qInfos.push({
                    "qId": props.qInfo.qId,
                    "qType": type
                });
            }
        });
};

function syncVariable(app, def) {
    return app.createVariableEx(def)
        .catch(err => {
            if (err.code == '18001') {
                return app.getVariableById(def.qInfo.qId)
                    .then(function (handle) {
                        if (handle) {
                            return handle.setProperties(def)
                        } else {
                            return Promise.resolve();
                        }
                    })
            } else {
                return Promise.reject(error);
            }
        });
}

function syncSheet(app, def, list, blueprint) {
    if (list.indexOf(def.qProperty.qInfo.qId) === -1) {
        return app.createObject(def.qProperty).then(function (handle) {
            addCreatedIdToBlueprint(handle, "sheet", blueprint);
            delete def.qProperty.qInfo.qId;
            return handle.setFullPropertyTree(def);
        })
    } else {
        return app.getObject(def.qProperty.qInfo.qId).then(function (handle) {
            return handle.setFullPropertyTree(def);
        })
    }
}

function syncMasterObject(app, def, list, blueprint) {
    if (list.indexOf(def.qProperty.qInfo.qId) === -1) {
        return app.createObject(def.qProperty).then(function (handle) {
            addCreatedIdToBlueprint(handle, "masterobject", blueprint);
            delete def.qProperty.qInfo.qId;
            return handle.setFullPropertyTree(def);
        });
    } else {
        return app.getObject(def.qProperty.qInfo.qId).then(function (handle) {
            return handle.setFullPropertyTree(def);
        })
    }
}

function syncDimension(app, def, list, blueprint) {
    const colorMapModel = def._ColorMapModel;
    delete def._ColorMapModel;

    const syncColorMapModel = function(dimensionId) {
        if (!colorMapModel) {
            return Promise.resolve();
        }
        const colorModelId = `ColorMapModel_${dimensionId}`;

        if (list.indexOf(colorModelId) === -1) {
            return app.createObject(colorMapModel);
        } else {
            return app.getObject(colorModelId).then(colorMapModelHandle => {
                return colorMapModelHandle.setProperties(colorMapModel);
            })
        }
    };

    if (list.indexOf(def.qInfo.qId) === -1) {
        return app.createDimension(def).then(function (handle) {
            addCreatedIdToBlueprint(handle, "dimension", blueprint);
            return handle.getProperties().then(newDimensionProperties => {
                return syncColorMapModel(newDimensionProperties.qInfo.qId);
            })
        });
    } else {
        return app.getDimension(def.qInfo.qId).then(function (dim) {
            return dim.setProperties(def)
                .then(() => {
                    return syncColorMapModel(def.qInfo.qId);
                });
        })
    }
}

function syncMeasure(app, def, list, blueprint) {

    if (list.indexOf(def.qInfo.qId) === -1) {
        return app.createMeasure(def).then(function (handle) {
            addCreatedIdToBlueprint(handle, "measure", blueprint);
            return Promise.resolve();
        });
    } else {
        return app.getMeasure(def.qInfo.qId).then(function (measure) {
            return measure.setProperties(def);
        })
    }
}

function syncStory(app, def, list, blueprint) {
    if (list.indexOf(def.qProperty.qInfo.qId) === -1) {
        return app.createObject(def.qProperty).then(function (handle) {
            addCreatedIdToBlueprint(handle, "story", blueprint);
            delete def.qProperty.qInfo.qId;
            return handle.setFullPropertyTree(def)
                .then(function () {
                    return embedSnapshot(app, handle, def);
                });
        })
    } else {
        return app.getObject(def.qProperty.qInfo.qId).then(function (handle) {
            return handle.setFullPropertyTree(def)
                .then(function () {
                    return embedSnapshot(app, handle, def);
                });
        })
    }
}

function embedSnapshot(app, handle, def) {
    return handle.getChildInfos()
        .then(function (list) {
            return Promise.all(list.filter(function (d) {
                return d.qId
            }).map(function (d) {
                return app.getObject(d.qId);
            }))
        })
        .then(function (slides) {
            return Promise.all(slides.map(function (d) {
                return d.getChildInfos()
            }))
        })
        .then(function (slideitems) {
            return Promise.all(slideitems.reduce(flatten, []).map(function (item) {
                return app.getObject(item.qId);
            }))
        })
        .then(function (itemlist) {
            return Promise.all(itemlist.map(function (d) {
                return d.getLayout();
            }))
                .then(function (layouts) {
                    return Promise.each(layouts, function (layout, index) {
                        if (layout.style && layout.style.id) {

                            var filtered = def.qChildren.reduce(function (a, b) {
                                return a.concat(b.qChildren)
                            }, []).filter(function (d) {
                                return d.qProperty.qInfo.qId === layout.qInfo.qId;
                            }).map(function (d) {
                                return d.qEmbeddedSnapshotRef;
                            });

                            return itemlist[index].embedSnapshotObject(layout.style.id)
                                .then(function () {
                                    return itemlist[index].getSnapshotObject()
                                })
                                .then(function (handle) {
                                    filtered[0].qProperties.qInfo = layout.qInfo;
                                    return handle.setProperties(filtered[0].qProperties)
                                })
                        } else {
                            return Promise.resolve()
                        }
                    })
                })
        })
}

function syncSnapshot(app, def, list, blueprint) {

    if (list.indexOf(def.qInfo.qId) === -1) {
        return app.createBookmark(def).then(function (handle) {
            addCreatedIdToBlueprint(handle, "snapshot", blueprint);
            return Promise.resolve();
        });
    } else {
        return app.getBookmark(def.qInfo.qId).then(function (handle) {
            return handle.setProperties(def);
        })
    }
}

function syncBookmark(app, def, list, blueprint) {

    if (list.indexOf(def.qInfo.qId) === -1) {
        return app.createBookmark(def).then(function (handle) {
            addCreatedIdToBlueprint(handle, "bookmark", blueprint);
            return Promise.resolve();
        });
    } else {
        return app.getBookmark(def.qInfo.qId).then(function (handle) {
            return handle.setProperties(def);
        })
    }
}

function syncAppprops(app, def, list, blueprint) {
    delete def.qProperty.qInfo.qId;
    return app.connection.ask(app.handle, 'GetObjects', [{
        qTypes: ["appprops"],
        qIncludeSessionObjects: false,
        qData: {}
    }])
        .then(function (data) {
            if (data.qList.length) {
                const apppropID = data.qList[0].qInfo.qId;
                return app.getObject(apppropID).then(function (handle) {
                    return handle.setFullPropertyTree(def);
                })
            } else {
                return app.createObject(def.qProperty).then(function (handle) {
                    addCreatedIdToBlueprint(handle, "appprops", blueprint);
                    delete def.qProperty.qInfo.qId;
                    return handle.setFullPropertyTree(def);
                });
            }
        });
}

function syncProperties(app, def) {

    return app.setAppProperties(def);
}

function syncFields(app, def) {
    if (def.qIsSystem) {
        return Promise.resolve();
    }
    return app.getField(def.qName).then(function (fieldLayout) {
        if (fieldLayout && fieldLayout.handle) {
            let setField = new qsocks.Field(app.connection, fieldLayout.handle);
            let sureBool = def.qAlwaysOneSelected === true;
            return setField.getNxProperties().then(function (existingProps) {
                let sureExistingBool = existingProps.qOneAndOnlyOne === true;
                if (sureExistingBool === sureBool) {
                    return Promise.resolve();
                }
                // We need to do the next manipulations to set qOneAndOnlyOne property
                //  See https://help.qlik.com/en-US/sense-developer/June2019/Subsystems/EngineAPI/Content/Sense_EngineAPI/WorkingWithAppsAndVisualizations/SetGetProperties/set-properties-field.htm
                if (sureBool) {
                    return app.createSessionObject({
                        "qInfo": {
                            "qType": "listbox"
                        },
                        "qListObjectDef": {
                            "qStateName": "$",
                            "qLibraryId": "",
                            "qDef": {
                                "qFieldDefs": [def.qName],
                                "qFieldLabels": [def.qName],
                                "qSortCriterias": [{"qSortByLoadOrder": 1}]
                            },
                            "qInitialDataFetch": [
                                {
                                    "qTop": 0,
                                    "qHeight": 1,
                                    "qLeft": 0,
                                    "qWidth": 1
                                }
                            ]
                        }
                    }).then(function (handle) {
                        let genericObject = new qsocks.GenericObject(app.connection, handle.handle);
                        return handle.getLayout().then(function (layout) {
                            return genericObject.selectListObjectValues("/qListObjectDef",
                                [0],
                                false)
                                .then(function () {
                                    return setField.setNxProperties({qOneAndOnlyOne: sureBool}).then(function () {
                                        return app.doSave().then(() => {
                                            return app.destroySessionObject(layout.qInfo.qId);
                                        });
                                    });
                                });
                        });
                    });
                } else {
                    return setField.setNxProperties({qOneAndOnlyOne: sureBool});
                }
            });
        } else {
            return Promise.resolve();
        }
    });
}

function syncAlternateStates(app, def, list, blueprint) {
    return app.addAlternateState(def);
}

module.exports = {
    sheets: syncSheet,
    dimensions: syncDimension,
    measures: syncMeasure,
    snapshots: syncSnapshot,
    stories: syncStory,
    masterobjects: syncMasterObject,
    variables: syncVariable,
    bookmarks: syncBookmark,
    appprops: syncAppprops,
    properties: syncProperties,
    fields: syncFields,
    alternatestates: syncAlternateStates
};