import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateClip } from '../js/analysis/simclip.js';
import { analyzeClip, agreement } from '../js/analysis/agreement.js';
import { blandAltmanSVG } from '../js/analysis/plots.js';
import { clipToJSON, clipFromJSON, summarize, CLIP_SCHEMA } from '../js/data/clip.js';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} expected ${b} ±${tol}, got ${a}`);

test('agreement statistics on known data', () => {
  const pairs = Array.from({ length: 200 }, (_, i) => {
    const truth = (i % 40) + 5;
    return [truth + 2 + Math.sin(i) * 1, truth];
  });
  const s = agreement(pairs);
  near(s.bias, 2, 0.1, 'bias');
  assert.ok(s.loa[0] < s.bias && s.loa[1] > s.bias);
  assert.ok(s.r > 0.99 && s.ccc < s.r, 'a constant bias lowers concordance but not correlation');
  assert.ok(s.icc > 0.9 && s.icc < 1);
});

let clip;
test('a simulated session produces a clip.v1 with frames, raw sensor stream and calibrations', async () => {
  clip = await simulateClip({ exercises: ['hip-hinge', 'side-bend'], cameraDelay: 0.08 });
  assert.equal(clip.schema, CLIP_SCHEMA);
  assert.ok(clip.frames.rows.length > 500);
  assert.equal(clip.lm.length, clip.frames.rows.length);
  assert.equal(clip.lm[0].length, 33 * 4);
  assert.deepEqual(clip.sensors.map((s) => s.role).sort(), ['lower', 'upper']);
  assert.ok(clip.sensors.every((s) => s.cal?.u0 && s.clock?.a != null));
  assert.ok(clip.sensorRaw.rows.length > 1000);
  assert.ok(clip.results.every((r) => r.reps === r.targetReps), 'the simulated person completed every exercise');
  const meta = summarize(clip);
  assert.deepEqual(meta.exercises, ['hip-hinge', 'side-bend']);
});

test('analysis recovers the camera-to-sensor delay and finds close agreement on clean data', () => {
  const res = analyzeClip(clip);
  assert.ok(res.ok, res.reason);
  // Sensor sample times carry the 25 ms minimum radio latency; camera stamps are 80 ms late.
  near(res.lag.lag, 0.025 - 0.08, 0.015, 'lag');
  assert.ok(res.smoothingDelay > 0.02 && res.smoothingDelay < 0.2, `the smoothing filter delays the camera by ${res.smoothingDelay} s`);
  const hinge = res.perExercise['hip-hinge'];
  assert.ok(hinge.reps.n >= 6, `rep pairs ${hinge.reps.n}`);
  near(hinge.frames.bias, 0, 2, 'hinge frame bias');
  assert.ok(hinge.frames.loa[1] - hinge.frames.loa[0] < 8, `limits of agreement ${hinge.frames.loa}`);
  assert.ok(hinge.frames.icc > 0.95, `ICC ${hinge.frames.icc}`);
  assert.ok(res.perExercise['side-bend'].frames.n > 100);
});

test('ignoring the delay makes agreement measurably worse (why time alignment matters)', () => {
  const aligned = analyzeClip(clip).perExercise['hip-hinge'].frames;
  const naive = analyzeClip(clip, { lagOverride: 0 }).perExercise['hip-hinge'].frames;
  assert.ok(naive.sd > aligned.sd * 1.3, `sd aligned ${aligned.sd} vs naive ${naive.sd}`);
});

test('clips survive the JSON download round trip and still analyse the same', () => {
  const back = clipFromJSON(JSON.parse(JSON.stringify(clipToJSON(clip))));
  const a = analyzeClip(clip).perExercise['hip-hinge'].frames;
  const b = analyzeClip(back).perExercise['hip-hinge'].frames;
  near(b.bias, a.bias, 0.05);
  near(b.sd, a.sd, 0.05);
  assert.throws(() => clipFromJSON({ schema: 'other' }));
});

test('Bland–Altman SVG renders with the bias and limit lines', () => {
  const ex = analyzeClip(clip).perExercise['hip-hinge'];
  const svg = blandAltmanSVG({ pairs: ex.pairs, repPairs: ex.repPairs, stats: ex.frames, theme: 'static' });
  assert.match(svg, /^<svg/);
  assert.match(svg, /bias/);
  assert.match(svg, /1\.96 SD/);
});
