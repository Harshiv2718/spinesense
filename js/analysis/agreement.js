// Camera vs back-sensor agreement for a recorded clip (clip.v1). Pure functions: used by the
// Recordings page in the browser and by tools/validate-clips.mjs in Node.
//
// For each exercise we compare the change in trunk angle from the exercise's start position:
//   side-on exercises:   camera trunk tilt from vertical   vs  sensor inclination from neutral
//   facing exercises:    camera side lean                  vs  sensor side bend
// Frame-level pairs are strongly autocorrelated, so the per-rep peak comparison is the headline.

import { AxisCalibration } from '../sensors/posture.js';
import { fitClock, crossCorrelateLag, interp } from '../sensors/timesync.js';
import { angle3 } from '../sensors/quat.js';
import { makeFrame, trunkTilt, lateralTilt, median } from '../core/geometry.js';
import { LandmarkSmoother } from '../core/filters.js';
import { byId } from '../core/exercises.js';
import { frameLandmarks } from '../data/clip.js';

const SENSOR_COLS = { role: 0, rx: 1, dev: 2, tl: 3, q: 4, a: 8 };

/** Camera trunk angles per frame, re-smoothed exactly like the live app does. */
export function cameraSeries(clip) {
  const aspect = clip.capture?.aspect ?? 16 / 9;
  const smooth = new LandmarkSmoother();
  const smoothW = new LandmarkSmoother();
  return clip.frames.rows.map((row, i) => {
    const t = row[0];
    const { lm, world } = frameLandmarks(clip, i);
    const f = makeFrame(smooth.apply(lm, t), world ? smoothW.apply(world, t) : null, aspect, t);
    const raw = makeFrame(lm, world, aspect, t);
    return { t, ex: row[2], phase: row[4], rep: row[5], state: row[6], tilt: trunkTilt(f), lean: lateralTilt(f), tiltRaw: trunkTilt(raw) };
  });
}

/** Sensor angles over time for one body position, on the browser clock (offline clock fit). */
export function sensorSeries(clip, role = 'upper') {
  const meta = (clip.sensors ?? []).find((s) => s.role === role && s.cal);
  const rows = (clip.sensorRaw?.rows ?? []).filter((r) => r[SENSOR_COLS.role] === role);
  if (!meta || rows.length < 50) return null;
  const fit = fitClock(rows.map((r) => [r[SENSOR_COLS.dev], r[SENSOR_COLS.rx]]));
  const cal = new AxisCalibration(meta.cal);
  return rows.map((r) => {
    const s = { q: r.slice(SENSOR_COLS.q, SENSOR_COLS.q + 4), a: r.slice(SENSOR_COLS.a, SENSOR_COLS.a + 3) };
    const ang = cal.angles(s);
    return { t: fit.local(r[SENSOR_COLS.dev]), flex: ang.flex, side: ang.side, incl: angle3(cal.up(s), cal.u0) };
  });
}

const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;

// ICC compares disagreement with how much the measurements vary. When every rep reaches about the
// same depth there is almost nothing to compare against and the ICC is meaningless, however small the errors.
export const ICC_MIN_SPREAD = 3; // degrees (SD of the sensor values)

/** Agreement statistics for [camera, sensor] pairs. */
export function agreement(pairs) {
  const n = pairs.length;
  if (n < 3) return { n };
  const cam = pairs.map((p) => p[0]);
  const sen = pairs.map((p) => p[1]);
  const diff = pairs.map(([c, s]) => c - s);
  const bias = mean(diff);
  const sd = Math.sqrt(diff.reduce((s, d) => s + (d - bias) ** 2, 0) / (n - 1));
  const mc = mean(cam);
  const ms = mean(sen);
  const vc = cam.reduce((s, x) => s + (x - mc) ** 2, 0) / n;
  const vs = sen.reduce((s, x) => s + (x - ms) ** 2, 0) / n;
  const cov = pairs.reduce((s, [c, x]) => s + (c - mc) * (x - ms), 0) / n;
  // ICC(A,1): two-way, absolute agreement, single measurement (camera and sensor as two raters).
  const grand = (mc + ms) / 2;
  const msr = (2 * pairs.reduce((s, [c, x]) => s + ((c + x) / 2 - grand) ** 2, 0)) / (n - 1);
  const msc = n * ((mc - grand) ** 2 + (ms - grand) ** 2);
  const sse = pairs.reduce((s, [c, x]) => {
    const rm = (c + x) / 2;
    return s + (c - rm - mc + grand) ** 2 + (x - rm - ms + grand) ** 2;
  }, 0);
  const mse = sse / (n - 1);
  const round = (v, k = 2) => +v.toFixed(k);
  return {
    n,
    bias: round(bias),
    sd: round(sd),
    loa: [round(bias - 1.96 * sd), round(bias + 1.96 * sd)],
    mae: round(mean(diff.map(Math.abs))),
    rmse: round(Math.sqrt(mean(diff.map((d) => d * d)))),
    r: vc && vs ? round(cov / Math.sqrt(vc * vs), 3) : null,
    ccc: vc + vs ? round((2 * cov) / (vc + vs + (mc - ms) ** 2), 3) : null,
    icc: round((msr - mse) / (msr + mse + (2 * (msc - mse)) / n), 3),
    spread: round(Math.sqrt(vs)),
  };
}

