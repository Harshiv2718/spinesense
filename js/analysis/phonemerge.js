// Merging a phone recording (spinesense-phone.v1) into a camera clip as its upper-back sensor.
//
// 1. Wall clocks: both files carry a (monotonic clock, wall clock) anchor, which puts the phone's
//    samples on the clip's clock. Wall clocks can disagree by a few seconds, especially on PCs.
// 2. Movement: cross-correlating the camera's trunk tilt with the phone's tilt over ±maxOffset s
//    finds that disagreement. analyzeClip() then refines the remaining offset to a few ms as usual.

import { AxisCalibration } from '../sensors/posture.js';
import { angle3 } from '../sensors/quat.js';
import { PHONE_SCHEMA } from '../sensors/phone.js';
import { byId } from '../core/exercises.js';
import { cameraSeries } from './agreement.js';

const RATE = 25; // Hz, grid for the coarse search
const SENSOR_COLUMNS = ['role', 'rx_s', 'device_ms', 'tl_s', 'qw', 'qx', 'qy', 'qz', 'ax_g', 'ay_g', 'az_g'];

export function parsePhoneRecording(obj) {
  if (obj?.schema !== PHONE_SCHEMA) throw new Error('Not a SpineSense phone recording');
  if (!obj.anchor || !Array.isArray(obj.rows) || obj.rows.length < 100) throw new Error('The phone recording is empty or too short');
  if (!obj.cal?.u0 || !obj.cal?.f) throw new Error('The phone wasn’t calibrated during this recording, so its angles can’t be used. Record again and follow the spoken calibration steps.');
  return obj;
}

/** Values on a uniform grid; NaN where the series has no sample within maxGap seconds. */
function resample(series, t0, n, maxGap = 0.2) {
  const out = new Float64Array(n).fill(NaN);
  let j = 0;
  for (let i = 0; i < n; i++) {
    const t = t0 + i / RATE;
    while (j < series.length - 2 && series[j + 1].t <= t) j++;
    const A = series[j];
    const B = series[j + 1];
    if (!B || t < A.t || t > B.t || B.t - A.t > maxGap) continue;
    out[i] = B.t === A.t ? A.v : A.v + ((B.v - A.v) * (t - A.t)) / (B.t - A.t);
  }
  return out;
}

/**
 * Lag (s) that best lines up b with a, so that b(t + lag) ≈ a(t), searched over ±maxLag at 1/RATE.
 * Returns { lag, r, runnerUp }: runnerUp is the best correlation at least 1 s away from the winner,
 * which shows whether a repetitive movement made the answer ambiguous.
 */
export function coarseLag(a, b, maxLag) {
  const t0 = a[0].t;
  const n = Math.ceil((a[a.length - 1].t - t0) * RATE) + 1;
  const K = Math.round(maxLag * RATE);
  const A = resample(a, t0, n);
  const B = resample(b, t0 - K / RATE, n + 2 * K);
  const validA = A.reduce((s, v) => s + (Number.isNaN(v) ? 0 : 1), 0);
  const rs = new Float64Array(2 * K + 1).fill(-Infinity);
  for (let k = -K; k <= K; k++) {
    let m = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
    for (let i = 0; i < n; i++) {
      const x = A[i];
      const y = B[i + k + K];
      if (Number.isNaN(x) || Number.isNaN(y)) continue;
      m++;
      sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y;
    }
    if (m < Math.max(50, validA * 0.5)) continue;
    const cov = sxy - (sx * sy) / m;
    const vx = sxx - (sx * sx) / m;
    const vy = syy - (sy * sy) / m;
    if (vx > 0 && vy > 0) rs[k + K] = cov / Math.sqrt(vx * vy);
  }
  let best = 0;
  rs.forEach((v, i) => { if (v > rs[best]) best = i; });
  let runnerUp = -Infinity;
  rs.forEach((v, i) => { if (Math.abs(i - best) > RATE && v > runnerUp) runnerUp = v; });
  return { lag: (best - K) / RATE, r: rs[best], runnerUp };
}

/**
 * Adds the phone's samples to the clip as its calibrated upper-back sensor.
 * Returns { clip, offset, r, ambiguous, warnings }; throws with a readable message when it can't.
 */
