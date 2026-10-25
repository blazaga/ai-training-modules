#!/usr/bin/env node
// Step 2 of 3 in adding a resource (see .claude/skills/nest-resource-scaffold):
//   1. nest g resource <plural>          structure + AppModule wiring (nest-cli)
//   2. node scripts/apply-resource-template.mjs --name <singular> --plural <plural>
//                                        house conventions (this script, deterministic)
//   3. an agent fills every AI-FILL marker, then `pnpm verify` must pass
//
// Deterministic on purpose: the same input always yields the same files, so the
// conventions never drift between resources or between agents. Judgement-heavy
// parts are left as AI-FILL markers for step 3.
//
// Names are given explicitly. Plurals are not guessed ("person" -> "people").
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const templateRoot = join(root, 'templates', 'resource');

function fail(msg) {
  console.error(`apply-resource-template: ${msg}`);
  process.exit(1);
}

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1]?.startsWith('--') ? true : (all[i + 1] ?? true)]);
    return acc;
  }, []),
);
const name = args.name;
const plural = args.plural;
const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
if (typeof name !== 'string' || typeof plural !== 'string') {
  fail('usage: --name <singular-kebab> --plural <plural-kebab>   e.g. --name line-item --plural line-items');
}
if (!KEBAB.test(name) || !KEBAB.test(plural)) fail('names must be lower kebab-case, e.g. line-item');
if (name === plural) fail('--name and --plural must differ');

const pascal = (s) => s.split('-').map((p) => p[0].toUpperCase() + p.slice(1)).join('');
const tokens = {
  __Names__: pascal(plural),
  __Name__: pascal(name),
  __NAMES__: plural.toUpperCase().replace(/-/g, '_'),
  __names__: plural,
  __name__: name,
};
const render = (s) => Object.entries(tokens).reduce((out, [k, v]) => out.split(k).join(v), s);

// Preconditions: step 1 ran, and step 2 has not already run.
const resourceDir = join(root, 'src', plural);
const generatedModule = join(resourceDir, `${plural}.module.ts`);
if (!existsSync(generatedModule)) {
  fail(`${relative(root, generatedModule)} not found. Run step 1 first: nest g resource ${plural}`);
}
const schemaFile = join(resourceDir, `${name}.schema.ts`);
if (existsSync(schemaFile) && args.force !== true) {
  fail(`${relative(root, schemaFile)} exists: templates were already applied. Re-run with --force to overwrite (this discards AI-FILL work).`);
}

function walk(dir) {
  return readdirSync(dir).flatMap((e) => {
    const p = join(dir, e);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const written = [];
let markers = 0;
for (const tpl of walk(templateRoot).filter((p) => p.endsWith('.tpl'))) {
  const target = join(root, render(relative(templateRoot, tpl)).replace(/\.tpl$/, ''));
  const body = render(readFileSync(tpl, 'utf8'));
  if (/__[A-Za-z]+__/.test(body)) fail(`unrendered placeholder left in ${relative(root, target)}`);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, body);
  markers += (body.match(/AI-FILL\(/g) ?? []).length;
  written.push(relative(root, target));
}

// Format what we wrote, so a long or short resource name never fails lint.
const prettier = join(root, 'node_modules', '.bin', 'prettier');
if (!existsSync(prettier)) fail('node_modules/.bin/prettier missing: run pnpm install first');
execFileSync(prettier, ['--write', ...written.map((f) => join(root, f))], { stdio: 'ignore' });

// nest g output that the template set replaces: controller spec (covered by e2e).
const removed = [];
for (const stale of [join(resourceDir, `${plural}.controller.spec.ts`)]) {
  if (existsSync(stale)) {
    rmSync(stale);
    removed.push(relative(root, stale));
  }
}

// When @nestjs/swagger is NOT installed, nest-cli 12's `nest g resource` adds
// "@nestjs/mapped-types": "*" to package.json for its PartialType DTO (with swagger
// installed it imports PartialType from swagger instead and adds nothing; both
// measured). The templates use zod, so after templating nothing imports it.
// Left in place it is an unpinned, uninstalled dependency that puts package.json
// out of sync with the lockfile and fails every frozen install (CI, Docker).
const pkgPath = join(root, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const MAPPED = '@nestjs/mapped-types';
const importsMapped = walk(join(root, 'src')).some((f) =>
  f.endsWith('.ts') && readFileSync(f, 'utf8').includes(`'${MAPPED}'`),
);
let droppedDep = false;
if (pkg.dependencies?.[MAPPED] && !importsMapped) {
  delete pkg.dependencies[MAPPED];
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  droppedDep = true;
}

console.log(`apply-resource-template: ${tokens.__Names__} (${name} / ${plural})`);
for (const f of written) console.log(`  wrote   ${f}`);
for (const f of removed) console.log(`  removed ${f}`);
if (droppedDep) console.log(`  package.json: removed unused "${MAPPED}" added by nest g`);
console.log(`files written: ${written.length}; AI-FILL markers to complete: ${markers}`);
console.log('next: fill every AI-FILL marker, then run `pnpm verify`');
