// Features for one hip-hinge rep. The browser and the training tools both run this file on the same
// smoothed frames, so there is one definition and no Python copy to drift out of step. Bump
// FEATURE_SCHEMA whenever a feature changes: the app refuses a model built for a different schema.
//
// Angles use gravity as the reference, so nothing is rotated in the image plane. Lengths are divided
// by the person's own torso length, so body size and distance from the camera drop out.

import { SIDE, trunkTilt, hipMid, shoulderMid, torsoLen, joint, facingSide, median } from './geometry.js';

export const FEATURE_SCHEMA = 'hinge.v1';
export const FEATURE_EXERCISE = 'hip-hinge';
export const FEATURE_NAMES = [
  'tiltStart', 'tiltPeak', 'tiltRange', // trunk lean from vertical (°)
  'hipRange', 'hipPerTilt', // hip flexion gained, and per degree of lean
  'kneeRange', // how much the knees bent
  'shiftAtPeak', 'shiftPerTilt', // how far the hips travelled back (torso lengths)
  'torsoAtPeak', // shoulder-to-hip distance at the peak, as a share of the start
  'headAtPeak', // ear in front of the trunk line (torso lengths)
  'durationS', 'peakAt', // rep length, and where in it the peak came (0-1)
  'minVis', // worst landmark visibility: low means the angles are less trustworthy
];
const MIN_FRAMES = 15;
const MIN_RANGE = 10; // ° of lean: anything less isn't a rep

/** Signed distance of the point from the hip-to-shoulder line, forward of the trunk being positive. */
function aheadOfTrunk(p, hip, shoulder, dir) {
  const tx = shoulder.x - hip.x;
  const ty = shoulder.y - hip.y;
  const len = Math.hypot(tx, ty) || 1;
  return (((p.x - hip.x) * ty - (p.y - hip.y) * tx) / len) * -dir;
}

/** frames: the smoothed frames of one rep, in order. Returns numbers matching FEATURE_NAMES, or null. */
export function repFeatures(frames) {
  if (frames.length < MIN_FRAMES) return null;
  const S = SIDE[facingSide(frames[0])];
  const series = frames.map((f) => {
    const hip = hipMid(f);
    const shoulder = shoulderMid(f);
    return {
      t: f.t, hip, shoulder,
      tilt: trunkTilt(f),
      hipFlex: 180 - joint(f, S.shoulder, S.hip, S.knee),
      knee: joint(f, S.hip, S.knee, S.ankle),
      torso: torsoLen(f),
      ear: f.p(S.ear),
      vis: Math.min(f.vis(S.shoulder), f.vis(S.hip), f.vis(S.knee), f.vis(S.ankle)),
    };
  });
  const head = series.slice(0, 5);
  const start = (key) => median(head.map((x) => x[key]));
  let peak = 0;
  series.forEach((x, i) => { if (x.tilt > series[peak].tilt) peak = i; });
  const p = series[peak];
  const tiltStart = start('tilt');
  const tiltRange = p.tilt - tiltStart;
  if (tiltRange < MIN_RANGE) return null;
  const torso0 = start('torso') || 1;
  const hipX0 = median(head.map((x) => x.hip.x));
  const dir = Math.sign(p.shoulder.x - p.hip.x) || 1; // which way this person faces
  const hipRange = p.hipFlex - start('hipFlex');
  const shift = ((hipX0 - p.hip.x) * dir) / torso0;
  return [
    tiltStart, p.tilt, tiltRange,
    hipRange, hipRange / tiltRange,
    start('knee') - Math.min(...series.map((x) => x.knee)),
    shift, (shift / tiltRange) * 45,
    p.torso / torso0,
    aheadOfTrunk(p.ear, p.hip, p.shoulder, dir) / torso0,
    series[series.length - 1].t - series[0].t, peak / (series.length - 1),
    Math.min(...series.map((x) => x.vis)),
  ];
}

/** Collects the frames of the rep in progress. take() returns its features and starts the next rep. */
export class RepWindow {
  constructor() {
    this.frames = [];
  }

  push(frame) {
    this.frames.push(frame);
  }

  take() {
    const features = repFeatures(this.frames);
    this.frames = [];
    return features;
  }
}
