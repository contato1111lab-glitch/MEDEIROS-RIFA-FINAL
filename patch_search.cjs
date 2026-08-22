const fs = require('fs');
let code = fs.readFileSync('api/_handlers/tickets/search.ts', 'utf8');

code = code.replace(/email: profile\.email \? maskEmail\(profile\.email\) : undefined,\n/g, '');
code = code.replace(/birthDate: profile\.birth_date,\n/g, '');
code = code.replace(/cep: profile\.cep,\n/g, '');
code = code.replace(/address: profile\.address,\n/g, '');
code = code.replace(/neighborhood: profile\.neighborhood,\n/g, '');
code = code.replace(/city: profile\.city,\n/g, '');
code = code.replace(/state: profile\.state,\n/g, '');
code = code.replace(/complement: profile\.complement,\n/g, '');

fs.writeFileSync('api/_handlers/tickets/search.ts', code);
