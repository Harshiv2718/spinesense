import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { simulateClip } from '../js/analysis/simclip.js';
import { clipRows, simulatedSubject } from '../js/analysis/dataset.js';
import { FEATURE_NAMES, FEATURE_SCHEMA, FEATURE_EXERCISE, RepWindow, repFeatures } from '../js/core/features.js';
import { predictTrees } from '../js/ml/trees.js';
import { ModelBank } from '../js/ml/bank.js';
import { shipModel } from '../tools/ship-model.mjs';
import { checkModels } from '../tools/check-models.mjs';

const person = simulatedSubject(3);
let live = [];
const clip = await (async () => {
  // The same steps as the live session: finish the rep on its 'rep' event, then keep collecting.
  const win = new RepWindow();
  return simulateClip({
    exercises: [FEATURE_EXERCISE],
    subject: person,
    onFrame: (f, st) => {
      if (st.events.some((e) => e.type === 'rep')) live.push(win.take());
      if (st.phase === 'active') win.push(f);
    },
  });
})();
live = live.filter(Boolean);

test('training rows and the live session compute the same features for the same reps', () => {
  const { rows, skipped } = clipRows(clip);
  assert.equal(skipped, null);
  assert.equal(rows.length, live.length);
  rows.forEach((row, r) => {
    assert.equal(row.features.length, FEATURE_NAMES.length);
    row.features.forEach((v, i) => assert.ok(Math.abs(v - live[r][i]) < 0.05, `rep ${r} ${FEATURE_NAMES[i]}: ${v} vs ${live[r][i]}`));
  });
  assert.equal(rows[0].subject, person.id);
  assert.equal(rows[0].simulated, true);
  assert.equal(rows[0].schema, FEATURE_SCHEMA);
});

test('the label is the lumbar flexion the two sensors measured, not a guess', () => {
  const { rows } = clipRows(clip);
  for (const r of rows) {
    const lean = r.features[FEATURE_NAMES.indexOf('tiltRange')];
    assert.ok(r.label > 0 && r.label < lean, `lumbar ${r.label} should be a share of the ${lean}° lean`);
  }
  assert.ok(new Set(rows.map((r) => Math.round(r.label))).size > 3, 'labels vary from rep to rep');
});

test('clips that would teach the wrong thing are left out, with the reason', () => {
  assert.match(clipRows({ ...clip, participant: null }).skipped, /participant/);
  assert.match(clipRows({ ...clip, sensors: clip.sensors.filter((s) => s.role === 'upper') }).skipped, /two calibrated back sensors/);
});

test('features use each person\'s own scale: body size barely changes them', async () => {
  const features = async (scale) => {
    const win = [];
    await simulateClip({ exercises: [FEATURE_EXERCISE], subject: { ...person, scale, noise: 0 }, onFrame: (f, st) => { if (st.phase === 'active' && st.reps === 1) win.push(f); } });
    return repFeatures(win);
  };
  const [small, large] = [await features(0.9), await features(1.1)];
  for (const name of ['tiltRange', 'hipPerTilt', 'shiftAtPeak', 'torsoAtPeak']) {
    const i = FEATURE_NAMES.indexOf(name);
    assert.ok(Math.abs(small[i] - large[i]) < Math.max(0.03 * Math.abs(small[i]), 0.02), `${name}: ${small[i]} vs ${large[i]}`);
  }
});

test('too little movement is not a rep', () => {
  const still = { t: 0, aspect: 1, p: () => ({ x: 0, y: 0, z: 0 }), w: () => null, vis: () => 1, world: null };
  assert.equal(repFeatures([still]), null);
});

test('the browser tree code matches scikit-learn exactly', async () => {
  const { model, inputs, expected } = JSON.parse(await readFile('test/fixtures/trees-parity.json', 'utf8'));
  inputs.forEach((x, i) => assert.ok(Math.abs(predictTrees(model, x) - expected[i]) < 1e-9, `input ${i}`));
});

const treeModel = { schema: 'trees.v1', featureSchema: FEATURE_SCHEMA, init: 20, learningRate: 0.1, trees: [{ f: [0, -2, -2], t: [10, -2, -2], l: [1, -1, -1], r: [2, -1, -1], v: [0, -5, 5] }] };
const passing = { featureSchema: FEATURE_SCHEMA, subjects: 16, reps: 400, tiers: ['A'], simulated: false, gate: { passed: true, reasons: [] }, methods: { model: { mae: 3, ci95: [2.5, 3.5] } } };

async function artifact(dir, report) {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'report.json'), JSON.stringify(report));
  await writeFile(join(dir, 'model.json'), JSON.stringify(treeModel));
  await writeFile(join(dir, 'MODEL_CARD.md'), '# card');
}

