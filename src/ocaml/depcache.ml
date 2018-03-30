open FStar_Parser_Dep

let collect_all prefix fnames =
  let map = build_map [] in
  List.map (fun fname -> (prefix ^ fname, collect_one map fname)) fnames

let debug = false

let print_deps deps =
  List.iter (fun (fname, (deps, deps')) ->
      List.iter (function
          | UseInterface modname -> Printf.printf "UseInterface: %s\n" modname
          | PreferInterface modname -> Printf.printf "PreferInterface: %s\n" modname
          | UseImplementation modname -> Printf.printf "UseImplementation: %s\n" modname)
        (deps @ deps'))
    deps

let main () =
  match Array.to_list Sys.argv with
  | _ :: fstar_home :: prefix :: filenames ->
     FStar_Options.set_option "fstar_home" (FStar_Options.String fstar_home);
     let deps = collect_all prefix filenames in
     if debug then print_deps deps
     else output_value stdout deps
  | _ -> failwith "Syntax: ./depcache fstar_home prefix files..."

let _ = main ()
