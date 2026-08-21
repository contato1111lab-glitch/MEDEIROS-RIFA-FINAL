import { createClient } from '@supabase/supabase-js';

/**
 * Server-side Supabase client, authenticated with the service role key.
 *
 * This key bypasses row level security, so this module must never be imported
 * from anything that ends up in the browser bundle. Frontend code uses
 * services/supabaseClient.ts (anon key) instead.
 */
const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '')
  .trim()
  .replace(/\/rest\/v1\/?$/, '');

const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

const missing: string[] = [];
if (!SUPABASE_URL) missing.push('SUPABASE_URL (or VITE_SUPABASE_URL)');
if (!SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');

/**
 * Reported by /api/health so a misconfigured deployment is visible without
 * having to read function logs.
 *
 * Note this is deliberately not thrown at module load: an exception here would
 * abort the serverless function during cold start, and the platform reports that
 * as an opaque FUNCTION_INVOCATION_FAILED with an HTML body rather than a
 * readable JSON error.
 */
export const supabaseServerConfig = {
  configured: missing.length === 0,
  missing,
};

if (missing.length > 0) {
  console.error(
    `[SUPABASE] Missing required environment variable(s): ${missing.join(', ')}. ` +
      'Every database call from this API will fail until they are set in the deployment environment.'
  );
}

export const supabaseServer = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY || 'placeholder',
  {
    auth: {
      // A serverless function has no user session to persist or refresh.
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);
