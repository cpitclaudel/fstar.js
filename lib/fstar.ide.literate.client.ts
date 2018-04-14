/* Run F* in --ide mode on literate F* documents (user side).

Copyright (C) 2017-2018 Clément Pit-Claudel
Author: Clément Pit-Claudel <clement.pitclaudel@live.com>
URL: https://github.com/cpitclaudel/fstar.js

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License. */

namespace FStar.IDE.LiterateClient {
    const _ = FStar._;

    namespace Utils {
        export function ensureVisible($element: JQuery<HTMLElement>) {
            const elemStart = ($element.offset() || { top: 0 }).top;
            const vpStart = $(window).scrollTop() || 0;

            const elemEnd = elemStart + ($element.height() || 0);
            const vpEnd = vpStart + window.innerHeight;

            if (elemStart < vpStart) {
                $("html, body").animate({ scrollTop: elemStart }, 200);
            } else if (elemEnd > vpEnd) {
                $("html, body").animate({ scrollTop: elemEnd - window.innerHeight }, 200);
            }
        }
    }

    interface StateUI {
        label: string;
        editorClassName: string;
        progressBarClassName: string;
    }

    const STATE_UI: { [k in SnippetState]: StateUI } = {
        [SnippetState.PENDING]: {
            label: "waiting for previous snippets…",
            editorClassName: "fstar-snippet fstar-snippet-pending",
            progressBarClassName: "fstar-progress-bar-pending"
        },
        [SnippetState.BUSY]: {
            label: "typechecking…",
            editorClassName: "fstar-snippet fstar-snippet-busy",
            progressBarClassName: "fstar-progress-bar-busy"
        },
        [SnippetState.DONE]: {
            label: "typechecked ✓",
            editorClassName: "fstar-snippet fstar-snippet-done",
            progressBarClassName: "fstar-progress-bar-done"
        }
    };

    const PROGRESS_BAR_CLASSES = _.map(STATE_UI, (ui: StateUI) => ui.progressBarClassName).join(" ");

    interface SnippetUI {
        $top: JQuery<HTMLElement>;
        $editor: JQuery<HTMLElement>;
        $controlPanel: JQuery<HTMLElement>;
        $errorPanel: JQuery<HTMLElement>;
        $proofStatePanel: JQuery<HTMLElement>;
        $docBox: JQuery<HTMLElement>;
        $complaintBox: JQuery<HTMLElement>;
        $statusLabel: JQuery<HTMLElement>;
        $submitButton: JQuery<HTMLElement>;
        $progressBarElement: JQuery<HTMLElement>;
    }

    interface AnnotatedEditor extends CodeMirror.Editor {
        fstarSnippet: Snippet;
    }

    class Snippet implements BasicSnippet<Snippet> {
        public idePrivateData: IdePrivateSnippetData;

        private id: number;
        private ui: SnippetUI;
        private lastWordRange: CodeMirror.Range | null;
        private editor: AnnotatedEditor;
        private errors: Array<FStarError<Snippet>>;
        private proofState: ProofState<Snippet> | null;
        private client: Client<Snippet>;
        private literateclient: Instance;

        public state: SnippetState | null;
        public previousSnippet: Snippet | null;
        public nextSnippet: Snippet | null;

        constructor(id: number, ui: SnippetUI, editor: CodeMirror.Editor,
                    client: Client<Snippet>, literateclient: Instance) {
            this.id = id;
            this.ui = ui;
            this.lastWordRange = null;
            this.editor = editor as AnnotatedEditor;
            this.editor.on("cursorActivity", cm => this.onCursorActivity(cm));
            this.editor.fstarSnippet = this;
            this.errors = [];
            this.proofState = null;
            this.client = client;
            this.literateclient = literateclient;

            this.state = null;
            this.previousSnippet = null;
            this.nextSnippet = null;

            this.idePrivateData = emptyIdePrivateData;
        }

        public getId() {
            return this.id;
        }

        public getText() {
            return this.editor.getValue() + "\n\n";
        }

        public getState() {
            return this.state;
        }

