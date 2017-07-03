/* global require global FStar */

// Added this in Z3:
// if (typeof(module) !== "undefined" && module.hasOwnProperty("exports")) {
//     module.exports = Z3;
// }

/// Must be run from etc/

if (typeof(require) !== "undefined") {
    process.chdir("../lib/");
    global.JSOO_FStar = require("../build/js/fstar.core.js");
    global.JSOO_FStar_Stdlib = require("../build/js/fstar.stdlib.js");
    global.Z3 = require("../lib/z3-wasm.core.js");
    global.underscore = require("../vendor/underscore-min.js");
    require("../lib/fstar.global-object.js");
    require("../lib/fstar.smtdriver.js");
}

var fname = "input.smt";
var fcontents = require("fs").readFileSync("../etc/input.smt", "utf8");
var args = ["-smt2", "auto_config=false", "model=true", "smt.relevancy=2"]; //"--lax", "--admit_smt_queries", "true",

console.log(FStar.SMTDriver.ENGINE);
FStar.SMTDriver.CLI.initAsync(function() {
    setImmediate(function () {
        console.log("Done initializing");
        console.log("Result:", FStar.SMTDriver.CLI.verify(fname, fcontents, args));
    });
});
