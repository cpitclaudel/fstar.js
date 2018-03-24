"use strict";
/* global self FStar */

self.importScripts("./fstar.global-object.js");
self.importScripts("./fstar.cli.protocol.js");
self.importScripts("./fstar.worker.utils.js");

FStar.CLI = FStar.CLI || {};
FStar.CLI.Worker = FStar.CLI.Worker || {};

(function () {
    var Protocol = FStar.CLI.Protocol;

    var messages = {
        ready: FStar.WorkerUtils.postMessage(Protocol.Worker.READY),
        progress: FStar.WorkerUtils.postMessage(Protocol.Worker.PROGRESS),
        stdout: FStar.WorkerUtils.postMessage(Protocol.Worker.STDOUT),
        stderr: FStar.WorkerUtils.postMessage(Protocol.Worker.STDERR),
        verification_complete: FStar.WorkerUtils.postMessage(Protocol.Worker.VERIFICATION_COMPLETE)
    };

    function Instance() {
        var _this = this;

        this.queue = [];
        this.ready = false;
        self.onmessage = function (message) { _this.onMessage(message); };

        messages.progress("Downloading and initializing F*…");
        FStar.WorkerUtils.loadBinaries();
        FStar.Driver.initSMT(function () { _this.smtInitialized(); });
        // We need a queue because Emscripten's initialization is asynchronous,
        // so we can't just start processing requests as they come.
    }

    Instance.prototype.smtInitialized = function() {
        messages.ready();
        this.ready = true;
        this.processMessages();
    };

    Instance.prototype.verify = function(fname, fcontents, args) {
        var retv = FStar.Driver.CLI.verify(fname, fcontents, args, messages.stdout, messages.stderr, true);
        messages.verification_complete(retv);
    };

    Instance.prototype.processMessage = function(message) {
        var kind = message.kind;
        var payload = message.payload;
        switch (kind) {
        case Protocol.Client.VERIFY:
            this.verify(payload.fname, payload.fcontents, payload.args);
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

    FStar.CLI.Worker.instance = null;
    FStar.CLI.Worker.run = function () {
        FStar.CLI.Worker.instance = FStar.CLI.Worker.instance || new Instance();
    };
}());

FStar.CLI.Worker.run();
