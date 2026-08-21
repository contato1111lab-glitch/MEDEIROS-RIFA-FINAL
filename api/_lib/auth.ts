import bcrypt from 'bcryptjs';
import crypto from 'crypto';

/**
 * Super-admin master password verification.
 *
 * The password used to live in `app_config.super_admin_password` as plain text.
 * That table is reachable with the anon key, which ships inside the public
 * frontend bundle, so the master password was readable by any visitor and could
 * be replayed against this API as `x-master-password` for full admin access.
 *
 * It now lives only in the SUPER_ADMIN_PASSWORD_HASH environment variable, as a
 * bcrypt hash, and is never stored in or read from the database.
 *
 * Generate the hash with:
 *   node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 12))" "<senha>"
 */
const HASH = process.env.SUPER_ADMIN_PASSWORD_HASH || '';

/**
 * Constant-time comparison for the non-bcrypt path, so a caller cannot learn the
 * secret one character at a time from response-time differences.
 */
function timingSafeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) {
    // Still burn a comparison so length mismatches are not measurably faster.
    crypto.timingSafeEqual(ba, ba);
    return false;
  }
  return crypto.timingSafeEqual(ba, bb);
}

export function isMasterPasswordConfigured(): boolean {
  return HASH.length > 0;
}

/**
 * Returns true only when the supplied password matches the configured hash.
 * Fails closed: if SUPER_ADMIN_PASSWORD_HASH is unset, no password is accepted.
 */
export async function verifyMasterPassword(supplied: unknown): Promise<boolean> {
  if (typeof supplied !== 'string' || supplied.length === 0) return false;
  if (!HASH) {
    console.error(
      '[AUTH] SUPER_ADMIN_PASSWORD_HASH is not set. Super-admin access is disabled.'
    );
    return false;
  }

  // Support a bcrypt hash (expected) or, as an explicit opt-in escape hatch, a
  // literal value prefixed with "plain:" for local development only.
  if (HASH.startsWith('plain:')) {
    return timingSafeEqual(supplied, HASH.slice('plain:'.length));
  }

  try {
    return await bcrypt.compare(supplied, HASH);
  } catch (err) {
    console.error('[AUTH] master password comparison failed:', err);
    return false;
  }
}
