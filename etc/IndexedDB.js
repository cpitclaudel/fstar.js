// Draft code to be added to fstar.smtdriver.js once Chrome supports serializing
// compiled WebAssembly modules to IndexedDB.

function fetchWasmBinaryAsync(url, onProgress) {
    return new Promise(function(resolve, _reject) {
        var xhr = new XMLHttpRequest();
        xhr.responseType = 'arraybuffer';
        xhr.addEventListener("progress", function (evt) {
            if (evt.lengthComputable) {
                var percentLoaded = evt.loaded / evt.total * 100;
                onProgress(`Downloading Z3 (${percentLoaded.toFixed(2)}%)…`);
            }
        });
        xhr.addEventListener("load", function () {
            if (xhr.status != 200) {
                throw "Failed to download " + url;
            }
            resolve(xhr.response);
        });
        xhr.open("GET", url, true);
        xhr.send(null);
    });
}

var WASM_CACHE_NAME = 'F*.js/wasmCache';
var WASM_CACHE_VERSION = 1;

function initWasmCache(mode) {
    return new Promise(function(resolve, reject) {
        var request = indexedDB.open(WASM_CACHE_NAME, WASM_CACHE_VERSION);
        request.onerror = function() {
            console.log("Failed to initialize the WASM cache");
            reject();
        };
        request.onsuccess = function() {
            var db = request.result;
            var store = db.transaction(WASM_CACHE_NAME, mode).objectStore(WASM_CACHE_NAME);
            resolve(store);
        };
        request.onupgradeneeded = function(_event) {
            var db = request.result;
            if (db.objectStoreNames.contains(WASM_CACHE_NAME)) {
                console.log("Deleting outdated WASM cache");
                db.deleteObjectStore(WASM_CACHE_NAME);
            }
            db.createObjectStore(WASM_CACHE_NAME);
        };
    });
}

function readFromWasmCache(url) {
    return initWasmCache("readonly").then(function(store) {
        return new Promise(function(resolve, reject) {
            var request = store.get(url);
            request.onerror = function() {
                console.log('Failed to read from WASM cache');
                reject(null);
            };
            request.onsuccess = function(_evt) {
                if (request.result) {
                    resolve(request.result);
                } else {
                    console.log('No usable WASM cache found');
                    reject(null);
                }
            };
        });
    });
}

function writeToWasmCache(url, module) {
    return initWasmCache("readwrite").then(function(store) {
        return new Promise(function(resolve, reject) {
            var request = store.put(module, url);
            request.onerror = function(err) {
                console.log(`Could not write to WASM cache (${err})`); reject(null); };
            request.onsuccess = function() {
                console.log(`Saved ${url} to WASM cache`); resolve(module); };
        });
    });
}

function fetchWasmModuleAsync(url, onProgress, onLoad) {
    return readFromWasmCache(url)
        .catch(function() {
            return fetchWasmBinaryAsync(url, onProgress)
                .then(function(wasmBinary) {
                    onProgress('Compiling Z3…');
                    var start = performance.now();
                    var module = new WebAssembly.Module(wasmBinary);
                    var elapsed = (performance.now() - start) / 1000;
                    console.log(`Compiled Z3 in ${elapsed.toFixed(2)}s`);
                    return module;
                })
                .then(function(module) {
                    return writeToWasmCache(url, module);
                });
        })
        .then(onLoad);
}
