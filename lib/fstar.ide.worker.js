"use strict";
/* global self FStar:true */

self.importScripts("./fstar.global-object.js");
self.importScripts("./fstar.ide.protocol.js");
self.importScripts("./fstar.worker.utils.js");

FStar.IDE = FStar.IDE || {};
FStar.IDE.Worker = FStar.IDE.Worker || {};

(function () {
    var Protocol = FStar.IDE.Protocol;

    var messages = {
        ready: FStar.WorkerUtils.postMessage(Protocol.Worker.READY),
        progress: FStar.WorkerUtils.postMessage(Protocol.Worker.PROGRESS),
        message: FStar.WorkerUtils.postMessage(Protocol.Worker.MESSAGE),
        response: FStar.WorkerUtils.postMessage(Protocol.Worker.RESPONSE),
        exit: FStar.WorkerUtils.postMessage(Protocol.Worker.EXIT)
    };

    messages.progress("Downloading and initializing F*…");
    FStar.WorkerUtils.loadFStar();

    function Instance() {
        this.ide = null;
        var _this = this; // No need to load _.js for just one _.bind
        self.onmessage = function (message) { _this.onMessage(message); };
        messages.ready();
    }

    Instance.prototype.onMessage = function(event) {
        var kind = event.data.kind;
        var payload = event.data.payload;
        switch (kind) {
        case Protocol.Client.INIT:
            this.ide = new FStar.Driver.IDE(payload.fname, payload.fcontents,
                                            payload.args, messages.message);
            break;
        case Protocol.Client.UPDATE_CONTENTS:
            this.ide.updateFile(payload.fcontents);
            break;
        case Protocol.Client.QUERY:
            this.ide.eval(payload, messages.response);
            break;
        default:
            FStar.WorkerUtils.assert(false);
        }
    };

    FStar.IDE.Worker.instance = null;
    FStar.IDE.Worker.run = function () {
        FStar.IDE.Worker.instance = FStar.IDE.Worker.instance || new Instance();
    };
}());

FStar.IDE.Worker.run();
