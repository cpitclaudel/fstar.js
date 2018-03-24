"use strict";
/* global self FStar */

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

    function Instance() {
        var _this = this;

        this.ide = null;
        this.queue = [];
        this.ready = false;
        self.onmessage = function (message) { _this.onMessage(message); };

        messages.progress("Downloading and initializing F*…");
        FStar.WorkerUtils.loadBinaries();
        messages.progress("Downloading and initializing Z3…");
        FStar.Driver.initSMT(function () { _this.smtInitialized(); });
        // We need a queue because Emscripten's initialization is asynchronous,
        // so we can't just start processing requests as they come.
    }

    Instance.prototype.smtInitialized = function() {
        messages.progress(null);
        messages.ready();
        this.ready = true;
        this.processMessages();
    };

    Instance.prototype.processMessage = function(message) {
        var kind = message.kind;
        var payload = message.payload;
        switch (kind) {
        case Protocol.Client.INIT:
            this.ide = new FStar.Driver.IDE(payload.fname, payload.fcontents,
                                            payload.args, { message: messages.message,
                                                            progress: messages.progress });
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

    Instance.prototype.processMessages = function() {
        if (this.ready) {
            var _this = this;
            this.queue.forEach(function(msg) { _this.processMessage(msg); });
            this.queue = [];
        }
    };

    Instance.prototype.onMessage = function(event) {
        this.queue.push(event.data);
        this.processMessages();
    };

    FStar.IDE.Worker.instance = null;
    FStar.IDE.Worker.run = function () {
        FStar.IDE.Worker.instance = FStar.IDE.Worker.instance || new Instance();
    };
}());

FStar.IDE.Worker.run();
