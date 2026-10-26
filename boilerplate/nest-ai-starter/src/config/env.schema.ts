import { z } from 'zod';

/**
 * Every environment variable the service reads, validated once at boot.
 * A missing or malformed variable stops the process with the variable NAME and
 * the reason, never its value, so this is safe to run against real secrets.
 *
 * To add a variable: add it here, add its NAME to `.env.example`, read it with
 * `ConfigService.get('NAME', { infer: true })`. Never read `process.env` directly.
 */
export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    /** Serve OpenAPI docs at /api/docs. Unset: on, except in production. */
    SWAGGER_ENABLED: z.enum(['true', 'false']).optional(),
    /**
     * ch08: Host names the MCP HTTP endpoint accepts (comma-separated). Unset →
     * 'localhost' (measured: localhost and 127.0.0.1 pass, the machine's hostname gets
     * 403; DNS-rebinding protection). Set it when deployed.
     */
    MCP_ALLOWED_HOSTS: z
      .string()
      .optional()
      .transform((v) =>
        v
          ? v
              .split(',')
              .map((h) => h.trim())
              .filter(Boolean)
          : ('localhost' as const),
      ),
    // A libSQL URL for an SQLite file, e.g. file:./data/app.db. Unset → in memory (dev/test only).
    DATABASE_URL: z
      .string()
      .regex(/^file:./, 'must be a file: URL, e.g. file:./data/app.db')
      .optional(),
  })
  .refine((env) => env.NODE_ENV !== 'production' || env.DATABASE_URL, {
    message: 'is required when NODE_ENV=production',
    path: ['DATABASE_URL'],
  })
  .transform(({ SWAGGER_ENABLED, ...env }) => ({
    ...env,
    SWAGGER_ENABLED:
      SWAGGER_ENABLED === undefined
        ? env.NODE_ENV !== 'production'
        : SWAGGER_ENABLED === 'true',
  }));

export type Env = z.output<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    // Names and messages only, built here rather than printing `result.error`.
    // Measured on zod 4.4.3 and 4.6.7: default messages do not include the input, but
    // that is zod's choice (`reportInput` turns it on), not a guarantee we own.
    // env.schema.spec.ts pins that the raw value never appears.
    const problems = result.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  return result.data;
}
