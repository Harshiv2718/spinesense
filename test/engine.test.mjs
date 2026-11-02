import test from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES, byId } from '../js/core/exercises.js';
import { ExerciseRun } from '../js/core/engine.js';
import { DiscomfortDetector } from '../js/core/discomfort.js';
import { SimPerson } from '../js/core/sim.js';
import { makeFrame } from '../js/core/geometry.js';
import { LandmarkSmoother } from '../js/core/filters.js';

const FPS = 30;

/** Drives an exercise with a simulated person, the same way the live app does. */
function run(spec, levelIdx, { painFrom = Infinity, maxSec = 180, sensitivity = 'medium' } = {}) {
  const level = spec.levels[levelIdx];
  const person = new SimPerson(spec.id, { kind: spec.kind, hold: level.hold ?? 3, painFrom, view: spec.view });
  const ex = new ExerciseRun(spec, levelIdx);
  const det = new DiscomfortDetector({ sensitivity });
  const smooth = new LandmarkSmoother();
  const smoothW = new LandmarkSmoother();
  const triggers = [];
  const cues = [];
  let state;
  for (let i = 0; i < maxSec * FPS; i++) {
    const t = i / FPS;
    const fr = person.frame(t);
    const f = makeFrame(smooth.apply(fr.lm, t), smoothW.apply(fr.world, t), fr.aspect, t);
    state = ex.update(f);
    det.pushFace(fr.face.score, t, fr.face.frontal);
    for (const ev of state.events) {
      det.onEvent(ev, state);
      if (ev.type === 'form') cues.push(ev.id);
    }
    det.onJitter(state.jitter, state.target);
    const d = det.tick(t);
    if (d.trigger) triggers.push({ t, trigger: d.trigger, top: d.top, rep: fr.rep });
    if (state.phase === 'complete') break;
  }
  return { ex, state, triggers, cues, summary: ex.summary() };
}

for (const spec of EXERCISES) {
  test(`${spec.id}: counts every rep of the Standard level with a healthy simulated person`, () => {
    const { state, summary, triggers, cues } = run(spec, 1);
    assert.equal(state.phase, 'complete', `did not complete (reps ${summary.reps}/${summary.targetReps}, msg: ${state.message})`);
    assert.equal(summary.reps, summary.targetReps);
    assert.equal(summary.aborts, 0);
    assert.deepEqual(cues, [], `unexpected form cues: ${cues.join(', ')}`);
    assert.equal(triggers.filter((x) => x.trigger === 'moderate').length, 0, 'false pain alarm on a pain-free run');
  });
}

test('alternating exercises split reps across both sides', () => {
  const { summary } = run(byId['side-bend'], 1);
  assert.equal(summary.bySide.left, 8);
  assert.equal(summary.bySide.right, 8);
  assert.ok(summary.asymmetry.pct < 10);
});

test('pain in a side-on exercise (no face visible) is caught from movement: range drop + guarding', () => {
  const { triggers } = run(byId['hip-hinge'], 1, { painFrom: 4, maxSec: 60 });
  const moderate = triggers.find((x) => x.trigger === 'moderate' || x.trigger === 'mild');
  assert.ok(moderate, 'no discomfort trigger');
  assert.ok(moderate.rep >= 4, `triggered too early (rep ${moderate.rep})`);
  assert.ok(moderate.top.some((s) => s === 'range' || s === 'guard'), `signals were ${moderate.top}`);
});

test('pain in a facing-camera exercise is caught from range drop, with facial strain adding weight', () => {
  const { triggers } = run(byId['side-bend'], 1, { painFrom: 3, maxSec: 60 });
  const first = triggers[0];
  assert.ok(first, 'no discomfort trigger');
  assert.equal(first.rep, 3);
  assert.ok(first.top.includes('face'));
});

test('regress() drops one level and keeps completed reps', () => {
  const ex = new ExerciseRun(byId['glute-bridge'], 2);
  ex.reps.push({ peak: 30, limb: null, issues: [] });
  assert.equal(ex.regress(), true);
  assert.equal(ex.levelIdx, 1);
  assert.equal(ex.reps.length, 1);
  ex.setLevel(0);
  assert.equal(ex.regress(), false);
});

test('out of frame: the message names the missing body part and how to fix it', async () => {
  const { framingMessage, L } = await import('../js/core/geometry.js');
  const showing = (...hidden) => ({ vis: (i) => (hidden.includes(i) ? 0.1 : 0.9) });
  const body = [L.lShoulder, L.rShoulder, L.lWrist, L.rWrist, L.lHip, L.rHip, L.lKnee, L.lAnkle];
  assert.match(framingMessage(showing(L.lAnkle), body), /can’t see your feet.*tilt the screen down/);
  assert.match(framingMessage(showing(L.lWrist), body), /can’t see your hands.*arms fit/);
  assert.match(framingMessage(showing(L.lShoulder), body), /can’t see your shoulders.*tilt the screen up/);
  assert.match(framingMessage(showing(L.lAnkle, L.lShoulder), body), /feet/, 'feet come first when several parts are out');
  assert.match(framingMessage(showing(), body), /whole body is in view/, 'falls back to the general message');
});
