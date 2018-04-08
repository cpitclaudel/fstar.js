interface JSOOFStarOptions {
    console?: typeof console;
    Object?: typeof Object;
    Array?: typeof Array;
    Uint8Array?: typeof Uint8Array;
    Buffer?: any;
    Error?: typeof Error;
    RangeError?: typeof RangeError;
    InternalError?: any;
    fstar_args?: string[];
}

interface JSOOFStarEngine extends JSOOFStarOptions {
    setCollectOneCache(buf: ArrayBuffer): void;
    registerLazyFS(index: object, files: object, root: string, resolver: (fname: string) => Uint8Array): void;
    writeFile(fname: string, fcontents: string): void;
    setSMTSolver(ask: (query: string) => string, refresh: () => void): void;
    setChannelFlushers(stdout: (s: string) => void, stderr: (s: string) => void): void;
    callMain(): void;
    callMainUnsafe(): void;
    repl: {
        init(fname: string, onMessage: (msg: string) => void): void;
        evalStr(query: string): string;
    };
}

declare const Buffer: any | undefined;
declare const InternalError: any | undefined;
declare const JSOO_FStar: (opts: JSOOFStarOptions) => void;

namespace FStar.Driver {
    import Utils = FStar.WorkerUtils;
    const debug = Utils.debug;

    /// JSOO Constructors

    // Prepare a minimal global object for js_of_ocaml.
    function freshJsooGlobalObject(fstar_args: string[]) {
        return { console,
                 Object, Array, Uint8Array, Buffer,
                 Error, RangeError, InternalError,
                 fstar_args };
    }

    let qid = 0;
    export function askSolver(query: string): string {
        debug(`Start of query #${qid++}`);
        const ret = FStar.SMTDriver.CLI.ask(query);
        debug(`End of query #${qid}`);
        return ret.response;
    }

    function urlSyncResolver(urlPrefix: string, progressCallback: (msg: string | null) => void) {
        return (fname: string) => {
            progressCallback(`Fetching ${fname}…`);
            const bytes = new Uint8Array(Utils.fetchSync(urlPrefix + fname, 'arraybuffer'));
            progressCallback(null);
            return bytes;
        };
    }

    // This lazy file system persists across calls to Driver.freshFStar
    const lazyFS = { index: Utils.fetchSync("fs/index.json", 'json'),
                     depcache: new Uint8Array(Utils.fetchSync("fs/depcache", 'arraybuffer')),
                     files: {},
                     fs_root: "/fstar/",
                     urlPrefix: "fs/" };

    function initFStarInPlace(engine: JSOOFStarOptions): JSOOFStarEngine {
        JSOO_FStar(engine);
        return (engine as JSOOFStarEngine);
    }

    // Start a new instance of F* with arguments ‘args’.
    export function freshFStar(args: string[], callbacks: { progress: (msg: string | null) => void }) {
        debug("Creating a new F* instance with arguments", args);
        const engine = initFStarInPlace (freshJsooGlobalObject(args));
        engine.setCollectOneCache(lazyFS.depcache);
        const resolver = urlSyncResolver(lazyFS.urlPrefix, callbacks.progress);
        engine.registerLazyFS(lazyFS.index, lazyFS.files, lazyFS.fs_root, resolver);
        engine.setSMTSolver(askSolver, FStar.SMTDriver.CLI.refresh);
        return engine;
    }

    // ON UPDATE: Compare against SMTEncoding.Z3.{ini_params,z3_options}
    const Z3_OPTIONS = {"model": "true",
                        "auto_config": "false",
                        // "unsat_cores": "true",
                        "smt.random_seed": "0",
                        "smt.case_split": "3",
                        "smt.relevancy": "2",
                        "smt.mbqi": "false" };

    // Initialize the SMT solver
    export function initSMT(callbacks: FStar.SMTDriver.CLI.SMTCLICallbacks) {
        FStar.SMTDriver.CLI.initAsync(Z3_OPTIONS, callbacks);
    }

    /// FStar.Driver.IDE

    export interface IDECallbacks {
        progress(msg: string | null): void;
        message(msg: string): void;
    }

    // Initialize a new F* REPL in --ide mode, working on file ‘fname’ with
    // arguments ‘args’.  ‘callbacks.message’ is called (with one argument, a
    // JSON message) every time F* sends an out-of-band message;
    // ‘callbacks.progress’ is called (with one argument, a string) when we make
    // some progress downloading or verifying files.
    export class IDE {
        private args: string[];
        private fname: string;
        private engine: JSOOFStarEngine;

        constructor(fname: string, fcontents: string | null, args: string[],
                    callbacks: IDECallbacks) {
            this.fname = fname;
            const IDE_FLAG = "--ide";
            this.args = args.concat(args.indexOf(IDE_FLAG) < 0 ? [IDE_FLAG] : []);
            this.engine = Driver.freshFStar(this.args.concat([fname]), callbacks);
            (fcontents !== null) && this.engine.writeFile(fname, fcontents); // FIXME updateFile

            this.engine.repl.init(fname, (msg: string) => {
                callbacks.message(JSON.parse(msg));
            });
        }

        // Run ‘query’ synchronously.  This is mostly for debugging purposes,
        // since F*'s --ide mode might become asynchronous some day.
        public evalSync(query: string): string {
            return JSON.parse(this.engine.repl.evalStr(JSON.stringify(query)));
        }

        // Run ‘query’, passing the results to ‘callback’.  This currently calls
        // ‘callback’ immediately, but clients shouldn't rely on this.
        public eval(query: string, callback: (response: string) => void) {
            callback(this.evalSync(query));
        }

        // Set contents of ‘fname’ to ‘fcontents’.
        public updateFile(fcontents: string) {
            this.engine.writeFile(this.fname, fcontents);
        }
    }

    /// FStar.Driver.CLI

    export namespace CLI {
        export function verify(fname: string, fcontents: string | null, args: string[],
                               stdout: Utils.Writer, stderr: Utils.Writer,
                               catchExceptions: boolean) {
            const callbacks = { progress: (_msg: any) => { /* ignore */ } };
            const engine = Driver.freshFStar(args.concat([fname]), callbacks);
            engine.setChannelFlushers((s: string) => stdout.write(s), (s: string) => stderr.write(s));
            (fcontents !== null) && engine.writeFile(fname, fcontents);
            return catchExceptions ? engine.callMain() : engine.callMainUnsafe();
        }

        export function verifySync(fname: string, fcontents: string | null, args: string[],
                                   catchExceptions: boolean) {
            const stdout = new Utils.Flusher(), stderr = new Utils.Flusher();
            const retv = Driver.CLI.verify(fname, fcontents, args, stdout, stderr, catchExceptions);
            return { exitCode: retv,
                     stdout: stdout.lines,
                     stderr: stderr.lines };
        }
    }
}
