"use strict";
/* global window $ FStar */

FStar.CLI = FStar.CLI || {};
FStar.CLI.Client = FStar.CLI.Client || {};

(function () {
    var _ = FStar._;

    // This needs to be customizable, because web workers are loaded relative to
    // the current *page*, not to the current *script*.
    FStar.CLI.WORKER_DIRECTORY = "./fstar.js/";

    var HTML = `\
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

    var Client = FStar.CLI.Client = function(host, fname, fcontents, cli) {
        var $root = this.$root = $(HTML);
        $(host).replaceWith($root);

        this.$editor = $root.find(".editor");
        this.$file_name = $root.find(".file-name");
        this.$command_line_args = $root.find(".command-line-args");
        this.$stdout = $root.find(".stdout").empty();
        this.$examples = $root.find(".examples").empty();
        this.$run = $root.find(".run").click(_.bind(this.verifyCurrentInput, this));

        this.messages = {
            verify: _.bind(function(fname, fcontents, args) {
                this.postMessage(FStar.CLI.Protocol.Client.VERIFY,
                                 { fname: fname, fcontents: fcontents, args: args });
            }, this)
        };

        this.addExamples();
        this.setupWorker();

        fname && this.$file_name.val(fname);
        cli && this.$command_line_args.text(cli);

        this.verification_start = null;
        this.editor = FStar.ClientUtils.setupEditor(this.$editor[0], fcontents || "");
    };

    Client.prototype.postMessage = function(query, payload) {
        this.worker.postMessage({ kind: query, payload: payload });
    };

    Client.prototype.toggleButton = function(disabled, message) {
        this.$run.prop("disabled", disabled);
        this.$run.val(message || "Run F*!");
    };

    Client.prototype.verifyCurrentInput = function(_event) {
        var fname = this.$file_name.val();
        var fcontents = this.editor.getValue();
        var args = this.$command_line_args.val().split(/ +/);
        this.$stdout.empty();
        this.toggleButton(true, "Running…");
        this.verification_start = window.performance.now();
        this.messages.verify(fname, fcontents, args);
    };

    Client.prototype.logOutput = function(channel, message) {
        var $span = $("<span>", { "class": "fstar-" + channel + "-message" });
        this.$stdout.append($span.text(message));
    };

    Client.prototype.onMessage = function(event) {
        var kind = event.data.kind;
        var payload = event.data.payload;
        switch (kind) {
        case FStar.CLI.Protocol.Worker.PROGRESS:
            this.toggleButton(true, payload);
            break;
        case FStar.CLI.Protocol.Worker.READY:
            this.toggleButton(false);
            break;
        case FStar.CLI.Protocol.Worker.STDOUT:
            this.logOutput("stdout", payload);
            break;
        case FStar.CLI.Protocol.Worker.STDERR:
            this.logOutput("stderr", payload);
            break;
        case FStar.CLI.Protocol.Worker.VERIFICATION_COMPLETE:
            this.toggleButton(false);
            var elapsed = Math.round(window.performance.now() - this.verification_start);
            this.logOutput("debug", "-- Verification complete (" + elapsed + "ms)");
            break;
        default:
            FStar.ClientUtils.assert(false);
        }
    };

    Client.prototype.setupWorker = function () {
        this.worker = new window.Worker(FStar.CLI.WORKER_DIRECTORY + "fstar.cli.worker.js");
        this.worker.onmessage = _.bind(this.onMessage, this);
    };

    function loadExample(editor, example) {
        editor.setValue(example, -1);
    }

    Client.prototype.addExamples = function () {
        this.$examples.empty();
        _.each(FStar.CLI.examples, function(lines, example_name) {
            var $link = $("<span>", { "class": "example-link" });
            $link.click(_.bind(loadExample, {}, this.editor, lines.join("\n")));
            $link.text(example_name);
            this.$examples.append($link);
            this.$examples.append(document.createTextNode(" • "));
        }, this);
        this.$examples.children().last().remove();
    };

    Client.prototype.setValue = function(fcontents) {
        this.editor.setValue(fcontents, -1);
    };

    Client.prototype.setFilename = function(fname) {
        this.$root.find(".file-name").val(fname);
    };
}());
