// Turning a back-mounted IMU into clinical angles.
//
// Each sensor works as a gravity-referenced inclinometer (no yaw, so no drift). A short
// functional calibration learns how the sensor sits on the body, so strap orientation
// doesn't matter:
//   1. stand tall and still  -> u0, the "up" direction in the sensor's own frame
//   2. bend forward          -> f, the direction "up" moves in during flexion (sagittal plane)
//   3. bend to the right     -> the sign of side-bending (frontal plane)
// Two sensors give the clinical dual-inclinometer measure: lumbar = upper (T12/L1) - lower (sacrum).

import { qrotate, qconj, norm3, dot3, cross3, sub3, scale3, add3, angle3, deg } from './quat.js';

// Which way round the firmware's quaternion is (sensor->world or world->sensor, Z-up or Y-up)
// isn't assumed: we pick the candidate that matches the accelerometer while still.
const UP_CANDIDATES = [
  (q) => qrotate(qconj(q), [0, 0, 1]),
  (q) => qrotate(q, [0, 0, 1]),
  (q) => qrotate(qconj(q), [0, 1, 0]),
  (q) => qrotate(q, [0, 1, 0]),
];

export function pickConvention(samples) {
  const valid = samples.filter((s) => s.q && Math.hypot(...s.q) > 0.5);
  if (!valid.length) return null;
  let best = null;
  let bestErr = Infinity;
  UP_CANDIDATES.forEach((up, i) => {
    const err = valid.reduce((acc, s) => acc + angle3(up(s.q), s.a), 0) / valid.length;
    if (err < bestErr) {
      bestErr = err;
      best = i;
    }
  });
  return bestErr < 15 ? best : null; // fall back to the accelerometer alone
}

/** "Up" in the sensor frame: from the fused quaternion if usable, else the raw accelerometer. */
export function upVector(sample, convention) {
  return convention != null ? norm3(UP_CANDIDATES[convention](sample.q)) : norm3(sample.a);
}

function meanDir(vs) {
  return norm3(vs.reduce((acc, v) => add3(acc, v), [0, 0, 0]));
}

/** Largest angular spread of the accelerometer direction over a window, in degrees. */
export function spread(samples) {
  if (samples.length < 2) return Infinity;
  const ref = norm3(samples[0].a);
  return Math.max(...samples.map((s) => angle3(ref, s.a)));
}

export class AxisCalibration {
  constructor(data) {
    this.convention = null;
    this.u0 = null;
    this.f = null;
    this.s = null;
    this.sideSign = 1;
    this.sideKnown = false;
    this.at = null;
    if (data) Object.assign(this, data);
  }

  get ready() {
    return !!(this.u0 && this.f);
  }

  up(sample) {
    return upVector(sample, this.convention);
  }

  /** Step 1: samples recorded while standing tall and still. */
  setNeutral(samples) {
    this.convention = pickConvention(samples);
    this.u0 = meanDir(samples.map((s) => this.up(s)));
    this.f = null;
    this.s = null;
  }

  /** How far "up" has moved from neutral, in degrees. */
  deviation(sample) {
    return this.u0 ? angle3(this.up(sample), this.u0) : 0;
  }

  /** Step 2: the sample at the deepest point of a forward bend. */
  setFlexion(sample) {
    const u = this.up(sample);
    const d = sub3(u, scale3(this.u0, dot3(u, this.u0)));
    this.f = norm3(d);
    this.s = norm3(cross3(this.u0, this.f));
    this.at = Date.now();
  }

  /** Step 3 (optional): the sample at the deepest point of a bend to the right. */
  setSide(sample) {
    const u = this.up(sample);
    const c = dot3(u, this.s);
    if (Math.abs(c) > 0.02) {
      this.sideSign = Math.sign(c);
      this.sideKnown = true;
    }
  }

  /** Sagittal (flex: + forward, - backward) and frontal (side: + right) inclination in degrees. */
  angles(sample) {
    const u = this.up(sample);
    const along = dot3(u, this.u0);
    return {
      flex: deg(Math.atan2(dot3(u, this.f), along)),
      side: deg(Math.atan2(dot3(u, this.s) * this.sideSign, along)),
    };
  }

  toJSON() {
    const { convention, u0, f, s, sideSign, sideKnown, at } = this;
    return { convention, u0, f, s, sideSign, sideKnown, at };
  }
}
