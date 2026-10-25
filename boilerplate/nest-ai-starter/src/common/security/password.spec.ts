import { hashPassword, verifyPassword } from './password.js';

describe('password hashing (scrypt)', () => {
  it('verifies the right password and rejects a wrong one', async () => {
    const stored = await hashPassword('correct horse battery');
    await expect(verifyPassword('correct horse battery', stored)).resolves.toBe(
      true,
    );
    await expect(verifyPassword('correct horse batterY', stored)).resolves.toBe(
      false,
    );
  });

  it('never stores the password, and salts every hash', async () => {
    const a = await hashPassword('same-password');
    const b = await hashPassword('same-password');
    expect(a).not.toContain('same-password');
    expect(a).not.toEqual(b);
    expect(a).toMatch(/^scrypt\$16384\$8\$1\$[\w-]+\$[\w-]+$/);
  });

  it('treats a malformed stored value as a failed verification', async () => {
    await expect(verifyPassword('x', 'not-a-hash')).resolves.toBe(false);
    await expect(verifyPassword('x', 'scrypt$1$1$1$$')).resolves.toBe(false);
  });
});
