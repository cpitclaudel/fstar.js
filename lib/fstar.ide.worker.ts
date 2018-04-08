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
