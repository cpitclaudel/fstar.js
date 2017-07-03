"use strict";
/* global _ $u */

(function () {
    var root;

    if (typeof(global) !== "undefined") {
        root = global;
    } else if (typeof(window) !== "undefined") {
        root = window;
    } else if (typeof(self) !== "undefined") {
        root = self;
    }

    if (typeof(root) !== "undefined") {
        root.FStar = root.FStar || {};

        if (typeof($u) !== "undefined") {
            root.FStar._ = $u; // Sphinx renames _
        } else if (typeof(_) !== "undefined") {
            root.FStar._ = _;
        }
    }
})();
