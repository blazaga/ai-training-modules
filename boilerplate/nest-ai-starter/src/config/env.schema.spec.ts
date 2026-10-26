import { validateEnv } from './env.schema.js';

describe('validateEnv', () => {
  it('applies defaults', () => {
    expect(validateEnv({})).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      SWAGGER_ENABLED: true,
      MCP_ALLOWED_HOSTS: 'localhost',
    });
  });

  it('MCP_ALLOWED_HOSTS: a comma-separated list, trimmed', () => {
    expect(
      validateEnv({ MCP_ALLOWED_HOSTS: 'localhost, mcp.example.com ,' })
        .MCP_ALLOWED_HOSTS,
    ).toEqual(['localhost', 'mcp.example.com']);
  });

  it('turns docs off by default in production', () => {
    const prod = { NODE_ENV: 'production', DATABASE_URL: 'file:/data/app.db' };
    expect(validateEnv(prod).SWAGGER_ENABLED).toBe(false);
  });

  it('an explicit SWAGGER_ENABLED wins over the production default', () => {
    expect(
      validateEnv({
        NODE_ENV: 'production',
        DATABASE_URL: 'file:/data/app.db',
        SWAGGER_ENABLED: 'true',
      }).SWAGGER_ENABLED,
    ).toBe(true);
  });

  it('production refuses to start without DATABASE_URL', () => {
    expect(() => validateEnv({ NODE_ENV: 'production' })).toThrow(
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
