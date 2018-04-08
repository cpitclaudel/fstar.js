"use strict";
/* global CodeMirror FStar */
/* exported FStarClientUtils */

FStar.ClientUtils = FStar.ClientUtils || {};

(function () {
    var _ = FStar._;
    var ClientUtils = FStar.ClientUtils;

    ClientUtils.DEBUG = true;
    ClientUtils.debug = function() {
        ClientUtils.DEBUG && console.debug.apply(console, arguments);
    };

    var CM_DEFAULTS = {
        lineNumbers: true,
        theme: "tango",
        mode: "text/x-fstar"
    };

    ClientUtils.setupEditor = function(parent, text, options) {
        options = _.extend({}, CM_DEFAULTS, (options || {}), { value: text || "" });
        return CodeMirror(parent, options);
    };

    ClientUtils.highlightSnippet = function(snippet) {
        var container = document.createElement("span");
        CodeMirror.runMode(snippet, "fstar", container);
        container.className = "cm-s-tango";
        return container.outerHTML;
    };

    ClientUtils.stripNewLines = function(text) {
        return text.replace(/^[\r\n]+/, "").replace(/[\r\n]+$/, "");
    };

    ClientUtils.countLines = function(text) {
        return (text.match(/\n/g) || []).length;
    };

    ClientUtils.assert = function(condition, message) {
        if (!condition) {
            throw (message || "assertion failed");
        }
    };
})();
