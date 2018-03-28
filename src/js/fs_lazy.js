/* global MlFile caml_raise_sys_error caml_blit_string caml_raise_no_such_file
   caml_string_of_array jsoo_mount_point */

/// Lazy File

//Provides: LazyFile
//Requires: MlFile, caml_raise_sys_error, caml_blit_string, caml_string_of_array
function LazyFile(fullname, bytes) {
    this.fullname = fullname;
    this.bytes = bytes;
}

// JSOO API

LazyFile.prototype = new MlFile();

LazyFile.prototype.asOcamlString = function() {
    return caml_string_of_array(this.bytes);
};

LazyFile.prototype.truncate = function(_len) {
    caml_raise_sys_error("Cannot truncate " + this.fullname);
};

LazyFile.prototype.length = function () {
    return this.bytes.length;
};

LazyFile.prototype.write = function(_offset, _buf, _pos, _len) {
    caml_raise_sys_error("Cannot write into " + this.fullname);
};

LazyFile.prototype.read = function(offset, buf, pos, len) {
    caml_blit_string(this.asOcamlString(), offset, buf, pos, len);
    return 0;
};

LazyFile.prototype.read_one = function(offset) {
    return this.bytes[offset];
};

LazyFile.prototype.close = function() {};

LazyFile.prototype.constructor = LazyFile;

/// Lazy FS

//Provides: LazyFSDevice
//Requires: LazyFile, caml_raise_sys_error, caml_raise_no_such_file
function LazyFSDevice(index, files, fs_root, resolver) {
    this.files = files;
    this.index = index;
    this.fs_root = fs_root;
    this.resolver = resolver;
}

LazyFSDevice.prototype.kind = function(fname) {
    if (this.index.indexOf(fname) >= 0) {
        return "file";
    } else if (this.index.indexOf(fname + "/") >= 0) {
        return "directory";
    } else {
        return null;
    }
};

LazyFSDevice.prototype.fullName = function(fname) {
    return this.fs_root + fname;
};

LazyFSDevice.prototype.readBytes = function(fname) {
    if (this.kind(fname) != "file")
        return null;
    if (!this.files.hasOwnProperty(fname))
        this.files[fname] = this.resolver(fname);
    return this.files[fname];
};

// JSOO API

LazyFSDevice.prototype.exists = function(fname) {
    return this.kind(fname) != null;
};

LazyFSDevice.prototype.readdir = function(dirname) {
    var in_dir_re = new RegExp("^" + dirname + "/([^/]+)$");
    var files = [];
    this.index.forEach(function (fpath) {
        var match = fpath.match(in_dir_re);
        if (match) files.push(match[1]);
    });
    files.reverse();
    return files;
};

LazyFSDevice.prototype.is_dir = function(fname) {
    return this.kind(fname) == "directory";
};

LazyFSDevice.prototype.unlink = function(fname) {
    caml_raise_sys_error("Cannot unlink " + fname);
};

LazyFSDevice.prototype.open = function(fname, flags) {
    if (flags.create || flags.wronly)
        caml_raise_sys_error("Cannot write nor create " + fname);
    if (flags.text && flags.binary)
        caml_raise_sys_error("Cannot open " + fname + " as both text and binary");

    var bytes = this.readBytes(fname);
    var fullname = this.fullName(fname);
    if (bytes == null)
        caml_raise_no_such_file(fullname);

    return new LazyFile(fullname, bytes);
};

LazyFSDevice.prototype.constructor = LazyFSDevice;

/// Entry point

//Provides: registerLazyFS
//Requires: LazyFile, LazyFSDevice, jsoo_mount_point
function registerLazyFS(index, files, fs_root, resolver) {
    var device = new LazyFSDevice(index, files, fs_root, resolver);
    jsoo_mount_point.push({path: fs_root, device: device});
}
