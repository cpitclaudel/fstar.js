/* global require global FStar */

if (typeof(require) !== "undefined") {
    global.JSOO_FStar = require("../build/js/fstar.core.js");
    global.JSOO_FStar_Stdlib = require("../build/js/fstar.stdlib.js");
    global.underscore = require("../vendor/underscore-min.js");
    require("../lib/fstar.global-object.js");
    require("../lib/fstar.driver.js");
}

var fname = "test.fst";
var fcontents = "module Test"; // "module Test\n\nopen List\nlet a = List.length [1]";
var args = ["--lax", "--admit_smt_queries", "true", "--fstar_home", "/fstar"];

console.log(FStar.Driver.CLI.verifySync(fname, fcontents, args, false));
