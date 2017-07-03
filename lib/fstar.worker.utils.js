"use strict";
/* global self FStar: true */

FStar.WorkerUtils = FStar.WorkerUtils || {};

(function () {
    var WorkerUtils = FStar.WorkerUtils;

    WorkerUtils.postMessage = function(kind) {
        return function(payload) {
            self.postMessage({ kind: kind, payload: payload });
        };
    };

    WorkerUtils.loadBinaries = function () {
        self.importScripts("./fstar.core.js", "./fstar.stdlib.js", "./fstar.driver.js",
                           "./z3-wasm.core.js", "./fstar.smtdriver.js");
    };

    WorkerUtils.assert = function(condition, message) {
        if (!condition) {
            throw (message || "assertion failed");
        }
    };
}());
