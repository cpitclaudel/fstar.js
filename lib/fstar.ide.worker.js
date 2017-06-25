function FStarIDEWorker(self, FStarWorkerUtils, FStarIDEProtocol) {
    var driver = null, ide = null;
    var utils = FStarWorkerUtils(self, FStarIDEProtocol);

    var messages = {
        ready: utils.postMessage(FStarIDEProtocol.Worker.READY),
        progress: utils.postMessage(FStarIDEProtocol.Worker.PROGRESS),
        message: utils.postMessage(FStarIDEProtocol.Worker.MESSAGE),
        response: utils.postMessage(FStarIDEProtocol.Worker.RESPONSE),
        exit: utils.postMessage(FStarIDEProtocol.Worker.EXIT)
    };

    function onMessage (event) {
        var kind = event.data.kind;
        var payload = event.data.payload;
        switch (kind) {
        case FStarIDEProtocol.Client.INIT:
            ide = driver.ide.newIDE(payload.fname, payload.fcontents,
                                    payload.args, messages.message);
            break;
        case FStarIDEProtocol.Client.SAVE:
            ide.updateFile(payload.fcontents);
            break;
        case FStarIDEProtocol.Client.QUERY:
            ide.eval(payload, messages.response);
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

self.importScripts("./fstar.ide.protocol.js");
self.importScripts("./fstar.utils.js");

/* global self FStarIDEProtocol FStarWorkerUtils */
FStarIDEWorker(self, FStarWorkerUtils, FStarIDEProtocol).init();
