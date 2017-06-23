#!/usr/bin/env bash
# Add contents of second file to the end of first file.

if [ ! $# -eq 2 ]; then
    echo "Usage: tail.sh <body> <tail>"
    exit 1
fi

printf "\n" | cat "$1" - "$2" | sponge "$1"
