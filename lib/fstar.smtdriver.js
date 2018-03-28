"use strict";
/* global Z3 FStar */

FStar.SMTDriver = FStar.SMTDriver || {};
FStar.SMTDriver.CLI = FStar.SMTDriver.CLI || {};

(function () {
    var SMTDriver = FStar.SMTDriver;

    // User configuration:
    SMTDriver.ENGINE = Z3; // Could be changed by users
    SMTDriver.LOG_QUERIES = false;

    /// Emscripten initialization

    // Start a new instance of the SMT solver, redirecting IO to ‘stdout’ and ‘stderr’.
    SMTDriver.freshEngine = function(stdout, stderr, readyCallback) {
        var options = { print: stdout, printErr: stderr,
                        onRuntimeInitialized: readyCallback };
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

    var SMTCLI = CLI.SMTCLI = function(options, readyCallback) {
        this.ready = false;
        this.stdout = new Flusher();
        this.stderr = new Flusher();

        var _this = this;
        this.solver = null;
        this.options = options;
        this.readyCallback = readyCallback;
        var callback = function() { _this.onRuntimeInitialized(); };
        this.engine = SMTDriver.freshEngine(this.stdout.write, this.stderr.write, callback);
    };

    SMTCLI.prototype.onRuntimeInitialized = function() {
        // setTimeout guarantees that this.engine is initialized: depending
        // on how asynchronous the WASM initialization ends up being, we can
        // reach this point before the call to freshEngine returns.
        var _this = this;
        setTimeout(function() {
            _this.ready = true;
            _this.bindCMethods();
            _this.readyCallback();
        }, 0);
    };

    function smtWrap(engine, method, returnType, argTypes) {
        var wrapped = engine.cwrap(method, returnType, argTypes);
        return function(...args) {
            if (SMTDriver.LOG_QUERIES) {
                console.log(method, ...args);
            } else {
                console.log("Calling z3Smt2." + method);
            }
            try {
                return wrapped(...args);
            } catch (e) {
                console.log("Z3 raised an exception while running " + method, e);
                throw e;
            }
        };
    }

    SMTCLI.prototype.bindCMethods = function() {
        this.engine.smt2API = {
            // init: () -> Z3_context
            init: smtWrap(this.engine, 'smt2Init', 'number', []),
            // setParam: key: js_string -> value: js_string -> Z3_context
            setParam: smtWrap(this.engine, 'smt2SetParam', null, ['string', 'string']),
            // ask: Z3_context -> query: js_string -> string: response
            ask: smtWrap(this.engine, 'smt2Ask', 'string', ['number', 'string']),
            // askRaw: Z3_context -> query: raw char* -> response
            askRaw: smtWrap(this.engine, 'smt2Ask', 'string', ['number', 'number']),
            // destroy: Z3_context -> ()
            destroy: smtWrap(this.engine, 'smt2Destroy', null, ['number']),
            // free: raw pointer -> ()
            free: smtWrap(this.engine, 'free', null, ['number'])
        };
    };

    SMTCLI.prototype.ensureReady = function() {
        if (!this.ready) {
            throw "Solver not ready.  Did the initial call to CLI.initAsync return yet?";
        }
    };

    SMTCLI.prototype.ensureSolver = function() {
        this.ensureReady();
        if (this.solver == null) {
            this.solver = this.engine.smt2API.init();
            for (var opt in this.options) {
                this.engine.smt2API.setParam(opt, this.options[opt]);
            }
        }
    };

    SMTCLI.prototype.destroySolver = function() {
        this.ensureReady();
        try {
            if (this.solver != null) {
                this.engine.smt2API.destroy(this.solver);
            }
        } finally {
            this.solver = null;
        }
    };

    SMTCLI.prototype.askSolver = function(query) {
        this.ensureSolver();
        this.stdout.clear();
        this.stderr.clear();

        // LATER: there's too much string conversion going on here: we go from an
        //   MlString to a JS string just to write that string out to a C string;
        //   it would be much better to convert the MlString directly;
        // LATER: Use writeAsciiToMemory instead of allocateUTF8.
        var query_cstr = this.engine.allocateUTF8(query);

        try {
            var response = this.engine.smt2API.askRaw(this.solver, query_cstr);
            var stdout = this.stdout.lines.join("\n");
            var stderr = this.stderr.lines.join("\n");
            return { response: response,
                     stdout: stdout,
                     stderr: stderr };
        } finally {
            this.engine.smt2API.free(query_cstr);
        }
    };

    CLI.initAsync = function(options, callback) {
        CLI.instance = new SMTCLI(options, callback || function () {});
    };

    CLI.refresh = function() {
        CLI.instance.destroySolver();
    };

    CLI.verify = function(fcontents) {
        CLI.instance.destroySolver();
        var response = CLI.instance.askSolver(fcontents);
        CLI.instance.destroySolver();
        return response;
    };

    CLI.ask = function(query) {
        return CLI.instance.askSolver(query);
    };
})();
