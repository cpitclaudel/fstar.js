const fs = require('fs');

JSON.parse(fs.readFileSync(process.argv[2]));
