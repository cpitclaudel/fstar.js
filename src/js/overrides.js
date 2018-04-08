/* eslint no-undef: "off" */
/* eslint no-unused-vars: "off" */

//Provides: unix_isatty
function unix_isatty() {
    return 0; // false
}

//Provides: unix_umask
function unix_umask(mask) {
    return 0;
}

//Provides: unix_environment
function unix_environment() {
    return [0]; // Empty array
}

/// We want a way to pass command-line arguments to F*

//Provides: caml_sys_get_argv const
//Requires: caml_js_to_string
//Requires: raw_array_sub, caml_sys_chdir
function caml_sys_get_argv () {
    var g = joo_global_object;

    var main = "fstar";
    var args = [];

    if (g.fstar_args) {
        args = g.fstar_args;
    } else if (g.process && g.process.argv
               && g.process.argv.length > 1) {
        // We only fall back to node's command line arguments if we weren't
        // passed a specific set of arguments.
        var argv = g.process.argv;
        main = argv[1];
        args = raw_array_sub(argv, 2, argv.length - 2);
    }

    var p = caml_js_to_string(main);
    return [0, p, [0, p].concat(args.map(caml_js_to_string))];
}

/// No threading support:

//Provides: caml_mutex_new const
function caml_mutex_new() {
    return 0;
}

//Provides: caml_mutex_lock const
function caml_mutex_lock(m) { }

//Provides: caml_mutex_unlock const
function caml_mutex_unlock(m) { }

//Provides: caml_thread_new const
function caml_thread_new() {
    return 0;
}

//Provides: caml_thread_initialize const
function caml_thread_initialize() {}

//Provides: caml_thread_cleanup const
function caml_thread_cleanup() { }

//Provides: caml_thread_join const
function caml_thread_join(t) { }

// Provides: unix_stat
// Requires: caml_sys_file_exists, caml_ml_open_descriptor_in
// Requires: caml_sys_open, caml_ml_set_channel_name
// Requires: caml_ml_close_channel, caml_ml_channel_size
// Requires: caml_new_string, caml_sys_is_directory
// Requires: caml_named_value, caml_bytes_of_string
function unix_stat(fname) {
    if (!caml_sys_file_exists(fname)) {
        var errname = caml_new_string("Unix.Unix_error");
        var Unix_error = caml_named_value(caml_bytes_of_string(errname));
        throw [0, Unix_error, 20, caml_new_string("stat"), fname];
    }

    var is_dir = caml_sys_is_directory(fname) ? 1 : 0;
    var kind = is_dir ? 1 : 0;
    var perms = is_dir ? 493 : 420;

    var size = 4096;
    if (!is_dir) {
        var channel = caml_ml_open_descriptor_in(caml_sys_open(fname, [0,0,[0,7,0]], 0));
        caml_ml_set_channel_name(channel, fname);
        size = caml_ml_channel_size(channel);
        caml_ml_close_channel(channel);
    }

    return [0, -1, -1, kind, perms, -1, -1, -1, -1, size, -1, -1, -1];
}

/// Our files are read as arrays:
/*
FIXME: this doesn't seem to make things much faster

//Provides: MlStringReader
//Requires: caml_string_of_array, caml_array_of_string
function MlStringReader (s, i) {
    this.s = caml_array_of_string(s);
    this.i = i;
}

MlStringReader.prototype = {
    read8u:function () { return this.s[this.i++]; },
    read8s:function () { return this.s[this.i++] << 24 >> 24; },
    read16u:function () {
        var s = this.s, i = this.i;
        this.i = i + 2;
        return (s[i] << 8) | s[i + 1];
    },
    read16s:function () {
        var s = this.s, i = this.i;
        this.i = i + 2;
        return (s[i] << 24 >> 16) | s[i + 1];
    },
    read32u:function () {
        var s = this.s, i = this.i;
        this.i = i + 4;
        return ((s[i] << 24) | (s[i+1] << 16) |
                (s[i+2] << 8) | s[i+3]) >>> 0;
    },
    read32s:function () {
        var s = this.s, i = this.i;
        this.i = i + 4;
        return (s[i] << 24) | (s[i+1] << 16) |
            (s[i+2] << 8) | s[i+3];
    },
    readstr:function (len) {
        var i = this.i;
        this.i += len;
        return caml_string_of_array(this.s.slice(i, i + len));
    }
};
*/
