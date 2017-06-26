"use strict";
/* global FStar:true Worker console _ */
FStar.IDE = FStar.IDE || {};

(function () {
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
        this.map = {}; // FIXME needed?
        this.indices = {};
    };

    SnippetCollection.prototype.count = function () {
        return this.list.length;
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

    var Protocol = FStar.IDE.Protocol;

    var Client = FStar.IDE.Client = function () {
        this.gensym_state = 0;
        this.callbacks = new FStar.IDE.Set();
        this.snippets = new FStar.IDE.SnippetCollection();
        this.worker = new Worker("./fstar.ide.worker.js");
        this.worker.onmessage = _.bind(this.onMessage, this);

        this.messages = {
            init: _.bind(function (fname, fcontents, args) {
                this.postMessage(Protocol.Client.INIT,
                                  { fname: fname,
                                    fcontents: fcontents,
                                    args: args });
            }, this),

            updateContents: _.bind(function (fcontents) {
                this.postMessage(Protocol.Client.UPDATE_CONTENTS, fcontents);
            }, this),

            query: _.bind(function(js_query) {
                this.postMessage(Protocol.Client.QUERY, js_query);
            }, this)
        };
    };

    var SNIPPET_STATE = Client.SNIPPET_STATE = { PENDING: "PENDING",
                                                 PROCESSING: "PROCESSING",
                                                 PROCESSED: "PROCESSED" };

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
            // TODO
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
            // TODO
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
        return this.snippets.someInState(SNIPPET_STATE.PROCESSING);
    };

    Client.prototype.makePushCallback = function(snippet) {
        return function(status, response) {
            switch (status) {
            case Protocol.Status.SUCCESS:
                snippet.setState(SNIPPET_STATE.PROCESSED);
                break;
            case Protocol.Status.FAILURE:
                console.log(response);
                snippet.setState(null);
                this.cancelPending();
                break;
            default:
                FStar.ClientUtils.assert(false);
            }
        };
    };

    Client.prototype.push = function (snippet) {
        var qid = this.gensym();
        this.messages.query(FStar.IDE.Utils.mkPush(qid, "full", snippet.getText()));
        this.callbacks.add(qid, this.makePushCallback(snippet));
        snippet.setState(SNIPPET_STATE.PROCESSING);
    };

    Client.prototype.assertCanPop = function (snippet) {
        FStar.ClientUtils.assert(this.snippets.contains(snippet));
        FStar.ClientUtils.assert(snippet === this.snippets.last());
        FStar.ClientUtils.assert(snippet.getState() !== SNIPPET_STATE.PROCESSING);
    };

    Client.prototype.pop = function (snippet) {
        var qid = this.gensym();
        this.assertCanPop(snippet);
        FStar.ClientUtils.assert(snippet.getState() === SNIPPET_STATE.PROCESSED);
        this.messages.query(FStar.IDE.Utils.mkPop(qid));
        this.callbacks.add(qid, function (status, _response) {
            FStar.ClientUtils.assert(status === Protocol.Status.SUCCESS);
        });
    };

    Client.prototype.popOrForget = function(snippet) {
        this.assertCanPop(snippet);
        if (snippet.getState() == SNIPPET_STATE.PROCESSED) {
            this.pop(snippet);
        }
        this.snippets.remove(snippet);
        snippet.setState(null);
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
        FStar.ClientUtils.assert(!this.busyWithSnippets());
        this.snippets
            .allInState(SNIPPET_STATE.PENDING)
            .reverse()
            .map(_.bind(this.popOrForget, this));
    };

    Client.prototype.init = function (fname, fcontents, args) {
        this.messages.init(fname, fcontents, args);
    };

    Client.prototype.updateContents = function (fcontents) {
        this.messages.updateContents(fcontents);
    };

    Client.prototype.submit = function(snippet, parent) {
        FStar.ClientUtils.assert(!this.snippets.contains(snippet));
        FStar.ClientUtils.assert(snippet.getState() == null);
        snippet.setState(SNIPPET_STATE.PENDING);
        if (parent == null) {
            FStar.ClientUtils.assert(this.snippets.count() == 0);
            this.snippets.insert(snippet, 0);
        } else {
            FStar.ClientUtils.assert(this.snippets.count() > 0);
            FStar.ClientUtils.assert(parent === this.snippets.last());
            this.snippets.insert(snippet, this.snippets.index(parent) + 1);
        }
        this.processPending();
    };

    Client.prototype.mayCancel = function(snippet) {
        if (!this.snippets.contains(snippet)) {
            return [true];
        } else if (snippet.getState() == SNIPPET_STATE.PROCESSING) {
            return [false, "Can't edit a snippet while processing it!"];
        } else if (snippet.getState() == SNIPPET_STATE.PROCESSED && this.busyWithSnippets()) {
            return [false, "Can't edit a processed snippet while other snippets are being processed!"];
        }

        return [false, "Can't edit a snippet while processing it"];
    };

    Client.prototype.cancel = function(snippet) {
        var cancellable = this.mayCancel(snippet);
        if (!cancellable[0]) {
            return cancellable;
        }
        while (this.snippets.contains(snippet)) {
            this.popOrForget(this.snippets.last());
        }
        return [true];
    };
}());
