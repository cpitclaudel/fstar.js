"use strict";
/* global FStar:true */
FStar.CLI = FStar.CLI || {};
FStar.CLI.Protocol = {
    Client: { VERIFY: "VERIFY" },
    Worker: { PROGRESS: "PROGRESS", READY: "READY",
              STDOUT: "STDOUT", STDERR: "STDERR",
              VERIFICATION_COMPLETE: "VERIFICATION_COMPLETE",
              IDE_RESPONSE: "IDE_RESPONSE", IDE_EXIT: "IDE_EXIT" }
};
