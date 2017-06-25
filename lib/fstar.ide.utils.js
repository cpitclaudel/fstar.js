/* exported FStarIDEUtils */
var FStarIDEUtils = (function() {
    function mkQuery(qid, query, args) {
        return { "query-id": qid,
                 "query": query,
                 "args": args };
    }

    function mkPush(qid, kind, code) {
        return mkQuery(qid, "push", { "kind": kind,
                                      "code": code,
                                      "line": 0, "column": 0 });
    }

    function mkPop(qid) {
        return mkQuery(qid, "pop", {});
    }

    return { mkQuery: mkQuery,
             mkPush: mkPush,
             mkPop: mkPop }
}());

/* global module */
if (typeof(module) !== "undefined" && module.hasOwnProperty("exports")) {
    module.exports = FStarIDEUtils;
}
