import {
  generateAccessKeyId,
  generateSecret,
  hashSecret,
  secretMatches,
} from './device-credentials.js';

describe('device credentials', () => {
  it('access key ids are AKID + 16 base32 chars, and unique', () => {
    const ids = new Set(Array.from({ length: 200 }, generateAccessKeyId));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(id).toMatch(/^AKID[A-Z2-7]{16}$/);
  });

  it('secrets are dsk_ + 43 base64url chars (256 bits), and unique', () => {
    const secret = generateSecret();
    expect(secret).toMatch(/^dsk_[A-Za-z0-9_-]{43}$/);
    expect(generateSecret()).not.toBe(secret);
  });

  it('stores only a hash, and the hash verifies the secret', () => {
    const secret = generateSecret();
    const stored = hashSecret(secret);
    expect(stored).toMatch(/^[0-9a-f]{64}$/);
    expect(stored).not.toContain(secret.slice(4));
    expect(secretMatches(secret, stored)).toBe(true);
    expect(secretMatches(generateSecret(), stored)).toBe(false);
  });

  it('a malformed stored hash never matches and never throws', () => {
    expect(secretMatches(generateSecret(), 'not-hex')).toBe(false);
    expect(secretMatches(generateSecret(), '')).toBe(false);
  });
});
