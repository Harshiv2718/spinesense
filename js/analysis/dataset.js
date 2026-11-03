// Turns recorded clips into training rows: camera features for each hip-hinge rep, labelled with the
// lumbar flexion the two back sensors measured during that rep. Rep windows match what the live
// session passes to RepWindow, so a model sees the same numbers in training and in the app.
//
// Sync follows docs/architecture.md §5: a clip that can't be lined up reliably is left out, because
// a badly timed label teaches the model something false.

import { analyzeClip, cameraFrames, sensorSeries } from './agreement.js';
import { interp } from '../sensors/timesync.js';
import { median } from '../core/geometry.js';
import { RepWindow, FEATURE_SCHEMA, FEATURE_EXERCISE } from '../core/features.js';

const MIN_SYNC = 0.9;

/**
 * Returns { rows, skipped }: skipped is a reason when the clip can't be used.
 * tier: the licence tier of this clip's data (own consented clips are A).
 */
export function clipRows(clip, { subject = clip.participant, tier = 'A' } = {}) {
  const none = (skipped) => ({ rows: [], skipped });
  if (!subject) return none('no participant id, so leave-one-person-out could leak: pass a subject');
  if (!clip.frames.rows.some((r) => r[2] === FEATURE_EXERCISE)) return none('no hip hinge in this clip');
  const upper = sensorSeries(clip, 'upper');
  const lower = sensorSeries(clip, 'lower');
  if (!upper || !lower) return none('lumbar labels need two calibrated back sensors');
  const res = analyzeClip(clip);
  if (!res.ok) return none(res.reason);
  if (!(res.lag.r >= MIN_SYNC)) return none(`failed the sync check (correlation ${res.lag.r?.toFixed(2) ?? 'unknown'}, need ${MIN_SYNC})`);

  const up = upper.map((s) => ({ t: s.t, v: s.flex }));
  const low = lower.map((s) => ({ t: s.t, v: s.flex }));
  const lumbar = (t) => {
    const u = interp(up, t + res.align);
    const l = interp(low, t + res.align);
    return u == null || l == null ? null : u - l;
  };
  const active = cameraFrames(clip).filter((c) => c.ex === FEATURE_EXERCISE && c.phase === 'active');
  const base = median(active.slice(0, 10).map((c) => lumbar(c.t)).filter((v) => v != null));

  const rows = [];
  const win = new RepWindow();
  let peak = -Infinity;
  let rep = active[0]?.rep ?? 0;
  const close = () => {
    const features = win.take();
    if (features && Number.isFinite(peak)) rows.push({ schema: FEATURE_SCHEMA, subject, clip: clip.id, rep, tier, simulated: !!clip.simulated, features, label: +(peak - base).toFixed(3) });
    peak = -Infinity;
  };
  for (const c of active) {
    if (c.rep !== rep) {
      close();
      rep = c.rep;
    }
    win.push(c.frame);
    const v = lumbar(c.t);
    if (v != null) peak = Math.max(peak, v);
  }
  close();
  return { rows, skipped: rows.length ? null : 'no complete reps with sensor data' };
}

/**
 * A simulated person for testing the pipeline. How much of each bend comes from the hips changes rep by
 * rep. cue=false breaks the link with what the camera sees, as a negative control: nothing is learnable.
 */
export function simulatedSubject(i, { cue = true } = {}) {
  let x = (i * 2654435761 + 11) % 4294967296;
  const next = () => {
    x = (x * 1664525 + 1013904223) % 4294967296;
    return x / 4294967296;
  };
  const style = 0.4 + next() * 0.4;
  const shares = Array.from({ length: 64 }, () => Math.max(0.2, Math.min(0.9, style + (next() - 0.5) * 0.3)));
  const share = (rep) => shares[Math.max(0, rep) % shares.length];
  return {
    id: `sim-${String(i).padStart(2, '0')}`,
    seed: 1000 + i,
    scale: 0.88 + next() * 0.2,
    amp: 0.85 + next() * 0.25,
    noise: 0.001 + next() * 0.002,
    pelvisShare: share,
    hipShare: cue ? share : () => 0.5,
  };
}
