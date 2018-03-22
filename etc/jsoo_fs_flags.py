#!/usr/bin/env python3
"""Build a list of F* files to include in JSOO's virtual file system."""

import argparse
from os import path, walk

EXTENSIONS = (".fst", ".fst.checked",
              ".fsti", ".fsti.checked")

def parse_arguments():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--local-root", required=True,
                        help="Prefix to strip from input files.")
    parser.add_argument("--jsoo-root", required=True,
                        help="Prefix to store files under in the JSOO file system.")
    parser.add_argument("files", nargs='+')
    return parser.parse_args()

def iter_files(local_root, jsoo_root, files):
    for fname in files:
        relative = path.relpath(fname, start=local_root)
        js_path = path.normpath(path.join(jsoo_root, relative))
        yield fname, js_path

def main():
    args = parse_arguments()
    for fname, js_path in iter_files(args.local_root, args.jsoo_root, args.files):
        print('"--file={}:{}"'.format(fname, js_path))

if __name__ == '__main__':
    main()
