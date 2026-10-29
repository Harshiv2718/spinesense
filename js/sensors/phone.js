// A phone as a stand-in back sensor. The phone records its own tilt to a file; the Recordings page
// later merges that file into a camera clip. Browsers only share motion sensors with https pages,
// and an https page can't reach the computer's local server, so the phone records on its own and
// the two are lined up afterwards: first by both devices' clocks, then by the movement itself.
//
// File (spinesense-phone.v1):
//   { schema, app, createdAt, platform, anchor: { perfMs, epochMs }, anchorEnd, accelSign,
//     cal: AxisCalibration JSON, calibratedAtMs, gaps: [[t_ms, ms]], columns, rows: [[t_ms, qw..qz, ax..az]] }
// t_ms is the phone's own monotonic clock (performance.now()); anchor maps it to wall-clock time.
//
// While it records, the phone page keeps a snapshot (phoneSnapshot) in IndexedDB, so a page that
// closes or crashes loses a few seconds at most; unsentRecording() turns it back into the same file.

import { Calibrator } from './hub.js';
import { AxisCalibration } from './posture.js';
import { qrotate, qconj, angle3 } from './quat.js';
import { VERSION } from '../version.js';

export const PHONE_SCHEMA = 'spinesense-phone.v1';
export const PHONE_COLUMNS = ['t_ms', 'qw', 'qx', 'qy', 'qz', 'ax_g', 'ay_g', 'az_g'];
export const PHONE_MAX_MINUTES = 20;

const G = 9.80665;
const MIN_INTERVAL = 14; // ms: keep at most ~70 samples a second
const GAP = 500; // ms without samples counts as a gap (screen off, page hidden)
const SIGN_SAMPLES = 30;
const ROWS = '\u0000rows'; // stands in for the rows while toText() writes the rest of the file
const r = (v, k = 4) => +v.toFixed(k);

export class PhoneRecorder extends EventTarget {
  constructor({ app = { name: 'SpineSense', version: VERSION }, platform = 'unknown' } = {}) {
    super();
    this.app = app;
    this.platform = platform;
    this.state = 'idle'; // idle -> recording -> stopped
    this.rows = [];
    this.gaps = [];
    this.anchor = null;
    this.anchorEnd = null;
    // Some browsers report acceleration pointing down instead of up; decided from the first samples.
    this.accelSign = null;
    this.signVotes = [];
    this.signVotesNoQ = 0;
    this.device = { role: 'upper', history: [] }; // what the hub's Calibrator expects
    this.calibrator = null;
    this.cal = null;
    this.calibratedAtMs = null;
    this.latest = null;
    this.lastT = null;
  }

  start({ perfMs, epochMs }) {
    Object.assign(this, { state: 'recording', rows: [], gaps: [], anchor: { perfMs: r(perfMs, 1), epochMs }, anchorEnd: null, lastT: null });
    this.emit('change');
  }

  /** tMs: phone clock (ms); q: device->earth quaternion or null; a: accelerationIncludingGravity in m/s². */
  add({ tMs, q, a }) {
    if (this.lastT != null && tMs - this.lastT < MIN_INTERVAL) return;
    if (this.lastT != null && tMs - this.lastT > GAP && this.state === 'recording') this.gaps.push([r(this.lastT, 1), Math.round(tMs - this.lastT)]);
    this.lastT = tMs;
    if (this.accelSign == null) this.voteSign(q, a);
    const sign = this.accelSign ?? 1;
    const s = { rx: tMs / 1000, q: q ?? [0, 0, 0, 0], a: a.map((v) => (sign * v) / G) };
    this.latest = s;
    const h = this.device.history;
    h.push(s);
    while (h.length && s.rx - h[0].rx > 3) h.shift();
    if (this.calibrator && this.calibrator.step !== 'done') this.calibrator.feed(this.device, s);
    if (this.state === 'recording') {
      this.rows.push([r(tMs, 1), ...s.q.map((v) => r(v)), ...s.a.map((v) => r(v))]);
      if (tMs - this.anchor.perfMs > PHONE_MAX_MINUTES * 60e3) this.emit('limit');
    }
  }

  voteSign(q, a) {
    if (!q) {
      if (++this.signVotesNoQ >= SIGN_SAMPLES * 2) this.setSign(1);
      return;
    }
    this.signVotes.push(angle3(qrotate(qconj(q), [0, 0, 1]), a));
    if (this.signVotes.length >= SIGN_SAMPLES) {
      const mean = this.signVotes.reduce((s, x) => s + x, 0) / this.signVotes.length;
      this.setSign(mean > 90 ? -1 : 1);
    }
  }

  setSign(sign) {
    this.accelSign = sign;
    if (sign === -1) {
      for (const row of this.rows) for (let i = 5; i < 8; i++) row[i] = -row[i];
      for (const s of this.device.history) s.a = s.a.map((v) => -v);
    }
  }

