const fs = require('fs');
let code = fs.readFileSync('api/_lib/raffleService.ts', 'utf8');

code = code.replace(/const hasEmail = !!\(prof\.email && prof\.email\.includes\('@'\) && !prof\.email\.includes\('@example\.invalid'\)\);\n/g, '');
code = code.replace(/const hasBirth = !!\(prof\.birth_date && prof\.birth_date\.trim\(\)\);\n/g, '');
code = code.replace(/const hasCep = !!\(prof\.cep && prof\.cep\.replace\(\/\\D\/g, ''\)\.length === 8\);\n/g, '');
code = code.replace(/const hasAddr = !!\(prof\.address && prof\.address\.trim\(\)\);\n/g, '');
code = code.replace(/const hasNeigh = !!\(prof\.neighborhood && prof\.neighborhood\.trim\(\)\);\n/g, '');
code = code.replace(/const hasCity = !!\(prof\.city && prof\.city\.trim\(\)\);\n/g, '');
code = code.replace(/const hasState = !!\(prof\.state && prof\.state\.trim\(\)\);\n/g, '');

const regexMap = /(?:email|birthDate|cep|address|neighborhood|city|state|complement): prof\.(?:email|birth_date|cep|address|neighborhood|city|state|complement),\n/g;
code = code.replace(regexMap, '');

// Line 1260:
code = code.replace(/email: p\.email \|\| '',\n/g, '');
code = code.replace(/city: p\.city \|\| '',\n/g, '');
code = code.replace(/state: p\.state \|\| '',\n/g, '');

// Line 1439:
code = code.replace(/email: profile\?\.email \|\| null,\n/g, '');

fs.writeFileSync('api/_lib/raffleService.ts', code);
