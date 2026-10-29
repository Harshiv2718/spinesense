// Exercise library. Each exercise is a declarative spec the engine runs:
//   setup()    – is the person in the right starting position?
//   baseline() – measurements captured at rest, so every metric is relative to YOUR body
//   metric()   – the one number that defines a rep (degrees or % of range)
//   form[]     – rules that produce spoken coaching cues
// Levels let the coach regress or progress an exercise.

import {
  SIDE, L, joint, trunkTilt, lateralTilt, hipMid, torsoLen, shoulderWidth,
  frontalness, elevation, dist, clamp,
} from './geometry.js';

const CAMERA = {
  front: 'Camera at chest height, 2–3 m away, facing you. Keep your whole body in view.',
  side: 'Camera at hip height, 2–3 m away. Turn side-on so it sees your profile. Whole body in view.',
  floor: 'Put the camera low (floor or a stool), 2–3 m away, side-on to you. Whole body in view.',
  chair: 'Chair side-on to the camera, 2–3 m away. Whole body in view.',
};

const shrugRatio = (f) =>
  ((f.p(L.lShoulder).y - f.p(L.lEar).y) + (f.p(L.rShoulder).y - f.p(L.rEar).y)) / 2 / Math.max(1e-6, shoulderWidth(f));

/** +1 if the person faces image-right, −1 if image-left (from heel → toe direction). */
function facingDir(f, S) {
  const heel = f.p(S === SIDE.left ? L.lHeel : L.rHeel);
  const toe = f.p(S === SIDE.left ? L.lFoot : L.rFoot);
  return Math.sign(toe.x - heel.x) || 1;
}

/** How far the hips sit behind the ankles, as a fraction of leg length. */
function hipBack(f, S) {
  const legLen = Math.max(1e-6, dist(f.p(S.hip), f.p(S.ankle)));
  return ((f.p(S.ankle).x - f.p(S.hip).x) * facingDir(f, S)) / legLen;
}

/** Height of the hip above the shoulder→knee line, as a fraction of thigh length (bridge over-arch). */
function hipAboveLine(f, S) {
  const sh = f.p(S.shoulder), hp = f.p(S.hip), kn = f.p(S.knee);
  const dx = kn.x - sh.x;
  if (Math.abs(dx) < 1e-6) return 0;
  const yLine = sh.y + ((kn.y - sh.y) * (hp.x - sh.x)) / dx;
  return (yLine - hp.y) / Math.max(1e-6, dist(hp, kn));
}

const lying = (f) => trunkTilt(f) > 55;

/** Angle in degrees between two unit vectors (back-sensor up directions). */
function tiltBetween(a, b) {
  const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return (Math.acos(Math.max(-1, Math.min(1, d))) * 180) / Math.PI;
}

