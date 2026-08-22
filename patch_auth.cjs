const fs = require('fs');
let code = fs.readFileSync('api/_handlers/auth/index.ts', 'utf8');

const regex = /(?:email|birthDate|cep|address|neighborhood|city|state|complement): (?:user|data)\.(?:email|birth_date|cep|address|neighborhood|city|state|complement),\n/g;
code = code.replace(regex, '');

fs.writeFileSync('api/_handlers/auth/index.ts', code);
