// Bland–Altman plot as an SVG string (works in the browser and in Node for docs/).
// theme 'css' uses the app's CSS variables (light and dark); 'static' uses fixed colours for files.

const THEMES = {
  css: { ink: 'var(--ink-2)', muted: 'var(--ink-3)', grid: 'var(--grid)', axis: 'var(--axis)', point: 'var(--series-1)', rep: 'var(--series-2)', surface: 'var(--surface)' },
  static: { ink: '#52514e', muted: '#898781', grid: '#e1e0d9', axis: '#c3c2b7', point: '#2a78d6', rep: '#eb6834', surface: '#fcfcfb' },
};

function niceStep(range) {
  const raw = range / 5;
  const mag = 10 ** Math.floor(Math.log10(raw || 1));
  return [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** pairs/repPairs: [[camera, sensor]]; stats: agreement() result used for the bias and limit lines. */
export function blandAltmanSVG({ pairs = [], repPairs = [], stats, title = 'Camera − sensor', width = 560, height = 300, theme = 'css' }) {
  const c = THEMES[theme];
  const pts = pairs.map(([a, b]) => [(a + b) / 2, a - b]);
  const reps = repPairs.map(([a, b]) => [(a + b) / 2, a - b]);
  const all = [...pts, ...reps];
  if (!all.length || !stats?.n) return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="60"><text x="0" y="30" fill="${c.ink}" font-size="13" font-family="system-ui, sans-serif">Not enough paired data</text></svg>`;
  const m = { l: 44, r: 92, t: 24, b: 34 };
  const iw = width - m.l - m.r;
  const ih = height - m.t - m.b;
  const xs = all.map((p) => p[0]);
  const ys = [...all.map((p) => p[1]), ...stats.loa, stats.bias];
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yAbs = Math.max(2, ...ys.map(Math.abs)) * 1.15;
  const x = (v) => m.l + ((v - xMin) / (xMax - xMin || 1)) * iw;
  const y = (v) => m.t + ih / 2 - (v / yAbs) * (ih / 2);
  const parts = [];
  const ystep = niceStep(2 * yAbs);
  for (let v = -Math.floor(yAbs / ystep) * ystep; v <= yAbs; v += ystep) {
    parts.push(`<line x1="${m.l}" x2="${m.l + iw}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="${v === 0 ? c.axis : c.grid}" stroke-width="1"/>`);
    parts.push(`<text x="${m.l - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end" fill="${c.muted}" font-size="11">${+v.toFixed(1)}</text>`);
  }
  const xstep = niceStep(xMax - xMin || 1);
  for (let v = Math.ceil(xMin / xstep) * xstep; v <= xMax; v += xstep) {
    parts.push(`<text x="${x(v).toFixed(1)}" y="${m.t + ih + 16}" text-anchor="middle" fill="${c.muted}" font-size="11">${+v.toFixed(1)}</text>`);
  }
  for (const [px, py] of pts) parts.push(`<circle cx="${x(px).toFixed(1)}" cy="${y(py).toFixed(1)}" r="2" fill="${c.point}" fill-opacity="0.35"/>`);
  for (const [px, py] of reps) parts.push(`<circle cx="${x(px).toFixed(1)}" cy="${y(py).toFixed(1)}" r="4.5" fill="${c.rep}" stroke="${c.surface}" stroke-width="2"/>`);
  // Narrow limits put the three lines close together, so their labels are pushed apart to stay readable.
  const GAP = 13;
  const yBias = y(stats.bias);
  const line = (v, labelY, label, w, dash) => {
    parts.push(`<line x1="${m.l}" x2="${m.l + iw}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="${c.ink}" stroke-width="${w}"${dash ? ' stroke-dasharray="5 4"' : ''}/>`);
    parts.push(`<text x="${m.l + iw + 6}" y="${(labelY + 4).toFixed(1)}" fill="${c.ink}" font-size="11">${esc(label)}</text>`);
  };
  line(stats.loa[1], Math.min(y(stats.loa[1]), yBias - GAP), `+1.96 SD ${stats.loa[1]}°`, 1, true);
  line(stats.bias, yBias, `bias ${stats.bias}°`, 2, false);
  line(stats.loa[0], Math.max(y(stats.loa[0]), yBias + GAP), `−1.96 SD ${stats.loa[0]}°`, 1, true);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="system-ui, sans-serif" role="img" aria-label="${esc(title)}">
  <text x="${m.l}" y="14" fill="${c.ink}" font-size="12" font-weight="600">${esc(title)}</text>
  ${parts.join('\n  ')}
  <text x="${m.l + iw / 2}" y="${height - 4}" text-anchor="middle" fill="${c.muted}" font-size="11">mean of camera and sensor (°)</text>
  <text x="12" y="${m.t + ih / 2}" text-anchor="middle" fill="${c.muted}" font-size="11" transform="rotate(-90 12 ${m.t + ih / 2})">camera − sensor (°)</text>
</svg>`;
}
