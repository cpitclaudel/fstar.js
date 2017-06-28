"use strict";
/* global _ jQuery FStar:true */

FStar.IDE = FStar.IDE || {};
FStar.IDE.LiterateClient = FStar.IDE.LiterateClient || {};

(function() {
    var $ = jQuery;
    var SNIPPET_STATE = FStar.IDE.Client.SNIPPET_STATE;

    var Snippet = FStar.IDE.LiterateClient.Snippet = function(id, ui, editor, client) {
        this.id = id;
        this.ui = ui;
        this.editor = editor;
        this.client = client;

        this.state = null;
        this.previousSnippet = null;
        this.nextSnippet = null;
    };

    Snippet.prototype.getId = function () {
        return this.id;
    };

    Snippet.prototype.getText = function () {
        return this.editor.getValue() + "\n\n";
    };

    Snippet.prototype.getState = function () {
        return this.state;
    };

    var STATE_UI = FStar.IDE.LiterateClient.STATE_UI = {};
    STATE_UI[SNIPPET_STATE.PENDING] = {
        label: "waiting for previous snippets…",
        className: "fstar-snippet fstar-snippet-pending"
    };
    STATE_UI[SNIPPET_STATE.BUSY] = {
        label: "typechecking…",
        className: "fstar-snippet fstar-snippet-busy"
    };
    STATE_UI[SNIPPET_STATE.DONE] = {
        label: "typechecked ✓",
        className: "fstar-snippet fstar-snippet-done"
    };

    Snippet.prototype.setState = function(state) {
        this.state = state;

        if (state !== null) {
            var ui = STATE_UI[state];
            this.ui.$top.attr("class", ui.className);
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

    function addRangeMarker(range, className, options) {
        if (range.snippet !== undefined) {
            return range.snippet.editor.markText(
                { line: range.beg[0] - 1, ch: range.beg[1] },
                { line: range.end[0] - 1, ch: range.end[1] },
                _.extend({ className: className }, options || {}));
        }
    }

    function visitRange(range) {
        // TODO
        // $("html, body").animate({
        //     scrollTop: range.marker.offset().top
        // }, 2000);
    }

    function highlightRange(range) {
        if (!range.highlighter) {
            range.highlighter = addRangeMarker(range, "fstar-highlighted-marker");
        }
    }

    function unhighlightRange(range) {
        if (range.highlighter) {
            range.highlighter.clear();
            delete range.highlighter;
        }
    }

    function formatEndPoint(point) {
        return point[0] + "," + point[1];
    }

    function formatRange(range) {
        return $("<span>", { "class": "fstar-error-range", "role": "button" })
            .append(
                [$('<span class="fstar-range-fname">').text(range.fname),
                 document.createTextNode("("),
                 $('<span class="fstar-range-snippet">').text("snippet #" + (range.snippet.id + 1)),
                 document.createTextNode("): "),
                 $('<span class="fstar-range-beg">').text(formatEndPoint(range.beg)),
                 document.createTextNode("–"),
                 $('<span class="fstar-range-end">').text(formatEndPoint(range.end))]);
    }

    function formatError(error) {
        var $error_span = $("<p>", { "class": "fstar-" + error.level });
        $error_span.append($("<span>", { "class": "fstar-error-level" }).text(error.level));
        $error_span.append($("<span>", { "class": "fstar-error-message" }).text(error.message));
        _.each(error.ranges, function(range) {
            $error_span
                .append(formatRange(range).click(_.bind(visitRange, {}, range)))
                .hover(_.bind(highlightRange, {}, range),
                       _.bind(unhighlightRange, {}, range));
        }, this);
        return $error_span;
    }

    Snippet.prototype.clearErrors = function() {
        _.each(this.errors, function(error) {
            _.each(error.ranges, function(range) {
                _.each(["marker", "highlighter"], function(markerName) {
                    if (range[markerName]) {
                        range[markerName].clear();
                        delete range[markerName];
                    }
                });
            });
        });
        this.errors = [];
    };

    Snippet.prototype.setErrors = function(errors) {
        this.ui.$errorPanel.empty();

        var firstLocalRange;
        this.ui.$errorPanel.append(_.map(errors, formatError));
        _.each(errors, function(error) {
            _.each(error.ranges, function(range) {
                if (firstLocalRange === undefined && range.snippet === this) {
                    firstLocalRange = range;
                }
                range.marker =
                    addRangeMarker(range, "fstar-" + error.level + "-marker",
                                   { title: error.message });
            }, this);
        }, this);

        var hasErrors = errors.length > 0;
        this.ui.$errorPanel.toggle(hasErrors);
        if (hasErrors && firstLocalRange !== undefined) {
            this.editor.focus();
            this.editor.setCursor(firstLocalRange.beg[0] - 1, firstLocalRange.beg[1]);
        }
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

    function ensureVisible($element) {
        var elem_start = $element.offset().top;
        var vp_start = $(window).scrollTop();

        var elem_end = elem_start + $element.height();
        var vp_end = vp_start + window.innerHeight;

        if (elem_start < vp_start) {
            $("html, body").animate({ scrollTop: elem_start }, 200);
        } else if (elem_end > vp_end) {
            $("html, body").animate({ scrollTop: elem_end - window.innerHeight }, 200);
        }
    }

    function jumpTo(snippet) {
        if (snippet !== null) {
            snippet.editor.focus();
            ensureVisible(snippet.ui.$top);
        }
    }

    function onSubmitKey(editor) { editor.fstarSnippet.submit(); }
    function onPreviousKey(editor) { jumpTo(editor.fstarSnippet.previousSnippet); }
    function onNextKey(editor) { jumpTo(editor.fstarSnippet.nextSnippet); }

    function onBeforeChange(cm, changeObj) {
        var cancelSnippetResult = cm.fstarSnippet.cancel();
        if (!cancelSnippetResult.success) {
            changeObj.cancel();
            // TODO display more prominently
            console.log(cancelSnippetResult.reason);
        }
    }

    var CM_OPTIONS = {
        viewportMargin: Infinity, // Used in conjunction with ‘height: auto’
        extraKeys: {
            "Ctrl-Enter": onSubmitKey,
            "Ctrl-Alt-Enter": onSubmitKey,
            "Ctrl-Alt-Up": onPreviousKey,
            "Ctrl-Alt-Down": onNextKey
        }
    };

    function prepareFStarSnippet(client, id, editorDiv) {
        var ui = {
            $top: $(editorDiv),
            $controlPanel: $("<div>", { "class": "fstar-control-panel" }),
            $errorPanel: $("<div>", { "class": "fstar-error-panel" }),
            $statusLabel: $("<span>", { "class": "fstar-snippet-status" }),
            $submitButton: $("<span>", { "class": "fstar-snippet-submit", "role": "button" })
        };

        var text = FStar.ClientUtils.stripNewLines(ui.$top.text());
        ui.$top.empty();
        ui.$top.attr("class", "fstar-snippet");

        var editor = FStar.ClientUtils.setupEditor(ui.$top[0], text, CM_OPTIONS);
        editor.on("beforeChange", onBeforeChange);

        ui.$editor = $(editor.getWrapperElement());
        ui.$top.append(ui.$controlPanel);

        ui.$submitButton.text("typecheck this");
        ui.$controlPanel
            .append(ui.$errorPanel)
            .append(ui.$submitButton)
            .append(ui.$statusLabel);

        var snippet = new FStar.IDE.LiterateClient.Snippet(id, ui, editor, client);
        ui.$submitButton.click(_.bind(snippet.submit, snippet));

        editor.fstarSnippet = snippet;
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
