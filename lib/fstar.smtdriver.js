"use strict";
/* global Z3 FStar WebAssembly */

FStar.SMTDriver = FStar.SMTDriver || {};
FStar.SMTDriver.CLI = FStar.SMTDriver.CLI || {};

(function () {
    var SMTDriver = FStar.SMTDriver;

    // User configuration:
    SMTDriver.ENGINE = Z3; // Could be changed by users
    SMTDriver.LOG_QUERIES = false;

    /// Emscripten initialization

    function fetchWasmBinaryAsync(url, onProgress, onLoad) {
        var xhr = new XMLHttpRequest();
        xhr.responseType = 'arraybuffer';
        xhr.addEventListener("progress", function (evt) {
            if (evt.lengthComputable) {
                var percentLoaded = evt.loaded / evt.total * 100;
                onProgress(`Downloading Z3 (${percentLoaded.toFixed(2)}%)…`);
            }
        });
        xhr.addEventListener("load", function () {
            if (xhr.status != 200) {
                throw "Failed to download " + url;
            }
            onLoad(xhr.response);
        });
        xhr.open("GET", url, true);
        xhr.send(null);
    }

    // LATER: Cache module in IndexedDB (Unsupported in Chrome as of 2018-03)
    function fetchWasmModuleAsync(url, onProgress, onLoad) {
        fetchWasmBinaryAsync(url, onProgress, function(wasmBinary) {
            onProgress('Compiling Z3…');
            var start = performance.now();
            var module = new WebAssembly.Module(wasmBinary);
            var elapsed = (performance.now() - start) / 1000;
            console.log(`Compiled Z3 in ${elapsed.toFixed(2)}s`);
            onLoad(module);
        });
    }

    // Start a new instance of the SMT solver, redirecting IO to ‘stdout’ and ‘stderr’.
    SMTDriver.initEngine = function(stdout, stderr, onProgress, then) {
        fetchWasmModuleAsync("z3smt2w.wasm", onProgress, function(wasmModule) {
            var options = { print: stdout,
                            printErr: stderr,
                            instantiateWasm: function(info, receiveInstance) {
                                // We do this here in preparation for IndexedDB support
                                var instance = new WebAssembly.Instance(wasmModule, info);
                                receiveInstance(instance);
                                return instance.exports; } };
            SMTDriver.ENGINE(options).then(then);
        });
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

    var SMTCLI = CLI.SMTCLI = function(options, callbacks) {
        this.ready = false;
        this.stdout = new Flusher();
        this.stderr = new Flusher();

        var _this = this;
        this.solver = null;
        this.options = options;
        this.callbacks = callbacks;
        SMTDriver.initEngine(this.stdout.write, this.stderr.write, callbacks.progress, function(engine) {
            _this.engine = engine;
            _this.onRuntimeInitialized();
        });
    };

    SMTCLI.prototype.onRuntimeInitialized = function() {
        this.ready = true;
        this.bindCMethods();
        this.callbacks.ready();
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

    CLI.initAsync = function(options, callbacks) {
        CLI.instance = new SMTCLI(options, callbacks);
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
