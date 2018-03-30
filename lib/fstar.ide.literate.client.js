"use strict";
/* global $ FStar Mustache */

FStar.IDE = FStar.IDE || {};
FStar.IDE.LiterateClient = FStar.IDE.LiterateClient || {};

(function() {
    var _ = FStar._;

    var SNIPPET_STATE = FStar.IDE.Client.SNIPPET_STATE;

    var Snippet = FStar.IDE.LiterateClient.Snippet = function(id, ui, editor, literateclient) {
        this.id = id;
        this.ui = ui;
        this.editor = editor;
        this.client = literateclient.client;
        this.literateclient = literateclient;

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
        editorClassName: "fstar-snippet fstar-snippet-pending",
        progressBarClassName: "fstar-progress-bar-pending"
    };
    STATE_UI[SNIPPET_STATE.BUSY] = {
        label: "typechecking…",
        editorClassName: "fstar-snippet fstar-snippet-busy",
        progressBarClassName: "fstar-progress-bar-busy"
    };
    STATE_UI[SNIPPET_STATE.DONE] = {
        label: "typechecked ✓",
        editorClassName: "fstar-snippet fstar-snippet-done",
        progressBarClassName: "fstar-progress-bar-done"
    };

    var PROGRESS_BAR_CLASSES = _.map(STATE_UI, function(ui) {
        return ui.progressBarClassName;
    }).join(" ");

    Snippet.prototype.updateClassAndLabel = function(label) {
        this.ui.$progressBarElement.removeClass(PROGRESS_BAR_CLASSES);
        if (this.state !== null) {
            var ui = STATE_UI[this.state];
            this.ui.$top.attr("class", ui.editorClassName);
            this.ui.$statusLabel.text(label || ui.label);
            this.ui.$progressBarElement.addClass(ui.progressBarClassName);
        } else {
            this.ui.$top.attr("class", "fstar-snippet");
            this.ui.$statusLabel.text("");
        }
    };

    Snippet.prototype.setState = function(state) {
        this.state = state;
        this.updateClassAndLabel();
    };

    Snippet.prototype.complain = function(message) {
        console.log(message);
        this.ui.$complaintBox.text(message).show().delay(4000).fadeOut(500);
    };

    function addRangeMarker(range, className, options) {
        if (range.snippet !== undefined) {
            return range.snippet.editor.markText(
                { line: range.beg[0] - 1, ch: range.beg[1] },
                { line: range.end[0] - 1, ch: range.end[1] },
                _.extend({ className: className }, options || {}));
        }
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

    function scrollToEditor(editor) {
        editor.fstarSnippet.ui.$top[0].scrollIntoView();
        editor.focus();
    }

    function setCursor(editor, pos) {
        editor.focus();
        editor.setCursor(pos[0] - 1, pos[1]);
    }

    function visitRange(range, snippet) {
        if (range.snippet !== undefined) {
            ensureVisible(range.snippet.ui.$top);
            setCursor(range.snippet.editor, range.beg);
        } else if (snippet !== undefined) {
            snippet.complain("This error came from another file");
        }
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

    function formatRange(range, css_class) {
        return $("<span>", { "class": css_class, "role": "button" })
            .append(
                [$('<span class="fstar-range-fname">').text(range.fname),
                 document.createTextNode("("),
                 $('<span class="fstar-range-snippet">').text("snippet #" + (range.snippet.id + 1)),
                 document.createTextNode("): "),
                 $('<span class="fstar-range-beg">').text(formatEndPoint(range.beg)),
                 document.createTextNode("–"),
                 $('<span class="fstar-range-end">').text(formatEndPoint(range.end))]);
    }

    Snippet.prototype.formatError = function(error) {
        var $error_span = $("<span>", { "class": "fstar-" + error.level });
        $error_span.append($("<span>", { "class": "fstar-error-level" }).text(error.level));
        $error_span.append($("<span>", { "class": "fstar-error-message" }).text(error.message));
        _.each(error.ranges, function(range) {
            $error_span
                .append(formatRange(range, "fstar-error-range").click(_.bind(visitRange, {}, range, this)))
                .hover(_.bind(highlightRange, {}, range),
                       _.bind(unhighlightRange, {}, range));
        }, this);
        return $error_span;
    };

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
        this.clearErrors();

        var firstLocalRange;
        this.ui.$errorPanel.append(_.map(errors, _.bind(this.formatError, this)));
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
            setCursor(this.editor, firstLocalRange.beg);
        }

        this.errors = errors;
    };

    var PROOF_STATE_TEMPLATE = `
        <div class="fstar-proof-state">
          <div class="fstar-ps-header">
            <span class="fstar-ps-label">{{label}}</span>
            <span class="fstar-ps-location" />
            <span class="fstar-ps-timestamp">{{timestamp}}</span>
          </div>
          {{#goals}}
          <div class="fstar-ps-goal">
            <div class="fstar-ps-goal-hyps">
              {{#hyps}}
              <div class="fstar-ps-goal-hyp">
                <span class="fstar-ps-goal-hyp-names">{{#hyps}}<span class="fstar-ps-goal-hyp-name">{{name}}</span>{{/hyps}}</span><span class="fstar-ps-goal-hyp-type">{{#highlight}}{{{type}}}{{/highlight}}</span>
              </div>
              {{/hyps}}
            </div>
            <div class="fstar-ps-goal-line">
              <hr /><span class="fstar-ps-goal-label">{{label}}</span>
            </div>
            <div class="fstar-ps-goal-conclusion">
              <span class="fstar-ps-goal-conclusion-type">{{#highlight}}{{{goal.type}}}{{/highlight}}</span>
              <span class="fstar-ps-goal-conclusion-witness">{{goal.witness}}</span>
            </div>
          </div>
          {{/goals}}
        </div>`;

    Snippet.prototype.setProofState = function(ps) {
        var $ps = this.ui.$proofStatePanel;
        $ps.empty().toggle(ps != null);
        if (ps) {
            ps.highlight = function () { return function(snippet, render) {
                return FStar.ClientUtils.highlightSnippet(render(snippet)); }; };
            $ps.append(Mustache.render(PROOF_STATE_TEMPLATE, ps));
            if (ps.location) {
                $ps.find(".fstar-ps-location")
                    .append(formatRange(ps.location, ""))
                    .click(_.bind(visitRange, {}, ps.location, this))
                    .hover(_.bind(highlightRange, {}, ps.location),
                           _.bind(unhighlightRange, {}, ps.location));
            }
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
        if (this.previousSnippet == null) { // F* recomputes dependencies after each first push.
            this.literateclient.updateContents();
        }
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
        this.justBlurredEditor = null;
        // We need to keep track of justBlurredEditor to suggest C-RET only when
        // the user clicked "submit" on the box they were editing.

        this.$progressBar = $('<div class="fstar-progress-bar">');
        this.$progressEchoArea = $('<span class="fstar-progress-echo-area">');
        $("body").append([this.$progressEchoArea, this.$progressBar]);

        this.client = new FStar.IDE.Client(fname, _.bind(this.onProgress, this));
        this.snippets = this.prepareFStarSnippets();
        chainSnippets(this.snippets);

        var fcontents = this.getFileContents();
        // "--lax", "--admit_smt_queries", "true", "--z3refresh",
        var args = ["--fstar_home", "/fstar", "--trace_error"]; // , "--trace_error"
        this.client.init(fcontents, args);
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

    function onBeforeEditorChange(cm, changeObj) {
        var snippet = cm.fstarSnippet;
        var cancelSnippetResult = snippet.cancel();
        if (!cancelSnippetResult.success) {
            changeObj.cancel();
            snippet.complain(cancelSnippetResult.reason);
        }
    }

    function onEditorChanges(cm, _changes) {
        cm.fstarSnippet.ui.$progressBarElement.css("flex-grow", 1 + cm.lineCount());
    }

    function onEditorFocus(cm) {
        cm.fstarSnippet.ui.$progressBarElement.addClass("fstar-active-progress-bar-element");
    }

    Instance.prototype.onEditorBlur = function(cm, _event) {
        this.justBlurredEditor = cm;
        cm.fstarSnippet.ui.$progressBarElement.removeClass("fstar-active-progress-bar-element");
        window.setTimeout(function () { this.justBlurredEditor = null; }, 0);
    };

    Instance.prototype.onProgress = function(msg) {
        var $echo = this.$progressEchoArea;
        if (msg == null) {
            this.progressEchoTimeout = window.setTimeout(function() {
                $echo.fadeOut(500);
            }, 1000);
        } else {
            $echo.text(msg);
            $echo.stop(true, true).toggle(true);
            this.progressEchoTimeout && window.clearTimeout(this.progressEchoTimeout);
        }
    };

    var CM_OPTIONS = {
        viewportMargin: Infinity, // Used in conjunction with ‘height: auto’
        extraKeys: {
            "Ctrl-Enter": onSubmitKey,
            "Ctrl-Alt-Enter": onSubmitKey,
            "Ctrl-Alt-Up": onPreviousKey,
            "Ctrl-Alt-Down": onNextKey
        }
    };

    Instance.prototype.submitClick = function(snippet) {
        snippet.submit();
        if (this.justBlurredEditor !== null && snippet === this.justBlurredEditor.fstarSnippet) {
            snippet.complain("Tip: You can use Ctrl-Return to typecheck the current snippet");
        }
    };

    function allMatchingIndices(regexp, string) {
        var offsets = [], match = null;
        while ((match = regexp.exec(string))) {
            offsets.push(match.index);
        }
        return offsets;
    }

    function pointToLineColumn(point, line_end_positions) {
        var line = _.sortedIndex(line_end_positions, point);
        var col = point - (line > 0 ? line_end_positions[line - 1] + 1 : 0);
        return { line: line, ch: col };
    }

    function trim(s) {
        var spaces = s.match(/^\s*|\s*$/g);
        var lspaces = spaces[0], rspaces = spaces[1];
        return { trimmed: s.substring(lspaces.length, s.length - rspaces.length),
                 lspaces: lspaces, rspaces: rspaces };
    }

    function collapseElidedBlocks(editor, text) {
        var hidden_blocks = /\(\* \{\{\{([^\0]*?)\*\)[^\0]*?\(\* \}\}\} \*\)/g;
        var match = null, ranges = [], eols = null;

        while ((match = hidden_blocks.exec(text))) {
            eols = eols || allMatchingIndices(/\n/g, text);
            var tr = trim(match[1]);
            var link = $('<span class="fstar-elided-fragment">')
                .text(tr.trimmed)
                .prop("title", "Click to reveal elided text");
            ranges.push({ start: pointToLineColumn(match.index, eols),
                          end: pointToLineColumn(match.index + match[0].length, eols),
                          replacement: [document.createTextNode("(* …" + tr.lspaces),
                                        link,
                                        document.createTextNode(tr.rspaces + "*)")] });
        }

        _.each(ranges, function (range) {
            var $repNode = $('<span class="cm-comment">')
                .append(range.replacement);
            var marker = editor.markText(range.start, range.end,
                                         { clearOnEnter: true,
                                           replacedWith: $repNode[0] });
            $repNode.click(function() { marker.clear(); });
        });
    }

    Instance.prototype.prepareFStarSnippet = function(id, editorDiv) {
        var ui = {
            $top: $(editorDiv),
            $controlPanel: $('<div class="fstar-control-panel">'),
            $errorPanel: $('<div class="fstar-error-panel">'),
            $proofStatePanel: $('<div class="fstar-proof-state-panel">'),
            $complaintBox: $('<span class="fstar-snippet-complaint">'),
            $statusLabel: $('<span class="fstar-snippet-status">'),
            $submitButton: $('<span class="fstar-snippet-submit">', { "role": "button" }),
            $progressBarElement: $('<span class="fstar-progress-bar-element">'),
        };

        this.$progressBar.append(ui.$progressBarElement);

        var text = FStar.ClientUtils.stripNewLines(ui.$top.text());
        ui.$top.empty();
        ui.$top.attr("class", "fstar-snippet");

        var editor = FStar.ClientUtils.setupEditor(ui.$top[0], text, CM_OPTIONS);
        editor.on("beforeChange", onBeforeEditorChange);
        editor.on("changes", onEditorChanges);
        editor.on("focus", onEditorFocus);
        editor.on("blur", _.bind(this.onEditorBlur, this));
        collapseElidedBlocks(editor, text);
        ui.$progressBarElement.css("flex-grow", 1 + editor.lineCount());
        ui.$progressBarElement.click(_.bind(scrollToEditor, {}, editor));

        ui.$editor = $(editor.getWrapperElement());
        ui.$top.append(ui.$controlPanel);

        ui.$submitButton.text("typecheck this");
        ui.$controlPanel
            .append(ui.$errorPanel)
            .append(ui.$proofStatePanel)
            .append(ui.$complaintBox)
            .append(ui.$submitButton)
            .append(ui.$statusLabel);

        var snippet = new FStar.IDE.LiterateClient.Snippet(id, ui, editor, this);
        ui.$submitButton.click(_.bind(this.submitClick, this, snippet));

        editor.fstarSnippet = snippet;
        return snippet;
    };

    Instance.prototype.prepareFStarSnippets = function() {
        return $(".fstar").map($.proxy(function(id, editorDiv) { // _.bind doesn't work here
            return this.prepareFStarSnippet(id, editorDiv);
        }, this)).toArray();
    };

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

    Instance.prototype.updateContents = function() {
        this.client.updateContents(this.getFileContents());
    };

    FStar.IDE.LiterateClient.instance = null;
    FStar.IDE.LiterateClient.run = function (fname) {
        FStar.IDE.LiterateClient.instance = FStar.IDE.LiterateClient.instance || new Instance(fname);
    };
})();
