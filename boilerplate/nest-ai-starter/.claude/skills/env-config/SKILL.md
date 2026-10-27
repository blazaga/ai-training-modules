---
name: env-config
description: Add or change an environment variable / configuration value in this NestJS service. Use when code needs a new setting, secret, URL, port, feature flag or timeout. Keeps every variable validated at boot and never logs values.
---

# Add a configuration value

All configuration goes through **one** zod schema, `src/config/env.schema.ts`, which is
validated once at boot by `ConfigModule.forRoot({ validate: validateEnv })`.

## Steps

1. Add the variable to `envSchema`. Give it a type, its constraints and, if it is
   optional, a default. Query strings and env values arrive as text, so use `z.coerce`
   for numbers and `z.enum(['true','false'])` for booleans.
2. Add its **name** to `.env.example`, with a placeholder value or an empty value. Never a
   real one.
3. Read it with
   `this.config.get('NAME', { infer: true })`, where `config` is
   `ConfigService<Env, true>`. **Never read `process.env` directly**, because that skips
   validation.
4. Add a case to `src/config/env.schema.spec.ts`: the default, and one invalid value.
5. Run `npm run verify`.

## Never

- Log the config object, a connection string, or any value from it. Log names and
  booleans only (`docs enabled: true`). The reference service this starter learned from
  printed its whole config, including a database URL, at startup.
- Put a real value in `.env.example`, a test, a commit or a ticket.
- Catch a validation failure and continue with a fallback. If config is wrong, the
  process should not start.

## Secrets

Treat a variable as a secret if it is a password, token, key or URL with credentials.
Mark it in the schema with a `/** secret */` comment. Validate its shape (for example
`z.string().min(1)`) but never its content in a way that would echo it.
