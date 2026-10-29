// Live "Tracking details" panel + a copyable test report (numbers only, no images),
// so real-world tracking problems can be diagnosed and thresholds tuned.

import { h, icon, toast, modal } from '../ui.js';
import { frontalness, trunkTilt, lateralTilt, facingSide } from '../core/geometry.js';
import { VERSION, buildInfo } from '../version.js';

const SAMPLE_EVERY = 0.5; // s
const MAX_SAMPLES = 480; // ~4 minutes
const COLS = ['t', 'mode', 'ex', 'phase', 'repState', 'value', 'target', 'reps', 'side', 'front', 'tilt', 'lean', 'minVis', 'face', 'faceZ', 'disc', 'fps', 'msg', 'sensorTrunk', 'sensorLumbar'];

// Reports get pasted into public bug reports, so nothing in them may reveal pain or discomfort: no
// check-in answers or events, no face or discomfort scores, no stopped-for-pain markers.
const PRIVATE = new Set(['rating', 'leg', 'pain', 'painRating']);
const PRIVATE_COLS = new Set(['face', 'faceZ', 'disc']);
const privateEvent = (type) => type.startsWith('pain') || type.startsWith('discomfort');

const r2 = (x) => (x == null || Number.isNaN(x) ? null : Math.round(x * 100) / 100);

export class Diagnostics {
  constructor(meta) {
    this.t0 = null;
    this.meta = { app: 'SpineSense', version: VERSION, when: new Date().toISOString(), ua: navigator.userAgent, ...meta };
    buildInfo().then((b) => { this.meta.build = b.sha; });
    this.samples = [];
    this.events = [];
    this.lastSample = -Infinity;
    this.rows = {};
    this.el = this.build();
  }

  build() {
    const table = h('table', { class: 'diag-table' }, h('tbody', {}, [
      ['phase', 'Phase'], ['msg', 'Message'], ['view', 'View (front ratio)'], ['tilt', 'Trunk tilt'], ['lean', 'Side lean'],
      ['value', 'Metric / target'], ['repState', 'Rep state'], ['minVis', 'Lowest visibility'], ['face', 'Face score / z'], ['disc', 'Discomfort score'], ['fps', 'FPS'],
    ].map(([k, label]) => h('tr', {}, h('th', {}, label), (this.rows[k] = h('td', {}, '—'))))));
    return h('details', { class: 'card diag' },
      h('summary', {}, icon('info', 15), 'Tracking details'),
      table,
      h('button', { class: 'btn btn-sm', type: 'button', style: { marginTop: '10px', width: '100%' }, onclick: () => this.copy() }, 'Copy test report'));
  }

  set(k, v) {
    const el = this.rows[k];
    if (el && el.textContent !== v) el.textContent = v;
  }

  sample(live, fr, st, d) {
    const t = fr.t;
    this.t0 ??= t;
    if (t - this.lastSample < SAMPLE_EVERY) return;
    this.lastSample = t;
    const f = fr.frame;
    const spec = live.spec;
    let front = null, tilt = null, lean = null, side = null, minVis = null;
    if (f) {
      front = frontalness(f);
      tilt = trunkTilt(f);
      lean = lateralTilt(f);
      side = facingSide(f);
      if (spec) minVis = Math.min(...spec.required(live.run?.side ?? side).map((i) => f.vis(i)));
    }
    const faceZ = live.det?.face?.z;
    const row = [
      r2(t - this.t0), live.mode, spec?.id ?? null, st?.phase ?? null, st?.repState ?? null, r2(st?.value), r2(st?.target), st?.reps ?? null,
      side, r2(front), r2(tilt), r2(lean), r2(minVis), fr.face?.found ? [r2(fr.face.score), fr.face.frontal ? 1 : 0] : null, r2(faceZ), r2(d?.score), fr.fps, st?.message || null,
      r2(live.lastSnapshot?.trunk?.flex), r2(live.lastSnapshot?.lumbar?.flex),
    ];
    this.samples.push(row);
    if (this.samples.length > MAX_SAMPLES) this.samples.shift();

    if (!this.el.open) return;
    this.set('phase', `${live.mode}${st ? ` · ${st.phase}` : ''}`);
    this.set('msg', st?.message || '—');
    this.set('view', f ? `${side} side · ${front.toFixed(2)} ${front > 0.5 ? '(facing)' : front < 0.45 ? '(side-on)' : '(in between)'}` : 'no person');
    this.set('tilt', f ? `${tilt.toFixed(1)}°` : '—');
    this.set('lean', f ? `${lean.toFixed(1)}°` : '—');
    this.set('value', st ? `${st.value.toFixed(1)} / ${st.target.toFixed(1)} ${spec?.unit ?? ''}` : '—');
    this.set('repState', st?.repState ?? '—');
    this.set('minVis', minVis == null ? '—' : minVis.toFixed(2));
    this.set('face', fr.face?.found ? `${fr.face.score.toFixed(2)} / z ${(faceZ ?? 0).toFixed(1)}${fr.face.frontal ? '' : ' (not frontal)'}` : fr.face ? 'no face found' : '—');
    this.set('disc', d ? `${d.score.toFixed(2)} (mild ${d.thresholds.mild}, check ${d.thresholds.moderate})` : '—');
    this.set('fps', String(fr.fps));
  }

  event(t, ex, ev) {
    this.t0 ??= t;
    const { type, ...rest } = ev;
    const slim = {};
    for (const [k, v] of Object.entries(rest)) {
      if (PRIVATE.has(k)) continue;
      if (k === 'rep') Object.assign(slim, { peak: r2(v.peak), dur: r2(v.duration), limb: v.limb, issues: v.issues });
      else slim[k] = typeof v === 'number' ? r2(v) : v;
    }
    this.events.push({ t: r2(t - this.t0), ex, type, ...slim });
    if (this.events.length > 400) this.events.shift();
  }

  report(results) {
    const keep = COLS.map((c, i) => (PRIVATE_COLS.has(c) ? -1 : i)).filter((i) => i >= 0);
    return JSON.stringify({
      meta: { ...this.meta, when: this.meta.when.slice(0, 10) },
      results: (results ?? []).filter(Boolean).map((r) => ({ id: r.id, reps: `${r.reps}/${r.targetReps}`, aborts: r.aborts, form: r.formScore, best: r.peakBest, skipped: r.skipped ? r.skipReason ?? true : false })),
      // Rep durations include pauses and check-ins, which would hint at pain: leave them out.
      events: this.events.filter((e) => !privateEvent(e.type)).map(({ dur, ...e }) => e),
      columns: keep.map((i) => COLS[i]),
      samples: this.samples.map((row) => keep.map((i) => row[i])),
    });
  }

  async copy(results) {
    const text = this.report(results ?? this.results?.());
    try {
      await navigator.clipboard.writeText(text);
      toast('Test report copied. Paste it into your feedback.');
    } catch {
      const ta = h('textarea', { readonly: true, style: { width: '100%', height: '240px', fontFamily: 'monospace', fontSize: '11px' } }, text);
      const dlg = modal(h('div', { class: 'stack' }, h('h2', {}, 'Test report'), h('p', { class: 'muted small' }, 'Copy everything below and paste it into your feedback. It holds tracking numbers, the app version and your browser: no images, nothing about pain or discomfort.'), ta,
        h('div', { class: 'actions' }, h('button', { class: 'btn btn-primary', type: 'button', onclick: () => dlg.close() }, 'Done'))), { label: 'Test report' });
      ta.select();
    }
  }
}
