// Runs shipped models in shadow mode: beside the rules, on this device, changing nothing the user sees.
// observe() deliberately returns nothing, so a prediction can't reach coaching or safety. It only adds
// to counters that appear, as numbers, in the test report.
//
// Any failure (missing model, wrong feature schema, bad hash, invalid output, too slow) just turns the
// model off for the session: the app carries on with its rules.

import { FEATURE_SCHEMA } from '../core/features.js';
import { predictTrees, TREES_SCHEMA } from './trees.js';

const SLOW_MS = 10;
const SLOW_LIMIT = 20; // consecutive slow predictions

async function sha256(text) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export class ModelBank {
  constructor({ base = 'models/', fetcher = (...a) => fetch(...a) } = {}) {
    this.base = base;
    this.fetcher = fetcher;
    this.model = null;
    this.id = null;
    this.off = 'not loaded';
    this.ms = [];
    this.diffs = [];
    this.slow = 0;
  }

  stop(reason) {
    this.model = null;
    this.off = reason;
  }

  async text(file) {
    const res = await this.fetcher(`${this.base}${file}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
    return res.text();
  }

  /** Never throws: a model problem must not affect the session. */
  async load() {
    try {
      const manifest = JSON.parse(await this.text('manifest.json'));
      const entry = (manifest.models ?? []).find((m) => m.status === 'shadow');
      if (!entry) return this.stop('no model in shadow mode');
      if (entry.featureSchema !== FEATURE_SCHEMA) return this.stop(`built for ${entry.featureSchema}, this app uses ${FEATURE_SCHEMA}`);
      const text = await this.text(entry.file);
      if ((await sha256(text)) !== entry.sha256) return this.stop('file hash mismatch');
      const model = JSON.parse(text);
      if (model.schema !== TREES_SCHEMA) return this.stop(`unknown model format ${model.schema}`);
      this.id = entry.id;
      this.model = model;
      this.off = null;
    } catch (e) {
      this.stop(`load failed: ${e.message}`);
    }
  }

  /** sensorLumbar: this rep's peak from two back sensors, when present, to measure disagreement. */
  observe(features, { sensorLumbar = null } = {}) {
    if (!this.model || !features) return;
    const start = performance.now();
    const value = predictTrees(this.model, features);
    const ms = performance.now() - start;
    if (!Number.isFinite(value)) return void this.stop('invalid output');
    this.ms.push(ms);
    this.slow = ms > SLOW_MS ? this.slow + 1 : 0;
    if (this.slow >= SLOW_LIMIT) return void this.stop('too slow');
    if (sensorLumbar != null) this.diffs.push(Math.abs(value - sensorLumbar));
  }

  /** Numbers for the test report: how the model ran, never what it said about this person. */
  stats() {
    const sorted = [...this.ms].sort((a, b) => a - b);
    const round = (v) => +v.toFixed(2);
    return {
      model: this.id,
      off: this.off,
      reps: this.ms.length,
      p95Ms: sorted.length ? round(sorted[Math.floor(sorted.length * 0.95)]) : null,
      sensorCompared: this.diffs.length,
      meanDiffDeg: this.diffs.length ? round(this.diffs.reduce((a, b) => a + b, 0) / this.diffs.length) : null,
    };
  }
}
