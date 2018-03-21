JS_BUILD_DIR=build/js
OCAML_BUILD_DIR=build/ocaml

OCAML_ROOT=src/ocaml
FSTAR_ROOT=$(OCAML_ROOT)/fstar
ULIB_ML32_SUBDIR=tmp/ulib-ml32
ULIB_ML32_ROOT=$(OCAML_ROOT)/$(ULIB_ML32_SUBDIR)

JS_OF_OCAML=ulimit -s unlimited; js_of_ocaml

# ocamlbuild reverses dependencies, so list fstar/ulib/ml/32bit last to give it
# priority over fstar/ulib/ml (it contains 32bit-friendly implementations)
OCAMLBUILD=cd $(OCAML_ROOT) && \
				ocamlbuild -j 8 -use-ocamlfind \
					-build-dir ../../$(OCAML_BUILD_DIR)/ \
					-I $(ULIB_ML32_SUBDIR) \
					-I fstar/src/basic/ml \
					-I fstar/src/extraction/ml \
					-I fstar/src/fstar/ml \
					-I fstar/src/parser/ml \
					-I fstar/src/prettyprint/ml \
					-I fstar/src/tactics/ml \
					-I fstar/src/ocaml-output

.SECONDARY: $(OCAML_BUILD_DIR)/FStar_JS_v1.byte $(OCAML_BUILD_DIR)/FStar_JS_v1.d.byte

default: opt

fstar:
	$(MAKE) -C $(FSTAR_ROOT)/src/ ocaml-fstar-ocaml

build-dirs:
	mkdir -p $(JS_BUILD_DIR)
	mkdir -p $(OCAML_BUILD_DIR)

ulib-32:
	mkdir -p $(ULIB_ML32_ROOT)
	cp $(FSTAR_ROOT)/ulib/ml/*.ml $(ULIB_ML32_ROOT)
	cp $(FSTAR_ROOT)/ulib/ml/32bit/*.ml $(ULIB_ML32_ROOT)

$(OCAML_BUILD_DIR)/%.byte: ulib-32 $(OCAML_ROOT)/%.ml | ulib-32 build-dirs
	+$(MAKE) -C $(FSTAR_ROOT)/src/ocaml-output # Needed to build the parser
	$(OCAMLBUILD) "$*.byte"

$(OCAML_BUILD_DIR)/%.d.byte: ulib-32 $(OCAML_ROOT)/%.ml | ulib-32 build-dirs
	+$(MAKE) -C $(FSTAR_ROOT)/src/ocaml-output # Needed to build the parser
	$(OCAMLBUILD) "$*.d.byte"

$(OCAML_BUILD_DIR)/fstar.core.%: $(OCAML_BUILD_DIR)/FStar_JS_v1.%
	cp "$<" "$@"

## Single-file stdlib package
# We need a dummy bytecode object to compile the file system separately
# -I indicates which directory the files in STDLIB_INCLUDE_SWITCHES are relative to
STDLIB_DUMMY_PREFIX=/tmp/dummy
STDLIB_FS_PATH=$(JS_BUILD_DIR)/fstar.stdlib.js
STDLIB_INCLUDE_SWITCHES=$(shell ./etc/jsoo_stdlib_fs_switches.py)

$(STDLIB_FS_PATH): | build-dirs
	echo "" > "$(STDLIB_DUMMY_PREFIX).ml"
	ocamlc "$(STDLIB_DUMMY_PREFIX).ml" -o "$(STDLIB_DUMMY_PREFIX).byte"
	$(JS_OF_OCAML) \
		--custom-header="var JSOO_FStar_Stdlib=" \
		--wrap-with-fun --opt 3 $(STDLIB_FS_OPTS) \
		--extern-fs -I . $(STDLIB_INCLUDE_SWITCHES) "--ofs=$(STDLIB_FS_PATH)" \
		"$(STDLIB_DUMMY_PREFIX).byte" -o "$(STDLIB_DUMMY_PREFIX).js"
	./etc/jsoo_append_tail.py "$(STDLIB_FS_PATH)" JSOO_FStar_Stdlib

fs: $(STDLIB_FS_PATH)

## JSOO options
# FIXME Replace --custom-header with --wrap-with-fun=… after moving to jsoo 3.0
JS_LIBS=src/js/BigInteger.js src/js/zarith.js src/js/overrides.js +nat.js +toplevel.js +weak.js
JSOO_OPTS=--wrap-with-fun --custom-header="var JSOO_FStar=" --extern-fs $(JS_LIBS) -o $(JS_BUILD_DIR)/fstar.core.js
JSOO_LIGHT_DEBUG_OPTS=--pretty --source-map
JSOO_HEAVY_DEBUG_OPTS=--debug-info --no-inline

FSTAR_CORE_APPEND_TAIL=./etc/jsoo_append_tail.py $(JS_BUILD_DIR)/fstar.core.js JSOO_FStar

opt: $(STDLIB_FS_PATH) $(OCAML_BUILD_DIR)/fstar.core.byte | build-dirs
	$(JS_OF_OCAML) --opt 3 $(JSOO_OPTS) $(OCAML_BUILD_DIR)/fstar.core.byte
	$(FSTAR_CORE_APPEND_TAIL)

debug: $(STDLIB_FS_PATH) $(OCAML_BUILD_DIR)/fstar.core.d.byte | build-dirs
	$(JS_OF_OCAML) $(JSOO_LIGHT_DEBUG_OPTS) $(JSOO_HEAVY_DEBUG_OPTS) $(JSOO_OPTS) $(OCAML_BUILD_DIR)/fstar.core.d.byte
	$(FSTAR_CORE_APPEND_TAIL)

# --debug-info and --no-inline actually makes some things harder to read
read: $(STDLIB_FS_PATH) $(OCAML_BUILD_DIR)/fstar.core.d.byte | build-dirs
	$(JS_OF_OCAML) $(JSOO_LIGHT_DEBUG_OPTS) $(JSOO_OPTS) $(OCAML_BUILD_DIR)/fstar.core.d.byte
	$(FSTAR_CORE_APPEND_TAIL)

serve:
	mkdir -p web/fstar.js/
	cp vendor/z3.js/* lib/*.js $(JS_BUILD_DIR)/fstar.*.js web/fstar.js/
	python3 -m http.server

clean-ocaml:
	rm -rf $(OCAML_BUILD_DIR)

clean:
	rm -rf build web/fstar.js
	+$(MAKE) -C $(FSTAR_ROOT) clean
