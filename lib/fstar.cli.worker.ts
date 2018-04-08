namespace FStar.CLI.Worker {
    import Protocol = FStar.CLI.Protocol;
    import Utils = FStar.WorkerUtils;

    export let CATCH_EXCEPTIONS = true; // Turn off to improve JS debugging.

    const messages = {
        ready: Utils.postMessage(Protocol.WorkerMessageKind.READY),
        progress: Utils.postMessage(Protocol.WorkerMessageKind.PROGRESS),
        stdout: Utils.postMessage(Protocol.WorkerMessageKind.STDOUT),
        stderr: Utils.postMessage(Protocol.WorkerMessageKind.STDERR),
        verification_complete: Utils.postMessage(Protocol.WorkerMessageKind.VERIFICATION_COMPLETE)
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
