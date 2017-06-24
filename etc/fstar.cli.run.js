#!/usr/bin/env nodejs
/* global require */
JSOO_FStar = require('../build/js/fstar.core.js'); /* exported JSOO_FStar */
JSOO_FStar_Stdlib = require('../build/js/fstar.stdlib.js'); /* exported JSOO_FStar_Stdlib */
FStar = require('../lib/fstar.driver.js');
console.log(FStar.verifySync("test.fst", "module Test\n\nopen List\nlet a = List.length [1]",
                             ["--lax",
                              "--admit_smt_queries", "true",
                              "--fstar_home", "/fstar"]));
