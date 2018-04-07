
namespace FStar.SMTDriver {
    import Utils = FStar.WorkerUtils;
    const debug = Utils.debug;

    type cpointer = number;
    interface EmscriptenModule {
        then(k: (mod: EmscriptenModule) => void): void;
        cwrap(method: string, returnType: string | null, argTypes: string[]): any;
        allocateUTF8(str: string): cpointer;
    }

    // User configuration:
    declare const Z3: ((params: object) => EmscriptenModule);
    export let ENGINE = Z3;
    export let LOG_QUERIES = false;

    /// Emscripten initialization

    function fetchWasmBinaryAsync(url: string,
                                  onProgress: (msg: string) => void,
                                  onLoad: (buffer: ArrayBuffer) => void) {
        Utils.fetchAsync(
            url, 'arraybuffer', (evt: ProgressEvent) => {
                if (evt.lengthComputable) {
                    const percentLoaded: number = evt.loaded / evt.total * 100;
                    onProgress(`Downloading Z3 (${percentLoaded.toFixed(2)}%)…`);
                }
            },
            onLoad);
    }

    // LATER: Cache module in IndexedDB (Unsupported in Chrome as of 2018-03)
    function fetchWasmModuleAsync(url: string,
                                  onProgress: (msg: string) => void,
                                  onLoad: (mod: WebAssembly.Module) => void) {
        fetchWasmBinaryAsync(url, onProgress, (wasmBinary) => {
            onProgress("Compiling Z3…");
            const start = Date.now();
            const wmod = new WebAssembly.Module(wasmBinary);
            const elapsed = (Date.now() - start) / 1000;
            debug(`Compiled Z3 in ${elapsed.toFixed(2)}s`);
            onLoad(wmod);
        });
    }

    // Start a new instance of the SMT solver, redirecting IO to ‘stdout’ and ‘stderr’.
    export function initEmscripten(stdout: Utils.Writer, stderr: Utils.Writer,
                                   onProgress: (msg: string) => void,
                                   then: (engine: EmscriptenModule) => void) {
        fetchWasmModuleAsync("z3smt2w.wasm", onProgress, (wasmModule) => {
            function instantiateWasm(info: any,
                                     receiveInstance: (inst: WebAssembly.Instance) => void) {
                // We do this here in preparation for IndexedDB support
                const instance = new WebAssembly.Instance(wasmModule, info);
                receiveInstance(instance);
                return instance.exports;
            }
            // FIXME check binding here
            const options = { instantiateWasm,
                              print: (str: string) => stdout.write(str),
                              printErr: (str: string) => stderr.write(str) };
            ENGINE(options).then(then);
        });
    }

    export namespace CLI {
        export interface SMTCLICallbacks { // FIXME move?
            progress(msg: string | null): void;
            ready(): void;
        }

        type Z3_context = number;
        interface SmtEngine {
            init(): Z3_context;
            setParam(key: string, value: string): void;
            ask(ctx: Z3_context, query: string): string;
            askRaw(ctx: Z3_context, queryPtr: cpointer): string;
            destroy(ctx: Z3_context): void;
            free(ptr: cpointer): void;
            allocateUTF8(str: string): cpointer;
        }

        interface ReadySMTCLI {
            engine: SmtEngine;
        }

        class SMTCLI { // FIXME flatten hierarchy
            private stdout: Utils.Flusher;
            private stderr: Utils.Flusher;

            private smtParams: { [k: string]: string };
            private callbacks: SMTCLICallbacks;

            private solver: cpointer | null;
            private engine: SmtEngine | null;

            constructor(smtParams: { [k: string]: string }, callbacks: SMTCLICallbacks) {
                this.stdout = new Utils.Flusher();
                this.stderr = new Utils.Flusher();

                this.solver = null;
                this.engine = null;
                this.smtParams = smtParams;
                this.callbacks = callbacks;

                SMTDriver.initEmscripten(this.stdout, this.stderr, callbacks.progress, (mod) => {
                    this.onRuntimeInitialized(mod);
                });
            }

            private onRuntimeInitialized(mod: EmscriptenModule): void {
                this.bindCMethods(mod);
                this.callbacks.ready();
            }

            private static smtWrap(engine: EmscriptenModule, // FIXME rename
                                   method: string, returnType: string | null, argTypes: string[]) {
                const wrapped = engine.cwrap(method, returnType, argTypes);
                return (...args: any[]) => {
                    if (SMTDriver.LOG_QUERIES) {
                        debug(method, ...args);
                    } else {
                        debug("Calling z3Smt2." + method);
                    }
                    try {
                        return wrapped(...args);
                    } catch (e) {
                        debug("Z3 raised an exception while running " + method, e);
                        throw e;
                    }
                };
            }

            private bindCMethods(mod: EmscriptenModule) {
                this.engine = {
                    init: SMTCLI.smtWrap(mod, 'smt2Init', 'number', []),
                    setParam: SMTCLI.smtWrap(mod, 'smt2SetParam', null, ['string', 'string']),
                    ask: SMTCLI.smtWrap(mod, 'smt2Ask', 'string', ['number', 'string']),
                    askRaw: SMTCLI.smtWrap(mod, 'smt2Ask', 'string', ['number', 'number']),
                    destroy: SMTCLI.smtWrap(mod, 'smt2Destroy', null, ['number']),
                    free: SMTCLI.smtWrap(mod, 'free', null, ['number']),
                    allocateUTF8: (s: string) => mod.allocateUTF8(s)
                };
            }

            private assertEngine(this: SMTCLI): SmtEngine {
                if (this.engine === null) {
                    throw new Error("Solver not ready.  Did the initial call to CLI.initAsync return yet?");
                }
                return this.engine;
            }

            private ensureSolver(): cpointer {
                if (this.solver == null) {
                    this.solver = this.assertEngine().init();
                    for (const opt in this.smtParams) {
                        this.assertEngine().setParam(opt, this.smtParams[opt]);
                    }
                }
                return this.solver;
            }

            public destroySolver() {
                if (this.solver !== null) {
                    try {
                        this.assertEngine().destroy(this.solver);
                    } finally {
                        this.solver = null;
                    }
                }
            }

            public askSolver(query: string) {
                this.stdout.clear();
                this.stderr.clear();

                // LATER: there's too much string conversion going on here: we go from an
                //   MlString to a JS string just to write that string out to a C string;
                //   it would be much better to convert the MlString directly;
                // LATER: Use writeAsciiToMemory instead of allocateUTF8.
                const query_cstr = this.assertEngine().allocateUTF8(query);

                try {
                    const response = this.assertEngine().askRaw(this.ensureSolver(), query_cstr);
                    const stdout = this.stdout.text();
                    const stderr = this.stderr.text();
                    return { response, stdout, stderr };
                } finally {
                    this.assertEngine().free(query_cstr);
                }
            }
        }

        let instance: SMTCLI | null;

        export function initAsync(smtParams: { [k: string]: string }, callbacks: SMTCLICallbacks) {
            instance = new SMTCLI(smtParams, callbacks);
        }

        function assertInstance(): SMTCLI {
            if (instance === null) {
                throw new Error("Call initAsync first!");
            }
            return instance;
        }

        export function refresh() {
            assertInstance().destroySolver();
        }

        export function verify(fcontents: string) {
            assertInstance().destroySolver(); // FIXME this is refresh();
            const response = assertInstance().askSolver(fcontents);
            assertInstance().destroySolver();
            return response;
        }

        export function ask(query: string) {
            return assertInstance().askSolver(query);
        }
    }
}
