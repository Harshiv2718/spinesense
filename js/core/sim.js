// Synthetic body poses. Used for unit tests, the camera-free demo mode, and the
// exercise illustrations. Produces MediaPipe-shaped landmarks (33 points).
//
// Angles are image-based: 0 = pointing down, 90 = image-right, 180 = up, −90 = image-left.

export const SIM_ASPECT = 16 / 9;
const SEG = { neck: 0.07, head: 0.04, torso: 0.25, upper: 0.15, fore: 0.13, thigh: 0.2, shin: 0.2, foot: 0.06, shHalf: 0.09, hipHalf: 0.06 };
const FLOOR = 0.9;
const CX = SIM_ASPECT / 2;
const M_PER_UNIT = 2.1; // ~1.7 m person drawn ~0.8 frame-heights tall

const dir = (a) => ({ x: Math.sin((a * Math.PI) / 180), y: Math.cos((a * Math.PI) / 180) });
const add = (p, d, len) => ({ x: p.x + d.x * len, y: p.y + d.y * len });

const IDX = {
  left: { shoulder: 11, elbow: 13, wrist: 15, hands: [17, 19, 21], hip: 23, knee: 25, ankle: 27, heel: 29, foot: 31, ear: 7, eye: [1, 2, 3], mouth: 9 },
  right: { shoulder: 12, elbow: 14, wrist: 16, hands: [18, 20, 22], hip: 24, knee: 26, ankle: 28, heel: 30, foot: 32, ear: 8, eye: [4, 5, 6], mouth: 10 },
};

function blank() {
  return Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0.95 }));
}

function put(pts, i, p, z = 0, vis = 0.95) {
  pts[i] = { x: p.x, y: p.y, z, visibility: vis };
}

/** Side view. limbs: { left: {armU, armF, thigh, shin, foot}, right: {...} }, near = side facing camera. */
function sideSkeleton({ hip, trunk, limbs, near = 'right' }) {
  const pts = blank();
  const td = dir(trunk);
  const sh = add(hip, td, SEG.torso);
  const headC = add(sh, td, SEG.neck + SEG.head);
  const face = { x: -td.y, y: td.x };
  for (const side of ['left', 'right']) {
    const I = IDX[side];
    const isNear = side === near;
    const z = isNear ? -0.1 : 0.1;
    const vis = isNear ? 0.95 : 0.55;
    const o = isNear ? 0.004 : -0.004; // tiny offset so left/right don't coincide exactly
    const l = limbs[side];
    const s = { x: sh.x + o, y: sh.y };
    const e = add(s, dir(l.armU), SEG.upper);
    const w = add(e, dir(l.armF ?? l.armU), SEG.fore);
    const h = { x: hip.x + o, y: hip.y };
    const k = add(h, dir(l.thigh), SEG.thigh);
    const a = add(k, dir(l.shin ?? l.thigh), SEG.shin);
    const footDir = dir(l.foot ?? 90);
    put(pts, I.shoulder, s, z, vis);
    put(pts, I.elbow, e, z, vis);
    put(pts, I.wrist, w, z, vis);
    for (const j of I.hands) put(pts, j, w, z, vis);
    put(pts, I.hip, h, z, vis);
    put(pts, I.knee, k, z, vis);
    put(pts, I.ankle, a, z, vis);
    put(pts, I.heel, add(a, footDir, -0.02), z, vis);
    put(pts, I.foot, add(a, footDir, SEG.foot), z, vis);
    put(pts, I.ear, headC, z, isNear ? 0.95 : 0.3);
    for (const j of I.eye) put(pts, j, add(add(headC, face, 0.03), td, 0.01), z, isNear ? 0.9 : 0.4);
    put(pts, I.mouth, add(add(headC, face, 0.035), td, -0.02), z, isNear ? 0.9 : 0.4);
  }
  put(pts, 0, add(headC, face, 0.045));
  return pts;
}

