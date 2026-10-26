import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeSample, decodeSample, parseInfo, command, CMD, PACKET_BYTES } from '../js/sensors/protocol.js';
import { AxisCalibration } from '../js/sensors/posture.js';
import { SensorHub } from '../js/sensors/hub.js';
import { SimSensor, simOrientation } from '../js/sensors/sim.js';
import { qconj, qrotate } from '../js/sensors/quat.js';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} expected ${b} ±${tol}, got ${a}`);

/** A simulated sample for a segment at the given angles (optionally with a different quaternion convention). */
function sample(flex, side = 0, { twist = 23, conj = false, rx = 0 } = {}) {
  const q = simOrientation(flex, side, twist);
  const a = qrotate(qconj(q), [0, 0, 1]);
  return decodeSample(encodeSample({ q: conj ? qconj(q) : q, a, t: rx * 1000 }));
}

function calibrate(opts = {}) {
  const cal = new AxisCalibration();
  cal.setNeutral(Array.from({ length: 20 }, () => sample(0, 0, opts)));
  cal.setFlexion(sample(45, 0, opts));
  cal.setSide(sample(0, 20, opts));
  return cal;
}

test('packets are 20 bytes and survive an encode/decode round trip', () => {
  const q = simOrientation(30, -10, 5);
  const buf = encodeSample({ role: 'lower', gyroOk: true, still: true, seq: 258, t: 123456789, q, a: [0.01, -0.5, 0.86] });
  assert.equal(buf.byteLength, PACKET_BYTES);
  const s = decodeSample(new DataView(buf));
  assert.equal(s.role, 'lower');
  assert.equal(s.version, 1);
  assert.equal(s.seq, 2);
  assert.equal(s.t, 123456789);
  assert.ok(s.gyroOk && s.still);
  s.q.forEach((v, i) => near(v, q[i], 1e-4));
  near(s.a[1], -0.5, 1e-3);
  assert.deepEqual(parseInfo('fw=1.0.0;board=m5stickc-plus2;role=1;rate=50'), { fw: '1.0.0', board: 'm5stickc-plus2', role: 'upper', rate: 50 });
  assert.deepEqual([...command(CMD.setRole, 2)], [3, 2]);
});

test('after calibration, a crookedly strapped sensor still reads true flexion and side bend', () => {
  const cal = calibrate();
  near(cal.angles(sample(30)).flex, 30, 0.5, 'flexion');
  near(cal.angles(sample(-15)).flex, -15, 0.5, 'extension');
  near(cal.angles(sample(0, 12)).side, 12, 0.5, 'right side bend');
  near(cal.angles(sample(0, -12)).side, -12, 0.5, 'left side bend');
  near(cal.angles(sample(30)).side, 0, 0.5, 'no side bend during pure flexion');
});

test('the quaternion convention is detected from the accelerometer', () => {
  const cal = calibrate({ conj: true });
  assert.notEqual(cal.convention, null);
  near(cal.angles(sample(35, 0, { conj: true })).flex, 35, 0.5);
});

test('hub: two sensors give lumbar angle = upper minus lower (dual-inclinometer method)', async () => {
  let t = 0;
  const pose = { upper: { flex: 0 }, lower: { flex: 0 } };
  const hub = new SensorHub({ clock: () => t });
  const up = new SimSensor({ role: 'upper', source: (r) => pose[r], interval: false, twist: 9 });
  const lo = new SimSensor({ role: 'lower', source: (r) => pose[r], interval: false, twist: -14 });
  await hub.add(up);
  await hub.add(lo);
  const run = (sec, fn) => {
    for (let i = 0; i < sec * 50; i++) {
      t += 0.02;
      fn?.(t);
      up.tick(t);
      lo.tick(t);
    }
  };
  const cal = hub.calibrate();
  run(3); // stand still
  assert.equal(cal.step, 'flex');
  run(4, (tt) => { const k = Math.sin(Math.min(1, (tt - 3) / 4) * Math.PI); pose.upper.flex = 60 * k; pose.lower.flex = 35 * k; }); // bend and return
  assert.equal(cal.step, 'side', `stuck on ${cal.step}`);
  run(4, (tt) => { const k = Math.sin(Math.min(1, (tt - 7) / 4) * Math.PI); pose.upper.side = 20 * k; pose.lower.side = 5 * k; pose.upper.flex = 0; pose.lower.flex = 0; });
  assert.equal(cal.step, 'done');
  assert.ok(hub.calibrated);

  pose.upper = { flex: 50, side: 0 };
  pose.lower = { flex: 30, side: 0 };
  run(0.2);
  const s = hub.snapshot(t);
  assert.equal(s.mode, 'dual');
  near(s.trunk.flex, 50, 1, 'trunk');
  near(s.pelvis.flex, 30, 1, 'pelvis');
  near(s.lumbar.flex, 20, 1.5, 'lumbar');

  assert.equal(hub.snapshot(t + 1).ok, false, 'stale samples are not trusted');
});

// ---------- sensors inside an exercise ----------

import { byId } from '../js/core/exercises.js';
import { ExerciseRun } from '../js/core/engine.js';
import { SimPerson } from '../js/core/sim.js';
import { makeFrame } from '../js/core/geometry.js';
import { simCalibration, simSegmentAngles } from '../js/sensors/sim.js';

async function hingeWithSensors(faults) {
  const spec = byId['hip-hinge'];
  const person = new SimPerson('hip-hinge', { kind: 'reps', view: 'side' });
  let t = 0;
  let pose = null;
  const hub = new SensorHub({ clock: () => t });
  const source = (role) => (pose ? simSegmentAngles(pose, 'side', faults)[role] : { flex: 0 });
  const sensors = [new SimSensor({ role: 'upper', source, interval: false, twist: 12 }), new SimSensor({ role: 'lower', source, interval: false, twist: -20 })];
  for (const s of sensors) {
    const d = await hub.add(s);
    d.cal = simCalibration(s.twist);
  }
  const ex = new ExerciseRun(spec, 1);
  const cues = [];
  for (let i = 0; i < 60 * 30 && ex.phase !== 'complete'; i++) {
    t = i / 30;
    pose = person.frame(t);
    sensors.forEach((s) => s.tick(t));
    const f = makeFrame(pose.lm, pose.world, pose.aspect, t);
    f.sensors = hub.snapshot(t);
    for (const ev of ex.update(f).events) if (ev.type === 'form') cues.push(ev.id);
  }
  return { ex, cues, summary: ex.summary() };
}

test('hip hinge with two back sensors: a good hinge gets no cue and records lumbar range', async () => {
  const { ex, cues, summary } = await hingeWithSensors({});
  assert.equal(ex.phase, 'complete');
  assert.deepEqual(cues, []);
  assert.equal(summary.sensor.mode, 'dual');
  near(summary.sensor.trunkFlexMax, 60, 3, 'trunk flexion from the sensor');
  near(summary.sensor.lumbarFlexMax, 18, 3, 'lumbar share of a hip-dominant hinge');
});

test('hip hinge with two back sensors: a rounding lower back triggers "bend from your hips"', async () => {
  const { cues, summary } = await hingeWithSensors({ round: true });
  assert.ok(cues.includes('lumbar-round'), `cues were ${cues}`);
  near(summary.sensor.lumbarFlexMax, 42, 3);
});
