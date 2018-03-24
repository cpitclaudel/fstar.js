JS_BUILD_DIR=build/js
OCAML_BUILD_DIR=build/ocaml

OCAML_ROOT=src/ocaml
FSTAR_ROOT=$(OCAML_ROOT)/fstar
STDLIB=$(FSTAR_ROOT)/ulib
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
					-I fstar/ulib/ml \
					-I fstar/src/ocaml-output

.SECONDARY: $(OCAML_BUILD_DIR)/FStar_JS_v1.byte $(OCAML_BUILD_DIR)/FStar_JS_v1.d.byte

default: opt

build-dirs:
	mkdir -p $(JS_BUILD_DIR)
	mkdir -p $(OCAML_BUILD_DIR)

ulib-32:
	mkdir -p $(ULIB_ML32_ROOT)
	cp $(FSTAR_ROOT)/ulib/ml/*.ml $(ULIB_ML32_ROOT)
	cp $(FSTAR_ROOT)/ulib/ml/32bit/*.ml $(ULIB_ML32_ROOT)

fstar:
	+$(MAKE) -C $(FSTAR_ROOT)/src/ocaml-output # Needed to build the parser

$(OCAML_BUILD_DIR)/%.byte: ulib-32 fstar $(OCAML_ROOT)/%.ml | ulib-32 build-dirs
	$(OCAMLBUILD) "$*.byte"

$(OCAML_BUILD_DIR)/%.d.byte: ulib-32 fstar $(OCAML_ROOT)/%.ml | ulib-32 build-dirs
	$(OCAMLBUILD) "$*.d.byte"

$(OCAML_BUILD_DIR)/fstar.core.%: $(OCAML_BUILD_DIR)/FStar_JS_v1.%
	cp "$<" "$@"

## JSOO options.  Compiling in opt mode with --disable inline reduces stack overflows
JS_LIBS=src/js/BigInteger.js src/js/zarith.js src/js/fs_lazy.js src/js/overrides.js +nat.js +toplevel.js
JSOO_OPTS=--wrap-with-fun=JSOO_FStar --extern-fs $(JS_LIBS) --disable inline --debug times
JSOO_DISABLED_OPTIMIZATIONS= #deadcode inline shortvar staticeval share strict debugger genprim excwrap optcall
JSOO_LIGHT_DEBUG_OPTS=--pretty --source-map $(addprefix --disable ,$(JSOO_DISABLED_OPTIMIZATIONS))
JSOO_HEAVY_DEBUG_OPTS=--debug-info --disable inline # --debug-info and --disable inline make some things harder to read

opt: $(OCAML_BUILD_DIR)/fstar.core.byte | build-dirs
	$(JS_OF_OCAML) --disable inline --opt 3 $(JSOO_OPTS) $(OCAML_BUILD_DIR)/fstar.core.byte -o $(JS_BUILD_DIR)/fstar.core.$@.js
	./etc/jsoo_append_tail.py $(JS_BUILD_DIR)/fstar.core.$@.js JSOO_FStar
	cp $(JS_BUILD_DIR)/fstar.core.$@.js $(JS_BUILD_DIR)/fstar.core.js

debug: $(OCAML_BUILD_DIR)/fstar.core.d.byte | build-dirs
	$(JS_OF_OCAML) $(JSOO_LIGHT_DEBUG_OPTS) $(JSOO_HEAVY_DEBUG_OPTS) $(JSOO_OPTS) $(OCAML_BUILD_DIR)/fstar.core.d.byte  -o $(JS_BUILD_DIR)/fstar.core.$@.js
	./etc/jsoo_append_tail.py $(JS_BUILD_DIR)/fstar.core.$@.js JSOO_FStar
	cp $(JS_BUILD_DIR)/fstar.core.$@.js $(JS_BUILD_DIR)/fstar.core.js

read: $(OCAML_BUILD_DIR)/fstar.core.d.byte | build-dirs
	$(JS_OF_OCAML) $(JSOO_LIGHT_DEBUG_OPTS) $(JSOO_OPTS) $(OCAML_BUILD_DIR)/fstar.core.d.byte  -o $(JS_BUILD_DIR)/fstar.core.$@.js
	./etc/jsoo_append_tail.py $(JS_BUILD_DIR)/fstar.core.$@.js JSOO_FStar
	cp $(JS_BUILD_DIR)/fstar.core.$@.js $(JS_BUILD_DIR)/fstar.core.js

STDLIB_FILES_EXCLUDED=$(addprefix $(STDLIB)/,FStar.Int31.fst FStar.UInt31.fst FStar.Relational.State.fst) # See ulib/Makefile.verify
STDLIB_FILES_SOURCES=$(wildcard $(STDLIB)/FStar.*.fst $(STDLIB)/FStar.*.fsti) $(STDLIB)/prims.fst
STDLIB_FILES_SOURCES_TO_CHECK=$(filter-out $(STDLIB_FILES_EXCLUDED),$(STDLIB_FILES_SOURCES))
STDLIB_FILES_CHECKED=$(STDLIB_FILES_SOURCES_TO_CHECK:=.checked)
STDLIB_FILES_ALL=$(STDLIB_FILES_SOURCES) $(STDLIB_FILES_CHECKED)

serve:
	mkdir -p web/fstar.js/
	cp vendor/z3.js/* lib/* $(JS_BUILD_DIR)/fstar.*.js web/fstar.js/
	mkdir -p web/fstar.js/fs/ web/fstar.js/fs/ulib/
	@+$(MAKE) -C $(FSTAR_ROOT)/ulib -f Makefile.verify $(STDLIB_FILES_CHECKED:$(STDLIB)/%=%)
	@cp $(STDLIB_FILES_ALL) web/fstar.js/fs/ulib/
	etc/jsoo_lazy_fs_index.py web/fstar.js/fs/ > web/fstar.js/fs/index.json
	python3 -m http.server

serve-%:
	cp $(JS_BUILD_DIR)/fstar.core.$*.js $(JS_BUILD_DIR)/fstar.core.js
	+$(MAKE) serve

clean-ocaml:
	rm -rf $(OCAML_BUILD_DIR)

clean:
	rm -rf build web/fstar.js
	+$(MAKE) -C $(FSTAR_ROOT) clean
