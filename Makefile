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

$(OCAML_BUILD_DIR)/%.byte: fstar $(OCAML_ROOT)/%.ml | ulib-32 build-dirs
	$(OCAMLBUILD) "$*.byte"

$(OCAML_BUILD_DIR)/%.d.byte: fstar $(OCAML_ROOT)/%.ml | ulib-32 build-dirs
	$(OCAMLBUILD) "$*.d.byte"

# Don't depend on fstar here (we use .native for tools only)
$(OCAML_BUILD_DIR)/%.native: $(OCAML_ROOT)/%.ml | ulib-32 build-dirs
	$(OCAMLBUILD) "$*.native"

$(OCAML_BUILD_DIR)/fstar.core.%: $(OCAML_BUILD_DIR)/FStar_JS_v1.%
	cp "$<" "$@"

## JSOO options.
# The code produced by JSOO tends to stack-overflow quite a bit.  Out of the
# box, ‘--disable inline’ makes things a bit better, and so does ‘--opt 3’,
# likely because these options make stack frames smaller.  But even that is not
# enough: what actually helps is disabling JSOO's trampolining optimization that
# doesn't trampoline until 50 stack-frames deep, and re-enabling inlining.
JS_LIBS=src/js/BigInteger.js src/js/zarith.js src/js/fs_lazy.js src/js/overrides.js +nat.js +toplevel.js
JSOO_OPTS=--wrap-with-fun=JSOO_FStar --extern-fs $(JS_LIBS) --debug times
JSOO_LIGHT_DEBUG_OPTS=--pretty --source-map
JSOO_HEAVY_DEBUG_OPTS=--debug-info --disable execwrap # --debug-info and --disable inline make some things harder to read

opt: $(OCAML_BUILD_DIR)/fstar.core.byte | build-dirs
	$(JS_OF_OCAML) --opt 3 $(JSOO_OPTS) $(OCAML_BUILD_DIR)/fstar.core.byte -o $(JS_BUILD_DIR)/fstar.core.$@.js
	./etc/jsoo_append_tail.py $(JS_BUILD_DIR)/fstar.core.$@.js JSOO_FStar
	cp $(JS_BUILD_DIR)/fstar.core.$@.js $(JS_BUILD_DIR)/fstar.core.js

debug: $(OCAML_BUILD_DIR)/fstar.core.d.byte | build-dirs
	$(JS_OF_OCAML) $(JSOO_LIGHT_DEBUG_OPTS) $(JSOO_HEAVY_DEBUG_OPTS) $(JSOO_OPTS) $(OCAML_BUILD_DIR)/fstar.core.d.byte -o $(JS_BUILD_DIR)/fstar.core.$@.js
	./etc/jsoo_append_tail.py $(JS_BUILD_DIR)/fstar.core.$@.js JSOO_FStar
	cp $(JS_BUILD_DIR)/fstar.core.$@.js $(JS_BUILD_DIR)/fstar.core.js

read: $(OCAML_BUILD_DIR)/fstar.core.d.byte | build-dirs
	$(JS_OF_OCAML) $(JSOO_LIGHT_DEBUG_OPTS) $(JSOO_OPTS) $(OCAML_BUILD_DIR)/fstar.core.d.byte -o $(JS_BUILD_DIR)/fstar.core.$@.js
	./etc/jsoo_append_tail.py $(JS_BUILD_DIR)/fstar.core.$@.js JSOO_FStar
	cp $(JS_BUILD_DIR)/fstar.core.$@.js $(JS_BUILD_DIR)/fstar.core.js

STDLIB_FILES_EXCLUDED=$(addprefix $(STDLIB)/,FStar.Int31.fst FStar.UInt31.fst FStar.Relational.State.fst) # See ulib/Makefile.verify
STDLIB_FILES_SOURCES=$(wildcard $(STDLIB)/FStar.*.fst $(STDLIB)/FStar.*.fsti) $(STDLIB)/prims.fst
STDLIB_FILES_SOURCES_TO_CHECK=$(filter-out $(STDLIB_FILES_EXCLUDED),$(STDLIB_FILES_SOURCES))
STDLIB_FILES_CHECKED=$(STDLIB_FILES_SOURCES_TO_CHECK:=.checked)
STDLIB_FILES_ALL=$(STDLIB_FILES_SOURCES) $(STDLIB_FILES_CHECKED)

web-dirs:
	mkdir -p web/fstar.js/ web/fstar.js/fs/ web/fstar.js/fs/ulib/

gen-index: $(STDLIB_FILES_ALL) | web-dirs
	@+$(MAKE) --quiet -C $(FSTAR_ROOT)/ulib -f Makefile.verify $(STDLIB_FILES_CHECKED:$(STDLIB)/%=%)
	etc/jsoo_lazy_fs_index.py web/fstar.js/fs/ > web/fstar.js/fs/index.json

gen-depcache: $(OCAML_BUILD_DIR)/depcache.native $(STDLIB_FILES_SOURCES_TO_CHECK) | web-dirs
	build/ocaml/depcache.native $(FSTAR_ROOT) /fstar/ulib/ $(STDLIB_FILES_SOURCES_TO_CHECK:$(STDLIB)/%=%) > web/fstar.js/fs/depcache

serve: gen-index gen-depcache | web-dirs
	cp vendor/z3.js/*.* lib/* $(JS_BUILD_DIR)/fstar.*.js web/fstar.js/
	@cp $(STDLIB_FILES_ALL) web/fstar.js/fs/ulib/
	python3 -m http.server

serve-%:
	cp $(JS_BUILD_DIR)/fstar.core.$*.js $(JS_BUILD_DIR)/fstar.core.js
	+$(MAKE) serve

clean-ocaml:
	rm -rf $(OCAML_BUILD_DIR)

clean:
	rm -rf build web/fstar.js
	+$(MAKE) -C $(FSTAR_ROOT) clean