  /** Runs the same stand-still / bend-forward / bend-right wizard as the Sensors page. */
  calibrate() {
    this.calibrator = new Calibrator(null, [this.device]);
    this.calibrator.addEventListener('change', () => this.emit('calibration'));
    this.calibrator.addEventListener('done', () => {
      this.cal = this.calibrator.states[0].cal;
      this.calibratedAtMs = this.lastT;
      this.emit('calibration');
    });
    this.emit('calibration');
    return this.calibrator;
  }

  /** Live angles for the display: forward and side bend once calibrated, else tilt from flat. */
  angles() {
    if (!this.latest) return null;
    if (this.cal?.ready) return { calibrated: true, ...this.cal.angles(this.latest) };
    return { calibrated: false, tilt: angle3(this.latest.a, [0, 0, 1]) };
  }

  get durationS() {
    return this.rows.length > 1 ? (this.rows[this.rows.length - 1][0] - this.rows[0][0]) / 1000 : 0;
  }

  get rateHz() {
    return this.durationS ? Math.round((this.rows.length - 1) / this.durationS) : 0;
  }

  stop({ perfMs, epochMs }) {
    if (this.state !== 'recording') return;
    this.state = 'stopped';
    this.anchorEnd = { perfMs: r(perfMs, 1), epochMs };
    if (this.calibrator && this.calibrator.step !== 'done') this.calibrator = null;
    this.emit('change');
  }

  toJSON() {
    return {
      schema: PHONE_SCHEMA,
      app: this.app,
      createdAt: new Date(this.anchor.epochMs).toISOString(),
      platform: this.platform,
      anchor: this.anchor,
      anchorEnd: this.anchorEnd,
      accelSign: this.accelSign ?? 1,
      cal: this.cal?.ready ? this.cal.toJSON() : null,
      calibratedAtMs: this.calibratedAtMs != null ? r(this.calibratedAtMs, 1) : null,
      gaps: this.gaps,
      columns: PHONE_COLUMNS,
      rows: this.rows,
    };
  }

  /**
   * The file as text: exactly JSON.stringify(this.toJSON()), but rows already written are kept, so
   * saving a long recording every few seconds only serialises the new samples.
   */
  toText() {
    let c = this.textCache;
    // setSign() rewrites the stored rows, and start() replaces them: then everything is written again.
    if (!c || c.rows !== this.rows || c.sign !== this.accelSign || c.n > this.rows.length) {
      c = this.textCache = { rows: this.rows, sign: this.accelSign, n: 0, text: '' };
    }
    if (c.n < this.rows.length) {
      const more = JSON.stringify(this.rows.slice(c.n)).slice(1, -1);
      c.text = c.n ? `${c.text},${more}` : more;
      c.n = this.rows.length;
    }
    const head = JSON.stringify(this.toJSON(), (k, v) => (v === this.rows ? ROWS : v));
    return head.replace(JSON.stringify(ROWS), () => `[${c.text}]`);
  }

  /**
   * A stopped recorder holding a recording from toJSON(), e.g. one kept on the phone after the page
   * closed. Its toJSON() and toText() give back the same file.
   */
  static fromJSON(json) {
    if (json?.schema !== PHONE_SCHEMA || !json.anchor || !Array.isArray(json.rows)) throw new Error('Not a SpineSense phone recording');
    const rec = new PhoneRecorder({ app: json.app, platform: json.platform });
    const last = json.rows[json.rows.length - 1];
    Object.assign(rec, {
      state: 'stopped', // a reloaded page has a new clock, so the recording can't carry on
      rows: json.rows,
      gaps: json.gaps ?? [],
      anchor: json.anchor,
      anchorEnd: json.anchorEnd ?? null,
      accelSign: json.accelSign ?? 1,
      cal: json.cal ? new AxisCalibration(json.cal) : null,
      calibratedAtMs: json.calibratedAtMs ?? null,
      lastT: last ? last[0] : null,
    });
    return rec;
  }

  emit(type) {
    this.dispatchEvent(new Event(type));
  }
}

/** What the phone page keeps in IndexedDB while it records: the file text and whether it was sent. */
export function phoneSnapshot(rec, { sent = false, savedAt = Date.now() } = {}) {
  return { text: rec.toText(), stopped: rec.state === 'stopped', sent: !!sent, savedAt };
}

/** The recording in a saved snapshot if it is worth offering (calibrated, not yet sent or downloaded), else null. */
export function unsentRecording(snapshot) {
  if (!snapshot || snapshot.sent || typeof snapshot.text !== 'string') return null;
  try {
    const rec = PhoneRecorder.fromJSON(JSON.parse(snapshot.text));
    return rec.cal?.ready ? rec : null;
  } catch {
    return null;
  }
}
