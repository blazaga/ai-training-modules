import { parseBasicAuth } from './basic-credentials.js';

const basic = (raw: string) => `Basic ${Buffer.from(raw).toString('base64')}`;

describe('parseBasicAuth', () => {
  it('parses email and password', () => {
    expect(parseBasicAuth(basic('ada@example.com:s3cret'))).toEqual({
      email: 'ada@example.com',
      password: 's3cret',
    });
  });

  it('splits at the FIRST colon: passwords may contain colons', () => {
    expect(parseBasicAuth(basic('ada@example.com:a:b:c'))?.password).toBe(
      'a:b:c',
    );
  });

  it('accepts the scheme in any case', () => {
    expect(parseBasicAuth(basic('a@b.c:x').replace('Basic', 'bAsIc'))).toEqual({
      email: 'a@b.c',
      password: 'x',
    });
  });

  it.each([
    ['missing header', undefined],
    ['other scheme', 'Bearer abc'],
    ['no credentials', 'Basic'],
    ['extra parts', `${basic('a@b.c:x')} extra`],
    ['no colon', basic('just-a-user')],
    ['empty email', basic(':password')],
  ])('returns undefined for %s', (_label, header) => {
    expect(parseBasicAuth(header)).toBeUndefined();
  });
});
