/* global require global FStar */

var fs = require("fs");
var path = require("path");
process.chdir(path.resolve(__dirname, "../dist/"));

function bufferToArrayBuffer(b) {
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
}

function convertReponse(responseType, responseBuffer) {
    if (responseType == 'arraybuffer') {
        return bufferToArrayBuffer(responseBuffer);
    } else if (responseType == 'json') {
        return JSON.parse(responseBuffer.toString('utf-8'));
    } else {
        throw `Unsupported: ${responseType}`;
    }
}

function fetchSync(url, responseType) {
    var contents = fs.readFileSync(url);
    return convertReponse(responseType, contents);
}

function fetchAsync(url, responseType, onProgress, onLoad) {
    onLoad(fetchSync(url, responseType));
}

global.JSOO_FStar = function(obj) {
    var JSOO_FStar = require("../build/js/fstar.core.js");
    return JSOO_FStar(obj);
};

global.underscore = require("../vendor/underscore-min.js");
global.Z3 = require("../vendor/z3.wasm/z3smt2w.js");
require("../lib/fstar.global-object.js");
require("../lib/fstar.worker.utils.js");
FStar.WorkerUtils.DEBUG = false;
FStar.WorkerUtils.fetchSync = fetchSync;
FStar.WorkerUtils.fetchAsync = fetchAsync;
require("../lib/fstar.driver.js");
require("../lib/fstar.ide.utils.js");
require("../lib/fstar.smtdriver.js");

module.exports = FStar;

