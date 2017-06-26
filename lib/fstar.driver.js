"use strict";
/* global console JSOO_FStar_Stdlib JSOO_FStar FStar:true */

FStar.Driver = FStar.Driver || {};

(function () {
    var Driver = FStar.Driver;

    /// JSOO Constructors

    // Prepare a minimal global object for js_of_ocaml.
    Driver.freshJsooGlobalObject = function() {
        var obj = { console: console,
                    Array: Array,
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

    // Start a new instance of F* with arguments ‘args’.
    Driver.freshFStar = function(args) {
        var obj = Driver.freshJsooGlobalObject();
        obj.fstar_args = args;
        JSOO_FStar_Stdlib(obj);
        JSOO_FStar(obj);
        return obj;
    };

    /// FStar.Driver.IDE

    // Initialize a new F* REPL in --ide mode, working on file ‘fname’ with
    // arguments ‘args’.  ‘fcontents_callback’ is called (with no arguments)
    // every time F* tries to read the contents of ‘fname’.  ‘message_callback’ is
    // called (with one argument, a JSON message) every time F* sends an
    // out-of-band message.
    var IDE = FStar.Driver.IDE = function(fname, fcontents, args, message_callback) {
        var IDE_FLAG = "--ide";
        if (!args.includes(IDE_FLAG)) {
            args = args.concat([IDE_FLAG]);
        }

        this.args = args;
        this.fname = fname;
        this.fstar = Driver.freshFStar(args.concat([fname]));
        this.fstar.writeFile(fname, fcontents);

        this.fstar.repl.init(fname, function (messageStr) {
            message_callback(JSON.parse(messageStr));
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
        var lines = [];
        var label = channel + ":";
        this.lines = lines;
        this.write = function(line) {
            console.log(label, line.replace(/[\r\n]+$/, ""));
            lines.push(line);
        };
    }

    /// FStar.Driver.CLI

    Driver.CLI = Driver.CLI || {};

    Driver.CLI.verify = function(fname, fcontents, args, stdout, stderr, catchExceptions) {
        var fstar = Driver.freshFStar(args.concat([fname]));
        fstar.setChannelFlushers(stdout, stderr);
        fstar.writeFile(fname, fcontents);
        return catchExceptions ? fstar.callMain() : fstar.callMainUnsafe();
    };

    Driver.CLI.verifySync = function(fname, fcontents, args, catchExceptions) {
        var stdout = new Flusher("stdout"), stderr = new Flusher("stderr");
        var retv = Driver.CLI.verify(fname, fcontents, args, stdout.write, stderr.write, catchExceptions);
        return { "exitCode": retv,
                 "stdout": stdout.lines,
                 "stderr": stderr.lines };
    };
})();
