"use strict";
/* global FStar:true Worker console */
FStar.IDE = FStar.IDE || {};

(function () {
    /// FStar.IDE.Set

    var Set = FStar.IDE.Set = function () {
        this.length = 0;
        this.elems = {};
    };

    Set.prototype.contains = function(key) {
        return this.elems[key] !== undefined;
    };

    Set.prototype.get = function(key) {
        return this.elems[key];
    };

    Set.prototype.add = function(key, value) {
        if (!this.contains(key)) {
            this.length++;
        }
        return this.elems[key] = value;
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

    SnippetCollection.prototype.someWithStatus = function(status) {
        // LATER make this faster by keeping track of snippets by status
        return this.list.some(function(snippet) {
            return snippet.status == status;
        });
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

    var Client = FStar.IDE.Client = function () {
        this.callbacks = new FStar.IDE.Set();
        this.snippets = new FStar.IDE.SnippetCollection();
        this.worker = new Worker("./fstar.ide.worker.js");

        var _this = this;
        this.worker.onmessage = function(msg) { return _this.onMessage(msg); };
    };

    Client.STATUS = { PENDING: "PENDING",
                      PROCESSING: "PROCESSING",
                      PROCESSED: "PROCESSED" };

    Client.prototype.onMessage = function(message) {
        var kind = message.kind;
        var payload = message.payload;
        console.log("Client.onMessage", kind, payload);
        // TODO
        this.processPending();
    };

    Client.prototype.busy = function () {
        return this.callbacks.length > 0;
    };

    Client.prototype.pop = function(snippet) {
        FStar.ClientUtils.assert(snippet === this.snippets.last());
        console.log("Client.pop", snippet);
    };

    Client.prototype.processPending = function () {
        // TODO
    };


    Client.prototype.submit = function(snippet, parent) {
        FStar.ClientUtils.assert(!this.snippets.contains(snippet));
        FStar.ClientUtils.assert(snippet.getStatus() == null);
        if (parent == null) {
            FStar.ClientUtils.assert(this.snippets.count() == 0);
            this.snippets.insert(snippet, 0);
        } else {
            FStar.ClientUtils.assert(this.snippets.count() > 0);
            FStar.ClientUtils.assert(parent === this.snippets.last());
            this.snippets.insert(snippet, this.snippets.index(parent) + 1);
        }
        snippet.setStatus(Client.STATUS.PENDING);
        this.processPending();
    };

    Client.prototype.mayCancel = function(snippet) {
        if (!this.snippets.contains(snippet)) {
            return [true];
        } else if (snippet.status == Client.STATUS.PROCESSING) {
            return [false, "Can't edit a snippet while processing it!"];
        } else if (snippet.status == Client.STATUS.PROCESSED
                   && this.snippets.someWithStatus(Client.STATUS.PROCESSING)) {
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
            this.snippets.pop(snippet);
            this.remove(snippet);
            snippet.setStatus(null);
        }
        return [true];
    };
}());
