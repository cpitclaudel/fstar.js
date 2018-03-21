all: unmarshal.js

unmarshal.byte: unmarshal.ml Makefile
	ocamlbuild -use-ocamlfind unmarshal.byte

unmarshal.js: unmarshal.byte Makefile
	js_of_ocaml --extern-fs --pretty +nat.js unmarshal.byte

clean:
	rm unmarshal.js unmarshal.byte
