LIB_BUILD_DIR=build/js/lib
JSOO_BUILD_DIR=build/js/jsoo
OCAML_BUILD_DIR=build/ocaml

OCAML_ROOT=src/ocaml
FSTAR_ROOT=$(OCAML_ROOT)/fstar
STDLIB=$(FSTAR_ROOT)/ulib
ULIB_ML32_SUBDIR=tmp/ulib-ml32
ULIB_ML32_ROOT=$(OCAML_ROOT)/$(ULIB_ML32_SUBDIR)

JS_OF_OCAML=ulimit -s unlimited; /build/js_of_ocaml/_build/default/compiler/js_of_ocaml.exe

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
	mkdir -p $(LIB_BUILD_DIR)
	mkdir -p $(JSOO_BUILD_DIR)
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
	$(JS_OF_OCAML) --opt 3 $(JSOO_OPTS) $(OCAML_BUILD_DIR)/fstar.core.byte -o $(JSOO_BUILD_DIR)/fstar.core.$@.js
	./etc/jsoo_append_tail.py $(JSOO_BUILD_DIR)/fstar.core.$@.js JSOO_FStar
	cp $(JSOO_BUILD_DIR)/fstar.core.$@.js $(JSOO_BUILD_DIR)/fstar.core.js

debug: $(OCAML_BUILD_DIR)/fstar.core.d.byte | build-dirs
	$(JS_OF_OCAML) $(JSOO_LIGHT_DEBUG_OPTS) $(JSOO_HEAVY_DEBUG_OPTS) $(JSOO_OPTS) $(OCAML_BUILD_DIR)/fstar.core.d.byte -o $(JSOO_BUILD_DIR)/fstar.core.$@.js
	./etc/jsoo_append_tail.py $(JSOO_BUILD_DIR)/fstar.core.$@.js JSOO_FStar
	cp $(JSOO_BUILD_DIR)/fstar.core.$@.js $(JSOO_BUILD_DIR)/fstar.core.js

# FIXME --disable excwrap?
read: $(OCAML_BUILD_DIR)/fstar.core.d.byte | build-dirs
	$(JS_OF_OCAML) $(JSOO_LIGHT_DEBUG_OPTS) $(JSOO_OPTS) $(OCAML_BUILD_DIR)/fstar.core.d.byte -o $(JSOO_BUILD_DIR)/fstar.core.$@.js
	./etc/jsoo_append_tail.py $(JSOO_BUILD_DIR)/fstar.core.$@.js JSOO_FStar
	cp $(JSOO_BUILD_DIR)/fstar.core.$@.js $(JSOO_BUILD_DIR)/fstar.core.js

STDLIB_FILES_EXCLUDED=$(addprefix $(STDLIB)/,FStar.Int31.fst FStar.UInt31.fst FStar.Relational.State.fst) # See ulib/Makefile.verify
STDLIB_FILES_SOURCES=$(wildcard $(STDLIB)/FStar.*.fst $(STDLIB)/FStar.*.fsti) $(STDLIB)/prims.fst
STDLIB_FILES_SOURCES_TO_CHECK=$(filter-out $(STDLIB_FILES_EXCLUDED),$(STDLIB_FILES_SOURCES))
STDLIB_FILES_CHECKED=$(STDLIB_FILES_SOURCES_TO_CHECK:=.checked)
STDLIB_FILES_ALL=$(STDLIB_FILES_SOURCES) $(STDLIB_FILES_CHECKED)

dist-dirs:
	mkdir -p dist/ dist/fs/ dist/fs/ulib/

gen-index: $(STDLIB_FILES_SOURCES) | dist-dirs
	@echo $(MAKE) --quiet -C $(FSTAR_ROOT)/ulib -f Makefile.verify '[...]'
	@+$(MAKE) --quiet -C $(FSTAR_ROOT)/ulib -f Makefile.verify $(STDLIB_FILES_CHECKED:$(STDLIB)/%=%)
	etc/jsoo_lazy_fs_index.py dist/fs/ > dist/fs/index.json

gen-depcache: $(OCAML_BUILD_DIR)/depcache.native $(STDLIB_FILES_SOURCES_TO_CHECK) | dist-dirs
	@echo 'depcache [...]'
	@build/ocaml/depcache.native $(FSTAR_ROOT) /fstar/ulib/ $(STDLIB_FILES_SOURCES_TO_CHECK:$(STDLIB)/%=%) > dist/fs/depcache

$(LIB_BUILD_DIR)/fstar.%.js: $(wildcard lib/*.ts)
	tsc --project "lib/tsconfig.$*.json"

TSC_OUTPUTS=$(addprefix $(LIB_BUILD_DIR)/,fstar.client.js fstar.ide.worker.js fstar.cli.worker.js)

dist: gen-index gen-depcache $(TSC_OUTPUTS) | dist-dirs
	cp vendor/z3.js/z3smt2w.js vendor/z3.js/z3smt2w.wasm lib/*.js lib/*.css dist/
	cp $(TSC_OUTPUTS) $(JSOO_BUILD_DIR)/fstar.core.js dist/
	@cp $(STDLIB_FILES_ALL) dist/fs/ulib/

serve: dist
	test -L web/fstar.js || ln -s ../dist web/fstar.js
	python3 -m http.server

serve-%:
	cp $(JSOO_BUILD_DIR)/fstar.core.$*.js $(JSOO_BUILD_DIR)/fstar.core.js
	+$(MAKE) serve

release: dist
	tar --create --gzip --file fstar.js.tar.gz --transform 's|^dist|fstar.js|' dist

clean-ocaml:
	rm -rf $(OCAML_BUILD_DIR)

clean:
	rm -rf build dist
	unlink web/fstar.js
	+$(MAKE) -C $(FSTAR_ROOT) clean
