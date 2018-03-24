"use strict";
/* global Worker console FStar */

FStar.IDE = FStar.IDE || {};

(function () {
    var _ = FStar._;

    /// FStar.IDE.Set

    var Set = FStar.IDE.Set = function () {
        this.length = 0;
        this.elems = {};
    };

    Set.prototype.containsKey = function(key) {
        return this.elems[key] !== undefined;
    };

    Set.prototype.get = function(key) {
        return this.elems[key];
    };

    Set.prototype.add = function(key, value) {
        if (!this.containsKey(key)) {
            this.length++;
        }
        return this.elems[key] = value;
    };

    Set.prototype.remove = function(key) {
        delete this.elems[key];
    };

    /// FStar.IDE.SnippetCollection

    var SnippetCollection = FStar.IDE.SnippetCollection = function () {
        this.list = [];
        this.map = {};
        this.indices = {};
    };

    SnippetCollection.prototype.count = function () {
        return this.list.length;
    };

    SnippetCollection.prototype.getById = function(snippetId) {
        return this.map[snippetId];
    };

    SnippetCollection.prototype.contains = function(snippet) {
        return this.indices[snippet.getId()] !== undefined;
    };

    SnippetCollection.prototype.count = function () {
        return this.list.length;
    };

    SnippetCollection.prototype.last = function () {
        if (this.list.length == 0) {
            throw "Empty collection";
        }
        return this.list[this.list.length - 1];
    };

    SnippetCollection.prototype.index = function(snippet) {
        var id = snippet.getId(), idx = this.indices[id];
        if (idx === undefined)
            throw "Not found: " + id;
        return this.indices[id];
    };

    SnippetCollection.prototype.allInState = function(state) {
        // LATER make this faster by keeping track of snippets by state
        return _.filter(this.list, function(snippet) { return (snippet.getState() == state); });
    };

    SnippetCollection.prototype.firstInState = function(state) {
        // LATER make this faster by keeping track of snippets by state
        return _.find(this.list, function(snippet) { return (snippet.getState() == state); });
    };

    SnippetCollection.prototype.someInState = function(state) {
        // LATER make this faster by keeping track of snippets by state
        return this.firstInState(state) !== undefined;
    };

    SnippetCollection.prototype.snippetAtLine = function(line) {
        var getFirstLine = function(snippet) { return snippet.idePrivateData.firstLine; };
        // Math.min is needed because F* sometimes thinks it found errors on (nonexistent) line 0
        var dummy = { idePrivateData: { firstLine: Math.max(line, 1) + 0.1 } };
        var insertionPoint = _.sortedIndex(this.list, dummy, getFirstLine);
        FStar.ClientUtils.assert(insertionPoint > 0);
        return this.list[insertionPoint - 1];
    };

    SnippetCollection.prototype.insert = function(snippet, index) {
        var id = snippet.getId();
        this.list.splice(index, 0, snippet);
        this.map[id] = snippet;
        this.indices[id] = index;
    };

    SnippetCollection.prototype.remove = function(snippet) {
        var id = snippet.getId();
        var idx = this.indices[id];

        if (idx === undefined)
            throw "Not found: " + id;

        this.list.splice(idx, 1);
        delete this.map[id];
        delete this.indices[id];
    };

    /// FStar.IDE.Client

    var IDEUtils = FStar.IDE.Utils;
    var Protocol = FStar.IDE.Protocol;

    // This needs to be customizable, because web workers are loaded relative to
    // the current *page*, not to the current *script*.
    FStar.IDE.WORKER_DIRECTORY = "./fstar.js/";

    var Client = FStar.IDE.Client = function (fname) {
        this.fname = fname;
        this.gensym_state = 0;
        this.callbacks = new FStar.IDE.Set();
        this.snippets = new FStar.IDE.SnippetCollection();
        this.worker = new Worker(FStar.IDE.WORKER_DIRECTORY + "fstar.ide.worker.js");
        this.worker.onmessage = _.bind(this.onMessage, this);

        this.messages = {
            init: _.bind(function (fcontents, args) {
                this.postMessage(Protocol.Client.INIT,
                                  { fname: this.fname,
                                    fcontents: fcontents,
                                    args: args });
            }, this),

            updateContents: _.bind(function (fcontents) {
                this.postMessage(Protocol.Client.UPDATE_CONTENTS,
                                 { fcontents: fcontents });
            }, this),

            query: _.bind(function(js_query) {
                this.postMessage(Protocol.Client.QUERY, js_query);
            }, this)
        };
    };

    var SNIPPET_STATE = Client.SNIPPET_STATE = {
        PENDING: "PENDING", BUSY: "BUSY", DONE: "DONE"
    };

    Client.prototype.gensym = function() {
        this.gensym_state++;
        return this.gensym_state.toString();
    };

    Client.prototype.postMessage = function(query, payload) {
        this.worker.postMessage({ kind: query, payload: payload });
    };

    Client.prototype.onMessage = function(event) {
        var kind = event.data.kind;
        var payload = event.data.payload;
        console.log("Client.onMessage", kind, payload);
        switch (kind) {
        case Protocol.Worker.PROGRESS:
            // TODO: Show progress message somewhere on the screen
            break;
        case Protocol.Worker.READY:
            // TODO
            break;
        case Protocol.Worker.RESPONSE:
            var qid = payload["query-id"];
            FStar.ClientUtils.assert(this.callbacks.containsKey(qid));
            this.callbacks.get(qid).call(this, payload.status, payload.response);
            this.callbacks.remove(qid);
            break;
        case Protocol.Worker.MESSAGE:
            // TODO: Handle 'goal' messages: find the relevant snippet, and add to its output?
            break;
        case Protocol.Worker.EXIT:
            // TODO
            break;
        default:
            FStar.ClientUtils.assert(false);
        }
        this.processPending();
    };

    Client.prototype.busy = function () {
        return this.callbacks.length > 0;
    };

    Client.prototype.busyWithSnippets = function () {
        return this.snippets.someInState(SNIPPET_STATE.BUSY);
    };

    Client.prototype.snippetForRange = function(range) {
        return this.snippets.snippetAtLine(range.beg[0]);
    };

    Client.prototype.annotateRanges = function(errors) {
        _.each(errors, function(error) {
            _.each(error.ranges, function(range) {
                if (range.fname == "<input>") {
                    var snippet = this.snippetForRange(range);
                    var lineDelta = -snippet.idePrivateData.firstLine + 1;
                    range.snippet = snippet;
                    range.beg[0] += lineDelta;
                    range.end[0] += lineDelta;
                }
                if (_.isEqual(range.beg, range.end)) {
                    if (range.beg[1] > 0) {
                        range.beg[1]--;
                    } else {
                        range.end[1]++;
                    }
                }
            }, this);
        }, this);
    };

    Client.prototype.makePushCallback = function(snippet) {
        return function(status, response) {
            switch (status) {
            case Protocol.Status.SUCCESS:
                snippet.setErrors([]);
                snippet.setState(SNIPPET_STATE.DONE);
                break;
            case Protocol.Status.FAILURE:
                console.log(response);
                this.annotateRanges(response);
                snippet.setErrors(response);
                this.cancelPending();
                this.forget(snippet);
                break;
            default:
                FStar.ClientUtils.assert(false);
            }
        };
    };

    Client.prototype.push = function(snippet) {
        var qid = this.gensym();
        var text = snippet.getText();
        var firstLine = snippet.idePrivateData.firstLine;
        this.messages.query(IDEUtils.mkPush(qid, "full", text, firstLine, 0));
        this.callbacks.add(qid, this.makePushCallback(snippet));
        snippet.setState(SNIPPET_STATE.BUSY);
    };

    Client.prototype.assertCanPop = function(snippet) {
        FStar.ClientUtils.assert(this.snippets.contains(snippet));
        FStar.ClientUtils.assert(snippet === this.snippets.last());
        FStar.ClientUtils.assert(snippet.getState() !== SNIPPET_STATE.BUSY);
    };

    Client.prototype.forget = function(snippet) {
        this.snippets.remove(snippet);
        snippet.setState(null);
    };

    Client.prototype.pop = function(snippet) {
        var qid = this.gensym();
        this.assertCanPop(snippet);
        FStar.ClientUtils.assert(snippet.getState() === SNIPPET_STATE.DONE);
        this.messages.query(IDEUtils.mkPop(qid));
        this.callbacks.add(qid, function(status, _response) {
            FStar.ClientUtils.assert(status === Protocol.Status.SUCCESS);
        });
        // No need to wait for a confirmation when popping
        this.forget(snippet);
    };

    Client.prototype.popOrForget = function(snippet) {
        this.assertCanPop(snippet);
        if (snippet.getState() == SNIPPET_STATE.DONE) {
            this.pop(snippet);
        } else {
            this.forget(snippet);
        }
    };

    Client.prototype.processPending = function () {
        if (this.busyWithSnippets())
            return;

        var snippet = this.snippets.firstInState(SNIPPET_STATE.PENDING);
        if (snippet !== undefined) {
            this.push(snippet);
        }
    };

    Client.prototype.cancelPending = function () {
        this.snippets
            .allInState(SNIPPET_STATE.PENDING)
            .reverse().map(_.bind(this.popOrForget, this));
    };

    Client.prototype.init = function(fname, fcontents, args) {
        this.messages.init(fname, fcontents, args);
    };

    Client.prototype.updateContents = function (fcontents) {
        this.messages.updateContents(fcontents);
    };

    Client.prototype.submit = function(snippet, parent) {
        FStar.ClientUtils.assert(!this.snippets.contains(snippet));
        FStar.ClientUtils.assert(snippet.getState() == null);
        snippet.setState(SNIPPET_STATE.PENDING);
        this.insertSnippet(snippet, parent);
        this.processPending();
    };

    Client.prototype.insertSnippet = function(snippet, parent) {
        var index, firstLine;
        if (parent == null) {
            FStar.ClientUtils.assert(this.snippets.count() == 0);
            index = 0;
            firstLine = 1;
        } else {
            FStar.ClientUtils.assert(this.snippets.count() > 0);
            FStar.ClientUtils.assert(parent === this.snippets.last());
            index = this.snippets.index(parent) + 1;
            firstLine = parent.idePrivateData.firstLine + parent.idePrivateData.length;
        }

        this.snippets.insert(snippet, index);
        snippet.idePrivateData =
            { firstLine: firstLine,
              length: FStar.ClientUtils.countLines(snippet.getText()) };
    };

    Client.prototype.mayCancel = function(snippet) {
        if (!this.snippets.contains(snippet)) {
            return { success: true };
        } else if (snippet.getState() == SNIPPET_STATE.BUSY) {
            return { success: false, reason: "Can't edit a snippet while processing it!"};
        } else if (snippet.getState() == SNIPPET_STATE.DONE && this.busyWithSnippets()) {
            return { success: false, reason: "Can't edit a processed snippet while other snippets are being processed!"};
        }

        return { success: true };
    };

    Client.prototype.cancel = function(snippet) {
        var cancellable = this.mayCancel(snippet);
        if (!cancellable.success) {
            return cancellable;
        }
        while (this.snippets.contains(snippet)) {
            this.popOrForget(this.snippets.last());
        }
        return { success: true };
    };
}());
