import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

/**
 * Password hashing with Node's built-in scrypt: no native module, so nothing
 * for pnpm's build-script policy to block. The stored string carries its own
 * parameters, so they can be raised later without breaking old hashes:
 *
 *   scrypt$<N>$<r>$<p>$<salt base64url>$<hash base64url>
 */
const PARAMS = { N: 16384, r: 8, p: 1 } as const;
const KEY_LENGTH = 32;
const MAXMEM = 64 * 1024 * 1024;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, KEY_LENGTH, {
    ...PARAMS,
    maxmem: MAXMEM,
  });
  return [
    'scrypt',
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString('base64url'),
    hash.toString('base64url'),
  ].join('$');
}

/** Constant-time comparison. A malformed stored value verifies as false, never throws. */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [scheme, n, r, p, saltB64, hashB64] = stored.split('$');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64url');
  const actual = await scryptAsync(
    password,
    Buffer.from(saltB64, 'base64url'),
    expected.length,
    { N: Number(n), r: Number(r), p: Number(p), maxmem: MAXMEM },
  );
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
