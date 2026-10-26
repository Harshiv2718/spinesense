// Discomfort detector. A camera can't see pain — it can see the signs of it.
// We fuse several weak signals, each measured against YOUR own baseline:
//   face    – grimace (PSPI-style blendshape score) vs your neutral face
//   range   – a rep reaches much less range than your earlier reps
//   tempo   – a rep is much slower than your usual reps
//   guard   – you start a rep and abandon it, or can't hold a position
//   shake   – trembling while holding a position
//   shrug   – shoulders hike up (bracing)
// Movement signals are impulses that fade (half-life); the face signal is continuous.
// The face is the weakest evidence (near chance on new people in published studies), so it is
// opt-in, half weight, and only counts when a movement signal agrees. It never acts alone.

import { clamp, median } from './geometry.js';

export const SIGNALS = {
  face: { label: 'Facial strain', weight: 0.5 },
  range: { label: 'Range drop', weight: 0.8 },
  tempo: { label: 'Slowing', weight: 0.45 },
  guard: { label: 'Guarding', weight: 0.7 },
  shake: { label: 'Shaking', weight: 0.6 },
  shrug: { label: 'Bracing', weight: 0.4 },
};

const THRESHOLDS = {
  low: { mild: 1.0, moderate: 1.9 },
  medium: { mild: 0.7, moderate: 1.4 },
  high: { mild: 0.5, moderate: 1.05 },
};

const HALF_LIFE = 5; // s for movement impulses
const MILD_COOLDOWN = 15; // s between "ease off" cues
const MODERATE_COOLDOWN = 25; // s between pain checks
const FACE_TAU = 0.6; // s smoothing on the face z-score
const SIGMA_FLOOR = 0.06;
const EYES_CLOSED = 0.55; // blendshape level counted as closed
const EYES_SUSTAIN = 0.4; // s: shorter closures are blinks, not AU43
const EFFORT_REPS = 2; // reps per exercise used to learn the effort face

export class DiscomfortDetector {
  constructor({ sensitivity = 'medium' } = {}) {
    this.sensitivity = sensitivity;
    this.face = { mu: null, sigma: null, calib: null, z: 0, visible: false, n: 0, lastT: null, closedSince: null };
    this.resetExercise();
  }

  resetExercise() {
    this.signals = Object.fromEntries(Object.keys(SIGNALS).map((k) => [k, 0]));
    this.peaks = [];
    this.durations = [];
    this.lastT = null;
    this.lastMild = -Infinity;
    this.lastModerate = -Infinity;
    this.mildTimes = [];
    this.face.z = 0;
    // Each exercise starts from the neutral-face calibration, then learns its own effort face.
    if (this.face.calib) Object.assign(this.face, this.face.calib);
    this.effort = [];
    this.repCount = 0;
  }

  /** Neutral-face calibration from a few seconds of samples. */
  calibrateFace(samples) {
    if (samples.length < 5) return false;
    const mu = median(samples);
    const sigma = Math.max(SIGMA_FLOOR, median(samples.map((s) => Math.abs(s - mu))) * 1.4826);
    Object.assign(this.face, { mu, sigma, n: samples.length, calib: { mu, sigma } });
    return true;
  }

  get faceCalibrated() {
    return this.face.mu !== null;
  }

  /** score: grimace without eye closure; eyes: eye-closure blendshape level (0-1), if known. */
  pushFace(score, t, frontal, eyes) {
    const F = this.face;
    const dt = F.lastT === null ? 0.033 : Math.min(0.5, t - F.lastT);
    F.lastT = t;
    F.visible = frontal && score != null;
    if (!F.visible) {
      this.signals.face *= 0.5 ** (dt / 1.0);
      return;
    }
    // Sustained eye closure (AU43) adds to the score; ordinary blinks do not.
    if (eyes != null && eyes > EYES_CLOSED) {
      F.closedSince ??= t;
      if (t - F.closedSince >= EYES_SUSTAIN) score += 0.5;
    } else {
      F.closedSince = null;
    }
    if (this.repCount < EFFORT_REPS) this.effort.push(score);
    if (F.mu === null) {
      // No calibration: learn a baseline from the first ~20 frontal frames.
      (F.warm ??= []).push(score);
      if (F.warm.length >= 20) this.calibrateFace(F.warm);
      return;
    }
    const z = (score - F.mu) / F.sigma;
    const a = 1 - Math.exp(-dt / FACE_TAU);
    F.z += a * (z - F.z);
    const level = clamp((F.z - 2.5) / 3, 0, 1);
    this.signals.face = level;
    // Slowly track drift (lighting, posture) while the face looks relaxed.
    if (level === 0) {
      const b = 1 - Math.exp(-dt / 40);
      F.mu += b * (score - F.mu);
    }
  }

  bump(key, v) {
    this.signals[key] = Math.max(this.signals[key], clamp(v, 0, 1));
  }

