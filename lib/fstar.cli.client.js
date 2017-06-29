"use strict";
/* global window $ FStar:true */

FStar.CLI = FStar.CLI || {};
FStar.CLI.Client = FStar.CLI.Client || {};

(function () {
    var _ = FStar._;

    function Instance() {
        this.$file_name_input = $("#file-name");
        this.$command_line_args_input = $("#command-line-args");
        this.$run_button = $("#run");
        this.$stdout_block = $("#stdout");
        this.$examples_span = $("#examples");

        this.messages = {
            verify: _.bind(function(fname, fcontents, args) {
                this.postMessage(FStar.CLI.Protocol.Client.VERIFY,
                                 { fname: fname, fcontents: fcontents, args: args });
            }, this)
        };

        var $editor = $("#editor");
        var text = $editor.text();
        $editor.empty();

        this.verification_start = null;
        this.editor = FStar.ClientUtils.setupEditor($editor[0], text);
        this.$stdout_block.empty();

        this.addExamples();
        this.setupWorker();

        this.$run_button.click(_.bind(this.verifyCurrentInput, this));
    }

    Instance.prototype.postMessage = function(query, payload) {
        this.worker.postMessage({ kind: query, payload: payload });
    };


    Instance.prototype.disableButton = function(message) {
        this.$run_button.prop("disabled", true);
        this.$run_button.val(message);
    };

    Instance.prototype.enableButton = function () {
        this.$run_button.prop("disabled", false);
        this.$run_button.val("Run F*!");
    };

    Instance.prototype.verifyCurrentInput = function(_event) {
        var fname = this.$file_name_input.val();
        var fcontents = this.editor.getValue();
        var args = this.$command_line_args_input.val().split(/ +/);
        this.$stdout_block.empty();
        this.disableButton("Running…");
        this.verification_start = window.performance.now();
        this.messages.verify(fname, fcontents, args);
    };

    Instance.prototype.logOutput = function(channel, message) {
        var $span = $("<span>", { "class": channel + "-message" });
        this.$stdout_block.append($span.text(message));
    };

    Instance.prototype.onMessage = function(event) {
        var kind = event.data.kind;
        var payload = event.data.payload;
        switch (kind) {
        case FStar.CLI.Protocol.Worker.PROGRESS:
            this.disableButton(payload);
            break;
        case FStar.CLI.Protocol.Worker.READY:
            this.enableButton();
            break;
        case FStar.CLI.Protocol.Worker.STDOUT:
            this.logOutput("stdout", payload);
            break;
        case FStar.CLI.Protocol.Worker.STDERR:
            this.logOutput("stderr", payload);
            break;
        case FStar.CLI.Protocol.Worker.VERIFICATION_COMPLETE:
            this.enableButton();
            var elapsed = Math.round(window.performance.now() - this.verification_start);
            this.logOutput("debug", "-- Verification complete (" + elapsed + "ms)");
            break;
        default:
            FStar.ClientUtils.assert(false);
        }
    };

    Instance.prototype.setupWorker = function () {
        this.worker = new window.Worker("./fstar.js/fstar.cli.worker.js");
        this.worker.onmessage = _.bind(this.onMessage, this);
    };

    function loadExample(editor, example) {
        editor.setValue(example, -1);
    }

    Instance.prototype.addExamples = function () {
        this.$examples_span.empty();
        _.each(FStar.CLI.examples, function(lines, example_name) {
            var $link = $("<span>", { "class": "example-link" });
            $link.click(_.bind(loadExample, {}, this.editor, lines.join("\n")));
            $link.text(example_name);
            this.$examples_span.append($link);
            this.$examples_span.append(document.createTextNode(" • "));
        }, this);
        this.$examples_span.children().last().remove();
    };

    var Client = FStar.CLI.Client;
    Client.instance = null;
    Client.run = function () {
        Client.instance = Client.instance || new Instance();
    };
}());
