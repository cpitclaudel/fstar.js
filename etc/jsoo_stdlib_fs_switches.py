#!/usr/bin/env python3
from os import chdir, path, sys, walk

def main():
    dirs = ["src/ocaml/fstar/ulib"]
    for directory in dirs:
        for root, _dirs, files in walk(directory):
            for fname in files:
                if path.splitext(fname)[1] == ".fst":
                    rooted = path.join(root, fname)
                    relative = path.relpath(rooted, start="src/ocaml/fstar/")
                    js_path = path.normpath(path.join("/fstar/", relative))
                    arg = '"--file={}:{}"'.format(rooted, js_path)
                    print(arg)

if __name__ == '__main__':
    main()
