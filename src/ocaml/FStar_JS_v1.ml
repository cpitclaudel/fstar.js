let cur_state = ref None

let fail_if_initialized () =
  match !cur_state with
  | None -> ()
  | Some _ -> failwith "REPL already initialized"

let assert_initialized () =
  match !cur_state with
  | Some st -> st
  | None -> failwith "REPL not initialized yet"

let repl_init (filename: string) (message_callback: FStar_Util.json -> unit) =
  fail_if_initialized ();
  FStar_Main.setup_hooks ();
  FStar_SMTEncoding_Z3.set_z3_options "";
  FStar_Interactive_Ide.js_repl_init_opts ();
  FStar_Interactive_Ide.install_ide_mode_hooks message_callback;
  message_callback FStar_Interactive_Ide.json_of_hello;
  cur_state := Some (FStar_Interactive_Ide.build_initial_repl_state filename)

let repl_eval_str query =
  let js_str, st_or_exit = FStar_Interactive_Ide.js_repl_eval_str (assert_initialized ()) query in
  (match st_or_exit with
   | FStar_Util.Inl st -> cur_state := Some st
   | FStar_Util.Inr _exitCode -> (* FIXME *) ());
  js_str

(* let stack_overflow_retries = ref 5 *)

(* let restart_on_overflow f x =
 *   let rec restart_on_overflow' n f x =
 *     try f x
 *     with Stack_overflow when n > 0 ->
 *       FStar_Util.print1 "Stack overflow: restarting (%s)\n" (string_of_int n);
 *       restart_on_overflow' (n - 1) f x
 *   in restart_on_overflow' !stack_overflow_retries f x *)

exception Exit of int

external ml_string_of_uint8Array : Js_of_ocaml.Typed_array.uint8Array Js.t -> string = "caml_string_of_array"

let main () =
  FStar_Main.setup_hooks ();
  FStar_SMTEncoding_Z3.set_z3_options "";
  FStar_Main.go ();
  FStar_Main.cleanup ();
  0

let _ =
  Js.export_all
    (object%js
       val quit = (* Called by the ‘Sys.exit’ handler in JSOO. *)
         Js.wrap_callback (fun (exitCode: int) -> raise (Exit exitCode))

       val chdir =
         Js.wrap_callback Sys.chdir

       val writeFile =
         Js.wrap_callback (fun fname fcontents ->
             let name = Js.to_string fname in
             let content = Js.to_string fcontents in
             if Sys.file_exists name then
               Sys_js.update_file ~name ~content
             else
               Sys_js.create_file ~name ~content)

       val setSMTSolver =
         Js.wrap_callback (fun ask reset ->
             let typesafe_ask (input: string) =
               let args = [| (Js.Unsafe.inject (Js.string input)) |] in
               Js.to_string (Js.Unsafe.fun_call ask args) in
             let typesafe_reset () =
               ignore (Js.Unsafe.fun_call reset [| |]) in
             FStar_SMTEncoding_Z3.set_bg_z3_proc
               { FStar_SMTEncoding_Z3.ask = typesafe_ask;
                 FStar_SMTEncoding_Z3.refresh = typesafe_reset;
                 FStar_SMTEncoding_Z3.restart = typesafe_reset })

       val setChannelFlushers =
         Js.wrap_callback (fun fstdout fstderr ->
             let wrap f s =
               Js.Unsafe.fun_call f [| (Js.Unsafe.inject (Js.string s)) |] in
             Sys_js.set_channel_flusher stderr (wrap fstderr);
             Sys_js.set_channel_flusher stdout (wrap fstdout))

       (* val setStackOverflowRetries =
        *   Js.wrap_callback (fun (n: int) -> stack_overflow_retries := n) *)

       val setCollectOneCache =
         Js.wrap_callback (fun js_bytestr ->
             let bs = ml_string_of_uint8Array js_bytestr in
             FStar_Parser_Dep.set_collect_one_cache
               (FStar_Util.smap_of_list (Marshal.from_bytes bs 0)))

       val callMain =
         Js.wrap_callback (fun () ->
             try (* ‘Exit’ is raised by ‘quit’ above. *)
               try main ()
               with | Exit exitCode -> exitCode
                    | e -> FStar_Main.handle_error e; 1
             with Exit exitCode -> exitCode)

       val callMainUnsafe =
         (** Run main with all exception catching disabled (to get better Javascript backtraces). **)
         Js.wrap_callback main

       val registerLazyFS =
         (** Register a lazy file system (this is a JS function). **)
         Js.Unsafe.js_expr "registerLazyFS"

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
