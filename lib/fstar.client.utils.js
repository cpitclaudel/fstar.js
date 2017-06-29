"use strict";
/* global _ CodeMirror FStar:true */
/* exported FStarClientUtils */

FStar.ClientUtils = FStar.ClientUtils || {};

(function () {
    var _ = FStar._;
    var ClientUtils = FStar.ClientUtils;
    var CM_DEFAULTS = {
        lineNumbers: true,
        theme: "monokai",
        mode: "text/x-fsharp"
    };

    ClientUtils.setupEditor = function(parent, text, options) {
        options = _.extend({}, CM_DEFAULTS, (options || {}), { value: text });
        return new CodeMirror(parent, options);
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
