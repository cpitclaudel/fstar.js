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
}());
