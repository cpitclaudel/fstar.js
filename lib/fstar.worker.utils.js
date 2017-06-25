function FStarWorkerUtils(self) { /* exported FStarWorkerUtils */
    function postMessage(kind) {
        return function(payload) {
            self.postMessage({ kind: kind, payload: payload });
        }
    }

    function loadFStar() {
        self.importScripts("../build/js/fstar.core.js",
                           "../build/js/fstar.stdlib.js");
        self.importScripts("../lib/fstar.driver.js");
        return FStarDriver; /* global FStarDriver */
    }

    return { loadFStar: loadFStar,
             postMessage: postMessage };
}
