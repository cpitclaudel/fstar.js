function FStarAsyncWorker(self, FStarProtocol) {
    var driver = null;

    function postMessage(kind, payload) {
        self.postMessage({ kind: kind, payload: payload });
    }

    var messages = {
        progress: function(message) {
            postMessage(FStarProtocol.Worker.PROGRESS, message);
        },

        ready: function() {
            postMessage(FStarProtocol.Worker.READY);
        },

        stdout: function(line) {
            postMessage(FStarProtocol.Worker.STDOUT, line);
        },

        stderr: function(line) {
            postMessage(FStarProtocol.Worker.STDERR, line);
        },

        verification_complete: function(exit_code) {
            postMessage(FStarProtocol.Worker.VERIFICATION_COMPLETE, exit_code);
        }
    };

    function verify(fname, fcontents, args) {
        var retv = driver.verify(fname, fcontents, args, messages.stdout, messages.stderr);
        messages.verification_complete(retv);
    }

    function onMessage (event) {
        var kind = event.data.kind;
        var payload = event.data.payload;
        switch (kind) {
        case FStarProtocol.Client.VERIFY:
            verify(payload.fname, payload.fcontents, payload.args);
            break;
        }
    }

    function loadFStar() {
        messages.progress("Downloading and initializing F*…");
        self.importScripts("../build/js/fstar.core.js",
                           "../build/js/fstar.stdlib.js");
        self.importScripts("../lib/fstar.driver.js");
        driver = FStar; /* global FStar */
    }

    function init() {
        loadFStar();
        self.onmessage = onMessage;
        messages.ready();
    }

    return { init: init };
}

/* global self FStarProtocol */
self.importScripts("./fstar.async.protocol.js");
FStarAsyncWorker(self, FStarProtocol).init();
