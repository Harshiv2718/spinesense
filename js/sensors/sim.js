// Simulated SpineSense Motion sensor. It produces the exact same 20-byte packets as the firmware,
// so the whole browser pipeline (decode -> calibrate -> angles) is exercised without hardware.

import { encodeSample, decodeSample } from './protocol.js';
import { qmul, qnorm, qfromAxisAngle, qrotate, qconj, rad } from './quat.js';
import { AxisCalibration } from './posture.js';
import { makeFrame, trunkTilt, lateralTilt, shoulderMid, hipMid } from '../core/geometry.js';

// Back-mounted sensor frame: y along the spine toward the head, z out of the back, x to the left.
// Standing upright, sensor y points at world up (Z).
const MOUNT = qfromAxisAngle([1, 0, 0], Math.PI / 2);

/** Orientation (sensor -> world, Z up) for a trunk segment flexed forward and bent to the right. */
export function simOrientation(flexDeg, sideDeg = 0, twistDeg = 0) {
  return qnorm(qmul(qmul(qmul(MOUNT, qfromAxisAngle([1, 0, 0], -rad(flexDeg))), qfromAxisAngle([0, 0, 1], rad(sideDeg))), qfromAxisAngle([0, 1, 0], rad(twistDeg))));
}

export class SimSensor extends EventTarget {
  /**
   * source(role, timeSeconds) -> { flex, side } in degrees for this body segment.
   * radio (optional) makes the timing realistic: { offset (s the device clock is behind), drift (ppm),
   * latency (s minimum), jitter (s, mean extra delay), burst (probability per sample of a radio burst) }.
   */
  constructor({ role = 'upper', source, twist = 17, noise = 0.004, interval = true, radio = null, seed = 1 } = {}) {
    super();
    this.id = `sim-${role}`;
    this.name = `Simulated sensor (${role})`;
    this.role = role;
    this.source = source;
    this.twist = twist; // strapped on slightly crooked, as in real life
    this.noise = noise;
    this.seq = 0;
    this.simulated = true;
    this.interval = interval; // false: the caller drives tick() (tests, demo sessions)
    this.radio = radio;
    this.backlog = 0;
    let a = seed >>> 0;
    this.rand = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  async connect() {
    this.emit('info', { fw: 'sim-1.0', board: 'simulator', imu: 'virtual', role: this.role, rate: 50 });
    this.emit('battery', 87);
    this.emit('status', 'connected');
    if (this.interval) this.timer = setInterval(() => this.tick(performance.now() / 1000), 20);
  }

  tick(now) {
    const { flex = 0, side = 0 } = this.source?.(this.role, now) ?? {};
    const q = simOrientation(flex, side, this.twist);
    const n = () => (Math.random() - 0.5) * 2 * this.noise;
    const a = qrotate(qconj(q), [0, 0, 1]).map((c) => c + n());
    const r = this.radio;
    // Device clock (ms) and arrival time, with the sensor's own offset/drift and radio delays if simulated.
    const deviceMs = r ? Math.round((now - r.offset) * (1 + (r.drift ?? 0) * 1e-6) * 1000) : Math.round(now * 1000);
    let rx = now;
    if (r) {
      if (this.rand() < (r.burst ?? 0)) this.backlog = 0.05 + this.rand() * 0.08;
      this.backlog = Math.max(0, this.backlog - 0.02);
      rx = now + (r.latency ?? 0) - Math.log(1 - this.rand()) * (r.jitter ?? 0) + this.backlog;
    }
    const packet = encodeSample({ role: this.role, gyroOk: true, still: false, seq: this.seq++, t: deviceMs, q, a });
    const sample = decodeSample(packet);
    sample.rx = rx;
    sample.tTrue = now; // ground truth, only the simulator knows it
    this.emit('sample', sample);
  }

  async setRole(role) {
    this.role = role;
  }

  async identify() {}

  disconnect() {
    clearInterval(this.timer);
    this.emit('status', 'disconnected');
  }
}

/** A ready calibration for a simulated sensor, as if the user had done the 3-step wizard. */
export function simCalibration(twist = 17) {
  const s = (flex, side) => {
    const q = simOrientation(flex, side, twist);
    return decodeSample(encodeSample({ q, a: qrotate(qconj(q), [0, 0, 1]) }));
  };
  const cal = new AxisCalibration();
  cal.setNeutral(Array.from({ length: 10 }, () => s(0, 0)));
  cal.setFlexion(s(45, 0));
  cal.setSide(s(0, 20));
  return cal;
}

/**
 * Sensor angles for a simulated person (from a SimPerson frame), so the demo can wear sensors.
 * faults.round: the lower back rounds instead of hinging at the hips.
 */
export function simSegmentAngles(frame, view, faults = {}) {
  const f = makeFrame(frame.lm, frame.world, frame.aspect, 0);
  const sh = shoulderMid(f), hp = hipMid(f);
  if (view === 'front') {
    const side = lateralTilt(f);
    return { upper: { flex: 0, side }, lower: { flex: 0, side: side * 0.25 } };
  }
  // Side view: the simulated person faces image-right, so shoulders ahead of hips = forward flexion.
  const flex = trunkTilt(f) * (Math.sign(sh.x - hp.x) || 1);
  const standing = Math.abs(flex) < 70;
  const pelvisShare = standing ? (faults.round ? 0.3 : 0.7) : 1;
  return { upper: { flex, side: 0 }, lower: { flex: flex * pelvisShare + (faults.arch && !standing ? 14 : 0), side: 0 } };
}
