/* global require global FStar:true JSOO_FStar:true JSOO_FStar_Stdlib:true */

if (typeof(require) !== "undefined") {
    JSOO_FStar = require("../build/js/fstar.core.js"); /* exported JSOO_FStar */
    JSOO_FStar_Stdlib = require("../build/js/fstar.stdlib.js"); /* exported JSOO_FStar_Stdlib */
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
