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

            messages.progress("Downloading and initializing F*…");
            Utils.loadBinaries();
            messages.progress("Downloading Z3…");
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
