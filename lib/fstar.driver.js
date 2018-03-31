"use strict";
/* global console FStar JSOO_FStar */

FStar.Driver = FStar.Driver || {};

(function () {
    var Driver = FStar.Driver;

    /// JSOO Constructors

    // Prepare a minimal global object for js_of_ocaml.
    Driver.freshJsooGlobalObject = function() {
        var obj = { console: console,
                    Array: Array,
                    Uint8Array: Uint8Array,
                    Object: Object,
                    Error: Error };
        if (typeof(RangeError) !== "undefined")
            obj.RangeError = RangeError; /* global RangeError */
        if (typeof(Uint8Array) !== "undefined")
            obj.Uint8Array = Uint8Array; /* global Uint8Array */
        if (typeof(InternalError) !== "undefined")
            obj.InternalError = InternalError; /* global InternalError */
        return obj;
    };

    var qid = 0;
    function askSolver(query) {
        console.log(`Start of query #${qid++}`);
        var ret = FStar.SMTDriver.CLI.ask(query);
        console.log(`End of query #${qid}`);
        return ret.response;
    }

    function fetchSync(url, responseType) {
        var xhr = new XMLHttpRequest();
        xhr.responseType = responseType;
        xhr.open("GET", url, false);
        xhr.send(null);
        if (xhr.status != 200) {
            throw "Failed to download " + url;
        }
        return xhr.response;
    }

    function urlSyncResolver(url_prefix, progress_callback) {
        return function(fname) {
            progress_callback(`Fetching ${fname}…`);
            var bytes = new Uint8Array(fetchSync(url_prefix + fname, 'arraybuffer'));
            progress_callback(null);
            return bytes;
        };
    }

    // This lazy file system persists across calls to Driver.freshFStar
    var lazyFS = Driver.lazyFS = { index: fetchSync("fs/index.json", 'json'),
                                   depcache: new Uint8Array(fetchSync("fs/depcache", 'arraybuffer')),
                                   files: {},
                                   fs_root: "/fstar/",
                                   url_prefix: "fs/" };

    // Start a new instance of F* with arguments ‘args’.  ‘callbacks.progress’
    // is called (with one argument, a string) when we make some progress
    // downloading or verifying files.
    Driver.freshFStar = function(args, callbacks) {
        console.log("Creating a new F* instance with arguments", args);
        var fstar = Driver.freshJsooGlobalObject();
        fstar.fstar_args = args;
        JSOO_FStar(fstar);
        fstar.setCollectOneCache(lazyFS.depcache);
        var resolver = urlSyncResolver(lazyFS.url_prefix, callbacks.progress);
        fstar.registerLazyFS(lazyFS.index, lazyFS.files, lazyFS.fs_root, resolver);
        fstar.setSMTSolver(askSolver, FStar.SMTDriver.CLI.refresh);
        fstar.setStackOverflowRetries(0);
        return fstar;
    };

    // ON UPDATE: Compare against SMTEncoding.Z3.{ini_params,z3_options}
    var Z3_OPTIONS = {"model": "true",
                      "auto_config": "false",
                      // "unsat_cores": "true",
                      "smt.random_seed": 0,
                      "smt.case_split": "3",
                      "smt.relevancy": "2",
                      "smt.mbqi": "false" };

    // Initialize the SMT solver
    Driver.initSMT = function(callbacks) {
        FStar.SMTDriver.CLI.initAsync(Z3_OPTIONS, callbacks);
    };

    /// FStar.Driver.IDE

    // Initialize a new F* REPL in --ide mode, working on file ‘fname’ with
    // arguments ‘args’.  ‘callbacks.message’ is called (with one argument, a
    // JSON message) every time F* sends an out-of-band message;
    // ‘callbacks.progress’ is called (with one argument, a string) when we make
    // some progress downloading or verifying files.
    var IDE = FStar.Driver.IDE = function(fname, fcontents, args, callbacks) {
        var IDE_FLAG = "--ide";
        if (!args.includes(IDE_FLAG)) {
            args = args.concat([IDE_FLAG]);
        }

        this.args = args;
        this.fname = fname;
        this.fstar = Driver.freshFStar(args.concat([fname]), callbacks);
        this.fstar.writeFile(fname, fcontents);

        this.fstar.repl.init(fname, function (messageStr) {
            callbacks.message(JSON.parse(messageStr));
        });
    };

    // Run ‘query’ synchronously.  This is mostly for debugging purposes,
    // since F*'s --ide mode might become asynchronous some day.
    IDE.prototype.evalSync = function(query) {
        return JSON.parse(this.fstar.repl.evalStr(JSON.stringify(query)));
    };

    // Run ‘query’, passing the results to ‘callback’.  This currently calls
    // ‘callback’ immediately, but clients shouldn't rely on this.
    IDE.prototype.eval = function(query, callback) {
        callback(this.evalSync(query));
    };

    // Set contents of ‘fname’ to ‘fcontents’.
    IDE.prototype.updateFile = function(fcontents) {
        this.fstar.writeFile(this.fname, fcontents);
    };

    /// Flusher

    function Flusher(channel) {
        var label = channel + ":";
        var lines = this.lines = [];
        this.write = function(line) {
            console.log(label, line.replace(/[\r\n]+$/, ""));
            lines.push(line);
        };
    }

    /// FStar.Driver.CLI

    Driver.CLI = Driver.CLI || {};

    Driver.CLI.verify = function(fname, fcontents, args, stdout, stderr, catchExceptions) {
        var callbacks = { progress: function (_msg) { } };
        var fstar = Driver.freshFStar(args.concat([fname]), callbacks);
        fstar.setChannelFlushers(stdout, stderr);
        fstar.writeFile(fname, fcontents);
        return catchExceptions ? fstar.callMain() : fstar.callMainUnsafe();
    };

    Driver.CLI.verifySync = function(fname, fcontents, args, catchExceptions) {
        var stdout = new Flusher("stdout"), stderr = new Flusher("stderr");
        var retv = Driver.CLI.verify(fname, fcontents, args, stdout.write, stderr.write, catchExceptions);
        return { exitCode: retv,
                 stdout: stdout.lines,
                 stderr: stderr.lines };
    };
})();
