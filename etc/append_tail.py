#!/usr/bin/env python
# Add contents of second file to the end of first file.

import sys
from shutil import copyfileobj

if len(sys.argv) != 3:
    print("Usage: ./append_tail.py <body> <tail>")
    sys.exit(1)

with open(sys.argv[1], mode="ab") as body:
    body.write("\n".encode('ascii'))
    with open(sys.argv[2], mode="rb") as tail:
        copyfileobj(tail, body)
