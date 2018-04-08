/* Utilities for F*.js' CLI and IDE web worker modules.

Copyright (C) 2017-2018 Clément Pit-Claudel
Author: Clément Pit-Claudel <clement.pitclaudel@live.com>
URL: https://github.com/cpitclaudel/fstar.js

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License. */

namespace FStar.WorkerUtils {
    export let DEBUG: boolean = true;

    export function debug(...args: any[]) {
        if (DEBUG) {
            // tslint:disable-next-line: no-console
            console.debug(...args);
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

    export function assertDedicatedWorker(): DedicatedWorkerGlobalScope {
        if (!(self instanceof DedicatedWorkerGlobalScope)) {
            throw new Error("This method only works in dedicated workers.");
        }
        return (self as DedicatedWorkerGlobalScope);
    }

    export function loadBinaries() {
        self.importScripts("./fstar.core.js", "./z3smt2w.js");
    }

    export function assert(condition: boolean, message?: string) {
        if (!condition) {
            throw (message || "assertion failed");
        }
    }

    export function assertNever(x: never): never {
        throw new Error(`Unexpected value: ${x}`);
    }

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
