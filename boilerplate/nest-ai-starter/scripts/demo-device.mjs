#!/usr/bin/env node
// Lab helper: on a RUNNING app, sign up (or reuse) a demo user, create a fresh
// device, issue its credentials and activate it, then print shell exports.
//
//   eval "$(node scripts/demo-device.mjs)"
//   curl … -H "X-Access-Key-Id: $MCP_KEY_ID" -H "X-Secret-Key: $MCP_SECRET"
//   curl … -H "Authorization: $DEMO_BASIC"   # the whole header value, "Basic …"
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

async function call(method, path, body, auth = true) {
  const res = await fetch(base + path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(auth ? { authorization: basic } : {}),
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

const signup = await call('POST', '/api/v1/users', user, false);
if (signup.status !== 201 && signup.status !== 409) fail('sign-up', signup);

const device = await call('POST', '/api/v1/devices', {
  name: `lab device ${new Date().toISOString()}`,
});
if (device.status !== 201) fail('create device', device);
const creds = await call(
  'POST',
  `/api/v1/devices/${device.body.id}/credentials`,
);
if (creds.status !== 200) fail('issue credentials', creds);
const active = await call('POST', `/api/v1/devices/${device.body.id}/activate`);
if (active.status !== 200) fail('activate', active);

console.log(
  `# demo device ${device.body.id} (owner ${user.email}). The secret is shown once.`,
);
console.log(`export DEVICE_ID=${device.body.id}`);
console.log(`export MCP_KEY_ID=${creds.body.accessKeyId}`);
console.log(`export MCP_SECRET=${creds.body.secret}`);
console.log(`export DEMO_BASIC='${basic}'`);
