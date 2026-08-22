const fs = require('fs');
let code = fs.readFileSync('api/_lib/raffleService.ts', 'utf8');

code = code.replace(/const hasNum = !!\(prof\.number && prof\.number\.trim\(\)\);\n/g, '');
code = code.replace(/number: prof\.number,\n/g, '');
fs.writeFileSync('api/_lib/raffleService.ts', code);
