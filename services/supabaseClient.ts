import { createClient } from '@supabase/supabase-js';

/**
 * Browser Supabase client, authenticated with the anon (publishable) key.
 *
 * The anon key is public by design — it ships inside the JavaScript bundle —
 * so everything it can reach must be protected by row level security. See
 * migrations/001_security_and_integrity.sql for the policies.
 *
 * The service role key must never appear in this file or anywhere else under
 * services/ or components/. Server-side code uses api/_lib/supabaseServer.ts.
 *
 * These are read as `import.meta.env.VITE_*` literals because that is the only
 * form Vite substitutes at build time; a computed lookup such as
 * `import.meta.env[name]` is left untouched and resolves to undefined in the
 * browser.
 */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    'Supabase não configurado: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY ' +
      'nas variáveis de ambiente do projeto.'
  );
}

export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_ANON_KEY || 'placeholder'
);
