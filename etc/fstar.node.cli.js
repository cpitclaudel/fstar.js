#!/usr/bin/env nodejs
//
// Verify a single file with F*.js.  Arguments are hard-coded in the script;
// dependencies of the input file won't be read.

var FStar = require("./fstar.node.js");
var fs = require("fs");

var fname = process.argv[2];
if (fname === undefined) {
    console.error("Usage: fstar.node.cli.js fname.fst");
    process.exit(1);
}

var args = ["--fstar_home", "/fstar"];
// var fcontents = fs.readFileSync(fname, { encoding: "utf-8" });

FStar.WorkerUtils.DEBUG = true;

FStar.Driver.initSMT({
    ready: function() {
        setImmediate(function () {
            FStar.Driver.CLI.verifySync(fname, null, args, true);
        });
    },
    progress: function() {} });
