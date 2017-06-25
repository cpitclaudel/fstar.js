let cur_state = ref None

let fail_if_initialized () =
  match !cur_state with
  | None -> ()
  | Some _ -> failwith "REPL already initialized"

let ensure_initialized () =
  match !cur_state with
  | Some st -> st
  | None -> failwith "REPL not initialized yet"

let repl_init (filename: string) (message_callback: FStar_Util.json -> unit) =
  fail_if_initialized ();
  FStar_Interactive.js_repl_init_opts ();
  FStar_Interactive.install_ide_mode_hooks message_callback;
  message_callback FStar_Interactive.json_of_hello;
  cur_state := Some (FStar_Interactive.init_repl filename)

let repl_eval_str query =
  let js_str, st_or_exit = FStar_Interactive.js_repl_eval_str (ensure_initialized ()) query in
  (match st_or_exit with        (* FIXME *)
   | FStar_Util.Inl st -> cur_state := Some st
   | _ -> ());
  js_str

(** Register ‘handler’ as a virtual file system mounted at ‘mount_point’.
   ‘handler’ is called every time a file in ‘mountpoint’ is accessed (unless
   that file already exists in JSOO's virtual file system), and should return
   the file contents, or None. *)
(* let register_virtual_fs mount_point (handler: string -> string option) = *)
(*   Sys_js.mount *)
(*     mount_point *)
(*     (fun ~prefix ~path -> *)
(*       handler (Filename.concat prefix path)) *)

let _ =
  Js.export_all
    (object%js
       val quit = (* Called by the ‘Sys.exit’ handler in JSOO. *)
         Js.wrap_callback (fun (exitCode: int) -> raise (FStar_Main.Exit (Z.of_int exitCode)))

       val chdir = Js.wrap_callback Sys.chdir

       val writeFile =
         Js.wrap_callback (fun fname fcontents ->
             let name = Js.to_string fname in
             let content = Js.to_string fcontents in
             if Sys.file_exists name then
               Sys_js.update_file ~name ~content
             else
               Sys_js.register_file ~name ~content)

       val setChannelFlushers =
         Js.wrap_callback (fun fstdout fstderr ->
             let wrap f s =
               Js.Unsafe.fun_call f [| (Js.Unsafe.inject (Js.string s)) |] in
             Sys_js.set_channel_flusher stderr (wrap fstderr);
             Sys_js.set_channel_flusher stdout (wrap fstdout))

       val callMain =
         Js.wrap_callback (fun () ->
             try
               let _ = FStar_Main.main () in 0
             with FStar_Main.Exit exitCode -> (* ‘Exit’ is raised by ‘quit’ above. *)
               Z.to_int exitCode
           )

       val callMainUnsafe =
         (** This disables all exception catching (to get better Javascript backtraces) *)
         Js.wrap_callback (fun () -> FStar_Main.go (); FStar_Main.cleanup (); 0)

       (* val registerVirtualFS = *)
       (*   Js.wrap_callback (fun mount_point js_handler -> *)
       (*       register_virtual_fs *)
       (*         (Js.to_string mount_point) *)
       (*         (fun fname -> *)
       (*           let retv : (Js.js_string Js.t) Js.opt = *)
       (*             let args = [| Js.Unsafe.inject (Js.string fname) |] in *)
       (*             Js.Unsafe.fun_call js_handler args in *)
       (*           Js.Opt.case retv *)
       (*                       (fun () -> None) *)
       (*                       (fun str -> Some (Js.to_string str)))) *)

       val repl =
         (object%js
            val init =
              Js.wrap_callback
                (fun (filename: Js.js_string Js.t) (message_callback: 'a) ->
                  let message_callback (message: FStar_Util.json) =
                    let message_str = FStar_Util.string_of_json message in
                    let args = [| Js.Unsafe.inject (Js.string message_str) |] in
                    ignore (Js.Unsafe.fun_call message_callback args) in
                  repl_init (Js.to_string filename) message_callback)

            val evalStr =
              Js.wrap_callback (fun (query: Js.js_string Js.t) ->
                  Js.string (repl_eval_str (Js.to_string query)))
          end)
     end)
