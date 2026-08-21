/**
 * Gera os segredos de produção para cadastrar na Vercel.
 *
 *   node scripts/gerar-segredos.mjs "SuaSenhaForteAqui"
 *
 * Nada aqui é gravado em arquivo: os valores são só impressos, para você
 * copiar direto para o painel da Vercel.
 */
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const senha = process.argv[2];

if (!senha) {
  console.error('\nUso: node scripts/gerar-segredos.mjs "SuaSenhaForteAqui"\n');
  console.error('A senha é a que você vai digitar na tela do Super Admin.');
  console.error('Use algo longo e único — ela dá acesso total ao sistema.\n');
  process.exit(1);
}

const problemas = [];
if (senha.length < 12) problemas.push('tem menos de 12 caracteres');
if (!/[a-z]/.test(senha)) problemas.push('não tem letra minúscula');
if (!/[A-Z]/.test(senha)) problemas.push('não tem letra maiúscula');
if (!/[0-9]/.test(senha)) problemas.push('não tem número');
if (/^\d+$/.test(senha)) problemas.push('é só números');

console.log('');
if (problemas.length) {
  console.log('  AVISO: a senha ' + problemas.join(', ') + '.');
  console.log('  Ela dá acesso total ao painel. Considere uma mais forte.\n');
}

console.log('  Cadastre estas variáveis na Vercel');
console.log('  (Settings -> Environment Variables, marcando Production,');
console.log('   Preview e Development):\n');

console.log('  SUPER_ADMIN_PASSWORD_HASH');
console.log('  ' + bcrypt.hashSync(senha, 12) + '\n');

console.log('  WEBHOOK_SECRET');
console.log('  ' + crypto.randomBytes(32).toString('hex') + '\n');

console.log('  ---');
console.log('  A senha em texto puro NÃO vai para lugar nenhum: o servidor');
console.log('  guarda só o hash. Anote a senha num gerenciador — não há como');
console.log('  recuperá-la a partir do hash.');
console.log('');
console.log('  Depois de definir o WEBHOOK_SECRET, a URL do webhook na');
console.log('  Simplify fica:');
console.log('  https://SEU_DOMINIO/api/webhook/simplify?token=<WEBHOOK_SECRET>');
console.log('');