/**
 * Full analysis of one clip. Returns { ok, lag, smoothingDelay, perExercise: { id: { view, frames, reps, pairs } } }.
 *  lag:            clock offset between camera and sensor timestamps, from the unfiltered camera signal
 *  smoothingDelay: extra delay the app's landmark smoothing adds to the camera signal
 * Agreement compares magnitudes with both delays removed, so a constant delay doesn't hide how close
 * the angles are; the delays are reported separately. lagOverride replaces the measured clock lag.
 */
export function analyzeClip(clip, { role = 'upper', lagOverride = null } = {}) {
  const sen = sensorSeries(clip, role);
  if (!sen) return { ok: false, reason: `No calibrated ${role} sensor data in this clip` };
  const cam = cameraSeries(clip);
  const senIncl = sen.map((s) => ({ t: s.t, v: s.incl }));
  const sync = lagOverride != null
    ? { lag: lagOverride, r: null, method: 'given' }
    : { ...crossCorrelateLag(cam.map((c) => ({ t: c.t, v: c.tiltRaw })), senIncl, { maxLag: 0.5 }), method: 'cross-correlation' };
  const smoothed = lagOverride != null ? { lag: lagOverride } : crossCorrelateLag(cam.map((c) => ({ t: c.t, v: c.tilt })), senIncl, { maxLag: 0.6 });
  const smoothingDelay = +(sync.lag - smoothed.lag).toFixed(3);
  const align = sync.lag - Math.max(0, smoothingDelay);
  const at = (key) => sen.map((s) => ({ t: s.t, v: s[key] }));
  const series = { incl: at('incl'), side: at('side') };
  const perExercise = {};
  for (const id of [...new Set(cam.map((c) => c.ex).filter(Boolean))]) {
    const spec = byId[id];
    const view = spec?.view ?? 'side';
    const frames = cam.filter((c) => c.ex === id && c.phase === 'active');
    const camVal = (c) => (view === 'front' ? Math.abs(c.lean) : c.tilt);
    const senVal = (c) => {
      const v = interp(view === 'front' ? series.side : series.incl, c.t + align);
      return v == null ? null : view === 'front' ? Math.abs(v) : v;
    };
    const both = frames.map((c) => ({ c, cv: camVal(c), sv: senVal(c) })).filter((x) => x.sv != null);
    if (both.length < 30) continue;
    const head = both.slice(0, 10);
    const camBase = median(head.map((x) => x.cv));
    const senBase = median(head.map((x) => x.sv));
    const pairs = both.map((x) => [x.cv - camBase, x.sv - senBase]);
    // One peak per rep: segments of frames sharing the same completed-rep count while moving.
    const peaks = [];
    let seg = null;
    both.forEach((x, i) => {
      const key = x.c.rep;
      if (!seg || seg.key !== key) {
        if (seg) peaks.push(seg);
        seg = { key, cam: -Infinity, sen: -Infinity };
      }
      seg.cam = Math.max(seg.cam, pairs[i][0]);
      seg.sen = Math.max(seg.sen, pairs[i][1]);
    });
    if (seg) peaks.push(seg);
    const repPairs = peaks.filter((p) => p.sen > 5).map((p) => [p.cam, p.sen]);
    perExercise[id] = {
      view,
      measure: view === 'front' ? 'side lean change (°)' : 'trunk tilt change (°)',
      frames: agreement(pairs),
      reps: agreement(repPairs),
      pairs: pairs.filter((_, i) => i % 3 === 0),
      repPairs,
    };
  }
  return { ok: true, lag: sync, smoothingDelay, perExercise };
}
