const fs = require('fs');
const unmarshal = require('./unmarshal.js');

function unmarshal_one(fname) {
    const contents = fs.readFileSync(fname);
    return unmarshal.jsOfMarshalled([...contents]);
}

var unmarshalled_map = {};
var files = process.argv.slice(2);
files.forEach(function(fname) {
    unmarshalled_map[fname] = unmarshal_one(fname);
});

console.log(JSON.stringify(unmarshalled_map));
