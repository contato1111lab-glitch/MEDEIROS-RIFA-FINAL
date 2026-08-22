const fs = require('fs');
let code = fs.readFileSync('components/MyTickets.tsx', 'utf8');

code = code.replace("Utilize seu CPF e senha para entrar", "Utilize seu CPF e telefone cadastrado para entrar");
code = code.replace("CPF ou senha incorretos", "CPF ou telefone incorretos");
code = code.replace("Informe o telefone.", "Informe o telefone cadastrado.");

fs.writeFileSync('components/MyTickets.tsx', code);
console.log("Replaced MyTickets.tsx");
