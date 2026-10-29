import test from 'node:test';
import assert from 'node:assert/strict';
import { quatFromDeviceOrientation, qrotate, qconj, qmul, qfromAxisAngle, angle3, rad } from '../js/sensors/quat.js';
import { PhoneRecorder, PHONE_SCHEMA, phoneSnapshot, unsentRecording } from '../js/sensors/phone.js';
import { mergePhone, removePhone, parsePhoneRecording } from '../js/analysis/phonemerge.js';
import { simulateClip } from '../js/analysis/simclip.js';
import { analyzeClip } from '../js/analysis/agreement.js';
import { fitClock } from '../js/sensors/timesync.js';
import { summarize } from '../js/data/clip.js';

const up = (q) => qrotate(qconj(q), [0, 0, 1]);
const close = (a, b, tol = 1e-6) => a.every((v, i) => Math.abs(v - b[i]) < tol);

test('deviceorientation angles give the right "up" in the phone frame, whatever the heading', () => {
  assert.ok(close(up(quatFromDeviceOrientation(0, 0, 0)), [0, 0, 1]), 'flat, screen up');
  assert.ok(close(up(quatFromDeviceOrientation(0, 90, 0)), [0, 1, 0]), 'upright: top of the phone is up');
  assert.ok(close(up(quatFromDeviceOrientation(123, 90, 0)), [0, 1, 0]), 'heading does not matter');
  assert.ok(close(up(quatFromDeviceOrientation(0, 0, 90)), [-1, 0, 0]), 'tilted right: left edge is up');
  assert.ok(close(up(quatFromDeviceOrientation(0, 90, 40)), [0, 1, 0]), 'gamma is irrelevant when upright');
});

/** A phone strapped upright on the back: trunk flexion and side bend rotate it about earth axes. */
function phoneOnBack(flexDeg, sideDeg, accelSign = 1) {
  const upright = quatFromDeviceOrientation(0, 90, 0);
  const q = qmul(qfromAxisAngle([0, 1, 0], rad(sideDeg)), qmul(qfromAxisAngle([1, 0, 0], rad(-flexDeg)), upright));
  return { q, a: up(q).map((v) => accelSign * v * 9.80665) };
}

function script(t) {
  const wobble = 0.15 * Math.sin(t * 7);
  if (t < 4) return [wobble, 0];
  if (t < 8) return [40 * Math.sin((Math.PI * (t - 4)) / 4), 0];
  if (t < 10) return [wobble, 0];
  if (t < 13) return [0, 20 * Math.sin((Math.PI * (t - 10)) / 3)];
  if (t < 15) return [wobble, 0];
  return [(30 * (1 - Math.cos((2 * Math.PI * (t - 15)) / 5))) / 2, 0];
}

/** gap: [from, to] s with no samples (screen off); stopAt: s to stop at, or null to leave it recording; onSample(rec, k). */
function recordScript(accelSign, { gap = null, stopAt = 35, onSample = null } = {}) {
  const rec = new PhoneRecorder({ platform: 'test' });
  rec.start({ perfMs: 1000, epochMs: Date.UTC(2026, 9, 26, 12) });
  for (let k = 0; k <= (stopAt ?? 35) * 60; k++) {
    const t = k / 60;
    if (k === 60) rec.calibrate();
    if (gap && t >= gap[0] && t < gap[1]) continue;
    const [flex, side] = script(t);
    rec.add({ tMs: 1000 + t * 1000, ...phoneOnBack(flex, side, accelSign) });
    onSample?.(rec, k);
  }
  if (stopAt != null) rec.stop({ perfMs: 1000 + stopAt * 1e3, epochMs: Date.UTC(2026, 9, 26, 12) + stopAt * 1e3 });
  return rec;
}

test('phone recorder: the spoken calibration steps complete and angles follow the trunk', () => {
  const rec = recordScript(1);
  assert.ok(rec.cal?.ready, 'calibrated');
  assert.equal(rec.accelSign, 1);
  const json = rec.toJSON();
  assert.equal(json.schema, PHONE_SCHEMA);
  assert.ok(json.rows.length > 2000 && json.rows.length < 2200, `${json.rows.length} rows`);
  assert.deepEqual(json.gaps, []);
  // Angles at the top of a hinge (t = 17.5 s, 30° flexion).
  rec.add({ tMs: 1000 + 40e3, ...phoneOnBack(30, 0) });
  const a = rec.angles();
  assert.ok(Math.abs(Math.abs(a.flex) - 30) < 1, `flex ${a.flex}`);
  assert.ok(Math.abs(a.side) < 1, `side ${a.side}`);
  assert.doesNotThrow(() => parsePhoneRecording(json));
});

