// Bench test: the reference has to be validated too. Hold the sensor still on a fixed rig at 0° and
// then at known angles (protractor, phone level app, 3D-printed wedge); compare the measured tilt with
// the rig angle. Uses the same gravity-referenced maths as the live app.

import { pickConvention, upVector } from '../sensors/posture.js';
import { angle3, norm3, add3 } from '../sensors/quat.js';

function meanUp(samples, convention) {
  return norm3(samples.reduce((acc, s) => add3(acc, upVector(s, convention)), [0, 0, 0]));
}

/** Start a bench session from ~2 s of still samples on the flat (0°) rig. */
export function benchReference(samples) {
  if (samples.length < 20) throw new Error('Hold the sensor still for about 2 seconds');
  const convention = pickConvention(samples);
  return { convention, up: meanUp(samples, convention) };
}

/** Measure one rig angle from ~2 s of still samples. */
export function benchMeasure(ref, samples, targetDeg) {
  const ups = samples.map((s) => upVector(s, ref.convention));
  const mean = norm3(ups.reduce((acc, u) => add3(acc, u), [0, 0, 0]));
  const measured = angle3(ref.up, mean);
  const each = ups.map((u) => angle3(ref.up, u));
  const m = each.reduce((s, x) => s + x, 0) / each.length;
  const sd = Math.sqrt(each.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, each.length - 1));
  return { target: targetDeg, measured: +measured.toFixed(2), error: +(measured - targetDeg).toFixed(2), sd: +sd.toFixed(2), n: samples.length };
}

export function benchSummary(rows) {
  if (!rows.length) return null;
  const abs = rows.map((r) => Math.abs(r.error));
  return { maxAbsError: +Math.max(...abs).toFixed(2), meanAbsError: +(abs.reduce((s, x) => s + x, 0) / abs.length).toFixed(2), worstSd: +Math.max(...rows.map((r) => r.sd)).toFixed(2) };
}
