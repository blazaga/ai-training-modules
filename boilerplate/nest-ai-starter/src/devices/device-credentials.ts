import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** RFC 4648 base32 alphabet: upper-case, no 0/1/8/9, so no O/0 or I/1 confusion. */
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  return out;
}

/** `AKID` + 16 base32 chars (80 random bits). An identifier: safe to show and log. */
export function generateAccessKeyId(): string {
  return `AKID${base32(randomBytes(10))}`;
}

/**
 * `dsk_` + base64url(32 random bytes): 256 bits. The prefix lets secret
 * scanners spot a leaked device secret. Generated on the SERVER only.
 */
export function generateSecret(): string {
  return `dsk_${randomBytes(32).toString('base64url')}`;
}

/**
 * sha256, hex. A fast hash is right here and wrong for passwords: a 256-bit
 * random secret cannot be brute-forced, while a human password can.
 */
export function hashSecret(secret: string): string {
  return createHash('sha256').update(secret, 'utf8').digest('hex');
}

/** Constant-time comparison of a presented secret with a stored hash. */
export function secretMatches(secret: string, storedHash: string): boolean {
  const actual = Buffer.from(hashSecret(secret), 'hex');
  const expected = Buffer.from(storedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
