import test from 'node:test';
import assert from 'node:assert/strict';
import { ClockFit, fitClock, crossCorrelateLag, interp } from '../js/sensors/timesync.js';

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A sensor sampled at 50 Hz whose clock is 7.3 s off and drifts 40 ppm, sent over a jittery radio. */
function stream(seconds, { offset = 7.3, drift = 40e-6, minLatency = 0.012, seed = 3 } = {}) {
  const rand = rng(seed);
  const out = [];
  let backlog = 0;
  for (let i = 0; i < seconds * 50; i++) {
    const tTrue = 100 + i / 50; // browser-clock time the sample was taken
    const devMs = Math.round((tTrue - offset) * (1 + drift) * 1000);
    // Exponential-ish jitter plus occasional batching bursts that delay several samples.
    if (rand() < 0.02) backlog = 0.06 + rand() * 0.08;
    backlog = Math.max(0, backlog - 0.02);
    const rx = tTrue + minLatency + -Math.log(1 - rand()) * 0.008 + backlog;
    out.push({ tTrue, devMs, rx });
  }
  return out;
}

test('clock fit maps device time to sample time within a few ms despite radio jitter and drift', () => {
  const data = stream(600);
  const fit = fitClock(data.map((s) => [s.devMs, s.rx]));
  const errs = data.map((s) => fit.local(s.devMs) - s.tTrue - 0.012); // minus the constant min latency
  const worst = Math.max(...errs.map(Math.abs));
  const rawWorst = Math.max(...data.map((s) => Math.abs(s.rx - s.tTrue - 0.012)));
  assert.ok(worst < 0.004, `fitted worst error ${(worst * 1000).toFixed(1)} ms`);
  assert.ok(rawWorst > 0.05, 'raw arrival times really are jittery');
  // The device clock runs 40 ppm fast, so mapping it back to the browser clock scales by 1 - 40 ppm.
  assert.ok(Math.abs(fit.b - 1 + 40e-6) < 10e-6, `drift estimate ${((fit.b - 1) * 1e6).toFixed(1)} ppm`);
});

test('the live (windowed) fit tracks the clock after a few seconds', () => {
  const data = stream(120, { seed: 9 });
  const fit = new ClockFit();
  let worstLate = 0;
  data.forEach((s, i) => {
    const local = fit.add(s.devMs, s.rx);
    if (i > 50 * 10) worstLate = Math.max(worstLate, Math.abs(local - s.tTrue - 0.012));
  });
  assert.ok(worstLate < 0.006, `live worst error after 10 s: ${(worstLate * 1000).toFixed(1)} ms`);
});

test('device clock wrap-around (uint32 ms) is handled', () => {
  const fit = new ClockFit();
  const start = 2 ** 32 - 2000; // 2 s before the wrap
  for (let i = 0; i < 300; i++) {
    const devMs = (start + i * 20) % 2 ** 32;
    fit.add(devMs, 50 + i * 0.02 + 0.01);
  }
  const after = (start + 299 * 20) % 2 ** 32;
  assert.ok(Math.abs(fit.local(after) - (50 + 299 * 0.02 + 0.01)) < 0.002);
});

test('cross-correlation recovers a camera-to-sensor delay from a few quick bends', () => {
  const rand = rng(5);
  const bend = (t) => 40 * Math.max(0, Math.sin(t * 2.6)) ** 2 + 6 * Math.sin(t * 7.1); // irregular bending
  const cam = [];
  const sen = [];
  for (let t = 0; t < 8; t += 1 / 30) cam.push({ t, v: bend(t) + (rand() - 0.5) * 3 });
  // The sensor's timestamps run 0.12 s late relative to the camera.
  for (let t = 0; t < 8; t += 1 / 50) sen.push({ t: t + 0.12, v: bend(t) * 1.1 + (rand() - 0.5) * 1 });
  const { lag, r } = crossCorrelateLag(cam, sen);
  assert.ok(Math.abs(lag - 0.12) <= 0.01, `lag ${lag}`);
  assert.ok(r > 0.9, `correlation ${r}`);
  assert.equal(interp([{ t: 0, v: 0 }, { t: 1, v: 10 }], 0.25), 2.5);
});
