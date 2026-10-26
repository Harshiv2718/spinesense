import test from 'node:test';
import assert from 'node:assert/strict';
import { DiscomfortDetector, grimaceScore } from '../js/core/discomfort.js';

function calibrated() {
  const d = new DiscomfortDetector();
  d.calibrateFace(Array.from({ length: 40 }, (_, i) => 0.3 + (i % 5) * 0.01));
  return d;
}

test('a strained face alone never triggers anything', () => {
  const d = calibrated();
  let trigger = null;
  for (let i = 0; i < 300; i++) {
    const t = i / 30;
    d.pushFace(1.5, t, true);
    trigger ??= d.tick(t).trigger;
  }
  assert.equal(trigger, null);
});

test('a strained face adds weight once a movement signal agrees', () => {
  const d = calibrated();
  for (let i = 0; i < 60; i++) d.pushFace(1.5, i / 30, true);
  const alone = d.tick(2).score;
  d.bump('guard', 0.5);
  const together = d.tick(2.01).score;
  assert.ok(together > alone + 0.5 * 0.7 * 0.8, `face should add once guarding is present (${alone} -> ${together})`);
});

test('ordinary blinks do not count as eye closure; sustained closure does', () => {
  const d = calibrated();
  const run = (closedFor) => {
    const det = calibrated();
    det.bump('guard', 0.4);
    for (let i = 0; i < 60; i++) {
      const t = i / 30;
      det.pushFace(0.3, t, true, t < closedFor ? 0.9 : 0.1);
    }
    return det.face.z;
  };
  assert.ok(run(0.15) < 1, 'a 150 ms blink should not raise the face score');
  assert.ok(run(1.5) > 2, 'eyes closed for 1.5 s should');
  assert.equal(grimaceScore([{ categoryName: 'eyeBlinkLeft', score: 1 }, { categoryName: 'eyeBlinkRight', score: 1 }]).score, 0);
  void d;
});

test('the effort face from the first reps raises the baseline, so effort is not mistaken for pain', () => {
  const d = calibrated();
  d.resetExercise();
  for (let i = 0; i < 30; i++) d.pushFace(0.9, i / 30, true); // effortful but comfortable reps
  d.onEvent({ type: 'rep', rep: { peak: 30, duration: 3 } });
  d.onEvent({ type: 'rep', rep: { peak: 30, duration: 3 } });
  assert.ok(d.face.mu >= 0.85, `baseline should move up to the effort face (got ${d.face.mu})`);
  d.resetExercise();
  assert.ok(d.face.mu < 0.4, 'the next exercise starts again from the relaxed calibration');
});
