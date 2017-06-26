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

    WorkerUtils.loadFStar = function () {
        self.importScripts("../build/js/fstar.core.js",
                           "../build/js/fstar.stdlib.js");
        self.importScripts("../lib/fstar.driver.js");
    };
}());
