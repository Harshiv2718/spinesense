// Runs one exercise: position check → baseline capture → rep/hold counting + form rules.
// Pure logic (no DOM), so it is unit-tested with synthetic poses.

import { facingSide, allVisible, std } from './geometry.js';

const SETUP_HOLD = 1.2; // s of steady, correct start position before counting begins
const FORM_PERSIST = 0.7; // s a fault must last before it becomes a cue (webcam angles are noisy)
const GOOD_VIS = 0.6; // landmark visibility counted as reliable tracking
const LOST_GRACE = 0.8; // s of missing landmarks before we say "can't see you"
const TEMPO_CUE = 'Slow it down — smooth and controlled';

/** The back-sensor readings kept as a baseline (see js/sensors/hub.js snapshot()). */
function sensorPoint(sn) {
  const p = { trunkFlex: sn.trunk.flex, trunkSide: sn.trunk.side, ux: sn.trunk.u[0], uy: sn.trunk.u[1], uz: sn.trunk.u[2], dual: sn.lumbar ? 1 : 0 };
  if (sn.lumbar) Object.assign(p, { lumbarFlex: sn.lumbar.flex, lumbarSide: sn.lumbar.side });
  return p;
}

function averageObjects(list) {
  const out = {};
  for (const k of Object.keys(list[0])) out[k] = list.reduce((a, o) => a + o[k], 0) / list.length;
  return out;
}

export class ExerciseRun {
  constructor(spec, levelIdx = 0, { repScale = 1 } = {}) {
    this.spec = spec;
    this.repScale = repScale;
    this.setLevel(levelIdx);
    this.phase = 'position'; // position → active → complete
    this.side = 'left';
    this.base = null;
    this.samples = [];
    this.sensorSamples = [];
    this.sbase = null;
    this.sensorPeak = { trunk: null, lumbar: null };
    this.stableFor = 0;
    this.lostFor = 0;
    this.lastT = null;
    this.repState = 'rest'; // rest → moving → (holding → release) → rest
    this.cur = null;
    this.reps = [];
    this.aborts = 0;
    this.holdBreaks = 0;
    this.formCounts = {};
    this.formSince = {};
    this.targetScale = 1;
    this.holdWindow = [];
    this.lastTick = null;
    this.switchCued = false;
    this.levelChanges = [];
    this.activeFrames = 0;
    this.goodFrames = 0;
  }

  setLevel(idx) {
    this.levelIdx = idx;
    this.level = this.spec.levels[idx];
    this.targetReps = Math.max(1, Math.round(this.level.reps * this.repScale));
  }

  get target() {
    return this.level.target * this.targetScale;
  }

  get holdTarget() {
    return this.level.hold ?? 0;
  }

  bySide() {
    const c = { left: 0, right: 0 };
    for (const r of this.reps) if (r.limb) c[r.limb]++;
    return c;
  }

  get done() {
    if (this.spec.alternating) {
      const c = this.bySide();
      return c.left >= this.targetReps && c.right >= this.targetReps;
    }
    return this.reps.length >= this.targetReps;
  }

  /** Discomfort response: shrink the range we ask for (floor at 60%). */
  easeOff() {
    this.targetScale = Math.max(0.6, this.targetScale * 0.85);
  }

  /** Drop to an easier level mid-exercise. Returns false if already at the easiest. */
  regress() {
    if (this.levelIdx === 0) return false;
    this.levelChanges.push({ from: this.levelIdx, to: this.levelIdx - 1 });
    this.setLevel(this.levelIdx - 1);
    this.targetScale = 1;
    return true;
  }

