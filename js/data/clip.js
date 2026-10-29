// Training clips, schema clip.v1: everything needed to re-run SpineSense's measurements offline
// and to compare the camera with the back sensors. No video, ever.
//
// {
//   schema: 'clip.v1', id, createdAt, app, simulated,
//   consent: { version, at },                     // the user's recording consent at the time
//   capture: { source, tasksVersion, poseModel, poseDelegate, aspect, videoSize },
//   clock: { perfS, epochMs },                   // the same moment on both clocks, for lining up other devices
//   plan: ['hip-hinge@1', ...],
//   frames: { columns: [...], rows: [[tCap, tProc, ex, level, phase, rep, state], ...] },
//   lm: [Float32Array(33*4)],  world: [Float32Array(33*3) | null]   // raw model output, unfiltered
//   sensors: [{ id, role, source?, simulated, info, cal, clock, sync? }],   // source 'phone' when merged from a phone
//   sensorRaw: { columns: [...], rows: [[role, rx_s, device_ms, tl_s, qw..qz, ax..az], ...] },
//   events: [{ t, ex, type, ... }],
//   results: [...]                                // per-exercise summaries from the session
// }

import { VERSION } from '../version.js';

export const CLIP_SCHEMA = 'clip.v1';
export const CLIP_MAX_SECONDS = 600;
export const FRAME_COLUMNS = ['tCap_s', 'tProc_s', 'exercise', 'level', 'phase', 'rep', 'repState'];

const r = (v, k = 4) => (v == null ? null : +v.toFixed(k));

export class ClipRecorder {
  constructor({ capture, consent, plan, app = { name: 'SpineSense', version: VERSION }, simulated = false } = {}) {
    this.clip = {
      schema: CLIP_SCHEMA,
      id: `clip-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
      app,
      simulated,
      consent: consent ?? null,
      capture: capture ?? {},
      // Frame times use the performance clock; this ties it to wall-clock time so a phone recording can be lined up.
      clock: { perfS: r(performance.now() / 1000), epochMs: Date.now() },
      plan: plan ?? [],
      frames: { columns: FRAME_COLUMNS, rows: [] },
      lm: [],
      world: [],
      sensors: [],
      sensorRaw: null,
      events: [],
      results: [],
    };
    this.t0 = null;
  }

  get full() {
    const rows = this.clip.frames.rows;
    return rows.length > 1 && rows[rows.length - 1][0] - rows[0][0] >= CLIP_MAX_SECONDS;
  }

  /** fr: a tracker frame ({ t, tCapture, raw }), ctx: what the engine was doing. */
  addFrame(fr, ctx = {}) {
    if (!fr?.raw?.lm || this.full) return false;
    const tCap = fr.tCapture ?? fr.t;
    this.t0 ??= tCap;
    this.clip.frames.rows.push([r(tCap), r(fr.t), ctx.ex ?? null, ctx.level ?? null, ctx.phase ?? null, ctx.rep ?? null, ctx.state ?? null]);
    const lm = new Float32Array(33 * 4);
    fr.raw.lm.forEach((p, i) => lm.set([p.x, p.y, p.z ?? 0, p.visibility ?? 1], i * 4));
    this.clip.lm.push(lm);
    if (fr.raw.world) {
      const w = new Float32Array(33 * 3);
      fr.raw.world.forEach((p, i) => w.set([p.x, p.y, p.z ?? 0], i * 3));
      this.clip.world.push(w);
    } else this.clip.world.push(null);
    return true;
  }

  addEvent(t, ex, ev) {
    const { type, rep, ...rest } = ev;
    const slim = { t: r(t), ex, type };
    if (rep) Object.assign(slim, { peak: r(rep.peak, 2), dur: r(rep.duration, 3), limb: rep.limb, issues: rep.issues });
    for (const [k, v] of Object.entries(rest)) if (typeof v !== 'object' || v === null) slim[k] = typeof v === 'number' ? r(v, 3) : v;
    this.clip.events.push(slim);
  }

  /** sensors: hub devices; sensorRaw: hub.stopRecording(); results: session summaries. */
  finish({ sensors = [], sensorRaw = null, results = [] } = {}) {
    this.clip.sensors = sensors.map((d) => ({
      id: d.id,
      role: d.role,
      simulated: !!d.simulated,
      info: d.info ?? null,
      cal: d.cal?.toJSON?.() ?? null,
      clock: d.clock?.toJSON?.() ?? null,
    }));
    this.clip.sensorRaw = sensorRaw;
    this.clip.results = results;
    this.clip.finishedAt = new Date().toISOString();
    return this.clip;
  }
}

/** A short description for lists, without the bulky arrays. */
export function summarize(clip) {
  const rows = clip.frames.rows;
  const exercises = [...new Set(rows.map((x) => x[2]).filter(Boolean))];
  const sensorRoles = (clip.sensors ?? []).filter((s) => s.cal).map((s) => (s.source === 'phone' ? 'phone' : s.role));
  return {
    id: clip.id,
    createdAt: clip.createdAt,
    simulated: !!clip.simulated,
    durationS: rows.length > 1 ? +(rows[rows.length - 1][0] - rows[0][0]).toFixed(1) : 0,
    frames: rows.length,
    exercises,
    sensors: sensorRoles,
    sensorSamples: clip.sensorRaw?.rows?.length ?? 0,
    bytes: rows.length * (33 * 4 + 33 * 3) * 4 + (clip.sensorRaw?.rows?.length ?? 0) * 11 * 8,
  };
}

const PAIN_KEYS = ['painRating', 'legSymptoms', 'feel', 'stoppedEarly', 'rating', 'leg'];
const strip = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => !PAIN_KEYS.includes(k)));

/**
 * Plain-JSON form for download and offline tools (typed arrays become rounded number arrays).
 * share: leave out pain and leg-symptom answers, for a copy that leaves this device.
 */
export function clipToJSON(clip, { share = false } = {}) {
  return {
    ...clip,
    ...(share ? {
      // Each result's events are check-in records and levelChanges show a mid-exercise drop: both reveal pain.
      results: (clip.results ?? []).map(({ events, levelChanges, ...r }) => strip(r)),
      events: (clip.events ?? []).filter((e) => !e.type?.startsWith('pain')).map(strip),
      shared: true,
    } : {}),
    lm: clip.lm.map((a) => Array.from(a, (v) => +v.toFixed(5))),
    world: clip.world.map((a) => (a ? Array.from(a, (v) => +v.toFixed(5)) : null)),
  };
}

/** Accepts either the stored form or the downloaded JSON form; returns typed arrays. */
export function clipFromJSON(obj) {
  if (obj?.schema !== CLIP_SCHEMA) throw new Error(`Not a ${CLIP_SCHEMA} file`);
  return {
    ...obj,
    lm: obj.lm.map((a) => (a instanceof Float32Array ? a : Float32Array.from(a))),
    world: obj.world.map((a) => (a == null ? null : a instanceof Float32Array ? a : Float32Array.from(a))),
  };
}

/** Landmarks of frame i as MediaPipe-style objects. */
export function frameLandmarks(clip, i) {
  const a = clip.lm[i];
  const lm = [];
  for (let j = 0; j < 33; j++) lm.push({ x: a[j * 4], y: a[j * 4 + 1], z: a[j * 4 + 2], visibility: a[j * 4 + 3] });
  const w = clip.world[i];
  const world = w ? Array.from({ length: 33 }, (_, j) => ({ x: w[j * 3], y: w[j * 3 + 1], z: w[j * 3 + 2] })) : null;
  return { lm, world };
}
