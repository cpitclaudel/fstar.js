"use strict";
/* global _ jQuery FStar:true */

FStar.IDE = FStar.IDE || {};
FStar.IDE.LiterateClient = FStar.IDE.LiterateClient || {};

(function() {
    var $ = jQuery;

    var Snippet = FStar.IDE.LiterateClient.Snippet = function(id, div, client) {
        this.id = id;
        this.state = null;
        this.client = client;

        this.div = div;
        this.$div = $(div);
        var text = FStar.ClientUtils.stripNewLines(this.$div.text());
        var nlines = (text.match(/\n/g) || []).length;

        this.$div.text(text);
        this.div.className = "fstar-ace-block";
        this.aceEditor = FStar.ClientUtils.setupAceEditor(div, {
            maxLines: nlines + 1,
            showGutter: false,
            showLineNumbers: false });

        this.previousSnippet = null;
        this.nextSnippet = null;
    };

    Snippet.prototype.getId = function () {
        return this.id;
    };

    Snippet.prototype.getText = function () {
        return this.aceEditor.getValue() + "\n\n";
    };

    Snippet.prototype.getState = function() {
        return this.state;
    };

    Snippet.prototype.setState = function(state) {
        this.state = state;
        // TODO
    };

    Snippet.prototype.submit = function () {
        return this.client.submit(this, this.previousSnippet);
    };

    Snippet.prototype.cancel = function () {
        return this.client.cancel(this);
    };

    /// Singleton

    function Instance(fname) {
        this.fname = fname;

        var client = this.client = new FStar.IDE.Client();
        this.snippets = collectSnippets(client);
        chainSnippets(this.snippets);

        var fcontents = this.getFileContents();
        var args = ["--lax", "--admit_smt_queries", "true", "--fstar_home", "/fstar"];
        this.client.init(fname, fcontents, args);
    }

    function collectSnippets(client) {
        return $(".fstar").map(function(id, div) {
            var snippet = new FStar.IDE.LiterateClient.Snippet(id, div, client);
            var submitLink = $("<a>", { "href": "#ide-submit-" + id,
                                        "class": "ide-submit-link" });
            submitLink.click(_.bind(snippet.submit, snippet));
            submitLink.text("typecheck this");
            snippet.$div.after($("<div>", { "class": "ide-submit-box" }).append(submitLink));
            return snippet;
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
