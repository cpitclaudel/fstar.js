/* exported FStarCLIClient */
function FStarCLIClient(window, ace, FStarExamples, FStarCLIProtocol, FStarClientUtils) {
    var editor, worker;
    var verification_start;

    var console = window.console;
    var document = window.document;
    var file_name_input = document.getElementById("file-name");
    var command_line_args_input = document.getElementById("command-line-args");
    var run_button = document.getElementById("run");
    var stdout_block = document.getElementById("stdout");
    var examples_span = document.getElementById("examples");

    var utils = FStarClientUtils(ace);

    function postMessage(query, payload) {
        worker.postMessage({ kind: query, payload: payload });
    }

    var messages = {
        verify: function(fname, fcontents, args) {
            postMessage(FStarCLIProtocol.Client.VERIFY,
                        { fname: fname, fcontents: fcontents, args: args });
        }
    };

    function clear(node) {
        while (node.hasChildNodes()) {
            node.removeChild(node.lastChild);
        }
    }

    function disableButton(message) {
        run_button.disabled = true;
        run_button.value = message;
    }

    function enableButton() {
        run_button.disabled = false;
        run_button.value = "Run F*!";
    }

    function verifyCurrentInput(_event) {
        var fname = file_name_input.value;
        var fcontents = editor.getValue();
        var args = command_line_args_input.value.split(/ +/);
        clear(stdout_block);
        disableButton("Running…");
        verification_start = window.performance.now();
        messages.verify(fname, fcontents, args);
    }

    function logOutput(channel, message) {
        var span = document.createElement("span");
        span.className = channel + "-message";
        span.appendChild(document.createTextNode(message));
        stdout_block.appendChild(span);
    }

    function onMessage(event) {
        var kind = event.data.kind;
        var payload = event.data.payload;
        switch (kind) {
        case FStarCLIProtocol.Worker.PROGRESS:
            disableButton(payload);
            break;
        case FStarCLIProtocol.Worker.READY:
            enableButton();
            break;
        case FStarCLIProtocol.Worker.STDOUT:
            logOutput("stdout", payload);
            break;
        case FStarCLIProtocol.Worker.STDERR:
            logOutput("stderr", payload);
            break;
        case FStarCLIProtocol.Worker.VERIFICATION_COMPLETE:
            enableButton();
            var elapsed = Math.round(window.performance.now() - verification_start);
            logOutput("debug", "-- Verification complete (" + elapsed + "ms)");
            break;
        }
    }

    function setupWorker() {
        worker = new window.Worker("./fstar.cli.worker.js");
        worker.onmessage = onMessage;
    }

    function loadExample() {
        editor.setValue(this.example, -1);
    }

    function addExamples() {
        clear(examples_span);
        var examples = FStarExamples.examples;
        for (var example_name in examples) {
            var example = examples[example_name].join("\n");
            var link = document.createElement("span");
            link.className = "example-link";
            link.appendChild(document.createTextNode(example_name));
            link.example = example;
            link.onclick = loadExample;
            examples_span.appendChild(link);
            examples_span.appendChild(document.createTextNode (" • "));
        }
        examples_span.removeChild(examples_span.lastChild);
    }

    function init() {
        addExamples();
        utils.setupAceEditor("editor");
        clear(stdout_block);
        setupWorker();
        run_button.onclick = verifyCurrentInput;
    }

    return { init: init };
}