  update(f) {
    const events = [];
    const dt = this.lastT === null ? 0 : Math.min(0.2, Math.max(0, f.t - this.lastT));
    this.lastT = f.t;
    const spec = this.spec;
    const out = (extra) => ({
      phase: this.phase,
      side: this.side,
      reps: this.reps.length,
      targetReps: this.targetReps,
      bySide: this.bySide(),
      target: this.target,
      holdTarget: this.holdTarget,
      holdSec: this.cur?.holdSec ?? 0,
      repState: this.repState,
      issues: Object.keys(this.formSince).filter((k) => this.formSince[k] != null && f.t - this.formSince[k] >= FORM_PERSIST),
      events,
      tracking: true,
      value: 0,
      progress: 0,
      jitter: 0,
      message: '',
      ...extra,
    });

    if (this.phase === 'complete') return out({ message: 'Exercise complete' });

    if (this.phase === 'position') {
      if (spec.view === 'side') this.side = facingSide(f);
      if (!allVisible(f, spec.required(this.side), 0.5)) {
        this.stableFor = 0;
        this.samples = [];
        this.sensorSamples = [];
        return out({ message: 'Step back so your whole body is in view', tracking: false });
      }
      const s = spec.setup(f, this.side);
      if (!s.ok) {
        this.stableFor = 0;
        this.samples = [];
        this.sensorSamples = [];
        return out({ message: s.msg });
      }
      this.stableFor += dt;
      this.samples.push(spec.baseline(f, this.side));
      if (f.sensors?.ok) this.sensorSamples.push(sensorPoint(f.sensors));
      if (this.stableFor < SETUP_HOLD) return out({ message: 'Good — hold still…', settling: this.stableFor / SETUP_HOLD });
      this.base = averageObjects(this.samples);
      this.sbase = this.sensorBaseline();
      this.phase = 'active';
      events.push({ type: 'ready' });
      return out({ message: 'Begin' });
    }

    // ---- active ----
    if (!allVisible(f, spec.required(this.side), 0.4)) {
      this.lostFor += dt;
      if (this.lostFor > LOST_GRACE) return out({ message: 'I can\'t see you fully — step back into view', tracking: false });
    } else {
      this.lostFor = 0;
    }

    this.activeFrames++;
    if (allVisible(f, spec.required(this.side), GOOD_VIS)) this.goodFrames++;
    // The back sensor (when calibrated and fresh) is more accurate than the camera for trunk angles.
    const sn = f.sensors?.ok && this.sbase ? f.sensors : null;
    let m = spec.metric(f, this.side, this.base, this.level);
    if (sn && spec.sensorMetric) m = { ...m, ...spec.sensorMetric(sn, this.sbase, this.level), camera: m.value };
    if (sn) this.trackSensorPeaks(sn);
    const value = m.value;
    const T = this.target;
    const rest = (spec.rest ?? 0.3) * T;
    const start = (spec.start ?? 0.45) * T;
    const t = f.t;

    const finish = () => {
      const c = this.cur;
      const duration = t - c.start;
      if (c.reached) {
        const minRep = this.level.minRepSec ?? spec.minRepSec;
        if (spec.kind === 'reps' && minRep && duration < minRep) {
          c.issues.add('tempo');
          this.formCounts.tempo = (this.formCounts.tempo ?? 0) + 1;
          events.push({ type: 'form', id: 'tempo', cue: TEMPO_CUE });
        }
        const rep = { t: c.start, duration, peak: c.peak, limb: c.limb ?? null, issues: [...c.issues], holdSec: c.holdSec ?? 0 };
        this.reps.push(rep);
        events.push({ type: 'rep', rep, count: this.reps.length });
        if (spec.alternating && !this.switchCued) {
          const bs = this.bySide();
          if (rep.limb && bs[rep.limb] >= this.targetReps && bs[rep.limb === 'left' ? 'right' : 'left'] < this.targetReps) {
            this.switchCued = true;
            events.push({ type: 'switch-side' });
          }
        }
      } else {
        this.aborts++;
        events.push({ type: 'abort', peak: c.peak, duration });
      }
      this.cur = null;
      this.repState = 'rest';
      this.holdWindow = [];
      if (this.done) {
        this.phase = 'complete';
        events.push({ type: 'complete' });
      }
    };

    switch (this.repState) {
      case 'rest':
        // A rep's clock starts when you leave the rest zone, not when you cross the start line.
        if (value <= rest || this.lastRestT == null) this.lastRestT = t;
        if (value > start) {
          this.repState = 'moving';
          this.cur = { start: this.lastRestT, peak: value, limb: m.limb, issues: new Set(), reached: false, holdSec: 0 };
          events.push({ type: 'rep-start' });
        }
        break;
      case 'moving':
        if (value > this.cur.peak) {
          this.cur.peak = value;
          if (m.limb) this.cur.limb = m.limb;
        }
        if (spec.kind === 'hold') {
          if (value >= 0.9 * T) {
            this.repState = 'holding';
            this.lastTick = null;
            events.push({ type: 'hold-start' });
          } else if (value < rest) finish();
        } else {
          if (value >= 0.92 * T && !this.cur.reached) {
            this.cur.reached = true;
            events.push({ type: 'top' });
          }
          if (value < rest) finish();
        }
        break;
      case 'holding': {
        const c = this.cur;
        c.peak = Math.max(c.peak, value);
        if (value >= 0.7 * T) {
          c.holdSec += dt;
          c.lowFor = 0;
        } else {
          c.lowFor = (c.lowFor ?? 0) + dt;
          if (c.lowFor > 0.8) {
            this.holdBreaks++;
            events.push({ type: 'hold-break', held: c.holdSec });
            this.repState = 'moving';
            if (value < rest) finish();
            break;
          }
        }
        this.holdWindow.push({ t, v: value });
        while (this.holdWindow.length && t - this.holdWindow[0].t > 1) this.holdWindow.shift();
        const remaining = Math.ceil(this.holdTarget - c.holdSec);
        if (remaining !== this.lastTick && remaining > 0) {
          this.lastTick = remaining;
          events.push({ type: 'hold-tick', remaining });
        }
        if (c.holdSec >= this.holdTarget) {
          c.reached = true;
          this.repState = 'release';
          events.push({ type: 'hold-done' });
        }
        break;
      }
      case 'release':
        if (value < rest) finish();
        break;
    }

    // Form rules only matter while moving.
    if (this.repState !== 'rest' && this.cur) {
      const ctx = { value, target: T, m, level: this.level };
      const checks = spec.form.map((rule) => [rule, (rule.active === 'top' ? value >= 0.85 * T : true) && rule.test(f, this.side, this.base, ctx)]);
      // Sensor rules catch what the camera can't see, e.g. a rounding lower back during a hip hinge.
      if (sn) {
        for (const rule of spec.sensorForm ?? []) {
          if (rule.needs === 'dual' && (sn.mode !== 'dual' || this.sbase.mode !== 'dual')) continue;
          checks.push([rule, rule.test(sn, this.sbase, ctx)]);
        }
      }
      for (const [rule, bad] of checks) {
        if (!bad) {
          this.formSince[rule.id] = null;
          continue;
        }
        this.formSince[rule.id] ??= t;
        if (t - this.formSince[rule.id] >= FORM_PERSIST && !this.cur.issues.has(rule.id)) {
          this.cur.issues.add(rule.id);
          this.formCounts[rule.id] = (this.formCounts[rule.id] ?? 0) + 1;
          events.push({ type: 'form', id: rule.id, cue: rule.cue, guarding: !!rule.guarding });
        }
      }
    } else {
      this.formSince = {};
    }

    const jitter = this.repState === 'holding' && this.holdWindow.length > 10 ? std(this.holdWindow.map((s) => s.v)) : 0;
    return out({ value, progress: Math.min(1.2, value / T), jitter, message: '' });
  }

