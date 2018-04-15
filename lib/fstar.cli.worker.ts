/* Run F* on whole files and print the command line output (web worker side).

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

namespace FStar.CLI.Worker {
    import Protocol = FStar.CLI.Protocol;
    import Utils = FStar.WorkerUtils;

    export let CATCH_EXCEPTIONS = true; // Turn off to improve JS debugging.

    const postMessage = (msg: Protocol.WorkerMessage) =>
        Utils.assertDedicatedWorker().postMessage(msg);
    const messages = {
        ready: () =>
            postMessage({ kind: Protocol.WorkerMessageKind.READY, payload: null }),
        progress: (payload: string) =>
            postMessage({ kind: Protocol.WorkerMessageKind.PROGRESS, payload }),
        stdout: (payload: string) =>
            postMessage({ kind: Protocol.WorkerMessageKind.STDOUT, payload }),
        stderr: (payload: string) =>
            postMessage({ kind: Protocol.WorkerMessageKind.STDERR, payload }),
        verification_complete: (payload: number) =>
            postMessage({ kind: Protocol.WorkerMessageKind.VERIFICATION_COMPLETE, payload })
    };

    class Instance {
        private ready: boolean;

        constructor() {
            this.ready = false;
            Utils.assertDedicatedWorker().onmessage =
                (ev: MessageEvent) => this.onMessage(ev);

            messages.progress("Downloading and initializing F* (~4MB)…");
            Utils.loadBinaries();
            messages.progress("Downloading Z3 (~5MB)…");
            FStar.Driver.initSMT({ progress: messages.progress,
                                   ready: () => this.smtInitialized() });
        }

        private smtInitialized() {
            messages.ready();
            this.ready = true;
        }

        public verify(msg: Protocol.ClientVerifyPayload) {
            const retv = FStar.Driver.CLI.verify(msg.fname, msg.fcontents, msg.args,
                                                 { write: messages.stdout },
                                                 { write: messages.stderr },
                                                 CATCH_EXCEPTIONS);
            messages.verification_complete(retv);
        }

        private processMessage(message: Protocol.ClientMessage) {
            this.verify(message.payload);
        }

        private onMessage(event: MessageEvent) {
            if (!this.ready) {
                throw new Error("Received a message before initialization completed");
            }
            this.processMessage(event.data);
        }
    }

    // This runs unconditionally (this file is called through `new WebWorker(…)`)
    export const instance = new Instance();
}
