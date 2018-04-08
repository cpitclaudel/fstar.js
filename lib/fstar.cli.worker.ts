namespace FStar.CLI.Worker {
    import Protocol = FStar.CLI.Protocol;
    import Utils = FStar.WorkerUtils;

    export let CATCH_EXCEPTIONS = true; // Turn off to improve JS debugging.

    const messages = {
        ready: Utils.postMessage(Protocol.Worker.READY),
        progress: Utils.postMessage(Protocol.Worker.PROGRESS),
        stdout: Utils.postMessage(Protocol.Worker.STDOUT),
        stderr: Utils.postMessage(Protocol.Worker.STDERR),
        verification_complete: Utils.postMessage(Protocol.Worker.VERIFICATION_COMPLETE)
    };

    interface ClientVerifyOpts {
        fname: string;
        fcontents: string;
        args: string[];
    }

    interface ClientVerifyMessage { // FIXME move to protocol
        kind: Protocol.Client.VERIFY;
        payload: ClientVerifyOpts;
    }

    type ClientMessage = ClientVerifyMessage;

    function isClientMessage(ev: MessageEvent): ev is MessageEvent & { data: ClientMessage } {
        return ev.data.kind === Protocol.Client.VERIFY;
    }

    class Instance {
        private queue: ClientMessage[];
        private ready: boolean;

        constructor() {
            this.queue = [];
            this.ready = false;
            Utils.assertDedicatedWorker().onmessage =
                (ev: MessageEvent) => this.onMessage(ev);

            messages.progress("Downloading and initializing F*…");
            Utils.loadBinaries();
            messages.progress("Downloading Z3…");
            FStar.Driver.initSMT({ progress: messages.progress,
                                   ready: () => this.smtInitialized() });
            // We need a queue because Emscripten's initialization is asynchronous,
            // so we can't just start processing requests as they come.
            // FIXME get rid of the queue and reject requests until ready
        }

        private smtInitialized() {
            messages.ready();
            this.ready = true;
            this.processMessages();
        }

        public verify(msg: ClientVerifyOpts) {
            const retv = FStar.Driver.CLI.verify(msg.fname, msg.fcontents, msg.args,
                                                 { write: messages.stdout },
                                                 { write: messages.stderr },
                                                 CATCH_EXCEPTIONS);
            messages.verification_complete(retv);
        }

        private processMessage(message: ClientMessage) {
            this.verify(message.payload);
        }

        private processMessages() {
            if (this.ready) {
                this.queue.forEach((msg) => this.processMessage(msg));
                this.queue = [];
            }
        }

        private onMessage(event: MessageEvent) {
            if (!isClientMessage(event)) {
                throw new Error(`Unexpected message: ${event}`);
            }
            this.queue.push(event.data);
            this.processMessages();
        }

    }

    // This runs unconditionally (this file is called through `new WebWorker(…)`)
    const instance = new Instance();
}
