/* global require global FStar:true JSOO_FStar:true JSOO_FStar_Stdlib:true */

if (typeof(require) !== "undefined") {
    JSOO_FStar = require("../build/js/fstar.core.js"); /* exported JSOO_FStar */
    JSOO_FStar_Stdlib = require("../build/js/fstar.stdlib.js"); /* exported JSOO_FStar_Stdlib */
    require("../lib/fstar.global-object.js");
    require("../lib/fstar.driver.js");
}

var fname = "test.fst";
var fcontents = "module Test"; // "module Test\n\nopen List\nlet a = List.length [1]";
var args = ["--lax", "--admit_smt_queries", "true", "--fstar_home", "/fstar"];

console.log(FStar.Driver.CLI.verifySync(fname, fcontents, args, false));