  sensorBaseline() {
    // Use the sensor only if it was there for most of the setup hold, in one consistent mode.
    if (this.sensorSamples.length < 0.7 * this.samples.length || !this.sensorSamples.length) return null;
    const mode = this.sensorSamples[this.sensorSamples.length - 1].dual;
    const sb = averageObjects(this.sensorSamples.filter((p) => p.dual === mode));
    const n = Math.hypot(sb.ux, sb.uy, sb.uz) || 1;
    sb.u = [sb.ux / n, sb.uy / n, sb.uz / n];
    sb.mode = mode ? 'dual' : 'single';
    return sb;
  }

  trackSensorPeaks(sn) {
    const p = this.sensorPeak;
    const trunk = sn.trunk.flex - this.sbase.trunkFlex;
    p.trunk = p.trunk == null ? trunk : Math.max(p.trunk, trunk);
    if (sn.lumbar && this.sbase.mode === 'dual') {
      const lumbar = sn.lumbar.flex - this.sbase.lumbarFlex;
      p.lumbar = p.lumbar == null ? lumbar : Math.max(p.lumbar, lumbar);
    }
  }

  summary() {
    const reps = this.reps;
    const scores = reps.map((r) => Math.max(0, 100 - 25 * r.issues.length));
    const peaks = reps.map((r) => r.peak);
    const side = (s) => reps.filter((r) => r.limb === s).map((r) => r.peak);
    const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
    let asymmetry = null;
    if (this.spec.alternating && side('left').length && side('right').length) {
      const l = avg(side('left')), r = avg(side('right'));
      asymmetry = { left: Math.round(l), right: Math.round(r), pct: Math.round((Math.abs(l - r) / Math.max(l, r, 1e-6)) * 100) };
    }
    return {
      id: this.spec.id,
      level: this.levelIdx,
      levelName: this.level.name,
      reps: reps.length,
      targetReps: this.targetReps * (this.spec.alternating ? 2 : 1),
      bySide: this.bySide(),
      aborts: this.aborts,
      holdBreaks: this.holdBreaks,
      formScore: scores.length ? Math.round(avg(scores)) : null,
      peakBest: peaks.length ? Math.round(Math.max(...peaks)) : null,
      peakAvg: peaks.length ? Math.round(avg(peaks)) : null,
      unit: this.spec.unit,
      formCounts: { ...this.formCounts },
      asymmetry,
      levelChanges: this.levelChanges,
      // Share of active frames where every required landmark was clearly visible.
      trackingQuality: this.activeFrames ? Math.round((this.goodFrames / this.activeFrames) * 100) / 100 : null,
      sensor: this.sbase ? { mode: this.sbase.mode, trunkFlexMax: this.sensorPeak.trunk == null ? null : Math.round(this.sensorPeak.trunk), lumbarFlexMax: this.sensorPeak.lumbar == null ? null : Math.round(this.sensorPeak.lumbar) } : null,
    };
  }
}
