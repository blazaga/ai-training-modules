#!/usr/bin/env node
// Fails while any AI-FILL marker or untouched nest-cli stub remains in src/ or test/.
// "The agent says it finished" is a claim; zero markers is the artefact.
// Prints a count per predicate either way, so a pass is a reading, not silence.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const checks = [
  { label: 'AI-FILL markers', re: /AI-FILL\(/ },
  { label: 'nest-cli stub bodies ("This action ...")', re: /This action (adds|returns|updates|removes)/ },
];

function walk(dir) {
  return readdirSync(dir).flatMap((e) => {
    const p = join(dir, e);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
  });
}

const files = ['src', 'test'].flatMap((d) => walk(join(root, d)));
if (files.length === 0) {
  console.error('check-ai-fill: no .ts files found under src/ or test/ - wrong directory?');
  process.exit(2);
}

let failed = false;
console.log(`check-ai-fill: scanned ${files.length} .ts files`);
for (const { label, re } of checks) {
  const hits = files.flatMap((f) =>
    readFileSync(f, 'utf8')
      .split('\n')
      .flatMap((line, i) => (re.test(line) ? [`${relative(root, f)}:${i + 1}: ${line.trim()}`] : [])),
  );
  console.log(`  ${label}: ${hits.length}`);
  for (const h of hits) console.log(`    ${h}`);
  if (hits.length) failed = true;
}
process.exit(failed ? 1 : 0);
