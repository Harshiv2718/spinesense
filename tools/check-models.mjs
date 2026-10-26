// Licence gate for shipped models (docs/architecture.md §4).
// Publishing to GitHub Pages counts as shipping, so every file in models/ must be listed in
// models/manifest.json, and any model not trained purely on tier-A (ship-safe) data must record
// written permission.
//
//   node tools/check-models.mjs        exits 1 on any problem

import { readFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const TIERS = ['A', 'B', 'C'];

export async function checkModels(dir = join(ROOT, 'models')) {
  if (!(await stat(dir).catch(() => null))) return { ok: true, problems: [], note: 'no models/ folder yet' };
  const problems = [];
  let manifest;
  try {
    manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8'));
  } catch (e) {
    return { ok: false, problems: [`models/manifest.json missing or invalid: ${e.message}`] };
  }
  const listed = new Map((manifest.models ?? []).map((m) => [m.file, m]));
  const files = (await readdir(dir)).filter((f) => !/^(manifest\.json|MODEL_CARD\.md|README\.md)$/i.test(f) && !f.startsWith('.'));
  for (const f of files) {
    const st = await stat(join(dir, f));
    if (st.isDirectory()) continue; // per-model folders hold model cards
    if (!listed.has(f)) problems.push(`${f} is not in manifest.json`);
  }
  for (const m of manifest.models ?? []) {
    const where = `model ${m.id ?? m.file}`;
    if (!TIERS.includes(m.licenceTier)) problems.push(`${where}: licenceTier must be A, B or C`);
    if (m.licenceTier === 'C') problems.push(`${where}: tier C data is validation-only and can never ship`);
    if (m.licenceTier === 'B' && !m.permission) problems.push(`${where}: tier B needs written permission recorded in "permission"`);
    if (!files.includes(m.file)) problems.push(`${where}: file ${m.file} not found`);
    else if (m.sha256) {
      const hash = createHash('sha256').update(await readFile(join(dir, m.file))).digest('hex');
      if (hash !== m.sha256) problems.push(`${where}: sha256 mismatch`);
    }
  }
  return { ok: problems.length === 0, problems };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { ok, problems, note } = await checkModels(process.argv[2] ? resolve(process.argv[2]) : undefined);
  if (note) console.log(`check-models: ${note}`);
  for (const p of problems) console.error(`check-models: ${p}`);
  if (!ok) process.exit(1);
  console.log('check-models: OK');
}