        private updateClassAndLabel(label?: string) {
            this.ui.$progressBarElement.removeClass(PROGRESS_BAR_CLASSES);
            if (this.state !== null) {
                const ui = STATE_UI[this.state];
                this.ui.$top.attr("class", ui.editorClassName);
                this.ui.$statusLabel.text(label || ui.label);
                this.ui.$progressBarElement.addClass(ui.progressBarClassName);
            } else {
                this.ui.$top.attr("class", "fstar-snippet");
                this.ui.$statusLabel.text("");
            }
        }

        public setState(state: SnippetState) {
            this.state = state;
            this.updateClassAndLabel();
        }

        public complain(message: string) {
            this.ui.$complaintBox.text(message).show().delay(4000).fadeOut(500);
        }

        public focus() {
            this.editor.focus();
            Utils.ensureVisible(this.ui.$top);
        }

        public scrollIntoView() {
            this.ui.$top[0].scrollIntoView();
            this.editor.focus();
        }

        // FIXME type
        private static formatSignature(data: any) {
            return $('<span class="fstar-docs-signature">')
                .append($('<span class="fstar-sig-name">').text(data.name))
                .append($('<span class="fstar-sig-type">').html(data.type));
        }

        private showDocs(spans: Array<JQuery<Element>> | null) {
            this.ui.$docBox.empty().append(spans || []).toggle(spans != null);
        }

        // FIXME improve response type
        private showLookupResults(status: Protocol.QueryStatus, data: any) {
            if (status === Protocol.QueryStatus.SUCCESS) {
                const docs = [Snippet.formatSignature(data)];
                if (data.documentation) {
                    docs.push($('<span class="fstar-docs-docstring">').text(data.documentation));
                }
                this.showDocs(docs);
            } else {
                this.showDocs(null);
            }
        }

