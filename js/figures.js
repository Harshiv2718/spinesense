// Exercise illustrations drawn from the same pose generator the tests use:
// a faint start position and a solid end position.

import { poseAt } from './core/sim.js';
import { BONES } from './core/geometry.js';

const BODY_BONES = BONES.filter(([a, b]) => a >= 11 && b >= 11);

function toPts(exId, p) {
  const { lm, aspect } = poseAt(exId, p, { limb: 'left' });
  return lm.map((q) => ({ x: q.x * aspect, y: q.y }));
}

function bodyMarkup(pts, cls) {
  const lines = BODY_BONES.map(([a, b]) => `<line x1="${pts[a].x.toFixed(3)}" y1="${pts[a].y.toFixed(3)}" x2="${pts[b].x.toFixed(3)}" y2="${pts[b].y.toFixed(3)}"/>`).join('');
  const head = { x: (pts[7].x + pts[8].x + pts[0].x) / 3, y: (pts[7].y + pts[8].y + pts[0].y) / 3 };
  return `<g class="${cls}">${lines}<circle cx="${head.x.toFixed(3)}" cy="${head.y.toFixed(3)}" r="0.042"/></g>`;
}

export function exerciseFigure(exId, { className = 'figure' } = {}) {
  const a = toPts(exId, 0), b = toPts(exId, 0.85);
  const all = [...a, ...b];
  const minX = Math.min(...all.map((q) => q.x)) - 0.08, maxX = Math.max(...all.map((q) => q.x)) + 0.08;
  const minY = Math.min(...all.map((q) => q.y)) - 0.1, maxY = 0.93;
  const w = maxX - minX, hgt = maxY - minY;
  const span = Math.max(w, hgt * 1.25);
  const cx = (minX + maxX) / 2;
  const vb = `${(cx - span / 2).toFixed(3)} ${(maxY - span / 1.25).toFixed(3)} ${span.toFixed(3)} ${(span / 1.25).toFixed(3)}`;
  let props = '';
  if (exId === 'sit-to-stand') {
    // A simple chair under the seated start position.
    const hip = a[24], seatY = hip.y + 0.03, back = hip.x - 0.08, front = hip.x + 0.08;
    props = `<g class="fig-prop"><line x1="${back}" y1="${seatY}" x2="${front}" y2="${seatY}"/><line x1="${back}" y1="${seatY}" x2="${back}" y2="0.905"/><line x1="${front}" y1="${seatY}" x2="${front}" y2="0.905"/><line x1="${back}" y1="${seatY}" x2="${back - 0.02}" y2="${seatY - 0.22}"/></g>`;
  }
  const el = document.createElement('div');
  el.className = className;
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `<svg viewBox="${vb}" preserveAspectRatio="xMidYMid meet">
    <line class="fig-floor" x1="${cx - span}" y1="0.905" x2="${cx + span}" y2="0.905"/>
    ${props}${bodyMarkup(a, 'fig-start')}${bodyMarkup(b, 'fig-end')}
  </svg>`;
  return el;
}
