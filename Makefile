JS_BUILD_DIR=build/js
OCAML_BUILD_DIR=build/ocaml
FSTAR_ROOT = src/ocaml/fstar

OCAMLBUILD = cd src/ocaml/ && \
				ocamlbuild -j 8 -use-ocamlfind -build-dir ../../$(OCAML_BUILD_DIR)/ \
					-I fstar/ulib/ml \
					-I fstar/src/basic/ml \
					-I fstar/src/extraction/ml \
					-I fstar/src/fstar/ml \
					-I fstar/src/parser/ml \
					-I fstar/src/prettyprint/ml \
					-I fstar/src/ocaml-output

fstar:
	$(MAKE) -C $(FSTAR_ROOT)/src/ ocaml-fstar-ocaml

build-dirs:
	mkdir -p $(JS_BUILD_DIR)
	mkdir -p $(OCAML_BUILD_DIR)

$(OCAML_BUILD_DIR)/%.byte: build-dirs src/ocaml/%.ml
	$(OCAMLBUILD) "$*.byte"

$(OCAML_BUILD_DIR)/%.d.byte: build-dirs src/ocaml/%.ml
	$(OCAMLBUILD) "$*.d.byte"

$(OCAML_BUILD_DIR)/fstar.core.%: $(OCAML_BUILD_DIR)/FStar_JS_v1.%
	cp "$<" "$@"

## Single-file stdlib package
# We need a dummy bytecode object to compile the file system separately
# -I indicates which directory the files in STDLIB_INCLUDE_SWITCHES are relative to
STDLIB_DUMMY_PREFIX = /tmp/dummy
STDLIB_FS_PATH = $(JS_BUILD_DIR)/fstar.stdlib.js
STDLIB_INCLUDE_SWITCHES = $(shell ./etc/jsoo_stdlib_fs_switches.py)

$(STDLIB_FS_PATH): build-dirs
	echo "" > "$(STDLIB_DUMMY_PREFIX).ml"
	ocamlc "$(STDLIB_DUMMY_PREFIX).ml" -o "$(STDLIB_DUMMY_PREFIX).byte"
	js_of_ocaml \
		--custom-header="var JSOO_FStar_Stdlib=" \
		--wrap-with-fun --opt 3 $(STDLIB_FS_OPTS) \
		--extern-fs -I . $(STDLIB_INCLUDE_SWITCHES) "--ofs=$(STDLIB_FS_PATH)" \
		"$(STDLIB_DUMMY_PREFIX).byte" -o "$(STDLIB_DUMMY_PREFIX).js"
	./etc/append-tail.sh "$(STDLIB_FS_PATH)" etc/fstar.stdlib.tail.js

## JSOO options
JS_LIBS = src/js/BigInteger.js src/js/zarith.js src/js/overrides.js +nat.js +toplevel.js +weak.js
JSOO_OPTS = --wrap-with-fun --extern-fs $(JS_LIBS) -o $(JS_BUILD_DIR)/fstar.core.js
JSOO_LIGHT_DEBUG_OPTS = --pretty --source-map
JSOO_HEAVY_DEBUG_OPTS = --debug-info --no-inline
# FIXME remove the ‘var JSOO…’ bits when moving to 3.0, though file handling is broken ATM

opt: $(STDLIB_FS_PATH) build-dirs $(OCAML_BUILD_DIR)/fstar.core.byte
	js_of_ocaml --custom-header="var JSOO_FStar=" --opt 3 $(JSOO_OPTS) $(OCAML_BUILD_DIR)/fstar.core.byte
	./etc/append-tail.sh $(JS_BUILD_DIR)/fstar.core.js etc/fstar.core.tail.js

debug: $(STDLIB_FS_PATH) build-dirs $(OCAML_BUILD_DIR)/fstar.core.d.byte
	js_of_ocaml --custom-header="var JSOO_FStar=" $(JSOO_LIGHT_DEBUG_OPTS) $(JSOO_HEAVY_DEBUG_OPTS) $(JSOO_OPTS) $(OCAML_BUILD_DIR)/fstar.core.d.byte
	./etc/append-tail.sh $(JS_BUILD_DIR)/fstar.core.js etc/fstar.core.tail.js

# --debug-info and --no-inline actually makes some things harder to read
read: $(STDLIB_FS_PATH) build-dirs $(OCAML_BUILD_DIR)/fstar.core.d.byte
	js_of_ocaml --custom-header="var JSOO_FStar=" $(JSOO_LIGHT_DEBUG_OPTS) $(JSOO_OPTS) $(OCAML_BUILD_DIR)/fstar.core.d.byte
	./etc/append-tail.sh $(JS_BUILD_DIR)/fstar.core.js etc/fstar.core.tail.js

serve:
	python3 -m http.server

clean:
	rm -rf build