test('phone recorder: browsers that report acceleration pointing down are corrected', () => {
  const rec = recordScript(-1);
  assert.equal(rec.accelSign, -1);
  assert.ok(rec.cal?.ready);
  const row = rec.rows[500];
  assert.ok(angle3(up(row.slice(1, 5)), row.slice(5, 8)) < 2, 'stored acceleration points up');
});

test('phone recorder: toText() is exactly the downloaded JSON while the recording grows, even when the sign flips', () => {
  for (const accelSign of [1, -1]) {
    const checks = [];
    // k = 5: before the acceleration sign is decided (it flips the stored rows when it is -1).
    const rec = recordScript(accelSign, {
      gap: [20, 21.5],
      onSample: (r, k) => {
        if ([5, 40, 41, 900, 1500].includes(k)) checks.push([k, r.toText(), JSON.stringify(r.toJSON())]);
      },
    });
    for (const [k, text, json] of checks) assert.equal(text, json, `sample ${k}, sign ${accelSign}`);
    assert.equal(rec.toText(), JSON.stringify(rec.toJSON()), 'after stop');
    assert.equal(rec.toText(), rec.toText(), 'repeatable');
    rec.start({ perfMs: 50e3, epochMs: Date.UTC(2026, 9, 26, 13) });
    assert.equal(rec.toText(), JSON.stringify(rec.toJSON()), 'a new recording starts a new file');
  }
});

test('phone recorder: fromJSON(toJSON()) round-trips rows, gaps, cal and anchor, and gives back the same file', () => {
  const rec = recordScript(-1, { gap: [20, 21.5] });
  assert.ok(rec.cal?.ready);
  assert.equal(rec.gaps.length, 1);
  const json = rec.toJSON();
  // As stored (JSON writes the sign flip's -0 as 0, so compare with what was written, not the live rows).
  const saved = JSON.parse(JSON.stringify(json));
  const back = PhoneRecorder.fromJSON(saved);
  assert.equal(back.state, 'stopped');
  assert.equal(back.rows.length, rec.rows.length);
  assert.deepEqual(back.rows, JSON.parse(JSON.stringify(rec.rows)));
  assert.deepEqual(back.gaps, rec.gaps);
  assert.deepEqual(back.anchor, rec.anchor);
  assert.deepEqual(back.anchorEnd, rec.anchorEnd);
  assert.equal(back.accelSign, -1);
  assert.equal(back.platform, 'test');
  assert.ok(back.cal.ready);
  assert.deepEqual(back.cal.toJSON(), saved.cal);
  const sample = { q: rec.rows[700].slice(1, 5), a: rec.rows[700].slice(5, 8) };
  assert.deepEqual(back.cal.angles(sample), rec.cal.angles(sample));
  assert.equal(back.durationS, rec.durationS);
  assert.equal(back.rateHz, rec.rateHz);
  assert.deepEqual(back.toJSON(), saved);
  assert.equal(back.toText(), JSON.stringify(json), 'byte-for-byte the same file');
  assert.equal(JSON.stringify(back.toJSON()), JSON.stringify(json));
  assert.doesNotThrow(() => parsePhoneRecording(back.toJSON()));
  assert.throws(() => PhoneRecorder.fromJSON({ schema: 'other' }), /Not a SpineSense phone recording/);
  assert.throws(() => PhoneRecorder.fromJSON(null), /Not a SpineSense phone recording/);
});

