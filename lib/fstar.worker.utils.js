"use strict";
/* global self FStar: true */

FStar.WorkerUtils = FStar.WorkerUtils || {};

(function () {
    var WorkerUtils = FStar.WorkerUtils;

    WorkerUtils.DEBUG = true;
    WorkerUtils.debug = function() {
        WorkerUtils.DEBUG && console.debug.apply(console, arguments);
    };

    WorkerUtils.postMessage = function(kind) {
        return function(payload) {
            self.postMessage({ kind: kind, payload: payload });
        };
    };

    WorkerUtils.loadBinaries = function () {
        self.importScripts("./fstar.core.js",
                           "./fstar.driver.js",
                           "./z3smt2w.js",
                           "./fstar.smtdriver.js");
    };

    WorkerUtils.assert = function(condition, message) {
        if (!condition) {
            throw (message || "assertion failed");
        }
    };

    WorkerUtils.fetchSync = function fetchSync(url, responseType) {
        var xhr = new XMLHttpRequest();
        xhr.responseType = responseType;
        xhr.open("GET", url, false);
        xhr.send(null);
        if (xhr.status != 200) {
            throw "Failed to download " + url;
        }
        return xhr.response;
    };

    WorkerUtils.fetchAsync = function fetchAsync(url, responseType, onProgress, onLoad) {
        var xhr = new XMLHttpRequest();
        xhr.responseType = responseType;
        xhr.addEventListener("progress", onProgress);
        xhr.addEventListener("load", function () {
            if (xhr.status != 200) {
                throw "Failed to download " + url;
            }
            onLoad(xhr.response);
        });
        xhr.open("GET", url, true);
        xhr.send(null);
    };
}());
