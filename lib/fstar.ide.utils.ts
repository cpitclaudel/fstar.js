"use strict";
/* global FStar */

FStar.IDE = FStar.IDE || {};
FStar.IDE.Utils = FStar.IDE.Utils || {};

(function () {
    var Utils = FStar.IDE.Utils;

    Utils.mkQuery = function(qid, query, args) {
        return { "query-id": qid,
                 "query": query,
                 "args": args };
    };

    Utils.mkPush = function(qid, kind, code, line, column) {
        return Utils.mkQuery(qid, "push", { "kind": kind, "code": code,
                                            "line": line, "column": column });
    };

    Utils.mkPop = function(qid) {
        return Utils.mkQuery(qid, "pop", {});
    };
}());
