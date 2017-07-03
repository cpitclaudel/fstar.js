/* global require global FStar */

if (typeof(require) !== "undefined") {
    process.chdir("../lib/");
    global.JSOO_FStar = require("../build/js/fstar.core.js");
    global.JSOO_FStar_Stdlib = require("../build/js/fstar.stdlib.js");
    global.underscore = require("../vendor/underscore-min.js");
    global.Z3 = require("../lib/z3-wasm.core.js");
    require("../lib/fstar.global-object.js");
    require("../lib/fstar.driver.js");
    require("../lib/fstar.smtdriver.js");
}

var fname = "test.fst";
var fcontents = "module Test\ntype test =\n| A : test\n| B : test\n"; // "module Test\n\nopen List\nlet a = List.length [1]";
var args = ["--z3refresh", "--fstar_home", "/fstar"]; //"--lax", "--admit_smt_queries", "true",

// if (typeof(module) !== "undefined" && module.hasOwnProperty("exports")) {
//     module.exports = Z3;
// }

// process.on('uncaughtException', function(err) {
//     console.log(err.stack);
//     throw err;
// });

FStar.SMTDriver.CLI.initAsync(function() {
    setImmediate(function () {
        console.log(FStar.Driver.CLI.verifySync(fname, fcontents, args, false));
    });
});
