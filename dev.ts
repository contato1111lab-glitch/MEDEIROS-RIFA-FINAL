/**
 * Entrypoint de desenvolvimento local.
 *
 * Carrega o .env para dentro de process.env ANTES de importar o servidor.
 *
 * Isso precisa ser um arquivo separado: em ESM, todos os `import` são avaliados
 * antes da primeira linha de código do módulo. Como api/_lib/supabaseServer.ts
 * lê process.env no escopo do módulo, colocar o carregamento no topo do
 * server.ts seria tarde demais — o cliente Supabase já teria sido criado sem as
 * chaves. O `await import()` no fim deste arquivo resolve a ordem.
 *
 * Na Vercel este arquivo nunca roda: as variáveis vêm do painel da plataforma.
 */
import fs from 'fs';
import path from 'path';

function loadEnvFile(file: string) {
  const full = path.resolve(process.cwd(), file);
  if (!fs.existsSync(full)) return false;

  const content = fs.readFileSync(full, 'utf8');

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const eq = line.indexOf('=');
    if (eq <= 0) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();

    // Remove aspas envolventes, se houver.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    // Variáveis já definidas no shell têm prioridade sobre o arquivo.
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  return true;
}

const loaded = loadEnvFile('.env');

if (loaded) {
  console.log('[dev] .env carregado');
} else {
  console.warn('[dev] .env não encontrado — copie .env.example para .env');
}

// Relatório de configuração antes de subir, para não descobrir o que falta
// só quando uma tela quebrar.
const required = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPER_ADMIN_PASSWORD_HASH',
];
const optional = ['SIMPLIFY_CLIENT_ID', 'SIMPLIFY_CLIENT_SECRET', 'WEBHOOK_SECRET'];

const missing = required.filter(k => !process.env[k]);
const missingOptional = optional.filter(k => !process.env[k]);

console.log('[dev] configuração:');
for (const k of [...required, ...optional]) {
  const mark = process.env[k] ? 'ok  ' : '--  ';
  console.log(`      ${mark}${k}`);
}

if (missing.length) {
  console.warn(`[dev] AVISO: faltam variáveis obrigatórias: ${missing.join(', ')}`);
}
if (missingOptional.length) {
  console.warn(
    `[dev] pagamento/webhook desabilitados (faltam: ${missingOptional.join(', ')})`
  );
}

await import('./server');
