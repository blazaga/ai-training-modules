#!/usr/bin/env node
// Lab helper: on a RUNNING app, sign up (or reuse) a demo user, log in, provision a fresh
// device, then print shell exports.
//
//   eval "$(node scripts/demo-device.mjs)"
//   curl … -H "X-Device-Key: $DEVICE_KEY" -H "X-Device-Secret: $DEVICE_SECRET"   # MCP
//   curl … -H "Authorization: $AUTH"   # REST: the whole header value, "Bearer …"
//
// Base URL: argv[2], else APP_URL, else http://localhost:<PORT>, with PORT read from the
// environment or from .env (the file the app reads), else 3000. So an app moved to another
// port in .env is found without extra flags. The secret is printed ONCE, for your terminal
// only: never paste it into a ticket, chat or commit.
import { existsSync, readFileSync } from 'node:fs';

function portFromEnvFile() {
  if (!existsSync('.env')) return undefined;
  const line = readFileSync('.env', 'utf8')
    .split('\n')
    .find((l) => /^\s*PORT\s*=/.test(l));
  return line?.split('=')[1].trim().replace(/^["']|["']$/g, '') || undefined;
}
const port = process.env.PORT ?? portFromEnvFile() ?? '3000';
const base = (
  process.argv[2] ??
  process.env.APP_URL ??
  `http://localhost:${port}`
).replace(/\/$/, '');
const user = {
  email: 'demo@example.com',
  name: 'Demo',
  password: 'demo passphrase for labs',
};
const basic = `Basic ${Buffer.from(`${user.email}:${user.password}`).toString('base64')}`;

async function call(method, path, body, authorization) {
  const res = await fetch(base + path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(authorization ? { authorization } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : undefined };
}

function fail(step, res) {
  console.error(
    `demo-device: ${step} failed with HTTP ${res.status}: ${JSON.stringify(res.body)}`,
  );
  process.exit(1);
}

const signup = await call('POST', '/api/v1/users', user);
if (signup.status !== 201 && signup.status !== 409) fail('sign-up', signup);

const login = await call('POST', '/api/v1/auth/login', undefined, basic);
if (login.status !== 200) fail('log in', login);
const bearer = `Bearer ${login.body.accessToken}`;

const device = await call(
  'POST',
  '/api/v1/devices/provision',
  { name: `lab device ${new Date().toISOString()}` },
  bearer,
);
if (device.status !== 201) fail('provision device', device);

console.log(
  `# demo device ${device.body.id} (owner ${user.email}). The secret is shown once.`,
);
console.log(`export DEVICE_ID=${device.body.id}`);
console.log(`export DEVICE_KEY=${device.body.deviceKey}`);
console.log(`export DEVICE_SECRET=${device.body.secret}`);
console.log(`export AUTH='${bearer}'`);
