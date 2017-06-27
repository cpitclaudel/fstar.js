"use strict";
/* global ace FStar:true */
/* exported FStarClientUtils */

FStar.ClientUtils = FStar.ClientUtils || {};

(function () {
    var ClientUtils = FStar.ClientUtils;

    ClientUtils.setupAceEditor = function(element, options) {
        var editor = ace.edit(element);
        editor.setTheme("ace/theme/monokai");
        editor.getSession().setMode("ace/mode/fstar");
        editor.setOptions({ fontFamily: "Ubuntu Mono, monospace", fontSize: "1rem" });
        editor.setOptions(options || {});
        return editor;
    };

    ClientUtils.stripNewLines = function(text) {
        return text.replace(/^[\r\n]+/, "").replace(/[\r\n]+$/, "");
    };

    ClientUtils.assert = function(condition, message) {
        if (!condition) {
            throw (message || "assertion failed");
        }
    };
})();
