(* Marshal F* dependency graphs.

Copyright (C) 2017-2018 Clément Pit-Claudel
Author: Clément Pit-Claudel <clement.pitclaudel@live.com>
URL: https://github.com/cpitclaudel/fstar.js

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License. *)

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
