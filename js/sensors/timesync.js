// Time alignment between a motion sensor's clock and the browser clock, and between camera and sensor.
//
// 1. ClockFit maps the sensor's own millisecond clock onto the browser clock. Bluetooth delivers
//    samples late by a variable amount (batching, radio retries), so arrival time is noisy. The
//    fastest-arriving samples sit on a "lower envelope" that follows the true clock relationship:
//    fit a line through the minimum (arrival - device) in short chunks. That removes jitter and
//    the sensor crystal's drift (tens of ppm, i.e. tens of ms over a 10-minute session).
// 2. crossCorrelateLag finds what remains: a constant offset between camera frames and sensor
//    samples (camera pipeline latency, minimum radio latency). A few quick trunk bends at the start
//    of a recording give a strong shared signal to correlate.

const CHUNK = 2; // s of device time per lower-envelope chunk

export class ClockFit {
  constructor({ window = 60 } = {}) {
    this.window = window; // s of history used for the fit
    this.chunks = []; // [{ dev, d }] device seconds -> minimum (arrival - device)
    this.a = null; // local = a + b * dev
    this.b = 1;
    this.lastDev = null;
    this.wraps = 0;
  }

  /** Add one sample: device time in ms (uint32, may wrap), arrival time in local seconds. */
  add(deviceMs, rxS) {
    if (this.lastDev != null && deviceMs + this.wraps * 2 ** 32 < this.lastDev - 1e6) this.wraps++;
    const dev = (deviceMs + this.wraps * 2 ** 32) / 1000;
    this.lastDev = dev * 1000;
    const d = rxS - dev;
    const key = Math.floor(dev / CHUNK);
    const last = this.chunks[this.chunks.length - 1];
    if (last && last.key === key) {
      if (d < last.d) Object.assign(last, { dev, d });
    } else {
      this.chunks.push({ key, dev, d });
      while (this.chunks.length && dev - this.chunks[0].dev > this.window) this.chunks.shift();
    }
    this.refit();
    return this.local(deviceMs);
  }

  refit() {
    if (!this.chunks.length) return;
    // The open chunk may hold a single sample that arrived in a radio burst; fit on completed chunks.
    const closed = this.chunks.slice(0, -1);
    const pts = closed.length >= 2 ? closed : this.chunks;
    const span = pts[pts.length - 1].dev - pts[0].dev;
    if (pts.length < 3 || span < 20) {
      // Too little history to see drift: offset only, from the best (lowest) recent chunks.
      const recent = pts.slice(-5).map((p) => p.d).sort((x, y) => x - y);
      this.a = recent[0];
      this.b = 1;
      return;
    }
    // Least squares on chunk minima: d = c + s * dev  ->  local = c + (1 + s) * dev
    const n = pts.length;
    const mx = pts.reduce((s, p) => s + p.dev, 0) / n;
    const my = pts.reduce((s, p) => s + p.d, 0) / n;
    let sxx = 0;
    let sxy = 0;
    for (const p of pts) {
      sxx += (p.dev - mx) ** 2;
      sxy += (p.dev - mx) * (p.d - my);
    }
    const slope = sxx ? sxy / sxx : 0;
    // A real crystal drifts well under 1000 ppm; anything bigger is noise in a short window.
    const s = Math.abs(slope) < 1e-3 ? slope : 0;
    this.b = 1 + s;
    this.a = my - s * mx;
  }

  /** Device ms -> local seconds (the time the sample was actually taken, on the browser clock). */
  local(deviceMs) {
    if (this.a == null) return null;
    const dev = (deviceMs + this.wraps * 2 ** 32) / 1000;
    return this.a + this.b * dev;
  }

  toJSON() {
    return { a: this.a, b: this.b, wraps: this.wraps };
  }
}

/** Fit a whole recording at once (offline analysis): same lower-envelope idea, no window. */
export function fitClock(pairs) {
  const fit = new ClockFit({ window: Infinity });
  for (const [deviceMs, rxS] of pairs) fit.add(deviceMs, rxS);
  return fit;
}

/** Linear interpolation of a series [{t, v}] (sorted by t) at time t; null outside the range. */
export function interp(series, t) {
  if (!series.length || t < series[0].t || t > series[series.length - 1].t) return null;
  let lo = 0;
  let hi = series.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (series[mid].t <= t) lo = mid;
    else hi = mid;
  }
  const A = series[lo];
  const B = series[hi];
  if (B.t === A.t) return A.v;
  return A.v + ((B.v - A.v) * (t - A.t)) / (B.t - A.t);
}

/**
 * Lag (s) that best aligns series b to series a: b(t + lag) ~ a(t).
 * Positive lag = b's timestamps run late relative to a. Returns { lag, r }.
 */
export function crossCorrelateLag(a, b, { maxLag = 0.5, step = 0.005, rate = 100 } = {}) {
  const t0 = Math.max(a[0].t, b[0].t) + maxLag;
  const t1 = Math.min(a[a.length - 1].t, b[b.length - 1].t) - maxLag;
  if (t1 - t0 < 1) return { lag: 0, r: 0 };
  const grid = [];
  for (let t = t0; t <= t1; t += 1 / rate) grid.push(t);
  const za = zscore(grid.map((t) => interp(a, t)));
  let best = { lag: 0, r: -Infinity };
  for (let lag = -maxLag; lag <= maxLag + 1e-9; lag += step) {
    const zb = zscore(grid.map((t) => interp(b, t + lag)));
    let r = 0;
    for (let i = 0; i < grid.length; i++) r += za[i] * zb[i];
    r /= grid.length;
    if (r > best.r) best = { lag: +lag.toFixed(4), r };
  }
  return best;
}

function zscore(xs) {
  const v = xs.map((x) => (x == null ? 0 : x));
  const m = v.reduce((s, x) => s + x, 0) / v.length;
  const sd = Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / v.length) || 1;
  return v.map((x) => (x - m) / sd);
}
