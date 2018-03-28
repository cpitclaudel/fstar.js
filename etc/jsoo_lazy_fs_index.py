#!/usr/bin/env python
"""Build an index file for use with LazyFSDevice"""

import json
import argparse
import sys
import os

def parse_arguments():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", help="The directory to build an index for")
    return parser.parse_args()

def join_relative(root, path, name):
    return os.path.join(path, name)[len(root):]

def main():
    index = ["/"]
    root = parse_arguments().root
    for path, dirs, fnames in os.walk(root):
        index.extend(join_relative(root, path, fname) for fname in fnames)
        index.extend(join_relative(root, path, dirname) + "/" for dirname in dirs)
    json.dump(sorted(index), sys.stdout)

if __name__ == '__main__':
    main()
