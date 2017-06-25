/* global require JSOO_FStar:true JSOO_FStar_Stdlib:true FStarDriver:true */
if (typeof(require) !== 'undefined') {
    JSOO_FStar = require('../build/js/fstar.core.js'); /* exported JSOO_FStar */
    JSOO_FStar_Stdlib = require('../build/js/fstar.stdlib.js'); /* exported JSOO_FStar_Stdlib */
    FStarDriver = require('../lib/fstar.driver.js');
}

var fname = "test.fst";
var fcontents = "module Test"; // "module Test\n\nopen List\nlet a = List.length [1]";
var args = ["--lax", "--admit_smt_queries", "true", "--fstar_home", "/fstar"];

FStarDriver.settings.catchExceptions = false;
console.log(FStarDriver.cli.verifySync(fname, fcontents, args));