  /** Feed engine events in; returns nothing — read state from tick(). */
  onEvent(ev, state) {
    switch (ev.type) {
      case 'rep': {
        const { peak, duration } = ev.rep;
        this.repCount++;
        if (this.repCount === EFFORT_REPS) this.learnEffortFace();
        if (this.peaks.length >= 3) {
          const ref = median(this.peaks);
          const r = peak / ref;
          if (r < 0.72) this.bump('range', 0.7 + (0.72 - r) / 0.3);
        }
        if (this.durations.length >= 3) {
          const refD = median(this.durations);
          if (duration > 1.9 * refD) this.bump('tempo', 0.6 + (duration / refD - 1.9) * 0.4);
        }
        this.peaks.push(peak);
        this.durations.push(duration);
        break;
      }
      case 'abort':
        // Started a rep and pulled out of it well short of the target.
        if (ev.peak > 0.5 * (state?.target ?? 0)) this.bump('guard', 0.9);
        else this.bump('guard', 0.5);
        break;
      case 'hold-break':
        this.bump('guard', 0.7);
        break;
      case 'form':
        if (ev.guarding) this.bump('shrug', 1);
        break;
    }
  }

  /** Effort is not pain: raise the face baseline to how this person looks during easy, comfortable reps. */
  learnEffortFace() {
    const F = this.face;
    if (F.mu === null || this.effort.length < 5) return;
    const mu = median(this.effort);
    const sigma = median(this.effort.map((s) => Math.abs(s - mu))) * 1.4826;
    F.mu = Math.max(F.mu, mu);
    F.sigma = Math.max(F.sigma, sigma, SIGMA_FLOOR);
  }

  /** Trembling during a hold, relative to the target range. */
  onJitter(jitter, target) {
    if (!jitter || !target) return;
    const rel = jitter / target;
    if (rel > 0.06) this.bump('shake', (rel - 0.06) / 0.08 + 0.4);
  }

  /**
   * Advance time and decide whether to respond.
   * Returns { score, level, top, trigger } where trigger is null | 'mild' | 'moderate'.
   */
  tick(t) {
    const dt = this.lastT === null ? 0 : Math.min(0.5, t - this.lastT);
    this.lastT = t;
    for (const k of Object.keys(this.signals)) {
      if (k !== 'face') this.signals[k] *= 0.5 ** (dt / HALF_LIFE);
    }
    const th = THRESHOLDS[this.sensitivity] ?? THRESHOLDS.medium;
    // The face only counts when at least one movement signal agrees.
    const corroborated = Object.entries(this.signals).some(([k, v]) => k !== 'face' && v > 0.25);
    const effective = { ...this.signals, face: corroborated ? this.signals.face : 0 };
    let score = 0;
    for (const [k, v] of Object.entries(effective)) score += SIGNALS[k].weight * v;
    const level = score >= th.moderate ? 'moderate' : score >= th.mild ? 'mild' : 'none';
    const top = Object.entries(effective)
      .filter(([, v]) => v > 0.25)
      .sort((a, b) => SIGNALS[b[0]].weight * b[1] - SIGNALS[a[0]].weight * a[1])
      .map(([k]) => k);

    let trigger = null;
    this.mildTimes = this.mildTimes.filter((x) => t - x < 60);
    if (t - this.lastModerate > MODERATE_COOLDOWN) {
      if (level === 'moderate' || (level === 'mild' && this.mildTimes.length >= 2 && t - this.lastMild > MILD_COOLDOWN)) {
        trigger = 'moderate';
        this.lastModerate = t;
        this.lastMild = t;
        this.mildTimes = [];
      }
    }
    if (!trigger && level === 'mild' && t - this.lastMild > MILD_COOLDOWN) {
      trigger = 'mild';
      this.lastMild = t;
      this.mildTimes.push(t);
    }
    return { score, level, top, trigger, signals: { ...this.signals }, thresholds: th, faceVisible: this.face.visible };
  }

  /** After a pain check is answered, clear movement impulses so we don't immediately re-trigger. */
  acknowledge(t) {
    for (const k of Object.keys(this.signals)) if (k !== 'face') this.signals[k] = 0;
    this.face.z = 0;
    this.lastModerate = t;
    this.lastMild = t;
  }
}

/**
 * PSPI-style grimace score from MediaPipe face blendshapes (brow lowering + orbital tightening +
 * levator contraction). Eye closure (AU43) is returned separately so the detector can require
 * it to be sustained rather than counting every blink.
 */
export function grimaceScore(categories) {
  const b = {};
  for (const c of categories) b[c.categoryName] = c.score;
  const avg = (x, y) => ((b[x] ?? 0) + (b[y] ?? 0)) / 2;
  const brow = avg('browDownLeft', 'browDownRight'); // AU4 brow lowerer
  const orbit = Math.max(avg('eyeSquintLeft', 'eyeSquintRight'), avg('cheekSquintLeft', 'cheekSquintRight')); // AU6/7
  const levator = Math.max(avg('noseSneerLeft', 'noseSneerRight'), avg('mouthUpperUpLeft', 'mouthUpperUpRight')); // AU9/10
  const eyes = avg('eyeBlinkLeft', 'eyeBlinkRight'); // AU43 when sustained
  return { score: brow + orbit + levator, parts: { brow, orbit, levator, eyes } };
}

/** Is the face roughly frontal? Uses nose tip vs cheek edges of the 478-point face mesh. */
export function isFrontal(face) {
  const nose = face[1], l = face[234], r = face[454];
  const span = r.x - l.x;
  if (Math.abs(span) < 1e-4) return false;
  const ratio = (nose.x - l.x) / span;
  return ratio > 0.3 && ratio < 0.7;
}
