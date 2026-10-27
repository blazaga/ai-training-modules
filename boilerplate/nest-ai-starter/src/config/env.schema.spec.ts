import { validateEnv } from './env.schema.js';

describe('validateEnv', () => {
  it('applies defaults: development uses the seeded file', () => {
    expect(validateEnv({})).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      SWAGGER_ENABLED: true,
      DATABASE_URL: 'file:./data/app.db',
    });
  });

  it('test keeps an unset DATABASE_URL unset (an in-memory database)', () => {
    expect(validateEnv({ NODE_ENV: 'test' }).DATABASE_URL).toBeUndefined();
  });

  /** The minimum a production start needs. */
  const prod = {
    NODE_ENV: 'production',
    DATABASE_URL: 'file:/data/app.db',
  };

  it('turns docs off by default in production', () => {
    expect(validateEnv(prod).SWAGGER_ENABLED).toBe(false);
  });

  it('an explicit SWAGGER_ENABLED wins over the production default', () => {
    expect(
      validateEnv({ ...prod, SWAGGER_ENABLED: 'true' }).SWAGGER_ENABLED,
    ).toBe(true);
  });

  it('production refuses to start without DATABASE_URL', () => {
    expect(() => validateEnv({ ...prod, DATABASE_URL: undefined })).toThrow(
      /DATABASE_URL: is required when NODE_ENV=production/,
    );
  });

  it('a malformed DATABASE_URL is rejected without echoing it', () => {
    // Not a file: URL (here a network URL with a password in it).
    const url = 'postgres://user:hunter2-not-real@host/db';
    expect(() => validateEnv({ DATABASE_URL: url })).toThrow(/DATABASE_URL/);
    expect(() => validateEnv({ DATABASE_URL: url })).not.toThrow(/hunter2/);
  });

  it('names the bad variable without echoing its value', () => {
    const secretLike = 'not-a-port-but-pretend-this-is-sensitive';
    let message = '';
    try {
      validateEnv({ PORT: secretLike });
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toContain('PORT');
    expect(message).not.toContain(secretLike);
  });
});
