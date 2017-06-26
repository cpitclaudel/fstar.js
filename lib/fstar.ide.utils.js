"use strict";
/* global FStar:true */
FStar = FStar || {};
FStar.IDE = FStar.IDE || {};
FStar.IDE.Utils = FStar.IDE.Utils || {};

(function () {
    var Utils = FStar.IDE.Utils;
    Utils.mkQuery = function(qid, query, args) {
        return { "query-id": qid,
                 "query": query,
                 "args": args };
    };

    Utils.mkPush = function(qid, kind, code) {
        return Utils.mkQuery(qid, "push", { "kind": kind,
                                      "code": code,
                                      "line": 0, "column": 0 });
    };

    Utils.mkPop = function(qid) {
        return Utils.mkQuery(qid, "pop", {});
    };
}());
