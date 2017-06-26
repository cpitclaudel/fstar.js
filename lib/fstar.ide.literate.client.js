"use strict";
/* global jQuery FStar:true */

FStar.IDE = FStar.IDE || {};
FStar.IDE.LiterateClient = FStar.IDE.LiterateClient || {};

(function($) {
    var Snippet = FStar.IDE.LiterateClient.Snippet = function(id, div, client) {
        this.id = id;
        this.status = null;
        this.client = client;

        this.div = div;
        this.$div = $(div);
        var text = FStar.ClientUtils.stripNewLines(this.$div.text());
        var nlines = (text.match(/\n/g) || []).length;

        this.$div.text(text);
        this.div.className = "fstar-ace-block";
        this.aceEditor = FStar.ClientUtils.setupAceEditor(div, { maxLines: nlines + 1 });

        this.prevEditor = null;
        this.nextEditor = null;
    };

    Snippet.prototype.getId = function () {
        return this.id;
    };

    Snippet.prototype.getText = function () {
        return this.aceEditor.getValue();
    };

    Snippet.prototype.getStatus = function(status) {
        return this.status;
        // TODO
    };

    Snippet.prototype.setStatus = function(status) {
        this.status = status;
        // TODO
    };

    Snippet.prototype.submit = function () {
        return this.client.submit(this, this.prevEditor);
    };

    Snippet.prototype.cancel = function () {
        return this.client.cancel(this);
    };

    function Instance() {
        var _this = this;
        this.client = new FStar.IDE.Client();
        this.editors = $(".fstar").map(function(id, div) {
            _this.setupAceEditor(id, div);
        });
        this.linkEditors();
    }

    Instance.prototype.setupAceEditor = function(id, div) {
        var snippet = new FStar.IDE.LiterateClient.Snippet(id, div, this.client);
        var submitButton = $("<button>", { "class": "ide-submit-button" });
        submitButton.click(function () {
            return snippet.submit(); });
        submitButton.text("submit");
        snippet.$div.after(submitButton);
        return snippet;
    };

    Instance.prototype.linkEditors = function () {
        var editors = this.editors;
        for (var editor_id = 0; editor_id < editors.length; editor_id++) {
            var editor = editors[editor_id];
            var prev_id = editor_id - 1, next_id = editor_id + 1;
            if (prev_id >= 0) {
                editor.prevEditor = editors[prev_id];
            }
            if (next_id < editors.length) {
                editor.nextEditor = editors[next_id];
            }
        }
    };

    FStar.IDE.LiterateClient.instance = null;
    FStar.IDE.LiterateClient.run = function () {
        FStar.IDE.LiterateClient.instance = FStar.IDE.LiterateClient.instance || new Instance();
    };
})(jQuery);