export function mergePhone(clip, phone, { maxOffset = 30 } = {}) {
  parsePhoneRecording(phone);
  if ((clip.sensors ?? []).some((s) => s.role === 'upper' && s.cal)) throw new Error('This clip already has an upper-back sensor');
  const rows = clip.frames.rows;
  if (rows.length < 100) throw new Error('This clip is too short to line up with the phone');
  const warnings = [];
  // Clips from before phone support have no clock anchor: their creation time is a few seconds early.
  const anchor = clip.clock ?? { perfS: rows[0][0], epochMs: Date.parse(clip.createdAt) };
  if (!clip.clock) warnings.push('This clip has no clock anchor, so lining up relied on the movement alone.');
  const end = phone.anchorEnd;
  if (end && Math.abs(end.epochMs - phone.anchor.epochMs - (end.perfMs - phone.anchor.perfMs)) > 1000) {
    warnings.push('The phone’s clock jumped during the recording (it may have slept). Check the plots.');
  }
  if (phone.gaps?.length) warnings.push(`The phone stopped sending data ${phone.gaps.length} time${phone.gaps.length > 1 ? 's' : ''} (screen off or page hidden).`);

  // Phone samples on the clip's clock, using the wall clocks.
  const toClip = (tMs) => anchor.perfS + (phone.anchor.epochMs + (tMs - phone.anchor.perfMs) - anchor.epochMs) / 1000;
  const cal = new AxisCalibration(phone.cal);
  const incl = phone.rows.map((p) => ({ t: toClip(p[0]), v: angle3(cal.up({ q: p.slice(1, 5), a: p.slice(5, 8) }), cal.u0) }));

  // Standing exercises only, if there are any: the phone isn't worn for floor exercises.
  const cam = cameraSeries(clip);
  const standing = cam.filter((c) => byId[c.ex]?.position === 'standing');
  const use = (standing.length >= 100 ? standing : cam).map((c) => ({ t: c.t, v: c.tiltRaw }));
  if (incl[incl.length - 1].t < use[0].t - maxOffset || incl[0].t > use[use.length - 1].t + maxOffset) {
    throw new Error('The phone recording and this clip don’t overlap in time. Check you picked the right files, and that both devices set their clocks automatically.');
  }
  const found = coarseLag(use, incl, maxOffset);
  if (!(found.r >= 0.5)) throw new Error(`Couldn’t line up the phone with the camera (best correlation ${Number.isFinite(found.r) ? found.r.toFixed(2) : 'none'}). Make sure the phone was strapped on for the whole session. Starting with a few slow forward bends helps, if they’re comfortable and in today’s plan.`);
  const ambiguous = found.runnerUp > found.r - 0.03;
  if (ambiguous) warnings.push('The match was close to ambiguous (very regular movement). Next time, pause for a few seconds between exercises.');

  // Keep the samples that overlap the clip (plus a margin), shifted onto the camera's timing.
  const first = rows[0][0] - 5;
  const last = rows[rows.length - 1][0] + 5;
  const sensorRows = [];
  for (const p of phone.rows) {
    const t = +(toClip(p[0]) - found.lag).toFixed(4);
    if (t >= first && t <= last) sensorRows.push(['upper', t, p[0], t, ...p.slice(1, 8)]);
  }
  const sensorRaw = clip.sensorRaw?.rows ? { ...clip.sensorRaw, rows: [...clip.sensorRaw.rows, ...sensorRows] } : { started: clip.createdAt, columns: SENSOR_COLUMNS, rows: sensorRows };
  const meta = {
    id: 'phone',
    role: 'upper',
    source: 'phone',
    simulated: false,
    info: { kind: 'phone', platform: phone.platform ?? 'unknown', recordedAt: phone.createdAt, rateHz: Math.round(phone.rows.length / ((phone.rows[phone.rows.length - 1][0] - phone.rows[0][0]) / 1000)) },
    cal: phone.cal,
    clock: null,
    sync: { method: 'wall clock + cross-correlation', wallClockOffsetS: found.lag, r: +found.r.toFixed(3), ambiguous, warnings },
  };
  return { clip: { ...clip, sensors: [...(clip.sensors ?? []), meta], sensorRaw }, offset: found.lag, r: found.r, ambiguous, warnings };
}

/** Undoes mergePhone(). */
export function removePhone(clip) {
  if (!(clip.sensors ?? []).some((s) => s.source === 'phone')) return clip;
  return {
    ...clip,
    sensors: clip.sensors.filter((s) => s.source !== 'phone'),
    sensorRaw: clip.sensorRaw ? { ...clip.sensorRaw, rows: clip.sensorRaw.rows.filter((row) => row[0] !== 'upper') } : null,
  };
}
