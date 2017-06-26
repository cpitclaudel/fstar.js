"use strict";
/* global FStar:true */
FStar.IDE = FStar.IDE || {};
FStar.IDE.Protocol = {
    Client: { INIT: "INIT", QUERY: "QUERY",
              UPDATE_CONTENTS: "UPDATE_CONTENTS" },
    Worker: { PROGRESS: "PROGRESS", READY: "READY",
              MESSAGE: "MESSAGE", RESPONSE: "RESPONSE", EXIT: "EXIT" },
    Status: { SUCCESS: "success", FAILURE: "failure" } };