async function workspace(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'ss-ml-'));
  const models = join(dir, 'models');
  await mkdir(models);
  await writeFile(join(models, 'manifest.json'), JSON.stringify({ schema: 'models.v1', models: [] }));
  try {
    await fn(dir, models);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const fetcherFor = (models) => async (url) => {
  try {
    const text = await readFile(join(models, url.replace(/^models\//, '')), 'utf8');
    return { ok: true, status: 200, text: async () => text };
  } catch {
    return { ok: false, status: 404, text: async () => '' };
  }
};

test('ship gate: simulated, failed or weak models can never reach models/', async () => {
  await workspace(async (dir, models) => {
    const failed = join(dir, 'failed');
    await artifact(failed, { ...passing, simulated: true, gate: { passed: false, reasons: ['trained on simulated data, which says nothing about real people'] } });
    await assert.rejects(shipModel(failed, { models, name: 'x' }), /simulated data/);
    const lying = join(dir, 'lying');
    await artifact(lying, { ...passing, simulated: true });
    await assert.rejects(shipModel(lying, { models, name: 'x' }), /simulated data/);
    assert.deepEqual(JSON.parse(await readFile(join(models, 'manifest.json'), 'utf8')).models, []);
  });
});

test('a passing model ships to shadow mode, loads with its hash checked, and rolls back', async () => {
  await workspace(async (dir, models) => {
    const first = join(dir, 'one');
    await artifact(first, passing);
    const { file } = await shipModel(first, { models, name: 'hinge' });
    assert.equal((await checkModels(models)).ok, true);

    const bank = new ModelBank({ fetcher: fetcherFor(models) });
    await bank.load();
    assert.equal(bank.off, null);
    const result = bank.observe([5], { sensorLumbar: 20 });
    assert.equal(result, undefined, 'shadow mode hands nothing back to the session');
    const stats = bank.stats();
    assert.equal(stats.reps, 1);
    assert.equal(stats.meanDiffDeg, 0.5);

    treeModel.init = 21;
    const second = join(dir, 'two');
    await artifact(second, passing);
    await shipModel(second, { models, name: 'hinge' });
    treeModel.init = 20;
    const manifest = JSON.parse(await readFile(join(models, 'manifest.json'), 'utf8'));
    assert.deepEqual(manifest.models.map((m) => m.status), ['off', 'shadow']);
    assert.equal(manifest.models[1].previous, manifest.models[0].id);
    assert.equal(manifest.models[0].file, file, 'the old file stays for rollback');
    assert.equal((await checkModels(models)).ok, true);
  });
});

test('any model problem just turns it off for the session', async () => {
  const stopped = async (edit) => {
    let reason;
    await workspace(async (dir, models) => {
      await artifact(join(dir, 'm'), passing);
      await shipModel(join(dir, 'm'), { models, name: 'hinge' });
      await edit(models);
      const bank = new ModelBank({ fetcher: fetcherFor(models) });
      await bank.load();
      bank.observe([5]);
      assert.equal(bank.stats().reps, 0);
      reason = bank.off;
    });
    return reason;
  };
  const manifestEdit = (fn) => async (models) => {
    const p = join(models, 'manifest.json');
    const m = JSON.parse(await readFile(p, 'utf8'));
    fn(m.models[0]);
    await writeFile(p, JSON.stringify(m));
  };
  assert.match(await stopped(manifestEdit((m) => { m.sha256 = 'bad'; })), /hash/);
  assert.match(await stopped(manifestEdit((m) => { m.featureSchema = 'old.v0'; })), /old\.v0/);
  assert.match(await stopped(manifestEdit((m) => { m.status = 'off'; })), /no model/);
  assert.match(await stopped(async (models) => rm(join(models, 'manifest.json'))), /HTTP 404/);
});

test('a slow or broken model switches itself off mid-session', async () => {
  const text = JSON.stringify({ ...treeModel, init: NaN });
  const sha256 = createHash('sha256').update(text).digest('hex');
  const files = { 'manifest.json': JSON.stringify({ models: [{ id: 'm', file: 'm.json', sha256, featureSchema: FEATURE_SCHEMA, status: 'shadow' }] }), 'm.json': text };
  const bank = new ModelBank({ fetcher: async (url) => ({ ok: true, status: 200, text: async () => files[url.replace('models/', '')] }) });
  await bank.load();
  bank.model = { ...treeModel, init: NaN };
  bank.observe([5]);
  assert.equal(bank.model, null);
  assert.equal(bank.off, 'invalid output');
});

test('the licence gate refuses simulated models and stale feature schemas', async () => {
  await workspace(async (dir, models) => {
    await artifact(join(dir, 'm'), passing);
    await shipModel(join(dir, 'm'), { models, name: 'hinge' });
    const p = join(models, 'manifest.json');
    const good = JSON.parse(await readFile(p, 'utf8'));
    const withEntry = (patch) => writeFile(p, JSON.stringify({ ...good, models: [{ ...good.models[0], ...patch }] }));
    await withEntry({ simulated: true });
    assert.match((await checkModels(models)).problems.join(), /simulated/);
    await withEntry({ featureSchema: 'old.v0' });
    assert.match((await checkModels(models)).problems.join(), /feature schema/);
    await withEntry({ status: 'live' });
    assert.match((await checkModels(models)).problems.join(), /status/);
  });
});
