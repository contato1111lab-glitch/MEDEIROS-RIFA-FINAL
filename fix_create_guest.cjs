const fs = require('fs');
let code = fs.readFileSync('api/_handlers/payments/create.ts', 'utf8');

const target = `    // 1. Setup User Profile First
    const cleanCpf = payer.cpf.replace(/\\D/g, '');
    let userId = 'guest';

    if (cleanCpf) {`;

const replacement = `    // 1. Setup User Profile First
    const cleanCpf = payer.cpf.replace(/\\D/g, '');
    let userId = 'guest';

    if (!cleanCpf) {
      return res.status(400).json({ success: false, error: 'CPF válido é obrigatório.' });
    }

    if (cleanCpf) {`;

code = code.replace(target, replacement);
fs.writeFileSync('api/_handlers/payments/create.ts', code);
console.log("Fixed guest in create.ts");