        private findSymbolAt(cm: CodeMirror.Editor, pos: CodeMirror.Position) {
            const prevWordChars = (cm as any).getHelper(pos, "wordChars");
            try {
                const wordChars = /[\w_'.]/;
                const line = cm.getDoc().getLine(pos.line);
                CodeMirror.registerHelper("wordChars", "fstar", wordChars);
                const after = pos.ch < line.length && /\w/.test(line.charAt(pos.ch));
                const realPos = { line: pos.line, ch: pos.ch, sticky: after ? "after" : "before" };
                return cm.findWordAt(realPos);
            } finally {
                CodeMirror.registerHelper("wordChars", "fstar", prevWordChars);
            }
        }

        private onCursorActivity(cm: CodeMirror.Editor) {
            ClientUtils.assert(cm === this.editor);
            if (this.client.busy()) {
                this.showDocs(null);
                return;
            }

            const pos = cm.getDoc().getCursor();
            const wordRange = this.findSymbolAt(cm, pos);
            if (!_.isEqual(wordRange, this.lastWordRange)) {
                const word = cm.getDoc().getRange(wordRange.anchor, wordRange.head);
                if (!/^[A-Za-z0-9._']+$/.test(word)) {
                    this.ui.$docBox.hide();
                } else {
                    const requestedInfo = ["type", "documentation"];
                    this.client.lookupAt(this, word, null, requestedInfo,
                                         { line: pos.line, column: pos.ch }, null,
                                         (status, data) => this.showLookupResults(status, data));
                }
                this.lastWordRange = wordRange;
            }
        }

        // LATER
        // this.ui.$editor.mousemove(evt => this.mousemove(evt));
        //
        // private editorPosAt(evt: JQuery.Event<HTMLElement>) {
        //     if (evt.target.tagName !== "SPAN" || !/\bcm-/.test(evt.target.className)) {
        //         return null;
        //     }
        //
        //     // Use average locations rather than ‘evt.pageX’: ‘evt.pageX’
        //     // can fall outside of the token corresponding to ‘evt.target’.
        //     const {left, right, top, bottom} = evt.target.getBoundingClientRect();
        //     const coords = { left: (left + right) / 2,
        //                      top: (top + bottom) / 2 };
        //     return this.editor.coordsChar(coords, 'window');
        // }
        //
        // private mousemove(evt: JQuery.Event<HTMLElement>) {
        //     if (!this.client.busy()) {
        //         const pos = this.editorPosAt(evt);
        //         if (pos !== null && !(pos as any).outside) {
        //             const token = this.editor.getTokenAt(pos);
        //             const requestedInfo = ["type", "doc"];
        //             this.client.lookupAt(this, token.string, null, requestedInfo,
        //                                  { line: pos.line, column: pos.ch }, null,
        //                                  (status, data) => this.showDocs(status, data));
        //         }
        //     }
        // }

        public setActive(active: boolean) {
            active || this.ui.$docBox.hide();
            this.ui.$progressBarElement.toggleClass("fstar-active-progress-bar-element", active);
        }

        public updateProgressBarElement() {
            this.ui.$progressBarElement.css("flex-grow", 1 + this.editor.getDoc().lineCount());
        }

        private static addRangeMarker(range: Range<Snippet> & { snippet: Snippet },
                                      className: string, options?: CodeMirror.TextMarkerOptions) {
            return range.snippet.editor.getDoc().markText(
                { line: range.beg[0] - 1, ch: range.beg[1] },
                { line: range.end[0] - 1, ch: range.end[1] },
                _.extend({ className }, options || {}));
        }

        private static setCursor(editor: CodeMirror.Editor, pos: [number, number]) {
            editor.focus();
            editor.getDoc().setCursor({ line: pos[0] - 1, ch: pos[1] });
        }

        private static visitRange(range: Range<Snippet>, snippet: Snippet) {
            if (range.snippet !== undefined) {
                Utils.ensureVisible(range.snippet.ui.$top);
                Snippet.setCursor(range.snippet.editor, range.beg);
            } else if (snippet !== undefined) {
                snippet.complain("This error came from another file");
            }
        }

        private static highlightRange(range: Range<Snippet> & { highlighter?: CodeMirror.TextMarker }) {
            if (range.snippet && !range.highlighter) {
                range.highlighter = Snippet.addRangeMarker(range as any, "fstar-highlighted-marker");
            }
        }

        private static unhighlightRange(range: Range<Snippet> & { highlighter?: CodeMirror.TextMarker }) {
            if (range.highlighter) {
                range.highlighter.clear();
                delete range.highlighter;
            }
        }

        private static formatEndPoint(point: [number, number]) {
            return point[0] + "," + point[1];
        }

        private static formatRange(range: Range<Snippet>, cssClass: string) {
            const snippetId = range.snippet ? range.snippet.id + 1 : "?";
            return $("<span>", { class: cssClass, role: "button" })
                .append(
                    [$('<span class="fstar-range-fname">').text(range.fname),
                     document.createTextNode("("),
                     $('<span class="fstar-range-snippet">').text(`snippet #${snippetId}`),
                     document.createTextNode("): "),
                     $('<span class="fstar-range-beg">').text(Snippet.formatEndPoint(range.beg)),
                     document.createTextNode("–"),
                     $('<span class="fstar-range-end">').text(Snippet.formatEndPoint(range.end))]);
        }

        private formatError(error: FStarError<Snippet>) {
            const $errorSpan = $("<span>", { class: "fstar-" + error.level });
            $errorSpan.append($("<span>", { class: "fstar-error-level" }).text(error.level));
            $errorSpan.append($("<span>", { class: "fstar-error-message" }).text(error.message));
            _.each(error.ranges, (range: Range<Snippet>) => {
                $errorSpan
                    .append(Snippet.formatRange(range, "fstar-error-range").click(
                        () => Snippet.visitRange(range, this)))
                    .hover(() => Snippet.highlightRange(range),
                           () => Snippet.unhighlightRange(range));
            }, this);
            return $errorSpan;
        }

        private static deleteMarker<K extends string>(obj: { [s in K]?: CodeMirror.TextMarker }, field: K) {
            const marker: CodeMirror.TextMarker | undefined = obj[field];
            marker && marker.clear();
            delete obj[field];
        }

        public clearErrors() {
            _.each(this.errors, (error: FStarError<Snippet>) => {
                _.each(error.ranges, (range: Range<Snippet> & { marker?: CodeMirror.TextMarker,
                                                                highlighter?: CodeMirror.TextMarker }) => {
                    Snippet.deleteMarker(range, "marker");
                    Snippet.deleteMarker(range, "highlighter");
                });
            });
            this.errors = [];
        }

        public setErrors(errors: Array<FStarError<Snippet>>) {
            this.ui.$errorPanel.empty();
            this.clearErrors();

            let firstLocalRange: Range<Snippet> | undefined;
            this.ui.$errorPanel.append(_.map(errors, err => this.formatError(err)));
            _.each(errors, (error: FStarError<Snippet>) => {
                _.each(error.ranges, (range: Range<Snippet>) => {
                    if (firstLocalRange === undefined && range.snippet === this) {
                        firstLocalRange = range;
                    }
                    if (range.snippet) {
                        (range as any).marker =
                            Snippet.addRangeMarker(range as any, "fstar-" + error.level + "-marker",
                                                   { title: error.message });
                    }
                });
            });

            const hasErrors = errors.length > 0;
            this.ui.$errorPanel.toggle(hasErrors);
            if (hasErrors && firstLocalRange !== undefined) {
                Snippet.setCursor(this.editor, firstLocalRange.beg);
            }

            this.errors = errors;
        }

        private static PROOF_STATE_TEMPLATE = `\
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

        public setProofState(ps: ProofState<Snippet>) {
            const $ps = this.ui.$proofStatePanel;
            if (ps == null && this.proofState == null) {
                // Enable the proof-state panel if we've had new goals since the last
                // time we reset this.proofState to ‘null’.
                $ps.empty().hide();
            } else if (ps) {
                $ps.empty().show();
                (ps as any).highlight = () => (snippet: string, render: (_: string) => string) =>
                    ClientUtils.highlightSnippet(render(snippet));
                $ps.append(Mustache.render(Snippet.PROOF_STATE_TEMPLATE, ps));
                if (ps.location) {
                    $ps.find(".fstar-ps-location")
                        .append(Snippet.formatRange(ps.location, ""))
                        .click(() => Snippet.visitRange(ps.location!, this))
                        .hover(() => Snippet.highlightRange(ps.location!),
                               () => Snippet.unhighlightRange(ps.location!));
                }
            }
            this.proofState = ps;
        }

        private lineage(predicate: (snippet: Snippet) => boolean) {
            let last: Snippet | null = this;
            const ancestors = [];
            while (last !== null && predicate(last)) {
                ancestors.push(last);
                last = last.previousSnippet;
            }
            return ancestors.reverse();
        }

        private submitSelf() {
            if (this.previousSnippet == null) {
                // F* recomputes dependencies after each first push.
                this.literateclient.updateContents();
            }
            this.proofState = null;
            this.client.submit(this, this.previousSnippet);
        }

        public submit() {
            const ancestors = this.lineage(parent => parent.state == null);
            _.each(ancestors, (snippet: Snippet) => snippet.submitSelf());
        }

        public cancel() {
            return this.client.cancel(this);
        }
    }

    /// Singleton

    class Instance {
        private snippets: Snippet[];
        private client: Client<Snippet>;
        private justBlurredEditor: AnnotatedEditor | null;

        private ui: { $tooltip: JQuery<HTMLElement>;
                      tooltipTimeout?: number;
                      $progressBar: JQuery<HTMLElement>;
                      $progressEchoArea: JQuery<HTMLElement>;
                      progressEchoTimeout?: number };

        constructor(fname: string) {
            // We need to keep track of justBlurredEditor to suggest C-RET only when
            // the user clicked "submit" on the box they were editing.
            this.justBlurredEditor = null;

            this.ui = {
                $tooltip: $('<div class="fstar-tooltip">'),
                $progressBar: $('<div class="fstar-progress-bar">'),
                $progressEchoArea: $('<span class="fstar-progress-echo-area">')
            };
            $("body").addClass("fstar-literate-document")
                .append([this.ui.$tooltip,
                         this.ui.$progressEchoArea,
                         this.ui.$progressBar]);

            this.client = new Client(fname, msg => this.onProgress(msg));
            this.snippets = this.prepareFStarSnippets();
            Instance.chainSnippets(this.snippets);

            const fcontents = this.getFileContents();
            const args = ["--fstar_home", "/fstar"]; // , "--trace_error"
            this.client.init(fcontents, args);
        }

        private static jumpTo(snippet: Snippet) {
            if (snippet !== null) {
                snippet.focus();
            }
        }

        public showTip(windowX: number, windowY: number, str: string) {
            this.ui.$tooltip.text(str)
                .css("top", windowY).css("left", windowX)
                .stop(true, true).show();
            this.ui.tooltipTimeout && window.clearTimeout(this.ui.tooltipTimeout);
            this.ui.tooltipTimeout = window.setTimeout(() => this.ui.$tooltip.hide('fast'), 10000);
        }

        private static onSubmitKey(editor: CodeMirror.Editor & { fstarSnippet: Snippet }) {
            editor.fstarSnippet.submit();
        }
        private static onPreviousKey(editor: CodeMirror.Editor & { fstarSnippet: Snippet }) {
            Instance.jumpTo(editor.fstarSnippet.previousSnippet || editor.fstarSnippet);

        }
        private static onNextKey(editor: CodeMirror.Editor & { fstarSnippet: Snippet }) {
            Instance.jumpTo(editor.fstarSnippet.nextSnippet || editor.fstarSnippet);
        }

        private static onBeforeEditorChange(cm: CodeMirror.Editor, changeObj: CodeMirror.EditorChangeCancellable) {
            const snippet = (cm as AnnotatedEditor).fstarSnippet;
            const cancelSnippetResult = snippet.cancel();
            if (!cancelSnippetResult.success) {
                changeObj.cancel();
                snippet.complain(cancelSnippetResult.reason!);
            }
        }

        private static onEditorChanges(cm: CodeMirror.Editor, _changes: any) {
            (cm as AnnotatedEditor).fstarSnippet.updateProgressBarElement();
        }

        private static onEditorFocus(cm: CodeMirror.Editor) {
            (cm as AnnotatedEditor).fstarSnippet.setActive(true);
        }

        private onEditorBlur(cm: CodeMirror.Editor) {
            this.justBlurredEditor = (cm as AnnotatedEditor);
            (cm as AnnotatedEditor).fstarSnippet.setActive(false);
            window.setTimeout(function(this: any) { this.justBlurredEditor = null; }, 0); // FIXME: How can this work?
        }

        private onProgress(msg: string | null) {
            const $echo = this.ui.$progressEchoArea;
            if (msg == null) {
                this.ui.progressEchoTimeout = window.setTimeout(() => $echo.fadeOut(500), 1000);
            } else {
                $echo.text(msg);
                $echo.stop(true, true).toggle(true);
                this.ui.progressEchoTimeout && window.clearTimeout(this.ui.progressEchoTimeout);
            }
        }

        private static CM_OPTIONS = {
            viewportMargin: Infinity, // Used in conjunction with ‘height: auto’
            extraKeys: {
                "Ctrl-Enter": Instance.onSubmitKey,
                "Ctrl-Alt-Enter": Instance.onSubmitKey,
                "Ctrl-Alt-Up": Instance.onPreviousKey,
                "Ctrl-Alt-Down": Instance.onNextKey
            }
        };

        private submitClick(snippet: Snippet) {
            snippet.submit();
            if (this.justBlurredEditor !== null && snippet === this.justBlurredEditor.fstarSnippet) {
                snippet.complain("Tip: You can use Ctrl-Return to typecheck the current snippet");
            }
        }

        private static allMatchingIndices(regexp: RegExp, str: string) {
            let match = null;
            const offsets = [];
            // tslint:disable-next-line: no-conditional-assignment
            while ((match = regexp.exec(str))) {
                offsets.push(match.index);
            }
            return offsets;
        }

        private static pointToLineColumn(point: number, eols: number[]) {
            const line = _.sortedIndex(eols, point);
            const ch = point - (line > 0 ? eols[line - 1] + 1 : 0);
            return { line, ch };
        }

        private static trim(s: string) {
            const spaces = s.match(/^\s*|\s*$/g)!;
            const [lspaces, rspaces] = spaces;
            return { trimmed: s.substring(lspaces.length, s.length - rspaces.length),
                     lspaces, rspaces };
        }

        private static collapseElidedBlocks(editor: CodeMirror.Editor, text: string) {
            const HIDDEN_BLOCKS = /\(\* \{\{\{([^\0]*?)\*\)[^\0]*?\(\* \}\}\} \*\)/g;

            const ranges = [];
            let match = null, eols = null;
            // tslint:disable-next-line: no-conditional-assignment
            while ((match = HIDDEN_BLOCKS.exec(text))) {
                eols = eols || Instance.allMatchingIndices(/\n/g, text);
                const tr = Instance.trim(match[1]);
                const link = $('<span class="fstar-elided-fragment">')
                    .text(tr.trimmed)
                    .prop("title", "Click to reveal elided text");
                ranges.push({ start: Instance.pointToLineColumn(match.index, eols),
                              end: Instance.pointToLineColumn(match.index + match[0].length, eols),
                              replacement: [document.createTextNode("(* …" + tr.lspaces),
                                            link,
                                            document.createTextNode(tr.rspaces + "*)")] });
            }

            _.each(ranges, range => {
                const $repNode = $('<span class="cm-comment">')
                    .append(range.replacement);
                const marker = editor.getDoc().markText(range.start, range.end,
                                                        { clearOnEnter: true,
                                                          replacedWith: $repNode[0] });
                $repNode.click(() => marker.clear());
            });
        }

        private prepareFStarSnippet(id: number, editorElement: HTMLElement) {
            const ui = {
                $top: $(editorElement),
                $editor: $([]), // Initialized later
                $controlPanel: $('<div class="fstar-control-panel">'),
                $errorPanel: $('<div class="fstar-error-panel">'),
                $proofStatePanel: $('<div class="fstar-proof-state-panel">'),
                $docBox: $('<span class="fstar-snippet-docs">'),
                $complaintBox: $('<span class="fstar-snippet-complaint">'),
                $statusLabel: $('<span class="fstar-snippet-status">'),
                $submitButton: $('<span class="fstar-snippet-submit">', { role: "button" }),
                $progressBarElement: $('<span class="fstar-progress-bar-element">'),
            };

            this.ui.$progressBar.append(ui.$progressBarElement);

            const text = ClientUtils.stripNewLines(ui.$top.text());
            ui.$top.empty();
            ui.$top.attr("class", "fstar-snippet");

            const editor = ClientUtils.setupEditor(ui.$top[0], text, Instance.CM_OPTIONS);
            editor.on("beforeChange", Instance.onBeforeEditorChange);
            editor.on("changes", Instance.onEditorChanges);
            editor.on("focus", Instance.onEditorFocus);
            editor.on("blur", cm => this.onEditorBlur(cm));
            Instance.collapseElidedBlocks(editor, text);
            ui.$progressBarElement.css("flex-grow", 1 + editor.getDoc().lineCount());
            ui.$progressBarElement.click(() => (editor as AnnotatedEditor).fstarSnippet.scrollIntoView());

            ui.$editor = $(editor.getWrapperElement());
            ui.$top.append(ui.$controlPanel);

            ui.$submitButton.text("typecheck this");
            ui.$controlPanel
                .append(ui.$submitButton)
                .append(ui.$statusLabel)
                .append(ui.$complaintBox)
                .append(ui.$docBox)
                .append($("<hr />"))
                .append(ui.$errorPanel)
                .append(ui.$proofStatePanel);

            const snippet = new Snippet(id, ui, editor, this.client, this);
            ui.$submitButton.click(() => this.submitClick(snippet));

            return snippet;
        }

        private prepareFStarSnippets() {
            return _.map($(".fstar").toArray(), (editorElement, id) => {
                return this.prepareFStarSnippet(id, editorElement);
            });
        }

        private static chainSnippets(snippets: Snippet[]) {
            for (let snippetId = 0; snippetId < snippets.length; snippetId++) {
                const snippet = snippets[snippetId];
                const [prevId, nextId] = [snippetId - 1, snippetId + 1];
                if (prevId >= 0) {
                    snippet.previousSnippet = snippets[prevId];
                }
                if (nextId < snippets.length) {
                    snippet.nextSnippet = snippets[nextId];
                }
            }
        }

        private getFileContents() {
            return this.snippets.map(snippet => snippet.getText()).join("");
        }

        public updateContents() {
            this.client.updateContents(this.getFileContents());
        }
    }

    export let instance: Instance | null = null;

    export function run(fname: string) {
        if (typeof (self as any).WebAssembly !== "object") {
            $("body").addClass("fstar-webassembly-unavailable");
        }
        instance = instance || new Instance(fname);
    }
}