export const EXERCISES = [
  {
    id: 'arm-raise',
    name: 'Overhead Arm Raise',
    short: 'Gentle warm-up that wakes up the upper back and shoulders.',
    category: 'Warm-up',
    position: 'standing',
    view: 'front',
    kind: 'reps',
    unit: '°',
    metricLabel: 'Arm lift',
    gesturePause: false,
    why: 'Raising the arms gently extends the upper back and gets you breathing and moving before loading the lower back.',
    steps: [
      'Stand tall facing the camera, arms relaxed by your sides.',
      'Breathe in and slowly raise both arms forward and up, as high as is comfortable.',
      'Breathe out and lower them slowly.',
    ],
    caution: 'Keep your ribs down — don\'t arch your lower back to get the arms higher.',
    camera: CAMERA.front,
    levels: [
      { name: 'Gentle', target: 90, reps: 6, note: 'To shoulder height' },
      { name: 'Standard', target: 140, reps: 8, note: 'Most of the way up' },
      { name: 'Full', target: 160, reps: 10, note: 'All the way overhead' },
    ],
    minRepSec: 1.5,
    required: () => [L.lShoulder, L.rShoulder, L.lElbow, L.rElbow, L.lWrist, L.rWrist, L.lHip, L.rHip],
    setup(f) {
      if (frontalness(f) < 0.5) return { ok: false, msg: 'Face the camera square-on' };
      if (trunkTilt(f) > 20) return { ok: false, msg: 'Stand up tall facing the camera' };
      if (f.p(L.lWrist).y < f.p(L.lShoulder).y || f.p(L.rWrist).y < f.p(L.rShoulder).y) {
        return { ok: false, msg: 'Start with your arms relaxed by your sides' };
      }
      return { ok: true };
    },
    baseline: (f) => ({ shrug: shrugRatio(f) }),
    metric(f) {
      const l = joint(f, L.lHip, L.lShoulder, L.lWrist);
      const r = joint(f, L.rHip, L.rShoulder, L.rWrist);
      return { value: (l + r) / 2, l, r };
    },
    // Back sensor: leaning back to get the arms higher is invisible to a front-facing camera.
    sensorForm: [
      { id: 'lean-back', needs: 'single', cue: 'Keep your ribs down: don’t lean back to lift higher', test: (sn, sb) => sn.trunk.flex - sb.trunkFlex < -10 },
    ],
    form: [
      { id: 'elbows', cue: 'Keep your elbows long and straight', test: (f) => Math.min(joint(f, L.lShoulder, L.lElbow, L.lWrist), joint(f, L.rShoulder, L.rElbow, L.rWrist)) < 135 },
      { id: 'uneven', cue: 'Lift both arms evenly', test: (f, s, b, c) => c.value > 50 && Math.abs(c.m.l - c.m.r) > 25 },
      { id: 'shrug', cue: 'Let your shoulders relax down, away from your ears', guarding: true, test: (f, s, b, c) => c.value < 110 && b.shrug > 0 && shrugRatio(f) / b.shrug < 0.65 },
      { id: 'lean', cue: 'Keep your body upright — no leaning', test: (f) => Math.abs(lateralTilt(f)) > 15 },
    ],
  },
  {
    id: 'side-bend',
    name: 'Standing Side Bend',
    short: 'Eases stiffness along the sides of the lower back.',
    category: 'Mobility',
    position: 'standing',
    view: 'front',
    kind: 'reps',
    alternating: true,
    unit: '°',
    metricLabel: 'Side bend',
    gesturePause: true,
    why: 'Side bending moves the lumbar joints in a direction that is often well tolerated, and shows left/right differences clearly.',
    steps: [
      'Stand facing the camera, feet hip-width apart, arms by your sides.',
      'Slide one hand down the side of your leg, bending straight to the side.',
      'Come back to upright, then bend to the other side.',
    ],
    caution: 'Stay in a comfortable range. Mild stretch is fine; sharp pain is not.',
    camera: CAMERA.front,
    levels: [
      { name: 'Gentle', target: 12, reps: 5, note: 'Small bends' },
      { name: 'Standard', target: 18, reps: 8, note: 'Moderate range' },
      { name: 'Full', target: 25, reps: 10, note: 'Full comfortable range' },
    ],
    minRepSec: 1.5,
    required: () => [L.lShoulder, L.rShoulder, L.lHip, L.rHip],
    setup(f) {
      if (frontalness(f) < 0.5) return { ok: false, msg: 'Face the camera square-on' };
      if (trunkTilt(f) > 12) return { ok: false, msg: 'Stand up tall, feet hip-width apart' };
      return { ok: true };
    },
    baseline: (f) => ({ tilt: lateralTilt(f), hipX: hipMid(f).x, torso: torsoLen(f), sw: shoulderWidth(f) }),
    metric(f, s, b) {
      const t = lateralTilt(f) - b.tilt;
      return { value: Math.abs(t), limb: t >= 0 ? 'right' : 'left' };
    },
    sensorMetric(sn, sb) {
      const t = sn.trunk.side - sb.trunkSide;
      return { value: Math.abs(t), limb: t >= 0 ? 'right' : 'left' };
    },
    sensorForm: [
      { id: 'forward', needs: 'single', cue: 'Bend straight to the side, not forward', test: (sn, sb) => Math.abs(sn.trunk.flex - sb.trunkFlex) > 12 },
    ],
    form: [
      { id: 'hips', cue: 'Keep your hips centred over your feet', test: (f, s, b) => Math.abs(hipMid(f).x - b.hipX) > 0.35 * b.sw },
      { id: 'forward', cue: 'Bend straight to the side, not forward', test: (f, s, b) => torsoLen(f) < 0.85 * b.torso },
    ],
  },
  {
    id: 'hip-hinge',
    name: 'Standing Hip Hinge',
    short: 'Practises bending from the hips, a comfortable and confident way to bend and lift.',
    category: 'Movement retraining',
    position: 'standing',
    view: 'side',
    kind: 'reps',
    unit: '°',
    metricLabel: 'Forward lean',
    gesturePause: true,
    why: 'Bending is safe and good for your back. Practising a hip hinge builds confidence and strength for everyday bending and lifting.',
    steps: [
      'Stand side-on to the camera, feet hip-width apart, soft knees.',
      'Push your hips back as if closing a car door with your bottom; let your chest tip forward.',
      'Keep your back long and neutral. Squeeze your glutes to stand back up.',
    ],
    caution: 'If bending forward triggers leg pain or tingling, stay in the Gentle level and stop if it spreads.',
    camera: CAMERA.side,
    levels: [
      { name: 'Gentle', target: 25, reps: 6, note: 'Small hinge' },
      { name: 'Standard', target: 40, reps: 8, note: 'Moderate hinge' },
      { name: 'Full', target: 55, reps: 10, note: 'Deep hinge' },
    ],
    minRepSec: 2,
    required: (s) => [SIDE[s].shoulder, SIDE[s].hip, SIDE[s].knee, SIDE[s].ankle],
    setup(f, s) {
      const S = SIDE[s];
      if (frontalness(f) > 0.45) return { ok: false, msg: 'Turn side-on to the camera' };
      if (trunkTilt(f) > 15) return { ok: false, msg: 'Stand up tall to start' };
      if (joint(f, S.hip, S.knee, S.ankle) < 150) return { ok: false, msg: 'Straighten up — stand tall with soft knees' };
      return { ok: true };
    },
    baseline: (f, s) => ({ tilt: trunkTilt(f), hipBack: hipBack(f, SIDE[s]) }),
    metric: (f, s, b) => ({ value: Math.max(0, trunkTilt(f) - b.tilt) }),
    sensorMetric: (sn, sb) => ({ value: Math.max(0, sn.trunk.flex - sb.trunkFlex) }),
    // Two sensors split the bend into lower back vs hips: a true hinge keeps the lumbar angle small.
    sensorForm: [
      { id: 'lumbar-round', needs: 'dual', cue: 'Keep your lower back long: bend from your hips, not your spine', test: (sn, sb, c) => c.value > 15 && sn.lumbar.flex - sb.lumbarFlex > Math.max(18, 0.45 * c.value) },
    ],
    form: [
      { id: 'squat', cue: 'Keep a soft knee — push your hips back instead of squatting', test: (f, s, b, c) => c.value > 10 && joint(f, SIDE[s].hip, SIDE[s].knee, SIDE[s].ankle) < 135 },
      { id: 'hips-back', cue: 'Send your hips back as you lean forward', test: (f, s, b, c) => c.value > 0.6 * c.target && hipBack(f, SIDE[s]) - b.hipBack < 0.04 },
    ],
  },
  {
    id: 'sit-to-stand',
    name: 'Sit to Stand',
    short: 'Builds leg and hip strength for everyday getting up and down.',
    category: 'Strength',
    position: 'chair',
    view: 'side',
    kind: 'reps',
    unit: '%',
    metricLabel: 'Stand height',
    gesturePause: true,
    why: 'Strong hips and legs take load off the lower back during daily tasks like getting out of chairs and cars.',
    steps: [
      'Sit on the front half of a sturdy chair, side-on to the camera, feet flat.',
      'Lean forward slightly from the hips and stand all the way up.',
      'Sit back down slowly with control.',
    ],
    caution: 'Use your hands on your thighs on the Gentle level if you need help.',
    camera: CAMERA.chair,
    levels: [
      { name: 'Gentle', target: 90, reps: 5, minRepSec: 2, note: 'Hands on thighs if needed' },
      { name: 'Standard', target: 90, reps: 8, minRepSec: 2.5, note: 'Arms crossed' },
      { name: 'Strong', target: 90, reps: 10, minRepSec: 4, note: 'Slow 3-second lowering' },
    ],
    required: (s) => [SIDE[s].shoulder, SIDE[s].hip, SIDE[s].knee, SIDE[s].ankle],
    setup(f, s) {
      const S = SIDE[s];
      if (frontalness(f) > 0.45) return { ok: false, msg: 'Turn the chair side-on to the camera' };
      if (joint(f, S.hip, S.knee, S.ankle) > 120) return { ok: false, msg: 'Sit on the front half of a sturdy chair' };
      return { ok: true };
    },
    baseline: (f, s) => ({ knee: joint(f, SIDE[s].hip, SIDE[s].knee, SIDE[s].ankle) }),
    metric(f, s, b) {
      const knee = joint(f, SIDE[s].hip, SIDE[s].knee, SIDE[s].ankle);
      return { value: clamp(((knee - b.knee) / Math.max(30, 168 - b.knee)) * 100, 0, 120) };
    },
    form: [
      { id: 'chest', cue: 'Keep your chest up as you rise', test: (f) => trunkTilt(f) > 60 },
      { id: 'tall', cue: 'Stand fully tall at the top — squeeze your glutes', active: 'top', test: (f, s) => joint(f, SIDE[s].shoulder, SIDE[s].hip, SIDE[s].knee) < 155 },
    ],
  },
  {
    id: 'knee-to-chest',
    name: 'Single Knee to Chest',
    short: 'A gentle relief stretch for the lower back and buttock.',
    category: 'Relief',
    position: 'floor',
    view: 'side',
    kind: 'hold',
    alternating: true,
    unit: '°',
    metricLabel: 'Knee pull',
    gesturePause: false, // lying down, the hands sit above the head in the image
    why: 'Gentle flexion often eases a stiff, achy lower back — especially if standing or walking is what aggravates it.',
    steps: [
      'Lie on your back, knees bent, feet flat, side-on to the camera.',
      'Hug one knee gently toward your chest and hold.',
      'Lower it slowly and switch legs.',
    ],
    caution: 'Skip this one if bending forward or sitting makes your pain worse, or if it sends pain down your leg.',
    camera: CAMERA.floor,
    levels: [
      { name: 'Gentle', target: 25, hold: 10, reps: 2, note: '10 s holds' },
      { name: 'Standard', target: 35, hold: 15, reps: 3, note: '15 s holds' },
      { name: 'Full', target: 45, hold: 20, reps: 3, note: '20 s holds' },
    ],
    required: (s) => [SIDE[s].shoulder, SIDE[s].hip, SIDE[s].knee],
    setup(f) {
      if (!lying(f)) return { ok: false, msg: 'Lie on your back, side-on to the camera' };
      if (Math.min(joint(f, L.lHip, L.lKnee, L.lAnkle), joint(f, L.rHip, L.rKnee, L.rAnkle)) > 135) {
        return { ok: false, msg: 'Bend both knees, feet flat on the floor' };
      }
      return { ok: true };
    },
    baseline: (f) => ({
      l: joint(f, L.lShoulder, L.lHip, L.lKnee),
      r: joint(f, L.rShoulder, L.rHip, L.rKnee),
      trunk: trunkTilt(f),
    }),
    metric(f, s, b) {
      const dl = b.l - joint(f, L.lShoulder, L.lHip, L.lKnee);
      const dr = b.r - joint(f, L.rShoulder, L.rHip, L.rKnee);
      return { value: Math.max(0, dl, dr), limb: dl >= dr ? 'left' : 'right' };
    },
    form: [
      { id: 'head', cue: 'Keep your head and shoulders relaxed on the floor', test: (f, s, b) => Math.abs(trunkTilt(f) - b.trunk) > 20 },
    ],
  },
  {
    id: 'glute-bridge',
    name: 'Glute Bridge',
    short: 'Strengthens the glutes that support and protect the lower back.',
    category: 'Strength',
    position: 'floor',
    view: 'side',
    kind: 'hold',
    unit: '°',
    metricLabel: 'Hip lift',
    gesturePause: false, // lying down, the hands sit above the head in the image
    why: 'Strong glutes share the load with the lower back. Bridges are one of the most common exercises in back-pain programmes.',
    steps: [
      'Lie on your back, knees bent, feet flat and hip-width apart, side-on to the camera.',
      'Tighten your tummy, squeeze your glutes and lift your hips until your body is in a line from shoulders to knees.',
      'Hold, then lower slowly one vertebra at a time.',
    ],
    caution: 'Lift with your glutes, not by arching your lower back.',
    camera: CAMERA.floor,
    levels: [
      { name: 'Gentle', target: 18, hold: 3, reps: 6, note: 'Small lift, 3 s hold' },
      { name: 'Standard', target: 25, hold: 5, reps: 8, note: 'Full lift, 5 s hold' },
      { name: 'Full', target: 32, hold: 8, reps: 10, note: 'Full lift, 8 s hold' },
    ],
    required: (s) => [SIDE[s].shoulder, SIDE[s].hip, SIDE[s].knee, SIDE[s].ankle],
    setup(f, s) {
      const S = SIDE[s];
      if (!lying(f)) return { ok: false, msg: 'Lie on your back, side-on to the camera' };
      if (joint(f, S.hip, S.knee, S.ankle) > 125) return { ok: false, msg: 'Bend your knees, feet flat on the floor' };
      return { ok: true };
    },
    baseline: (f, s) => ({ hip: joint(f, SIDE[s].shoulder, SIDE[s].hip, SIDE[s].knee) }),
    metric: (f, s, b) => ({ value: Math.max(0, joint(f, SIDE[s].shoulder, SIDE[s].hip, SIDE[s].knee) - b.hip) }),
    sensorForm: [
      { id: 'arch-lumbar', needs: 'dual', cue: 'Don’t over-arch: ribs down, squeeze your glutes', test: (sn, sb) => sn.lumbar.flex - sb.lumbarFlex < -12 },
    ],
    form: [
      { id: 'arch', cue: 'Don\'t over-arch — ribs down, squeeze your glutes', test: (f, s) => hipAboveLine(f, SIDE[s]) > 0.12 },
    ],
  },
  {
    id: 'bird-dog',
    name: 'Bird Dog',
    short: 'Core stability with a steady spine — part of McGill\'s "Big 3".',
    category: 'Stability',
    position: 'floor',
    view: 'side',
    kind: 'hold',
    alternating: true,
    unit: '%',
    metricLabel: 'Reach',
    gesturePause: false,
    why: 'Builds strength and control in the back and core muscles while the arms and legs move, which helps with everyday activity.',
    steps: [
      'Get onto hands and knees, side-on to the camera. Hands under shoulders, knees under hips.',
      'Brace gently. Reach one arm forward (or one leg back on the Gentle level) without moving your back.',
      'Hold, return slowly, then switch sides.',
    ],
    caution: 'The spine stays still like a table top — only the arms and legs move.',
    camera: CAMERA.floor,
    levels: [
      { name: 'Gentle', target: 80, hold: 5, reps: 3, mode: 'single', note: 'One arm or one leg' },
      { name: 'Standard', target: 80, hold: 6, reps: 4, mode: 'pair', note: 'Opposite arm + leg' },
      { name: 'Full', target: 85, hold: 10, reps: 5, mode: 'pair', note: 'Opposite arm + leg, 10 s' },
    ],
    required: (s) => [SIDE[s].shoulder, SIDE[s].wrist, SIDE[s].hip, SIDE[s].ankle],
    setup(f) {
      if (!lying(f)) return { ok: false, msg: 'Get onto your hands and knees, side-on to the camera' };
      const armL = elevation(f.p(L.lShoulder), f.p(L.lWrist));
      const armR = elevation(f.p(L.rShoulder), f.p(L.rWrist));
      if (Math.max(armL, armR) > -55) return { ok: false, msg: 'Place both hands on the floor under your shoulders' };
      return { ok: true };
    },
    baseline: (f) => ({
      trunk: trunkTilt(f),
      arm: Math.min(elevation(f.p(L.lShoulder), f.p(L.lWrist)), elevation(f.p(L.rShoulder), f.p(L.rWrist))),
      leg: Math.min(elevation(f.p(L.lHip), f.p(L.lAnkle)), elevation(f.p(L.rHip), f.p(L.rAnkle))),
    }),
    metric(f, s, b, level) {
      const armE = [elevation(f.p(L.lShoulder), f.p(L.lWrist)), elevation(f.p(L.rShoulder), f.p(L.rWrist))];
      const legE = [elevation(f.p(L.lHip), f.p(L.lAnkle)), elevation(f.p(L.rHip), f.p(L.rAnkle))];
      const armP = armE.map((e) => clamp((e - b.arm) / Math.max(30, -b.arm), 0, 1.3));
      const legP = legE.map((e) => clamp((e - b.leg) / Math.max(15, -b.leg), 0, 1.3));
      const arm = Math.max(...armP), leg = Math.max(...legP);
      const value = (level.mode === 'single' ? Math.max(arm, leg) : Math.min(arm, leg)) * 100;
      const armSide = armP[0] >= armP[1] ? 'left' : 'right';
      const legSide = legP[0] >= legP[1] ? 'left' : 'right';
      const limb = level.mode === 'single' && leg > arm ? (legSide === 'left' ? 'right' : 'left') : armSide;
      return { value, limb, armUp: Math.max(...armE), legUp: Math.max(...legE) };
    },
    sensorForm: [
      { id: 'spine-still', needs: 'single', cue: 'Keep your back still and level, like a table top', test: (sn, sb) => tiltBetween(sn.trunk.u, sb.u) > 8 },
    ],
    form: [
      { id: 'too-high', cue: 'Reach long, not up — keep arm and leg level with your back', test: (f, s, b, c) => c.m.armUp > 30 || c.m.legUp > 25 },
      { id: 'sag', cue: 'Keep your back flat and steady, like a table top', test: (f, s, b) => Math.abs(trunkTilt(f) - b.trunk) > 18 },
    ],
  },
];

export const byId = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));

export const POSITION_LABEL = { standing: 'Standing', chair: 'Chair', floor: 'On the floor' };
export const VIEW_LABEL = { front: 'Face the camera', side: 'Side-on to camera' };
