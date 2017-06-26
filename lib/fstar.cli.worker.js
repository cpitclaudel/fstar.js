"use strict";
/* global self FStar:true */

self.importScripts("../lib/fstar.global-object.js");
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

    messages.progress("Downloading and initializing F*…");
    FStar.WorkerUtils.loadFStar();

    function Instance() {
        var _this = this;
        self.onmessage = function(msg) { return _this.onMessage(msg); };
        messages.ready();
    }

    Instance.prototype.verify = function(fname, fcontents, args) {
        var retv = FStar.Driver.CLI.verify(fname, fcontents, args, messages.stdout, messages.stderr, true);
        messages.verification_complete(retv);
    };

    Instance.prototype.onMessage = function(event) {
        var kind = event.data.kind;
        var payload = event.data.payload;
        switch (kind) {
        case Protocol.Client.VERIFY:
            this.verify(payload.fname, payload.fcontents, payload.args);
            break;
        }
    };

    FStar.CLI.Worker.instance = null;
    FStar.CLI.Worker.run = function () {
        FStar.CLI.Worker.instance = FStar.CLI.Worker.instance || new Instance();
    };
}());

FStar.CLI.Worker.run();