/** Front view (person facing the camera). tilt > 0 leans toward the person's right (image-left). */
function frontSkeleton({ hip, tilt = 0, armL = 15, armR = 15 }) {
  const pts = blank();
  const t = (tilt * Math.PI) / 180;
  const td = { x: -Math.sin(t), y: -Math.cos(t) };
  const perpL = { x: Math.cos(t), y: -Math.sin(t) }; // toward the person's left = image-right
  const sMid = add(hip, td, SEG.torso);
  const headC = add(sMid, td, SEG.neck + SEG.head);
  const sides = { left: { s: add(sMid, perpL, SEG.shHalf), arm: dir(armL), sign: 1 }, right: { s: add(sMid, perpL, -SEG.shHalf), arm: dir(-armR), sign: -1 } };
  for (const side of ['left', 'right']) {
    const I = IDX[side];
    const { s, arm, sign } = sides[side];
    const e = add(s, arm, SEG.upper);
    const w = add(e, arm, SEG.fore);
    const h = { x: hip.x + sign * SEG.hipHalf, y: hip.y };
    const k = { x: h.x, y: h.y + SEG.thigh };
    const a = { x: k.x, y: k.y + SEG.shin };
    put(pts, I.shoulder, s);
    put(pts, I.elbow, e);
    put(pts, I.wrist, w);
    for (const j of I.hands) put(pts, j, w);
    put(pts, I.hip, h);
    put(pts, I.knee, k);
    put(pts, I.ankle, a);
    put(pts, I.heel, { x: a.x, y: a.y + 0.015 });
    put(pts, I.foot, { x: a.x + sign * 0.02, y: a.y + 0.035 });
    put(pts, I.ear, add(headC, perpL, sign * 0.035));
    for (const j of I.eye) put(pts, j, add(add(headC, perpL, sign * 0.016), td, 0.012));
    put(pts, I.mouth, add(add(headC, perpL, sign * 0.012), td, -0.025));
  }
  put(pts, 0, add(headC, td, -0.004));
  return pts;
}

function shift(pts, dx, dy) {
  for (const p of pts) {
    p.x += dx;
    p.y += dy;
  }
  return pts;
}

/** Anchor so the lowest of the given landmarks touches the floor and landmark `xi` sits at x. */
function anchor(pts, floorIdx, xi, x) {
  const maxY = Math.max(...floorIdx.map((i) => pts[i].y));
  return shift(pts, x - pts[xi].x, FLOOR - maxY);
}

const ease = (p) => p * p * (3 - 2 * p);

