==============
 ``fstar.js``
==============

This repo contains a scripts, wrappers, and libraries to run `F* <https://github.com/FStarLang/FStar/>`_ in the browser.  More precisely, it includes the following:

* Scripts and adapters (``src/ocaml/``) to compile F\* to JavaScript using `js_of_ocaml <https://github.com/ocsigen/js_of_ocaml>`_.
* TypeScript libraries to connect JavaScript builds of F\* to `Z3.wasm <https://github.com/cpitclaudel/z3.wasm/>`_.
* TypeScript sources and CSS styles to turn literate-F\* documents compiled with ``fslit`` into interactive F\* notebooks.

Loading Z3 and F* and downloading F* libraries is fairly slow (~15 seconds on Chrome, though less than 1 second on Firefox), but verification performance is fairly good (typically within a factor 2-5 of native on Chrome, and 3-10 of native on Firefox).

Pre-build archives are available at https://github.com/cpitclaudel/fstar.js/releases.

Building
========

- Clone this repository::

    git clone --recurse-submodules git@github.com:cpitclaudel/fstar.js.git

- Switch to OCaml 4.04.0 and install dependencies::

    opam switch 4.04.0
    eval `opam config env`
    opam install batteries compiler-libs compiler-libs.common dynlink js_of_ocaml js_of_ocaml.ppx menhirLib pprint stdint ulex yojson zarith
    (cd lib; npm install)

- Compile ``js_of_ocaml``::

    make -C vendor/js_of_ocaml

- Fetch a release of ``z3.wasm`` from https://github.com/cpitclaudel/z3.wasm/releases/ and extract it to ``vendor/z3.wasm``.

- Compile F* and the supporting libraries to JavaScript::

    make
    make dist

- Make sure that everything works::

    make serve
    chromium-browser http://localhost:8000/web/fstar.cli.html
    chromium-browser http://localhost:8000/web/fstar.ide.literate.stlc.html
    chromium-browser http://localhost:8000/web/fstar.ide.literate.client.html

Using the generated code
========================

The recommended way to integrate ``F*.js`` in your documents is to use `fslit <https://github.com/FStarLang/fstar-mode.el/tree/master/etc/fslit>`_ and Sphinx.

Other options are listed below:

- ``web/fstar.cli.html`` demonstrates how to setup ``F*.js`` for single-file verification.

  1. Add the following style sheets in your page's ``<head>``:

     .. code:: html

        <link rel="stylesheet" href="./fstar.js/cm.tango.css" />
        <link rel="stylesheet" href="./fstar.js/fstar.cli.css" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.36.0/codemirror.min.css" />

  2. Add the following scripts to the end of page's your ``<body>``:

     .. code:: html

        <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.36.0/codemirror.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.2.1/jquery.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/underscore.js/1.8.3/underscore-min.js"></script>
        <script src="./fstar.js/fstar.cm.js"></script>
        <script src="./fstar.js/fstar.client.js"></script>

  3. Set up the CLI integration:

     .. code:: html

        <script>
          // Tell F*.js where to look for web worker scripts
          FStar.CLI.WORKER_DIRECTORY = "./fstar.js/";
          // Set up the CLI backend
          var $editor = $(".standalone-editor");
          var client = new FStar.CLI.Client($editor, "file-name.fst", $editor.text());
        </script>

- ``web/fstar.ide.literate.stlc.html`` demonstrates how to turn a literate-F\* document into an interactive F\* notebook.  Most of this can be done for you by ``fslit``.

  1. Add the following style sheets in your page's ``<head>``:

     .. code:: html

        <link rel="stylesheet" href="./fslit.css" />
        <link rel="stylesheet" href="./fstar.js/cm.tango.css" />
        <link rel="stylesheet" href="./fstar.js/fstar.ide.css" />
        <link rel="stylesheet" href="./fstar.js/fstar.cli.css" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.36.0/codemirror.min.css" />

  2. Add the following scripts to the end of page's your ``<body>``:

     .. code:: html

        <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.36.0/codemirror.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.36.0/addon/runmode/runmode.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.2.1/jquery.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/underscore.js/1.8.3/underscore-min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/mustache.js/2.3.0/mustache.js"></script>
        <script src="./fslit.js"></script>
        <script src="./fstar.js/fstar.cm.js"></script>
        <script src="./fstar.js/fstar.client.js"></script>

  3. Set up the CLI integration:

     .. code:: html

         <script>
           // Tell F*.js where to look for web worker scripts
           FStar.CLI.WORKER_DIRECTORY = "./fstar.js/";
           FStar.IDE.WORKER_DIRECTORY = "./fstar.js/";
           // Set up the IDE backend (this turns all DOM elements with class ``fstar``
           // into interactive snippets).
           FStar.IDE.LiterateClient.run("file-name.fst");
         </script>

Notes
=====

The build script places all artefacts in ``dist/``:

- ``fstar.core.js``: F\*, compiled to JavaScript.
- ``fs/``: A copy of F\*'s standard library, along with index files to allow ``F*.js`` to fetch library files on demand.
- ``fstar.client.js``, ``fstar.cli.worker.js``, ``fstar.ide.worker.js``: Libraries to load and drive ``fstar.core.js``, verify individual files, talk to F* using the IDE protocol, and embed ``F*.js`` in literate F\* documents.  ``worker`` files are intended to be run in web workers.
- , ``fstar.cli.css``, ``fstar.ide.css``: CSS styles for standalone F\* CLI interface and for F\* snippets embedded in an HTML document.
- ``fstar.cm.js``, ``cm.tango.css``: Basic F\* syntax highlighting for CodeMirror

The JavaScript libraries are built from TypeScript sources in ``lib/``: each file has a small header summarizing its purpose.
