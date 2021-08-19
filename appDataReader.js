const log = require(`./logger`).log;
const fs = require("fs");
const path = require("path");

const readFile = (filename, isBinary) => {
    return new Promise((resolve, reject) => {
        fs.readFile(filename, isBinary ? undefined : `utf8`, (err, data) => {
            if (err) {
                return reject(err);
            }
            if (filename.endsWith(`.json`)) {
                data = JSON.parse(data);
            }
            return resolve(data);
        });
    })
}

const Options = {
    REPOSITORY_SCRIPT_FOLDER: "data_load_script",
    SCRIPT_TABS_ORDER_FILEPATH: "data_load_script/tab_order.txt",
    REPOSITORY_OBJECTS_FOLDER: "objects",
    REPOSITORY_APPCONTENT_FOLDER: "appcontent",
    REPOSITORY_TASKS_FOLDER: "reload_tasks",
    SCRIPT_TABS_DIVIDER: "///$tab ",
    SCRIPT_LAST_UPDATE_TAB: "_gitoqlik",
    SCRIPT_LAST_UPDATE_TAB_V2: "_gitoqlok",
    SCRIPT_TABS_ORDER_DIVIDER: "%tab_order_divider%",
    SCRIPT_TABS_ORDER_DIVIDER_V2: "%tab_file_order_divider%",
    get storedAppObjects(){
        return ["properties", "sheets", "stories", "masterobjects", "appprops", "dimensions", "snapshots",
            "bookmarks", "measures", "fields", "variables", "alternatestates"]
    }
};

const Utils = {
    getTabNameFromScript: function (script) {
        const dividerIndex = script.indexOf(Options.SCRIPT_TABS_DIVIDER);
        if (dividerIndex === -1) {
            return null;
        }

        let newLineIndex = script.indexOf("\n", dividerIndex);
        if (newLineIndex === -1) {
            newLineIndex = script.length;
        }

        let tabNamesIndex = dividerIndex;
        return script.substring(tabNamesIndex + 8, newLineIndex).trim();
    },
    getIndicesOf: function (searchStr, str, caseSensitive) {
        let searchStrLen = searchStr.length;
        if (searchStrLen == 0) {
            return [];
        }
        let startIndex = 0, index, indices = [];
        if (!caseSensitive) {
            str = str.toLowerCase();
            searchStr = searchStr.toLowerCase();
        }
        while ((index = str.indexOf(searchStr, startIndex)) > -1) {
            indices.push(index);
            startIndex = index + searchStrLen;
        }
        return indices;
    },
    SplitScriptToTabs: function (script, fileName) {
        if (!script) {
            return {tabNames: [], tabContents: []};
        }
        let tabContents = script.split(Options.SCRIPT_TABS_DIVIDER);
        tabContents.shift();

        // Add TAB_DILIMETER, removed due split
        tabContents.forEach(function (part, index) {
            this[index] = (Options.SCRIPT_TABS_DIVIDER + this[index]).trim();
        }, tabContents);

        let tabNamesIndices = this.getIndicesOf(Options.SCRIPT_TABS_DIVIDER, script);
        let tabNames = [];
        let includeFileName = (tabNamesIndices.length > 1 && fileName) ? ` (${fileName})` : "";

        for (let i = 0; i < tabNamesIndices.length; i++) {
            let tabNameIndex = tabNamesIndices[i];
            let tabName = script.substring(tabNameIndex + 8, script.indexOf("\n", tabNameIndex)).trim();
            if (tabName === Options.SCRIPT_LAST_UPDATE_TAB || tabName === Options.SCRIPT_LAST_UPDATE_TAB_V2) {
                tabContents.splice(i, 1);
                continue;
            }
            tabNames.push(tabName + includeFileName);
        }

        return {tabNames: tabNames, tabContents: tabContents};
    },
    sortBlueprintItems: function(blueprint) {
        function getSortFunction(idPath) {
            return function (a, b) {
                let textA = a;
                idPath.forEach(pathItem => {
                    textA = textA[pathItem];
                });

                let textB = b;
                idPath.forEach(pathItem => {
                    textB = textB[pathItem];
                });

                return (textA < textB) ? -1 : (textA > textB) ? 1 : 0;
            };
        }

        blueprint.appprops && blueprint.appprops.sort(getSortFunction(["qProperty", "qInfo", "qId"]));
        blueprint.bookmarks && blueprint.bookmarks.sort(getSortFunction(["qInfo", "qId"]));
        blueprint.dimensions && blueprint.dimensions.sort(getSortFunction(["qInfo", "qId"]));
        blueprint.fields && blueprint.fields.sort(getSortFunction(["qName"]));
        blueprint.masterobjects && blueprint.masterobjects.sort(getSortFunction(["qProperty", "qInfo", "qId"]));
        blueprint.measures && blueprint.measures.sort(getSortFunction(["qInfo", "qId"]));
        blueprint.sheets && blueprint.sheets.sort(getSortFunction(["qProperty", "qInfo", "qId"]));
        blueprint.snapshots && blueprint.snapshots.sort(getSortFunction(["qInfo", "qId"]));
        blueprint.stories && blueprint.stories.sort(getSortFunction(["qProperty", "qInfo", "qId"]));
        blueprint.variables && blueprint.variables.sort(getSortFunction(["qInfo", "qId"]));
        blueprint.alternatestates && blueprint.alternatestates.sort();
        return blueprint;
    }
}

