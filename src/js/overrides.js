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

/// We create factory functions, not global objects.

//Provides: caml_js_export_var
function caml_js_export_var () {
    // Always use joo_global_object (the original version uses module.exports if
    // available, but this only works if you're creating a single instance of
    // the JSOO application).
    return joo_global_object;
}

// //Provides: caml_sys_file_exists
// //Requires: caml_root_dir, caml_make_path
// function caml_sys_file_exists (name) {
//     console.log("Checking for ", name);
//     var dir = caml_root_dir;
//     var path = caml_make_path(name);
//     var auto_load;
//     var pos;
//     for(var i=0;i<path.length;i++){
//         if(dir.auto) { auto_load = dir.auto; pos = i}
//         if(!(dir.exists && dir.exists(path[i]))) {
//             if(auto_load) {
//                 return auto_load(path,pos);
//             }
//             else {
//                 console.log("Segment", path[i], "doesn't exist");
//                 return 0;
//             }
//         }
//         dir=dir.get(path[i]);
//     }
//     return 1;
// }
