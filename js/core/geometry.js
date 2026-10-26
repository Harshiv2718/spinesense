// Geometry helpers over MediaPipe Pose landmarks.
// Image coordinates: x grows right, y grows DOWN. `f.p(i)` returns aspect-corrected
// 2D points so angles are true angles; `f.w(i)` returns 3D world points in meters.

export const L = {
  nose: 0, lEye: 2, rEye: 5, lEar: 7, rEar: 8,
  lShoulder: 11, rShoulder: 12, lElbow: 13, rElbow: 14, lWrist: 15, rWrist: 16,
  lHip: 23, rHip: 24, lKnee: 25, rKnee: 26, lAnkle: 27, rAnkle: 28,
  lHeel: 29, rHeel: 30, lFoot: 31, rFoot: 32,
};

export const SIDE = {
  left: { shoulder: 11, elbow: 13, wrist: 15, hip: 23, knee: 25, ankle: 27, ear: 7 },
  right: { shoulder: 12, elbow: 14, wrist: 16, hip: 24, knee: 26, ankle: 28, ear: 8 },
};

export const BONES = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [27, 29], [29, 31], [27, 31],
  [24, 26], [26, 28], [28, 30], [30, 32], [28, 32],
  [0, 7], [0, 8],
];

export const deg = (r) => (r * 180) / Math.PI;
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: ((a.z ?? 0) + (b.z ?? 0)) / 2 });
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** Interior angle at b, in degrees (0–180). */
export function angle(a, b, c, use3d = false) {
  const v1x = a.x - b.x, v1y = a.y - b.y, v1z = use3d ? (a.z ?? 0) - (b.z ?? 0) : 0;
  const v2x = c.x - b.x, v2y = c.y - b.y, v2z = use3d ? (c.z ?? 0) - (b.z ?? 0) : 0;
  const n = Math.hypot(v1x, v1y, v1z) * Math.hypot(v2x, v2y, v2z);
  if (!n) return 0;
  return deg(Math.acos(clamp((v1x * v2x + v1y * v2y + v1z * v2z) / n, -1, 1)));
}

/** Angle of the segment from→to away from straight up, 0 = vertical, 90 = horizontal. */
export function tiltFromVertical(from, to) {
  return deg(Math.atan2(Math.abs(to.x - from.x), from.y - to.y));
}

/** Elevation of from→to above horizontal (−90 = straight down, 90 = straight up). */
export function elevation(from, to) {
  return deg(Math.atan2(from.y - to.y, Math.abs(to.x - from.x)));
}

/** Wraps one frame of landmarks with convenient accessors. */
export function makeFrame(lm, world, aspect, t) {
  return {
    t, aspect, lm, world,
    p: (i) => ({ x: lm[i].x * aspect, y: lm[i].y, z: (lm[i].z ?? 0) * aspect }),
    w: (i) => (world ? world[i] : null),
    vis: (i) => lm[i].visibility ?? 1,
  };
}

/** Joint angle using 3D world points when present (view-independent), else 2D. */
export function joint(f, a, b, c) {
  if (f.world) return angle(f.w(a), f.w(b), f.w(c), true);
  return angle(f.p(a), f.p(b), f.p(c));
}

export const shoulderMid = (f) => mid(f.p(L.lShoulder), f.p(L.rShoulder));
export const hipMid = (f) => mid(f.p(L.lHip), f.p(L.rHip));
export const torsoLen = (f) => dist(shoulderMid(f), hipMid(f));
export const shoulderWidth = (f) => dist(f.p(L.lShoulder), f.p(L.rShoulder));

/** Trunk lean away from vertical (0 upright, 90 lying flat). */
export const trunkTilt = (f) => tiltFromVertical(hipMid(f), shoulderMid(f));

/** Side-to-side trunk lean in a front view. Positive = toward the person's right. */
export function lateralTilt(f) {
  const s = shoulderMid(f), h = hipMid(f);
  const rightSign = Math.sign(f.p(L.rHip).x - f.p(L.lHip).x) || 1;
  return deg(Math.atan2((s.x - h.x) * rightSign, h.y - s.y));
}

/** Which body side faces the camera (more visible). */
export function facingSide(f) {
  const score = (k) => ['shoulder', 'hip', 'knee', 'ankle'].reduce((a, j) => a + f.vis(SIDE[k][j]), 0);
  return score('left') >= score('right') ? 'left' : 'right';
}

/** Ratio of shoulder width to torso length: small when side-on, large when facing the camera. */
export const frontalness = (f) => shoulderWidth(f) / Math.max(1e-6, torsoLen(f));

export const allVisible = (f, idx, min = 0.5) => idx.every((i) => f.vis(i) >= min);

export function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function std(arr) {
  if (arr.length < 2) return 0;
  const m = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length);
}
