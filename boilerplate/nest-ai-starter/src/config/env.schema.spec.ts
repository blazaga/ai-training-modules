import { validateEnv } from './env.schema.js';

describe('validateEnv', () => {
  it('applies defaults', () => {
    expect(validateEnv({})).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      SWAGGER_ENABLED: true,
    });
  });

  it('turns docs off by default in production', () => {
    expect(validateEnv({ NODE_ENV: 'production' }).SWAGGER_ENABLED).toBe(false);
  });

  it('an explicit SWAGGER_ENABLED wins over the production default', () => {
    expect(
      validateEnv({ NODE_ENV: 'production', SWAGGER_ENABLED: 'true' })
        .SWAGGER_ENABLED,
    ).toBe(true);
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
