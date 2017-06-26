"use strict";
/* global window _ FStar:true */

FStar.CLI = FStar.CLI || {};
FStar.CLI.Client = FStar.CLI.Client || {};

(function () {
    function Instance() {
        var document = window.document;
        this.file_name_input = document.getElementById("file-name");
        this.command_line_args_input = document.getElementById("command-line-args");
        this.run_button = document.getElementById("run");
        this.stdout_block = document.getElementById("stdout");
        this.examples_span = document.getElementById("examples");

        this.messages = {
            verify: _.bind(function(fname, fcontents, args) {
                this.postMessage(FStar.CLI.Protocol.Client.VERIFY,
                                 { fname: fname, fcontents: fcontents, args: args });
            }, this)
        };

        this.verification_start = null;
        this.editor = FStar.ClientUtils.setupAceEditor("editor");
        FStar.ClientUtils.clear(this.stdout_block);

        this.addExamples();
        this.setupWorker();

        this.run_button.onclick = _.bind(this.verifyCurrentInput, this);
    }

    Instance.prototype.postMessage = function(query, payload) {
        this.worker.postMessage({ kind: query, payload: payload });
    };


    Instance.prototype.disableButton = function(message) {
        this.run_button.disabled = true;
        this.run_button.value = message;
    };

    Instance.prototype.enableButton = function () {
        this.run_button.disabled = false;
        this.run_button.value = "Run F*!";
    };

    Instance.prototype.verifyCurrentInput = function(_event) {
        var fname = this.file_name_input.value;
        var fcontents = this.editor.getValue();
        var args = this.command_line_args_input.value.split(/ +/);
        FStar.ClientUtils.clear(this.stdout_block);
        this.disableButton("Running…");
        this.verification_start = window.performance.now();
        this.messages.verify(fname, fcontents, args);
    };

    Instance.prototype.logOutput = function(channel, message) {
        var span = window.document.createElement("span");
        span.className = channel + "-message";
        span.appendChild(window.document.createTextNode(message));
        this.stdout_block.appendChild(span);
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
        this.worker = new window.Worker("./fstar.cli.worker.js");
        this.worker.onmessage = _.bind(this.onMessage, this);
    };

    function loadExample() {
        this.editor.setValue(this.example, -1);
    }

    Instance.prototype.addExamples = function () {
        FStar.ClientUtils.clear(this.examples_span);
        var examples = FStar.CLI.examples;
        for (var example_name in examples) {
            var example = examples[example_name].join("\n");
            var link = window.document.createElement("span");
            link.className = "example-link";
            link.appendChild(window.document.createTextNode(example_name));
            link.example = example;
            link.editor = this.editor;
            link.onclick = loadExample;
            this.examples_span.appendChild(link);
            this.examples_span.appendChild(window.document.createTextNode (" • "));
        }
        this.examples_span.removeChild(this.examples_span.lastChild);
    };

    var Client = FStar.CLI.Client;
    Client.instance = null;
    Client.run = function () {
        Client.instance = Client.instance || new Instance();
    };
}());
