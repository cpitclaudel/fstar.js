"use strict";
/* global Z3 FStar */

FStar.SMTDriver = FStar.SMTDriver || {};
FStar.SMTDriver.CLI = FStar.SMTDriver.CLI || {};

(function () {
    var SMTDriver = FStar.SMTDriver;

    // User configuration:
    SMTDriver.ENGINE = Z3; // Can be changed by users
    SMTDriver.OPTIONS = {};

    /// Emscripten initialization

    // Start a new instance of the SMT solver, redirecting IO to ‘stdout’ and ‘stderr’.
    SMTDriver.freshEngine = function(stdout, stderr, readyCallback) {
        var options = { print: stdout, printErr: stderr,
                        onRuntimeInitialized: readyCallback };
        for (var opt in SMTDriver.OPTIONS) {
            options[opt] = SMTDriver.OPTIONS[opt];
        }
        return SMTDriver.ENGINE(options);
    };

    /// CLI interface

    var CLI = SMTDriver.CLI;

    function Flusher() {
        var _this = this;
        this.lines = [];
        this.write = function(line) { _this.lines.push(line); };
    }

    Flusher.prototype.clear = function() {
        this.lines = [];
    };

    var SMTCLI = CLI.SMTCLI = function(readyCallback) {
        this.ready = false;
        this.on_ready_functions = [];
        this.stdout = new Flusher("stdout");
        this.stderr = new Flusher("stderr");

        var _this = this;
        this.readyCallback = readyCallback;
        var callback = function() { _this.onRuntimeInitialized(); };
        this.solver = SMTDriver.freshEngine(this.stdout.write, this.stderr.write, callback);
    };

    SMTCLI.prototype.onRuntimeInitialized = function() {
        this.ready = true;
        this.readyCallback();
    };

    SMTCLI.prototype.clearBuffers = function() {
        this.stdout.clear();
        this.stderr.clear();
    };

    SMTCLI.prototype.callMain = function(args) {
        this.clearBuffers();
        var exitCode = this.solver.callMain(args);
        var stdout = this.stdout.lines.join("\n");
        var stderr = this.stderr.lines.join("\n");
        return { exitCode: exitCode,
                 stdout: stdout,
                 stderr: stderr };
    };

    SMTCLI.prototype.verify = function(fname, fcontents, args) {
        this.solver.FS.writeFile(fname, fcontents, { encoding: "utf8" });
        return this.callMain(args.concat([fname]));
    };

    CLI.initAsync = function(callback) {
        CLI.instance = new SMTCLI(callback || function () {});
    };

    CLI.refresh = function() {
        CLI.initAsync();
        if (!CLI.instance.ready) {
            throw "Could not refresh the solver synchronously.  Did the initial call to CLI.initAsync return yet?";
        }
    };

    CLI.verify = function(fname, fcontents, fargs) {
        // CLI.refresh(); // Too slow // FIXME talk to the Z3 people to get a clean REPL API
        return CLI.instance.verify(fname, fcontents, fargs);
    };
})();
