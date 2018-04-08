namespace FStar.IDE.Worker {
    import Protocol = FStar.IDE.Protocol;
    import Utils = FStar.WorkerUtils;

    const messages = {
        ready: FStar.WorkerUtils.postMessage(Protocol.Worker.READY),
        progress: FStar.WorkerUtils.postMessage(Protocol.Worker.PROGRESS),
        message: FStar.WorkerUtils.postMessage(Protocol.Worker.MESSAGE),
        response: FStar.WorkerUtils.postMessage(Protocol.Worker.RESPONSE),
        exit: FStar.WorkerUtils.postMessage(Protocol.Worker.EXIT)
    };

    interface ClientInitOps { // FIXME move to protocol
        fname: string;
        fcontents: string;
        args: string[];
    }

    interface ClientInitMessage {
        kind: Protocol.Client.INIT;
        payload: ClientInitOps;
    }

    interface ClientQueryMessage {
        kind: Protocol.Client.QUERY;
        payload: string;
    }

    interface ClientUpdateContentsOps {
        fcontents: string;
    }

    interface ClientUpdateContentsMessage {
        kind: Protocol.Client.UPDATE_CONTENTS;
        payload: ClientUpdateContentsOps;
    }

    type ClientMessage = ClientInitMessage | ClientQueryMessage | ClientUpdateContentsMessage;

    class Instance {
        private ide: FStar.Driver.IDE | null;
        private queue: ClientMessage[];
        private ready: boolean;

        constructor() {
            this.ide = null;
            this.queue = [];
            this.ready = false;
            Utils.assertDedicatedWorker().onmessage = (message: MessageEvent) => this.onMessage(message);

            messages.progress("Downloading and initializing F*…");
            Utils.loadBinaries();
            messages.progress("Downloading Z3…");
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

        private assertIDE(queryKind: Protocol.Client): FStar.Driver.IDE {
            if (this.ide === null) {
                throw new Error(`Cannot run query ${queryKind} before running INIT.`);
            }
            return this.ide;
        }

        private processMessage(message: ClientMessage) {
            switch (message.kind) {
                case Protocol.Client.INIT: {
                    const payload = message.payload;
                    this.ide = new FStar.Driver.IDE(payload.fname, payload.fcontents,
                                                    payload.args, { message: messages.message,
                                                                    progress: messages.progress });
                    break;
                } case Protocol.Client.UPDATE_CONTENTS:
                    this.assertIDE(message.kind).updateFile(message.payload.fcontents);
                    break;
                case Protocol.Client.QUERY:
                    this.assertIDE(message.kind).eval(message.payload, messages.response);
                    break;
                default:
                    Utils.assertNever(message);
            }
        }

        private processMessages() {
            if (this.ready) {
                this.queue.forEach((msg) => this.processMessage(msg));
                this.queue = [];
            }
        }

        private onMessage(event: MessageEvent) {
            this.queue.push(event.data);
            this.processMessages();
        }
    }

    // This runs unconditionally (this file is called through `new WebWorker(…)`)
    const instance = new Instance();
}
