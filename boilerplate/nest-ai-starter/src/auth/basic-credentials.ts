/**
 * Parse `Authorization: Basic base64(email:password)` (RFC 7617).
 * Returns undefined for anything malformed. Splits at the FIRST colon only,
 * because a password may itself contain colons; an email cannot.
 */
export function parseBasicAuth(
  header: string | undefined,
): { email: string; password: string } | undefined {
  if (!header) return undefined;
  const [scheme, encoded, ...extra] = header.trim().split(/\s+/);
  if (scheme?.toLowerCase() !== 'basic' || !encoded || extra.length > 0) {
    return undefined;
  }
  const decoded = Buffer.from(encoded, 'base64').toString('utf8');
  const colon = decoded.indexOf(':');
  if (colon <= 0) return undefined;
  return {
    email: decoded.slice(0, colon),
    password: decoded.slice(colon + 1),
  };
}

/** The 401 every auth failure returns: one body, so failures cannot be told apart. */
export const UNAUTHORIZED_BODY = {
  statusCode: 401,
  error: 'Unauthorized',
  message: 'Invalid credentials',
} as const;

/** Tells clients (and browsers) which scheme to use. */
export const WWW_AUTHENTICATE =
  'Basic realm="nest-ai-starter", charset="UTF-8"';
