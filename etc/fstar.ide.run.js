/* global require global FStar */

if (typeof(require) !== "undefined") {
    global.JSOO_FStar = require("../build/js/fstar.core.js");
    global.JSOO_FStar_Stdlib = require("../build/js/fstar.stdlib.js");
    global.underscore = require("../vendor/underscore-min.js");
    require("../lib/fstar.global-object.js");
    require("../lib/fstar.driver.js");
    require("../lib/fstar.ide.utils.js");
}

var fname = "test.fst";
var fblocks = ["module Test\n", "let a = 1\n", "let b = 1 + true\n"];
var args = ["--lax", "--admit_smt_queries", "true", "--fstar_home", "/fstar"];

function onMessage(message) {
    console.log("message:", message);
}

var ide = new FStar.Driver.IDE(fname, fblocks.join(""), args, onMessage);

fblocks.forEach(function(block) {
    console.log(">>>", block.replace(/[\r\n]+$/, ""));
    console.log(ide.evalSync(FStar.IDE.Utils.mkPush("0", "lax", block)));
});
