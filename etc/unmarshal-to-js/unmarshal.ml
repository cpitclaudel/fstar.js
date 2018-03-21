(* This could be made faster by breaking through the abstraction and
   reusing the Javascript array directly *)
let bytes_of_array =
  fun js_arr ->
  let arr = Js.to_array js_arr in
  let bytes = Bytes.create (Array.length arr) in
  Array.iteri (fun idx chr -> Bytes.set bytes idx chr) arr;
  bytes

let _ =
  Js.export_all
    (object%js
       (* val example =
        *   Marshal.to_bytes ("ABC", 123) []
        *
        * val roundtrip =
        *   Marshal.from_bytes (Marshal.to_bytes ("ABC", 123) []) 0 *)

       val jsOfMarshalled = fun js_bytes ->
         Marshal.from_bytes (bytes_of_array js_bytes) 0

       val jsonOfMarshalled = fun js_bytes ->
         Json.output (Marshal.from_bytes (bytes_of_array js_bytes) 0)
     end)

(* let _ =
 *   List.iter (Sys.readdir "marshalled"
 *   print_string "AAA\n" *)
