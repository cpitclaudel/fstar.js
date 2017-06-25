/* global require JSOO_FStar:true JSOO_FStar_Stdlib:true FStarDriver:true */
if (typeof(require) !== 'undefined') {
    JSOO_FStar = require('../build/js/fstar.core.js'); /* exported JSOO_FStar */
    JSOO_FStar_Stdlib = require('../build/js/fstar.stdlib.js'); /* exported JSOO_FStar_Stdlib */
    FStarDriver = require('../lib/fstar.driver.js');
    FStarIDEUtils = require('../lib/fstar.ide.utils.js');
}

var fname = "test.fst";
var fblocks = ["module Test\n", "let a = 1\n", "let b = 1 + true\n"];
var args = ["--lax", "--admit_smt_queries", "true", "--fstar_home", "/fstar"];

function onMessage(message) {
    console.log("message:", message);
}

FStarDriver.settings.catchExceptions = false;
var ide = FStarDriver.ide.newIDE(fname, fblocks.join(""), args, onMessage);

fblocks.forEach(function(block) {
    console.log(">>>", block.replace(/[\r\n]+$/, ""));
    console.log(ide.evalSync(FStarIDEUtils.mkPush("0", "lax", block)));
});
