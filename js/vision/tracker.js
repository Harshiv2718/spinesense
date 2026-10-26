// Webcam → MediaPipe Pose (33 body points) + Face (52 blendshapes), all on-device in the browser.
// The video never leaves this page; only the model files are downloaded from Google's CDN.

import { LandmarkSmoother } from '../core/filters.js';
import { makeFrame } from '../core/geometry.js';
import { grimaceScore, isFrontal } from '../core/discomfort.js';
import { SimPerson } from '../core/sim.js';

const TASKS_VERSION = '0.10.14';
const CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VERSION}`;
const MODELS = {
  lite: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
  full: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task',
  heavy: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task',
  face: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
};

let visionPromise = null;
function loadVision() {
  visionPromise ??= (async () => {
    const mod = await import(`${CDN}/vision_bundle.mjs`);
    const fileset = await mod.FilesetResolver.forVisionTasks(`${CDN}/wasm`);
    return { mod, fileset };
  })().catch((e) => {
    visionPromise = null;
    throw e;
  });
  return visionPromise;
}

async function createTask(Task, fileset, options) {
  try {
    return await Task.createFromOptions(fileset, { ...options, baseOptions: { ...options.baseOptions, delegate: 'GPU' } });
  } catch (e) {
    console.warn('GPU delegate unavailable, using CPU', e);
    return Task.createFromOptions(fileset, { ...options, baseOptions: { ...options.baseOptions, delegate: 'CPU' } });
  }
}

class FpsMeter {
  constructor() {
    this.times = [];
  }
  tick(t) {
    this.times.push(t);
    while (this.times.length && t - this.times[0] > 1) this.times.shift();
    return this.times.length;
  }
}

export class CameraTracker {
  constructor({ video, variant = 'full', face = true }) {
    this.video = video;
    this.variant = variant;
    this.useFace = face;
    this.smooth = new LandmarkSmoother();
    this.smoothW = new LandmarkSmoother();
    this.fps = new FpsMeter();
    this.crop = document.createElement('canvas');
    this.crop.width = this.crop.height = 256;
    this.cropCtx = this.crop.getContext('2d', { willReadFrequently: false });
    this.lastVideoTime = -1;
    this.lastTs = 0;
    this.frameNo = 0;
    this.demo = false;
  }

  async load(onStatus) {
    onStatus?.('Loading vision engine…');
    const { mod, fileset } = await loadVision();
    onStatus?.('Loading body-tracking model…');
    this.pose = await createTask(mod.PoseLandmarker, fileset, {
      baseOptions: { modelAssetPath: MODELS[this.variant] ?? MODELS.full },
      runningMode: 'VIDEO',
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    if (this.useFace) {
      onStatus?.('Loading face model…');
      try {
        this.face = await createTask(mod.FaceLandmarker, fileset, {
          baseOptions: { modelAssetPath: MODELS.face },
          runningMode: 'VIDEO',
          numFaces: 1,
          outputFaceBlendshapes: true,
        });
      } catch (e) {
        console.warn('Face model failed to load; continuing with body signals only', e);
        this.face = null;
      }
    }
  }

  async startCamera(deviceId) {
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: deviceId ? { exact: deviceId } : undefined, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
      audio: false,
    });
    this.video.srcObject = this.stream;
    this.video.muted = true;
    this.video.playsInline = true;
    await this.video.play();
  }

  get size() {
    return [this.video.videoWidth || 1280, this.video.videoHeight || 720];
  }

  start(onFrame) {
    this.onFrame = onFrame;
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      try {
        this.step();
      } catch (e) {
        console.error(e);
      }
    };
    loop();
  }

  step() {
    const v = this.video;
    if (v.readyState < 2 || !v.videoWidth || v.currentTime === this.lastVideoTime) return;
    this.lastVideoTime = v.currentTime;
    const now = performance.now();
    const ts = Math.max(now, this.lastTs + 1);
    this.lastTs = ts;
    const t = now / 1000;
    const res = this.pose.detectForVideo(v, ts);
    let frame = null;
    if (res.landmarks?.length) {
      const lm = this.smooth.apply(res.landmarks[0], t);
      const world = res.worldLandmarks?.[0] ? this.smoothW.apply(res.worldLandmarks[0], t) : null;
      frame = makeFrame(lm, world, v.videoWidth / v.videoHeight, t);
    } else {
      this.smooth.reset();
      this.smoothW.reset();
    }
    let face = null;
    if (this.face && frame && this.frameNo++ % 2 === 0) face = this.detectFace(frame.lm, ts + 0.5);
    this.onFrame({ frame, face, t, fps: this.fps.tick(t) });
  }

  /** Crop the head region from the full frame and upscale it, so the face model works even 3 m away. */
  detectFace(lm, ts) {
    const v = this.video, W = v.videoWidth, H = v.videoHeight;
    const pts = lm.slice(0, 11).filter((p) => (p.visibility ?? 1) > 0.3);
    if (pts.length < 4) return { score: null, frontal: false, found: false };
    const xs = pts.map((p) => p.x * W), ys = pts.map((p) => p.y * H);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const size = Math.max(72, Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * 2.6);
    this.cropCtx.drawImage(v, cx - size / 2, cy - size / 2, size, size, 0, 0, 256, 256);
    const r = this.face.detectForVideo(this.crop, ts);
    if (!r.faceLandmarks?.length || !r.faceBlendshapes?.length) return { score: null, frontal: false, found: false };
    const g = grimaceScore(r.faceBlendshapes[0].categories);
    return { score: g.score, parts: g.parts, eyes: g.parts.eyes, frontal: isFrontal(r.faceLandmarks[0]), found: true };
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.video.srcObject = null;
  }

  static async cameras() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter((d) => d.kind === 'videoinput');
    } catch {
      return [];
    }
  }
}

/** Camera-free demo: a simulated person performs whatever exercise is active. */
export class SimTracker {
  constructor() {
    this.smooth = new LandmarkSmoother();
    this.smoothW = new LandmarkSmoother();
    this.fps = new FpsMeter();
    this.person = null;
    this.mode = 'idle';
    this.demo = true;
  }

  async load(onStatus) {
    onStatus?.('Starting demo person…');
  }

  async startCamera() {}

  get size() {
    return [1280, 720];
  }

  /** Called by the session when the exercise changes. */
  setExercise(spec, level) {
    this.person = new SimPerson(spec.id, { kind: spec.kind, hold: level.hold ?? 3, view: spec.view, seed: Math.floor(Math.random() * 1e6) });
    this.t0 = this.lastNow ?? performance.now() / 1000;
    this.mode = 'exercise';
    this.smooth.reset();
    this.smoothW.reset();
  }

  /** Front-facing neutral person for the face-calibration step. */
  setCalibrating() {
    this.person = new SimPerson('arm-raise', { view: 'front' });
    this.person.lead = 1e9; // stand still
    this.t0 = this.lastNow ?? performance.now() / 1000;
    this.mode = 'calibrate';
  }

  /** Make the simulated person start hurting from the next rep. */
  simulatePain() {
    if (!this.person) return;
    const now = this.lastNow ?? performance.now() / 1000;
    const k = Math.floor((now - this.t0 - this.person.lead) / this.person.period);
    this.person.painFrom = Math.max(0, k + 1);
  }

  start(onFrame) {
    this.onFrame = onFrame;
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      this.tick(performance.now() / 1000);
    };
    loop();
  }

  /** One simulated frame at time `now` (seconds). Exposed so tests can step time manually. */
  tick(now) {
    if (!this.person || !this.onFrame) return;
    this.lastNow = now;
    const fr = this.person.frame(now - this.t0);
    const lm = this.smooth.apply(fr.lm, now);
    const world = this.smoothW.apply(fr.world, now);
    this.onFrame({ frame: makeFrame(lm, world, fr.aspect, now), face: { score: fr.face.score, frontal: fr.face.frontal, found: true }, t: now, fps: this.fps.tick(now) });
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }
}