test('phone recorder: a snapshot saved mid-recording is offered back as the same file until it is sent', () => {
  const rec = recordScript(1, { stopAt: null });
  assert.equal(rec.state, 'recording');
  assert.ok(rec.cal?.ready);
  const snap = structuredClone(phoneSnapshot(rec, { savedAt: 123 })); // as IndexedDB stores it
  assert.deepEqual({ ...snap, text: undefined }, { text: undefined, stopped: false, sent: false, savedAt: 123 });
  assert.equal(snap.text, JSON.stringify(rec.toJSON()));
  const r = unsentRecording(snap);
  assert.ok(r, 'offered');
  assert.equal(r.state, 'stopped');
  assert.equal(r.anchorEnd, null, 'the page closed before Stop');
  assert.equal(r.toText(), snap.text);
  assert.doesNotThrow(() => parsePhoneRecording(r.toJSON()));
  assert.equal(unsentRecording({ ...snap, sent: true }), null, 'sent or downloaded: not offered again');
  rec.stop({ perfMs: 40e3, epochMs: Date.UTC(2026, 9, 26, 12) + 39e3 });
  assert.equal(phoneSnapshot(rec, { sent: true }).stopped, true);
  // Nothing useful to offer: not calibrated, not a recording, nothing saved.
  const uncal = new PhoneRecorder({ platform: 'test' });
  uncal.start({ perfMs: 0, epochMs: Date.UTC(2026, 9, 26, 12) });
  for (let k = 0; k < 200; k++) uncal.add({ tMs: k * 16, ...phoneOnBack(0, 0) });
  assert.equal(unsentRecording(phoneSnapshot(uncal)), null);
  for (const bad of [undefined, null, {}, { text: 'not json' }, { text: '{"schema":"other"}' }]) assert.equal(unsentRecording(bad), null);
});

/** A phone file made from a simulated clip's upper sensor, with the phone's wall clock off by wallError s. */
function phoneFromClip(clip, wallError) {
  const upper = clip.sensors.find((s) => s.role === 'upper');
  const rows = clip.sensorRaw.rows.filter((r) => r[0] === 'upper');
  const fit = fitClock(rows.map((r) => [r[2], r[1]]));
  const t0 = fit.local(rows[0][2]);
  const epochAt = (t) => clip.clock.epochMs + (t - clip.clock.perfS) * 1000;
  return {
    schema: PHONE_SCHEMA,
    platform: 'test',
    createdAt: new Date(epochAt(t0)).toISOString(),
    anchor: { perfMs: 5000, epochMs: epochAt(t0) + wallError * 1000 },
    cal: upper.cal,
    gaps: [],
    rows: rows.map((r) => [5000 + (fit.local(r[2]) - t0) * 1000, ...r.slice(4, 11)]),
  };
}

const simulated = simulateClip({ exercises: ['hip-hinge', 'side-bend'] });

test('phone merge: wall clocks seconds apart are found from the movement, then agreement matches', async () => {
  const clip = await simulated;
  const bare = { ...clip, sensors: [], sensorRaw: null };
  for (const wallError of [2.4, -9]) {
    const m = mergePhone(bare, phoneFromClip(clip, wallError));
    // The camera timestamps are 60 ms late in the simulation, so the best match is 60 ms short of the clock error.
    assert.ok(Math.abs(m.offset - (wallError - 0.06)) < 0.06, `offset ${m.offset} for a ${wallError} s clock error`);
    assert.ok(m.r > 0.9, `r ${m.r}`);
    assert.equal(m.ambiguous, false);
    const res = analyzeClip(m.clip);
    assert.ok(res.ok, res.reason);
    assert.ok(Math.abs(res.lag.lag) < 0.1, `residual lag ${res.lag.lag}`);
    const hinge = res.perExercise['hip-hinge'].reps;
    assert.ok(hinge.n >= 5 && Math.abs(hinge.bias) < 1, JSON.stringify(hinge));
    assert.deepEqual(summarize(m.clip).sensors, ['phone']);
    assert.deepEqual(removePhone(m.clip).sensors, []);
  }
});

test('phone merge refuses what it cannot use', async () => {
  const clip = await simulated;
  const phone = phoneFromClip(clip, 0);
  assert.throws(() => mergePhone(clip, phone), /already has an upper-back sensor/);
  const bare = { ...clip, sensors: [], sensorRaw: null };
  assert.throws(() => mergePhone(bare, { ...phone, cal: null }), /wasn’t calibrated/);
  assert.throws(() => mergePhone(bare, { ...phone, schema: 'other' }), /Not a SpineSense phone recording/);
  const later = { ...phone, anchor: { ...phone.anchor, epochMs: phone.anchor.epochMs + 3600e3 } };
  assert.throws(() => mergePhone(bare, later), /don’t overlap/);
});
