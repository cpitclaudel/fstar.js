"use strict";
/* global FStar:true */
FStar.IDE = FStar.IDE || {};
FStar.IDE.Protocol = {
    Client: { INIT: "INIT", QUERY: "QUERY", SAVE: "SAVE" },
    Worker: { PROGRESS: "PROGRESS", READY: "READY",
              MESSAGE: "MESSAGE", RESPONSE: "RESPONSE", EXIT: "EXIT" } };