const getFolderRecursive = function(folderName, opts) {
    return new Promise((resolve, reject) => {
        const workFolder = path.resolve(`./`);

        const walk = function(dir, done) {
            let results = [];
            fs.readdir(dir, function(err, list) {
                if (err) return done(err);
                let pending = list.length;
                if (!pending) return done(null, results);
                list.forEach(function(file) {

                    let fileFullPath = path.resolve(dir, file);
                    fs.stat(fileFullPath, function(err, stat) {
                        if (stat && stat.isDirectory()) {
                            if (opts.excludeFolders && opts.excludeFolders.indexOf(file) > -1) {
                                if (!--pending) done(null, results);
                            } else {
                                walk(fileFullPath, function (err, res) {
                                    results = results.concat(res);
                                    if (!--pending) done(null, results);
                                });
                            }
                        } else {
                            results.push(
                                {
                                    path: fileFullPath.replace(`${workFolder}/`, ``)
                                });
                            if (!--pending) done(null, results);
                        }
                    });

                });
            });
        };

        walk(folderName, (err, res) => {
            if (err) {
                return reject(err);
            }
            return resolve(res);
        })
    });
}

const getAppData = function() {
    return new Promise((resolve, reject) => {
        getFolderRecursive(`./`, {excludeFolders: `.git`})
        .then((tree) => {
            let fileList = Options.storedAppObjects;

            let isDataLoadScriptsExists = false;
            // Backward compatibility with single script.qvs file
            let isBackwardCompatibility = false;

            /**
             *   Filtering a tree, will fetch only gitoqlok-files
             * **/
            tree.forEach(file => {
                if (file.path.indexOf(".qvs") > -1) {
                    if (file.path.indexOf(Options.REPOSITORY_SCRIPT_FOLDER + "/") > -1) {
                        isDataLoadScriptsExists = true;
                    }
                    return fileList.push(file);
                }

                if (file.path === Options.SCRIPT_TABS_ORDER_FILEPATH) {
                    return fileList.push(file);
                }

                // backward compatibility for old sheets store
                if (file.path === `${Options.REPOSITORY_OBJECTS_FOLDER}/sheets.json`) {
                    return fileList.push(file);
                }

                if (file.path.startsWith(`${Options.REPOSITORY_APPCONTENT_FOLDER}/`)) {
                    return fileList.push(file);
                }

                if (file.path.startsWith(`${Options.REPOSITORY_TASKS_FOLDER}/`)) {
                    return fileList.push(file);
                }

                // Add all files from the app objects folder
                if (file.path.startsWith(`${Options.REPOSITORY_OBJECTS_FOLDER}/`)) {
                    return fileList.push(file);
                }
            });

            //backward compatibility if no data_load_script folder in repo
            if (!isDataLoadScriptsExists) {
                isBackwardCompatibility = true;
            }

            log(`Blueprint file list: `, fileList);
            Promise.all(fileList.map(function (fileData) {
                let file = fileData.path || fileData;

                let isBinary = file.startsWith(`${Options.REPOSITORY_APPCONTENT_FOLDER}/`);
                let name = "";
                if (//file.startsWith(`${Options.REPOSITORY_SHEETS_FOLDER}/`)
                    file.indexOf(".qvs") > -1
                    || file === Options.SCRIPT_TABS_ORDER_FILEPATH
                    || isBinary
                    || file === `${Options.REPOSITORY_OBJECTS_FOLDER}/sheets.json`
                    || file.startsWith(`${Options.REPOSITORY_TASKS_FOLDER}/`)) {
                    name = file;
                } else if (file.startsWith(`${Options.REPOSITORY_OBJECTS_FOLDER}/`)) {
                    // Check if given object type is presented in Custom File List
                    let objectType = file.replace(`${Options.REPOSITORY_OBJECTS_FOLDER}/`, ``);
                    let nextSlashIndex = objectType.indexOf(`/`);

                    if (nextSlashIndex === -1) {
                        // Case non-splitted appprops, properties.json files
                        nextSlashIndex = objectType.indexOf(`.json`)
                    }

                    objectType = objectType.substring(0, nextSlashIndex);
                    if (fileList.indexOf(objectType) > -1) {
                        name = file;
                    }
                }

                // Check if fileList item (from objects/ folder) exists in the repository tree
                if (!name.length || !tree.find(treeItem => treeItem.path === name)) {
                    return Promise.resolve();
                }

                return readFile(name, isBinary, fileData)
                    .then(data => {
                        if (!data) {
                            return Promise.resolve();
                        }

                        return Promise.resolve({
                            name: name.substring(name.lastIndexOf("/") + 1),
                            path: name,
                            content: data
                        });
                    })
                    .catch(error => {
                        return Promise.reject(error);
                    });
            })).then(function (list) {
                let result = {
                    qvs: {
                        loadScript: {
                            tabs: [],
                            content: [],
                            fileNames: []
                        },
                        foundScript: {
                            tabs: [],
                            content: []
                        }
                    },
                    blueprintObjectList: {qInfos: []}
                };
                let tabOrder = null;
                // Determine if old repository that uses tab names in tab_order.txt file
                let isOldTabOrderVersion = false;
                list.forEach(function (file) {
                    if (!file) {
                        return;
                    }

                    let content = file.content;
                    if (typeof content === "string") {
                        content = content.trim();
                    }

                    let fileName = file.name || file.file_name;
                    let filePath = file.path || file.file_path;
                    if (fileName.endsWith(".qvs")) {
                        if (filePath.startsWith(Options.REPOSITORY_SCRIPT_FOLDER)) {
                            // Default load script for commits and pull
                            let tabName = Utils.getTabNameFromScript(content);
                            result.qvs.loadScript.tabs.push(tabName);
                            result.qvs.loadScript.content.push(content);
                            let fileNameWithoutExtension = fileName.substring(0, fileName.lastIndexOf(".qvs"));
                            result.qvs.loadScript.fileNames.push(fileNameWithoutExtension);
                        } else {
                            if (isBackwardCompatibility && fileName === "script.qvs") {
                                let {tabNames, tabContents} = Utils.SplitScriptToTabs(content, fileName);
                                result.qvs.loadScript.tabs = result.qvs.loadScript.tabs.concat(tabNames);
                                result.qvs.loadScript.content = result.qvs.loadScript.content.concat(tabContents);
                            } else {
                                let {tabNames, tabContents} = Utils.SplitScriptToTabs(content, fileName);
                                if (tabNames.length === 0) {
                                    // If .qvs file does not contains tab name, add tab name from file name
                                    let tabNameFromFile = fileName.replace(".qvs", "");
                                    result.qvs.foundScript.tabs.push(tabNameFromFile);
                                    result.qvs.foundScript.content.push(Options.SCRIPT_TABS_DIVIDER + tabNameFromFile + "\n" + content);
                                } else if (tabNames.length === 1) {
                                    // Perfomance improvement - no need to concatenate arrays, use push
                                    result.qvs.foundScript.tabs.push(tabNames[0]);
                                    result.qvs.foundScript.content.push(tabContents[0]);
                                } else {
                                    result.qvs.foundScript.tabs = result.qvs.foundScript.tabs.concat(tabNames);
                                    result.qvs.foundScript.content = result.qvs.foundScript.content.concat(tabContents);
                                }
                            }
                        }
                    } else if (filePath === Options.SCRIPT_TABS_ORDER_FILEPATH) {
                        isOldTabOrderVersion = content.indexOf(Options.SCRIPT_TABS_ORDER_DIVIDER) > -1;
                        if (isOldTabOrderVersion) {
                            return tabOrder = content.split(Options.SCRIPT_TABS_ORDER_DIVIDER).filter(item => item !== "_gitoqlik");
                        } else {
                            return tabOrder = content.split(Options.SCRIPT_TABS_ORDER_DIVIDER_V2).filter(item => item !== "_gitoqlik");
                        }
                    } else if (filePath === `${Options.REPOSITORY_OBJECTS_FOLDER}/sheets.json`) {
                        result["sheets"] = content;
                    } else if (filePath.endsWith(".json") && filePath.startsWith(`${Options.REPOSITORY_OBJECTS_FOLDER}/`)) {
                        let objectType = filePath.replace(`${Options.REPOSITORY_OBJECTS_FOLDER}/`, ``);
                        let nextSlashIndex = objectType.indexOf(`/`);

                        if (nextSlashIndex === -1) {
                            // Case non-splitted appprops, blueprintObjectList, properties.json files
                            // and backward compatibility with non-splitted old commits
                            nextSlashIndex = objectType.indexOf(`.json`)
                            objectType = objectType.substring(0, nextSlashIndex);

                            // Skip stored blueprintObjectList
                            if (objectType !== `blueprintObjectList`) {
                                result[objectType] = content;
                            }

                            // On-fly generating blueprintObjectList
                            switch(objectType) {
                                case `snapshots`:
                                case `measures`:
                                case `dimensions`:
                                case `bookmarks`:
                                    content.forEach(item => {
                                        result.blueprintObjectList.qInfos.push({
                                            qId: item.qInfo.qId,
                                            qType: item.qInfo.qType
                                        });
                                    });
                                    break;
                                case `stories`:
                                case `sheets`:
                                case `masterobjects`:
                                    content.forEach(item => {
                                        result.blueprintObjectList.qInfos.push({
                                            qId: item.qProperty.qInfo.qId,
                                            qType: item.qProperty.qInfo.qType
                                        });
                                    });
                                    break;
                                default:
                                    break;
                            }
                        } else {
                            objectType = objectType.substring(0, nextSlashIndex);

                            if (typeof result[objectType] === "undefined") {
                                result[objectType] = [];
                            }

                            result[objectType].push(content);

                            // On-fly generating blueprintObjectList
                            switch(objectType) {
                                case `snapshots`:
                                case `measures`:
                                case `dimensions`:
                                case `bookmarks`:
                                    result.blueprintObjectList.qInfos.push({
                                        qId: content.qInfo.qId,
                                        qType: content.qInfo.qType
                                    });
                                    break;
                                case `stories`:
                                case `sheets`:
                                case `masterobjects`:
                                    result.blueprintObjectList.qInfos.push({
                                        qId: content.qProperty.qInfo.qId,
                                        qType: content.qProperty.qInfo.qType
                                    });
                                    break;
                                default:
                                    break;
                            }
                        }
                    } else if (filePath === "README.md") {
                        result.README = content;
                    } else if (filePath.startsWith(`${Options.REPOSITORY_APPCONTENT_FOLDER}/`)) {
                        if (!result.appcontent) {
                            result.appcontent = [];
                        }
                        result.appcontent.push(file);
                    } else if (filePath.startsWith(`${Options.REPOSITORY_TASKS_FOLDER}/`)) {
                        let field = "tasks";
                        if (fileName.startsWith("tasks")) {
                            field = "tasks"
                        } else if (fileName.startsWith("dataconnections")) {
                            field = "dataconnections";
                        }
                        result[field] = content;
                    }
                });
                // Order tabs
                if (tabOrder !== null) {
                    let orderedLoadScript = {
                        tabs: [],
                        content: []
                    };
                    // Store used indexes for ordering, to avoid duplicate content for tabs with the same name
                    let usedIndexes = [];
                    tabOrder.forEach(orderTabFileName => {
                        if (isOldTabOrderVersion) {
                            // Backward capability in case when tabOrder contain tab names
                            // instead of file names
                            let currentTabIndex = result.qvs.loadScript.tabs.indexOf(orderTabFileName);

                            while (usedIndexes.indexOf(currentTabIndex) > -1) {
                                currentTabIndex = result.qvs.loadScript.tabs.indexOf(orderTabFileName, currentTabIndex + 1);
                            }
                            usedIndexes.push(currentTabIndex);

                            orderedLoadScript.tabs.push(orderTabFileName);
                            orderedLoadScript.content.push(result.qvs.loadScript.content[currentTabIndex]);
                        } else {
                            let currentTabFileIndex = result.qvs.loadScript.fileNames.indexOf(orderTabFileName);
                            orderedLoadScript.tabs.push(result.qvs.loadScript.tabs[currentTabFileIndex]);
                            orderedLoadScript.content.push(result.qvs.loadScript.content[currentTabFileIndex]);
                        }
                    });
                    delete result.qvs.loadScript;
                    result.qvs.loadScript = orderedLoadScript;
                }

                if (result.qvs.loadScript.content.length) {
                    result.script = result.qvs.loadScript.content.join("\n");
                }

                // Add all default fields
                Options.storedAppObjects.forEach(storedObject => {
                    if (!result[storedObject]) {
                        if (storedObject === "properties") {
                            result[storedObject] = {};
                            return;
                        }
                        result[storedObject] = [];
                    }
                });

                Utils.sortBlueprintItems(result);
                return resolve(result);
            })
            .catch(function (error) {
                    return reject(error);
            })
        })
    });
}

module.exports = {
    getAppData
}