namespace FStar.CLI {
    export const examples: { [k: string]: string[] } = {};
}

namespace FStar.CLI {
    const _ = FStar._;
    import Utils = FStar.ClientUtils;

    export class Client {
        private ui: {
            $root: JQuery<HTMLElement>;
            $editor: JQuery<HTMLElement>;
            $fileName: JQuery<HTMLElement>;
            $command_line_args: JQuery<HTMLElement>;
            $stdout: JQuery<HTMLElement>;
            $examples: JQuery<HTMLElement>;
            $run: JQuery<HTMLElement>;
        };

        private worker: Worker;
        private editor: CodeMirror.Editor;
        private verificationStart: number | null;

        private static HTML = `\
            <div class="fstar-standalone-editor">
              <div class="editor"></div>
              <div class="control-panel">
                <div class="row">
                  <span class="file-name-cell">
                    <input class="file-name" type="text" value="scratchpad.fst" />
                  </span>
                  <span class="command-line-args-cell">
                    <input class="command-line-args" type="text"
                           value="--fstar_home /fstar" />
                  </span>
                  <span class="run-cell">
                    <input class="run" type="button" value="…" disabled="disabled" />
                  </span>
                </div>
              </div>
              <pre class="stdout"></pre>
            </div>`;

        // This needs to be customizable, because web workers are loaded relative to
        // the current *page*, not to the current *script*.
        public static WORKER_DIRECTORY = "./fstar.js/";

        constructor(host: HTMLElement, fname: string, fcontents: string | null, cli: string) {
            const $root = $(Client.HTML);
            $(host).replaceWith($root);

            this.ui = {
                $root,
                $editor: $root.find(".editor"),
                $fileName: $root.find(".file-name"),
                $command_line_args: $root.find(".command-line-args"),
                $stdout: $root.find(".stdout").empty(),
                $examples: $root.find(".examples").empty(),
                $run: $root.find(".run").click(() => this.verifyCurrentInput())
            };

            this.addExamples();

            this.worker = new _Worker(Client.WORKER_DIRECTORY + "fstar.cli.worker.js");
            this.worker.onmessage = (msg: MessageEvent) => this.onMessage(msg);

            fname && this.ui.$fileName.val(fname);
            cli && this.ui.$command_line_args.text(cli);

            this.verificationStart = null;
            this.editor = Utils.setupEditor(this.ui.$editor[0], fcontents || "");
        }

        private postMessage(msg: Protocol.ClientMessage) {
            this.worker.postMessage(msg);
        }

        private toggleButton(disabled: boolean, message?: string) {
            this.ui.$run.prop("disabled", disabled);
            this.ui.$run.val(message || "Run F*!");
        }

        public verifyCurrentInput() {
            const fname = (this.ui.$fileName.val() || "").toString();
            const fcontents = this.editor.getValue();
            const args = (this.ui.$command_line_args.val() || "").toString().split(/ +/);
            this.ui.$stdout.empty();
            this.toggleButton(true, "Running…");
            this.verificationStart = Date.now();
            this.postMessage({ kind: Protocol.ClientMessageKind.VERIFY,
                               payload: { fname, fcontents, args } });
        }

        private logOutput(channel: string, message: string) {
            const $span = $("<span>", { class: `fstar-${channel}-message` });
            this.ui.$stdout.append($span.text(message));
        }

        private processMessage(msg: Protocol.WorkerMessage) {
            switch (msg.kind) {
                case Protocol.WorkerMessageKind.PROGRESS:
                    this.toggleButton(true, msg.payload);
                    break;
                case Protocol.WorkerMessageKind.READY:
                    this.toggleButton(false);
                    break;
                case Protocol.WorkerMessageKind.STDOUT:
                    this.logOutput("stdout", msg.payload);
                    break;
                case Protocol.WorkerMessageKind.STDERR:
                    this.logOutput("stderr", msg.payload);
                    break;
                case Protocol.WorkerMessageKind.VERIFICATION_COMPLETE:
                    this.toggleButton(false);
                    const elapsed = Math.round(Date.now() - (this.verificationStart || 0));
                    this.logOutput("debug", `-- Verification complete ${elapsed}ms`);
                    break;
                default:
                    ClientUtils.assertNever(msg);
            }
        }

        private onMessage(event: MessageEvent) {
            this.processMessage(event.data);
        }

        public setValue(fcontents: string) {
            this.editor.setValue(fcontents, -1);
        }

        public setFilename(fname: string) {
            this.ui.$fileName.val(fname);
        }

        private addExamples() {
            this.ui.$examples.empty();
            _.each(FStar.CLI.examples, (lines: string[], exampleName: string) => {
                const $link = $("<span>", { class: "example-link" });
                $link.click(() => this.setValue(lines.join("\n")));
                $link.text(exampleName);
                this.ui.$examples.append($link);
                this.ui.$examples.append(document.createTextNode(" • "));
            });
            this.ui.$examples.children().last().remove();
        }
    }
}
