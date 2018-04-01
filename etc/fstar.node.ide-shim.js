#!/usr/bin/env nodejs
//
// This script can be used make sure that F*.js passes F*'s interactive-mode
// test suite.  To use it, run this in F*'s ‘tests/interactive’ directory::
//
//   make "FSTAR=/path/to/this/script" check
//
// Note that this won't work for tests that rely on local dependencies: by
// default, when running in node, JSOO only redirects reads of absolute paths to
// the physical file system.

var fs = require("fs");
var FStar = require("./fstar.node.js");

var fname = process.argv[2];
if (fname === undefined) {
    console.error("Usage: fstar.node.ide-shim.js fname.fst < queries.in");
    process.exit(1);
}

var args = ["--fstar_home", "/fstar"];
var callbacks = { message: msg => console.log(JSON.stringify(msg)),
                  progress: function() {} };
var ide = new FStar.Driver.IDE(fname, null, args, callbacks);

function allStdin() {
    return new Promise((resolve) => {
        var chunks = [];

        process.stdin.on('readable', () => {
            var chunk;
            while ((chunk = process.stdin.read())) {
                chunks.push(chunk);
            }
        });

        process.stdin.on('end', () => {
            resolve(chunks.join(""));
        });
    });
}

FStar.Driver.initSMT({
    ready: function() {
        setImmediate(function () {
            allStdin().then(stdin => {
                var queries = stdin.split(/[\r\n]+/g).filter(str => str !== "");
                queries.forEach(function(query) {
                    console.log(ide.fstar.repl.evalStr(query));
                });
            });
        });
    },
    progress: function() {} });
