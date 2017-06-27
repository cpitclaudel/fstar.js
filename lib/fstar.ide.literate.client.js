"use strict";
/* global _ jQuery FStar:true */

FStar.IDE = FStar.IDE || {};
FStar.IDE.LiterateClient = FStar.IDE.LiterateClient || {};

(function() {
    var $ = jQuery;
    var SNIPPET_STATE = FStar.IDE.Client.SNIPPET_STATE;

    var Snippet = FStar.IDE.LiterateClient.Snippet = function(id, ui, aceEditor, client) {
        this.id = id;
        this.ui = ui;
        this.aceEditor = aceEditor;
        this.client = client;

        this.state = null;
        this.previousSnippet = null;
        this.nextSnippet = null;
    };

    Snippet.prototype.getId = function () {
        return this.id;
    };

    Snippet.prototype.getText = function () {
        return this.aceEditor.getValue() + "\n\n";
    };

    Snippet.prototype.getState = function () {
        return this.state;
    };

    var STATE_UI = FStar.IDE.LiterateClient.STATE_UI = {};
    STATE_UI[SNIPPET_STATE.PENDING] = {
        label: "waiting for previous snippets…",
        cssClass: "fstar-snippet fstar-snippet-pending"
    };
    STATE_UI[SNIPPET_STATE.BUSY] = {
        label: "typechecking…",
        cssClass: "fstar-snippet fstar-snippet-busy"
    };
    STATE_UI[SNIPPET_STATE.DONE] = {
        label: "typechecked ✓",
        cssClass: "fstar-snippet fstar-snippet-done"
    };

    Snippet.prototype.setState = function (state) {
        this.state = state;

        if (state !== null) {
            var ui = STATE_UI[state];
            this.ui.$top.attr("class", ui.cssClass);
            this.ui.$statusLabel.text(ui.label);
        } else {
            this.ui.$top.attr("class", "fstar-snippet");
            this.ui.$statusLabel.text("");
        }

        switch (state) {
        case SNIPPET_STATE.PENDING:
            //TODO
            break;
        case SNIPPET_STATE.BUSY:
            //TODO
            break;
        case SNIPPET_STATE.DONE:
            //TODO
            break;
        case null:
            //TODO
            break;
        default:
            FStar.ClientUtils.assert(false);
        }
    };

    function formatEndPoint(point) {
        return point[0] + "," + point[1];
    }

    function formatRange(range) {
        return [$("<span>", { "class": "fstar-range-fname" }).text(range.fname),
                document.createTextNode("("),
                $("<span>", { "class": "fstar-range-beg" }).text(formatEndPoint(range.beg)),
                document.createTextNode("–"),
                $("<span>", { "class": "fstar-range-end" }).text(formatEndPoint(range.end)),
                document.createTextNode(")")];
    }

    function formatError(error) {
        var $error_span = $("<p>", { "class": "fstar-error fstar-error-" + error.level });
        $error_span.append($("<span>", { "class": "fstar-error-level" })
                           .text(error.level));
        $error_span.append($("<span>", { "class": "fstar-error-message" })
                           .text(error.message));
        _.each(error.ranges, function(range) {
            $error_span.append($("<span>", { "class": "fstar-error-range" })
                               .append(formatRange(range)));
        }, this);
        return $error_span;
    }

    Snippet.prototype.setErrors = function (errors) {
        this.ui.$errorPanel.empty();
        this.ui.$errorPanel.append(_.map(errors, formatError));
        this.ui.$errorPanel.show();
    };

    Snippet.prototype.lineage = function(predicate) {
        var last = this;
        var ancestors = [];
        while (last !== null && predicate(last)) {
            ancestors.push(last);
            last = last.previousSnippet;
        }
        return ancestors.reverse();
    };

    Snippet.prototype.submitSelf = function () {
        this.client.submit(this, this.previousSnippet);
    };

    Snippet.prototype.submit = function () {
        var ancestors = this.lineage(function (parent) { return parent.state == null; });
        _.each(ancestors, function(snippet) { snippet.submitSelf(); });
    };

    Snippet.prototype.cancel = function () {
        return this.client.cancel(this);
    };

    /// Singleton

    function Instance(fname) {
        this.fname = fname;

        var client = this.client = new FStar.IDE.Client();
        this.snippets = prepareFStarSnippets(client);
        chainSnippets(this.snippets);

        var fcontents = this.getFileContents();
        var args = ["--lax", "--admit_smt_queries", "true", "--fstar_home", "/fstar"];
        this.client.init(fname, fcontents, args);
    }

    function prepareFStarSnippet(client, id, editorDiv) {
        var ui = {
            $top: null,
            $editor: $(editorDiv),
            $controlPanel: $("<div>", { "class": "fstar-control-panel" }),
            $errorPanel: $("<div>", { "class": "fstar-error-panel" }),
            $statusLabel: $("<span>", { "class": "fstar-snippet-status" }),
            $submitButton: $("<span>", { "class": "fstar-snippet-submit", "role": "button" })
        };

        var text = FStar.ClientUtils.stripNewLines(ui.$editor.text());
        ui.$editor.text(text);
        ui.$top = ui.$editor.wrap("<div>").parent();
        ui.$top.attr("class", "fstar-snippet");
        ui.$top.append(ui.$controlPanel);
        ui.$submitButton.text("typecheck this");
        ui.$controlPanel
            .append(ui.$errorPanel)
            .append(ui.$submitButton)
            .append(ui.$statusLabel);

        var nlines = (text.match(/\n/g) || []).length;
        var aceEditor = FStar.ClientUtils.setupAceEditor(ui.$editor[0], {
            maxLines: nlines + 1,
            showGutter: false,
            showLineNumbers: false,
            highlightActiveLine: false,
            highlightGutterLine: false
        });

        var snippet = new FStar.IDE.LiterateClient.Snippet(id, ui, aceEditor, client);
        ui.$submitButton.click(_.bind(snippet.submit, snippet));

        return snippet;
    }

    function prepareFStarSnippets(client) {
        return $(".fstar").map(function(id, editorDiv) {
            return prepareFStarSnippet(client, id, editorDiv);
        }).toArray();
    }

    function chainSnippets(snippets) {
        for (var snippet_id = 0; snippet_id < snippets.length; snippet_id++) {
            var snippet = snippets[snippet_id];
            var prev_id = snippet_id - 1, next_id = snippet_id + 1;
            if (prev_id >= 0) {
                snippet.previousSnippet = snippets[prev_id];
            }
            if (next_id < snippets.length) {
                snippet.nextSnippet = snippets[next_id];
            }
        }
    }

    Instance.prototype.getFileContents = function() {
        return this.snippets.map(function(snippet) {
            return snippet.getText();
        }).join("");
    };

    FStar.IDE.LiterateClient.instance = null;
    FStar.IDE.LiterateClient.run = function (fname) {
        FStar.IDE.LiterateClient.instance = FStar.IDE.LiterateClient.instance || new Instance(fname);
    };
})();
