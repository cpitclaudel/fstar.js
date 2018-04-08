namespace FStar.WorkerUtils {
    export let DEBUG: boolean = true;

    export function debug(...msgs: any[]) {
        if (DEBUG) {
            console.debug(...msgs);
        }
    }

    export interface Writer {
        write(msg: string): void;
    }

    export class Flusher implements Writer {
        public lines: string[];

        constructor() {
            this.lines = [];
        }

        public write(line: string) {
            this.lines.push(line);
        }

        public clear() {
            this.lines = [];
        }

        public text(): string {
            return this.lines.join("\n");
        }
    }

    export function postMessage(kind: string) {
        if (!(self instanceof DedicatedWorkerGlobalScope)) {
            throw new Error("This method only works in dedicated workers.");
        }
        return (payload?: any): void => {
            (self as DedicatedWorkerGlobalScope).postMessage({ kind, payload });
        };
    }

    export function loadBinaries() { // FIXME rename // FIXME merge all these files
        self.importScripts("./fstar.core.js",
                           "./fstar.driver.js",
                           "./z3smt2w.js",
                           "./fstar.smtdriver.js");
    }

    export function assert(condition: boolean, message?: string) {
        if (!condition) {
            throw (message || "assertion failed");
        }
    }

    export function assertNever(x: never): never { /* nothing */ }

    export function fetchSync(url: string, responseType: XMLHttpRequestResponseType) {
        const xhr = new XMLHttpRequest();
        xhr.responseType = responseType;
        xhr.open("GET", url, false);
        xhr.send(null);
        if (xhr.status !== 200) {
            throw new Error(`Failed to download ${url}`);
        }
        return xhr.response;
    }

    export function fetchAsync(url: string, responseType: XMLHttpRequestResponseType,
                               onProgress: (evt: ProgressEvent) => void,
                               onLoad: (contents: any) => void) {
        const xhr = new XMLHttpRequest();
        xhr.responseType = responseType;
        xhr.addEventListener("progress", onProgress);
        xhr.addEventListener("load", () => {
            if (xhr.status !== 200) {
                throw new Error(`Failed to download ${url}`);
            }
            onLoad(xhr.response);
        });
        xhr.open("GET", url, true);
        xhr.send(null);
    }
}
