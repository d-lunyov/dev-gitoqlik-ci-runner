const fs = require("fs");
const path = require("path");
const log = require(`./logger`).log;

const getFolderRecursive = function(folderName) {
    return new Promise((resolve, reject) => {
        const walk = function(dir, done) {
            let results = [];
            fs.readdir(dir, function(err, list) {
                if (err) return done(err);
                let pending = list.length;
                if (!pending) return done(null, results);
                list.forEach(function(file) {
                    console.log(`before: ${file}`);
                    file = path.resolve(dir, file);
                    console.log(`after: ${file}`);
                    fs.stat(file, function(err, stat) {
                        if (stat && stat.isDirectory()) {
                            walk(file, function(err, res) {
                                results = results.concat(res);
                                if (!--pending) done(null, results);
                            });
                        } else {
                            results.push(
                                {
                                    path: file
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

getFolderRecursive(`./`)
.then(data => {
    //console.log(data);
    console.log(path.resolve(`./`));
})

