function FStarCLIWorker(self, FStarWorkerUtils, FStarCLIProtocol) {
    var driver = null;
    var utils = FStarWorkerUtils(self);

    var messages = {
        ready: utils.postMessage(FStarCLIProtocol.Worker.READY),
        progress: utils.postMessage(FStarCLIProtocol.Worker.PROGRESS),
        stdout: utils.postMessage(FStarCLIProtocol.Worker.STDOUT),
        stderr: utils.postMessage(FStarCLIProtocol.Worker.STDERR),
        verification_complete: utils.postMessage(FStarCLIProtocol.Worker.VERIFICATION_COMPLETE)
    };

    function verify(fname, fcontents, args) {
        var retv = driver.verify(fname, fcontents, args, messages.stdout, messages.stderr);
        messages.verification_complete(retv);
    }

    function onMessage (event) {
        var kind = event.data.kind;
        var payload = event.data.payload;
        switch (kind) {
        case FStarCLIProtocol.Client.VERIFY:
            verify(payload.fname, payload.fcontents, payload.args);
            break;
        }
    }

    function init() {
        messages.progress("Downloading and initializing F*…");
        driver = utils.loadFStar();
        self.onmessage = onMessage;
        messages.ready();
    }

    return { init: init };
}

self.importScripts("./fstar.cli.protocol.js");
self.importScripts("./fstar.utils.js");

/* global self FStarCLIProtocol FStarWorkerUtils */
FStarCLIWorker(self, FStarWorkerUtils, FStarCLIProtocol).init();
