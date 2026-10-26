// Sensor hub: keeps track of connected motion sensors and their roles, runs the calibration
// wizard, and turns the latest samples into trunk, pelvis and lumbar angles.

import { AxisCalibration, spread } from './posture.js';

const CAL_KEY = 'spinesense.sensorcal';
const CAL_HOURS = 12; // straps move between days, so calibrations expire
const FRESH = 0.35; // s: older samples are treated as lost
const HISTORY = 3; // s of samples kept per device

function loadCals() {
  try {
    return JSON.parse(globalThis.localStorage?.getItem(CAL_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function storeCal(key, cal) {
  try {
    const all = loadCals();
    all[key] = cal.toJSON();
    globalThis.localStorage?.setItem(CAL_KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable */
  }
}

function restoreCal(key) {
  const c = loadCals()[key];
  if (!c?.at || Date.now() - c.at > CAL_HOURS * 3600e3) return null;
  return new AxisCalibration(c);
}

export class SensorHub extends EventTarget {
  constructor({ clock } = {}) {
    super();
    this.devices = new Map();
    this.clock = clock ?? (() => performance.now() / 1000);
    this.calibrator = null;
    this.recording = null;
  }

  changed() {
    this.dispatchEvent(new Event('change'));
  }

  /** Register a driver (BleSensor or SimSensor) and connect it. */
  async add(driver) {
    const d = { id: driver.id, name: driver.name, role: driver.role ?? 'unknown', driver, simulated: !!driver.simulated, status: 'connecting', battery: null, info: null, last: null, history: [], cal: null };
    d.cal = restoreCal(`${d.id}:${d.role}`);
    driver.addEventListener('sample', (e) => this.onSample(d, e.detail));
    driver.addEventListener('status', (e) => {
      d.status = e.detail;
      this.changed();
    });
    driver.addEventListener('battery', (e) => {
      d.battery = e.detail;
      this.changed();
    });
    driver.addEventListener('info', (e) => {
      d.info = e.detail;
      if (d.role === 'unknown' && e.detail.role && e.detail.role !== 'unknown') this.setRole(d.id, e.detail.role, { sendToDevice: false });
      this.changed();
    });
    this.devices.set(d.id, d);
    this.changed();
    try {
      await driver.connect();
    } catch (err) {
      d.status = 'error';
      this.changed();
      throw err;
    }
    return d;
  }

  onSample(d, s) {
    s.rx ??= this.clock();
    d.last = s;
    d.history.push(s);
    while (d.history.length && s.rx - d.history[0].rx > HISTORY) d.history.shift();
    this.calibrator?.feed(d, s);
    if (this.recording) this.recording.rows.push([d.role, +s.rx.toFixed(3), s.t, ...s.q.map((v) => +v.toFixed(4)), ...s.a.map((v) => +v.toFixed(3))]);
    this.dispatchEvent(new CustomEvent('sample', { detail: { device: d, sample: s } }));
  }

  get list() {
    return [...this.devices.values()];
  }

  byRole(role) {
    return this.list.find((d) => d.role === role && d.status === 'connected');
  }

  rate(d) {
    const h = d.history;
    return h.length > 1 ? Math.round((h.length - 1) / Math.max(1e-3, h[h.length - 1].rx - h[0].rx)) : 0;
  }

  async setRole(id, role, { sendToDevice = true } = {}) {
    const d = this.devices.get(id);
    if (!d) return;
    // Only one sensor per body position.
    for (const other of this.list) if (other !== d && other.role === role && role !== 'other') other.role = 'unknown';
    d.role = role;
    d.cal = restoreCal(`${d.id}:${role}`);
    if (sendToDevice) await d.driver.setRole?.(role);
    this.changed();
  }

  remove(id) {
    const d = this.devices.get(id);
    if (!d) return;
    d.driver.disconnect();
    this.devices.delete(id);
    this.changed();
  }

  get calibrated() {
    const up = this.byRole('upper');
    return !!up?.cal?.ready && (!this.byRole('lower') || !!this.byRole('lower').cal?.ready);
  }

  /** Latest angles. ok=false when there's no fresh, calibrated upper sensor. */
  snapshot(now = this.clock()) {
    const up = this.byRole('upper');
    const lo = this.byRole('lower');
    const fresh = (d) => d?.last && now - d.last.rx < FRESH && d.cal?.ready;
    if (!fresh(up)) return { ok: false, mode: up || lo ? (up?.cal?.ready ? 'lost' : 'uncalibrated') : 'none' };
    const ua = up.cal.angles(up.last);
    const trunk = { ...ua, u: up.cal.up(up.last) };
    let pelvis = null;
    let lumbar = null;
    if (fresh(lo)) {
      pelvis = lo.cal.angles(lo.last);
      lumbar = { flex: ua.flex - pelvis.flex, side: ua.side - pelvis.side };
    }
    return { ok: true, mode: lumbar ? 'dual' : 'single', trunk, pelvis, lumbar, t: now };
  }

  /** Start the 3-step calibration for every connected sensor with a body role. */
  calibrate() {
    const devices = this.list.filter((d) => d.status === 'connected' && (d.role === 'upper' || d.role === 'lower'));
    if (!devices.some((d) => d.role === 'upper')) throw new Error('Assign one sensor to the upper back first');
    this.calibrator = new Calibrator(this, devices);
    this.calibrator.addEventListener('done', () => {
      for (const st of this.calibrator.states) {
        st.device.cal = st.cal;
        storeCal(`${st.device.id}:${st.device.role}`, st.cal);
      }
      this.calibrator = null;
      this.changed();
    });
    return this.calibrator;
  }

  startRecording() {
    this.recording = { started: new Date().toISOString(), columns: ['role', 'rx_s', 'device_ms', 'qw', 'qx', 'qy', 'qz', 'ax_g', 'ay_g', 'az_g'], rows: [] };
  }

  stopRecording() {
    const r = this.recording;
    this.recording = null;
    return r;
  }
}

/** Calibration wizard: stand still -> bend forward and back -> bend right and back. */
export class Calibrator extends EventTarget {
  constructor(hub, devices) {
    super();
    this.hub = hub;
    this.step = 'neutral';
    this.progress = 0;
    this.stillSince = null;
    this.states = devices.map((device) => ({ device, cal: new AxisCalibration(), still: [], peak: null, peakDev: 0, reached: false, back: false }));
  }

  get message() {
    return {
      neutral: 'Stand tall and still with your arms by your sides',
      flex: 'Slowly bend forward as far as is comfortable, then stand back up',
      side: 'Slide your right hand down the side of your right leg, then come back up',
      done: 'Calibrated',
    }[this.step];
  }

  emitChange() {
    this.dispatchEvent(new Event('change'));
  }

  need(st) {
    if (this.step === 'flex') return st.device.role === 'upper' ? 20 : 6;
    return st.device.role === 'upper' ? 8 : 2;
  }

  feed(device, sample) {
    const st = this.states.find((x) => x.device === device);
    if (!st || this.step === 'done') return;
    if (this.step === 'neutral') {
      const recent = device.history.filter((s) => sample.rx - s.rx <= 0.8);
      const steady = (d) => d.history.length > 10 && d.history[d.history.length - 1].rx - d.history[0].rx > 0.7 && spread(d.history.filter((s) => d.history[d.history.length - 1].rx - s.rx <= 0.8)) < 2.5;
      if (recent.length > 10 && this.states.every((x) => steady(x.device))) {
        this.stillSince ??= sample.rx;
        st.still.push(sample);
      } else {
        this.stillSince = null;
        this.states.forEach((x) => (x.still = []));
      }
      this.progress = this.stillSince == null ? 0 : Math.min(1, (sample.rx - this.stillSince) / 2);
      if (this.progress >= 1 && this.states.every((x) => x.still.length >= 10)) {
        this.states.forEach((x) => x.cal.setNeutral(x.still));
        this.goto('flex');
      } else this.emitChange();
      return;
    }
    // flex / side: start from upright, track the deepest point, then wait for the return to upright
    const dev = st.cal.deviation(sample);
    const upright = dev < (st.device.role === 'upper' ? 5 : 3);
    if (!st.armed) {
      if (upright) st.armed = true;
      else return this.emitChange();
    }
    if (dev > st.peakDev) {
      st.peakDev = dev;
      st.peak = sample;
    }
    if (st.peakDev >= this.need(st)) st.reached = true;
    if (st.reached && upright) st.back = true;
    const upper = this.states.find((x) => x.device.role === 'upper');
    this.progress = Math.min(1, upper.peakDev / this.need(upper)) * (upper.back ? 1 : 0.9);
    if (upper.back) {
      // The pelvis moves less; accept whatever it did as long as it moved at all.
      const ok = this.states.every((x) => x.reached || (x.device.role !== 'upper' && x.peakDev >= 2));
      if (!ok) {
        this.error = 'The lower sensor barely moved. Check it sits flat on your sacrum, then try again.';
        this.restartStep();
        return;
      }
      if (this.step === 'flex') {
        this.states.forEach((x) => x.cal.setFlexion(x.peak));
        this.goto('side');
      } else {
        this.states.forEach((x) => x.cal.setSide(x.peak));
        this.finish();
      }
      return;
    }
    this.emitChange();
  }

  restartStep() {
    this.states.forEach((x) => Object.assign(x, { peak: null, peakDev: 0, reached: false, back: false, armed: false }));
    this.emitChange();
  }

  goto(step) {
    this.step = step;
    this.progress = 0;
    this.error = null;
    this.restartStep();
  }

  skipSide() {
    if (this.step === 'side') this.finish();
  }

  finish() {
    this.step = 'done';
    this.progress = 1;
    this.emitChange();
    this.dispatchEvent(new Event('done'));
  }

  cancel() {
    this.hub.calibrator = null;
    this.step = 'done';
    this.dispatchEvent(new Event('cancel'));
  }
}

/** The app-wide hub: connections survive page changes inside the app. */
export const hub = new SensorHub();
