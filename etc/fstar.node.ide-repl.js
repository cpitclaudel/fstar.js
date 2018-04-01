#!/usr/bin/env nodejs
//
// This script behaves mostly like fstar.exe --ide; it's convenient for
// interactive experimentation.

var FStar = require("./fstar.node.js");

var readline = require('readline');

var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});

var fname = process.argv[2];
if (fname === undefined) {
    console.error("Usage: fstar.node.ide-repl.js fname.fst");
    process.exit(1);
}

var args = ["--fstar_home", "/fstar"];
var callbacks = { message: console.log, progress: function() {} };
var ide = new FStar.Driver.IDE(fname, null, args, callbacks);

FStar.Driver.initSMT({
    ready: function() {
        setImmediate(function () {
            rl.on('line', function(query_str) {
                console.log(ide.evalSync(query_str));
            });
        });
    },
    progress: function() {} });
