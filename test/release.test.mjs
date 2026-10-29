import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSite } from '../tools/build-site.mjs';
import { checkModels } from '../tools/check-models.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

async function jsFiles(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await jsFiles(p)));
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}

/** Relative static imports of a module, resolved to absolute paths. */
async function importsOf(file) {
  const src = await readFile(file, 'utf8');
  const specs = [...src.matchAll(/^\s*(?:import|export)\s[^'"]*?from\s+['"](\.{1,2}\/[^'"]+)['"]/gm)].map((m) => m[1]);
  return specs.map((s) => resolve(dirname(file), s));
}

test('the public site contains the app and none of the private folders', async () => {
  const out = await mkdtemp(join(tmpdir(), 'spinesense-site-'));
  try {
    const { files } = await buildSite(out);
    for (const needed of ['index.html', 'phone.html', 'js/app.js', 'js/phone.js', 'css/app.css', 'docs/hardware.md', '.nojekyll']) assert.ok(files.includes(needed), `missing ${needed}`);
    for (const f of files) assert.ok(!/^(research_notes|reports|active|\.claude|test|tools|firmware)\//.test(f), `private file published: ${f}`);
  } finally {
    await rm(out, { recursive: true, force: true });
  }
});

test('build refuses to write into the project or a source folder', async () => {
  await assert.rejects(buildSite(ROOT));
  await assert.rejects(buildSite(join(ROOT, 'js', 'out')));
});

test('every relative import in the app resolves to a real file', async () => {
  const missing = [];
  for (const f of await jsFiles(join(ROOT, 'js'))) {
    for (const target of await importsOf(f)) {
      if (!(await readFile(target).catch(() => null))) missing.push(`${relative(ROOT, f)} -> ${relative(ROOT, target)}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('safety boundary: safety code never depends on learned models or the LLM layer', async () => {
  // docs/architecture.md §10: models and explanations may advise, never decide.
  const safetyRoots = ['js/program.js', 'js/views/safety.js'].map((p) => join(ROOT, p));
  const seen = new Set();
  const stack = [...safetyRoots];
  while (stack.length) {
    const f = stack.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    stack.push(...(await importsOf(f)));
  }
  const forbidden = [...seen].map((f) => relative(ROOT, f).replace(/\\/g, '/')).filter((p) => p.startsWith('js/ml/') || p === 'js/coach/explain.js');
  assert.deepEqual(forbidden, []);
});

test('model licence gate: unlisted files, tier C and tier B without permission all fail', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'spinesense-models-'));
  try {
    assert.equal((await checkModels(join(dir, 'nope'))).ok, true, 'no models folder is fine');
    await mkdir(dir, { recursive: true });
    const bytes = Buffer.from('fake onnx');
    await writeFile(join(dir, 'quality.onnx'), bytes);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const write = (models) => writeFile(join(dir, 'manifest.json'), JSON.stringify({ schema: 1, models }));

    await write([{ id: 'q', file: 'quality.onnx', sha256, licenceTier: 'A' }]);
    assert.equal((await checkModels(dir)).ok, true);

    await write([{ id: 'q', file: 'quality.onnx', sha256, licenceTier: 'B' }]);
    assert.match((await checkModels(dir)).problems.join(), /permission/);

    await write([{ id: 'q', file: 'quality.onnx', sha256, licenceTier: 'C', permission: 'x' }]);
    assert.match((await checkModels(dir)).problems.join(), /validation-only/);

    await write([]);
    assert.match((await checkModels(dir)).problems.join(), /not in manifest/);

    await write([{ id: 'q', file: 'quality.onnx', sha256: 'bad', licenceTier: 'A' }]);
    assert.match((await checkModels(dir)).problems.join(), /sha256/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
