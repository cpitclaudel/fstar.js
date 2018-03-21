#!/usr/bin/env python
"""Add a nodejs-friendly tail to a JSOO file"""

import argparse

def parse_arguments():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("jsoo_file", help="JSOO file to edit")
    parser.add_argument("jsoo_fun_name", help="Name of the JSOO object (--wrap-with-fun=...).")
    return parser.parse_args()

TEMPLATE = """
/* global module */
if (typeof(module) !== "undefined" && module.hasOwnProperty("exports")) {
    module.exports = [[fun-name]];
}
"""

if __name__ == '__main__':
    args = parse_arguments()
    with open(args.jsoo_file, mode="ab") as f:
        f.write(TEMPLATE.replace("[[fun-name]]", args.jsoo_fun_name).encode('ascii'))