/** Skeleton for an exercise at progress p (0 = start position, 1 = full range). */
export function poseAt(exId, p, { limb = 'left' } = {}) {
  const other = limb === 'left' ? 'right' : 'left';
  let pts;
  switch (exId) {
    case 'arm-raise':
      pts = frontSkeleton({ hip: { x: CX, y: 0.5 }, armL: 15 + 155 * p, armR: 15 + 155 * p });
      pts = anchor(pts, [27, 28, 31, 32], 0, CX);
      break;
    case 'side-bend':
      pts = frontSkeleton({ hip: { x: CX, y: 0.5 }, tilt: 28 * p * (limb === 'right' ? 1 : -1), armL: 8, armR: 8 });
      pts = anchor(pts, [27, 28, 31, 32], 23, CX + SEG.hipHalf);
      break;
    case 'hip-hinge': {
      const leg = { armU: 0, thigh: 15 * p, shin: 0, foot: 90 };
      pts = sideSkeleton({ hip: { x: CX, y: 0.5 }, trunk: 180 - 60 * p, limbs: { left: leg, right: leg } });
      pts = anchor(pts, [28, 30], 28, CX + 0.05);
      break;
    }
    case 'sit-to-stand': {
      const lean = (15 + 25 * Math.sin(p * Math.PI)) * (1 - p);
      const leg = { armU: 20, thigh: 90 * (1 - p), shin: 0, foot: 90 };
      pts = sideSkeleton({ hip: { x: CX, y: 0.5 }, trunk: 180 - lean, limbs: { left: leg, right: leg } });
      pts = anchor(pts, [28, 30], 28, CX + 0.1);
      break;
    }
    case 'knee-to-chest': {
      const rest = { armU: 90, thigh: 135, shin: 31, foot: 90 };
      const pulled = { armU: 90, thigh: 135 + 50 * p, shin: 31 + 120 * p, foot: 90 };
      pts = sideSkeleton({ hip: { x: CX, y: 0.8 }, trunk: -90, limbs: { [limb]: pulled, [other]: rest } });
      pts = anchor(pts, [11, 12, 23, 24], 24, CX + 0.1);
      break;
    }
    case 'glute-bridge': {
      const phi = 30 * p;
      const leg = { armU: 90, thigh: 135 - (45 - 30) * p, shin: 31 - 10 * p, foot: 90 };
      pts = sideSkeleton({ hip: { x: CX, y: 0.7 }, trunk: -90 + phi, limbs: { left: leg, right: leg } });
      pts = anchor(pts, [11, 12], 12, CX - 0.15);
      break;
    }
    case 'bird-dog': {
      const reach = { armU: 90 * p, thigh: 0, shin: -90, foot: -90 };
      const kick = { armU: 0, thigh: -90 * p, shin: -90, foot: -90 };
      const arms = { [limb]: reach.armU, [other]: 0 };
      const legs = { [other]: kick.thigh, [limb]: 0 };
      const limbs = {
        left: { armU: arms.left, thigh: legs.left, shin: -90, foot: -90 },
        right: { armU: arms.right, thigh: legs.right, shin: -90, foot: -90 },
      };
      pts = sideSkeleton({ hip: { x: CX, y: 0.6 }, trunk: 108, limbs });
      pts = anchor(pts, [15, 16, 25, 26], 24, CX - 0.1);
      break;
    }
    default:
      throw new Error(`No simulated pose for ${exId}`);
  }
  const hx = (pts[23].x + pts[24].x) / 2, hy = (pts[23].y + pts[24].y) / 2;
  const world = pts.map((q) => ({ x: (q.x - hx) * M_PER_UNIT, y: (q.y - hy) * M_PER_UNIT, z: q.z, visibility: q.visibility }));
  const lm = pts.map((q) => ({ x: q.x / SIM_ASPECT, y: q.y, z: q.z / M_PER_UNIT, visibility: q.visibility }));
  return { lm, world, aspect: SIM_ASPECT };
}

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

/**
 * A scripted person doing an exercise over time.
 * opts.painFrom: from this rep on, range shrinks and the face grimaces (to demo pain detection).
 */
export class SimPerson {
  constructor(exId, { kind = 'reps', hold = 3, painFrom = Infinity, view = 'side', seed = 7, noise = 0.0015, amp = 1 } = {}) {
    Object.assign(this, { exId, kind, hold, painFrom, view, noise, amp });
    this.rand = rng(seed);
    this.lead = 2.2;
  }

  get period() {
    return this.kind === 'hold' ? 1.2 + this.hold + 1.0 + 1.2 + 1.2 : 1.6 + 0.3 + 1.6 + 0.8;
  }

  phase(local) {
    if (this.kind === 'hold') {
      const up = 1.2, hold = this.hold + 1.0, down = 1.2;
      if (local < up) return ease(local / up);
      if (local < up + hold) return 1;
      if (local < up + hold + down) return 1 - ease((local - up - hold) / down);
      return 0;
    }
    const up = 1.6, top = 0.3, down = 1.6;
    if (local < up) return ease(local / up);
    if (local < up + top) return 1;
    if (local < up + top + down) return 1 - ease((local - up - top) / down);
    return 0;
  }

  frame(t) {
    let p = 0, k = -1;
    if (t >= this.lead) {
      k = Math.floor((t - this.lead) / this.period);
      p = this.phase((t - this.lead) % this.period);
    }
    const hurting = k >= this.painFrom;
    const amp = hurting ? 0.62 * this.amp : this.amp;
    const limb = k % 2 === 1 ? 'right' : 'left';
    const pose = poseAt(this.exId, p * amp, { limb });
    const n = () => (this.rand() - 0.5) * 2 * this.noise;
    for (const q of pose.lm) {
      q.x += n();
      q.y += n();
    }
    const grimace = 0.3 + n() * 10 + (hurting && p > 0.4 ? 0.9 : 0);
    return { ...pose, t, face: { score: grimace, frontal: this.view === 'front' }, rep: k, p };
  }
}
