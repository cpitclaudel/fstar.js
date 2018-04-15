/* Run F* in --ide mode (web worker side).

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

namespace FStar.IDE.Worker {
    import Protocol = FStar.IDE.Protocol;
    import Utils = FStar.WorkerUtils;

    const postMessage = (msg: Protocol.WorkerMessage) =>
        Utils.assertDedicatedWorker().postMessage(msg);
    const messages = {
        ready: () =>
            postMessage({ kind: Protocol.WorkerMessageKind.READY, payload: null }),
        progress: (payload: string | null) =>
            postMessage({ kind: Protocol.WorkerMessageKind.PROGRESS, payload }),
        message: (payload: Protocol.WorkerMessagePayload) =>
            postMessage({ kind: Protocol.WorkerMessageKind.MESSAGE, payload }),
        response: (payload: Protocol.WorkerResponsePayload) =>
            postMessage({ kind: Protocol.WorkerMessageKind.RESPONSE, payload }),
        exit: () => postMessage({ kind: Protocol.WorkerMessageKind.EXIT, payload: null })
    };

    class Instance {
        private ide: FStar.Driver.IDE | null;
        private queue: Protocol.ClientMessage[];
        private ready: boolean;

        constructor() {
            this.ide = null;
            this.queue = [];
            this.ready = false;
            Utils.assertDedicatedWorker().onmessage = (message: MessageEvent) => this.onMessage(message);

            messages.progress("Downloading and initializing F* (~4MB)…");
            Utils.loadBinaries();
            messages.progress("Downloading Z3 (~5MB)…");
            FStar.Driver.initSMT({ progress: messages.progress,
                                   ready: () => this.smtInitialized() });
            // We need a queue because the engine's initialization is asynchronous,
            // so we can't just start processing requests as they come.
        }

        private smtInitialized() {
            messages.progress(null);
            messages.ready();
            this.ready = true;
            this.processMessages();
        }

        private assertIDE(queryKind: Protocol.ClientMessageKind): FStar.Driver.IDE {
            if (this.ide === null) {
                throw new Error(`Cannot run query ${queryKind} before running INIT.`);
            }
            return this.ide;
        }

        private processMessage(message: Protocol.ClientMessage) {
            switch (message.kind) {
                case Protocol.ClientMessageKind.INIT: {
                    const payload = message.payload;
                    this.ide = new FStar.Driver.IDE(payload.fname, payload.fcontents,
                                                    payload.args, { message: messages.message,
                                                                    progress: messages.progress });
                    break;
                } case Protocol.ClientMessageKind.UPDATE_CONTENTS:
                    this.assertIDE(message.kind).updateFile(message.payload.fcontents);
                    break;
                case Protocol.ClientMessageKind.QUERY:
                    this.assertIDE(message.kind).eval(message.payload, messages.response);
                    break;
                default:
                    Utils.assertNever(message);
            }
        }

        private processMessages() {
            if (this.ready) {
                this.queue.forEach(msg => this.processMessage(msg));
                this.queue = [];
            }
        }

        private onMessage(event: MessageEvent) {
            this.queue.push(event.data);
            this.processMessages();
        }
    }

    // This runs unconditionally (this file is called through `new WebWorker(…)`)
    export const instance = new Instance();
}
