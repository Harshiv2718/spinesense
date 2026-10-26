// Dependency-free SVG charts: a line chart with crosshair tooltip + table view, and a bar list.

import { h } from './ui.js';

const NS = 'http://www.w3.org/2000/svg';
function s(tag, attrs = {}) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
  return el;
}
function txt(x, y, value, cls) {
  const t = s('text', { x, y, class: cls });
  t.textContent = value;
  return t;
}

function niceTicks(lo, hi, target = 5) {
  const raw = (hi - lo) / target;
  const mag = 10 ** Math.floor(Math.log10(raw || 1));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((st) => st >= raw) ?? 10 * mag;
  const top = Math.ceil(hi / step) * step;
  const ticks = [];
  for (let v = lo; v <= top + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

/**
 * series: [{ name, color: '--series-1', values: [number|null] }]
 * labels: x labels (same length as values)
 */
export function lineChart({ labels, series, yMin = 0, yMax, unit = '', height = 220, format = (v) => String(Math.round(v)), title = 'Chart' }) {
  const wrap = h('div', { class: 'chart' });
  const legend = series.length > 1
    ? h('div', { class: 'legend' }, series.map((se) => h('span', { class: 'legend-item' }, h('span', { class: 'key-line', style: { background: `var(${se.color})` } }), se.name)))
    : h('span');
  const tableBtn = h('button', { class: 'link-btn', type: 'button' }, 'View as table');
  const plot = h('div', { class: 'plot' });
  const tip = h('div', { class: 'tooltip', hidden: true });
  wrap.append(h('div', { class: 'chart-top' }, legend, tableBtn), plot);

  let showTable = false;
  let lastW = 0;
  tableBtn.addEventListener('click', () => {
    showTable = !showTable;
    tableBtn.textContent = showTable ? 'View as chart' : 'View as table';
    lastW = -1;
    draw();
  });

  const table = () => {
    const t = h('table', { class: 'data-table' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Date'), series.map((se) => h('th', {}, se.name)))),
      h('tbody', {}, labels.map((lb, i) => h('tr', {}, h('td', {}, lb), series.map((se) => h('td', {}, se.values[i] == null ? '—' : format(se.values[i]) + unit))))));
    return h('div', { class: 'table-scroll' }, t);
  };

  function draw() {
    const W = Math.round(plot.clientWidth);
    if (W === lastW) return;
    lastW = W;
    plot.replaceChildren();
    if (showTable) {
      plot.style.height = 'auto';
      plot.append(table());
      return;
    }
    plot.style.height = `${height}px`;
    plot.append(tip);
    if (!W) return;
    const H = height;
    const m = { l: 36, r: 46, t: 10, b: 26 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const n = labels.length;
    const x = (i) => m.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
    const vals = series.flatMap((se) => se.values).filter((v) => v != null);
    const ticks = niceTicks(yMin, yMax ?? Math.max(...vals, yMin + 1));
    const top = ticks[ticks.length - 1];
    const y = (v) => m.t + ih - ((v - yMin) / (top - yMin)) * ih;
    const svg = s('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': title });

    for (const t of ticks) {
      svg.append(s('line', { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), class: t === yMin ? 'axis' : 'grid' }));
      svg.append(txt(m.l - 8, y(t) + 4, format(t), 'tick tick-y'));
    }
    const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 76))));
    labels.forEach((lb, i) => {
      const isLast = i === n - 1;
      if (isLast || (i % every === 0 && n - 1 - i >= every * 0.6)) svg.append(txt(x(i), H - 6, lb, 'tick tick-x'));
    });

    const ends = [];
    for (const se of series) {
      let d = '';
      let pen = false;
      se.values.forEach((v, i) => {
        if (v == null) {
          pen = false;
          return;
        }
        d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
        pen = true;
      });
      if (series.length === 1 && d) {
        const first = se.values.findIndex((v) => v != null);
        const last = se.values.length - 1 - [...se.values].reverse().findIndex((v) => v != null);
        svg.append(s('path', { d: `${d}L${x(last)},${y(yMin)}L${x(first)},${y(yMin)}Z`, class: 'area', fill: `var(${se.color})` }));
      }
      svg.append(s('path', { d, class: 'line', stroke: `var(${se.color})` }));
      const li = se.values.length - 1 - [...se.values].reverse().findIndex((v) => v != null);
      if (li < se.values.length && se.values[li] != null) {
        svg.append(s('circle', { cx: x(li), cy: y(se.values[li]), r: 4, class: 'dot', fill: `var(${se.color})` }));
        ends.push({ x: x(li), y: y(se.values[li]), label: format(se.values[li]) + unit });
      }
    }
    // Direct end labels only when they don't collide; otherwise the legend + tooltip carry it.
    const collide = ends.some((a, i) => ends.some((b, j) => i < j && Math.abs(a.y - b.y) < 14));
    if (!collide) for (const e of ends) svg.append(txt(e.x + 9, e.y + 4, e.label, 'end-label'));

    const cross = s('line', { class: 'crosshair', y1: m.t, y2: m.t + ih, visibility: 'hidden' });
    const dots = series.map((se) => s('circle', { r: 4.5, class: 'dot', fill: `var(${se.color})`, visibility: 'hidden' }));
    svg.append(cross, ...dots);
    const hit = s('rect', { x: m.l - 10, y: m.t, width: iw + 20, height: ih, fill: 'transparent', tabindex: 0, 'aria-label': `${title}: use arrow keys to read values` });
    svg.append(hit);
    let cur = n - 1;
    const show = (i) => {
      cur = i;
      cross.setAttribute('x1', x(i));
      cross.setAttribute('x2', x(i));
      cross.setAttribute('visibility', 'visible');
      series.forEach((se, k) => {
        const v = se.values[i];
        dots[k].setAttribute('visibility', v == null ? 'hidden' : 'visible');
        if (v != null) {
          dots[k].setAttribute('cx', x(i));
          dots[k].setAttribute('cy', y(v));
        }
      });
      tip.replaceChildren(
        h('div', { class: 'tip-label' }, labels[i]),
        ...series.map((se) => h('div', { class: 'tip-row' },
          h('span', { class: 'key-line', style: { background: `var(${se.color})` } }),
          h('strong', {}, se.values[i] == null ? '—' : format(se.values[i]) + unit),
          h('span', { class: 'tip-name' }, se.name))),
      );
      tip.hidden = false;
      const tw = tip.offsetWidth || 140;
      tip.style.left = `${Math.min(W - tw - 4, Math.max(4, x(i) + 12 > W - tw - 4 ? x(i) - tw - 12 : x(i) + 12))}px`;
      tip.style.top = `${m.t + 4}px`;
    };
    const hide = () => {
      cross.setAttribute('visibility', 'hidden');
      dots.forEach((d) => d.setAttribute('visibility', 'hidden'));
      tip.hidden = true;
    };
    hit.addEventListener('pointermove', (e) => {
      const r = svg.getBoundingClientRect();
      const i = Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left - m.l) / iw) * (n - 1))));
      show(i);
    });
    hit.addEventListener('pointerleave', hide);
    hit.addEventListener('focus', () => show(cur));
    hit.addEventListener('blur', hide);
    hit.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') show(Math.max(0, cur - 1));
      if (e.key === 'ArrowRight') show(Math.min(n - 1, cur + 1));
    });
    plot.prepend(svg);
  }

  new ResizeObserver(() => draw()).observe(plot);
  return wrap;
}

/** Horizontal bars. rows: [{ label, value, display, sub }] */
export function barList(rows, { max, color = '--accent', empty = 'Nothing to show yet.' } = {}) {
  if (!rows.length) return h('p', { class: 'muted small' }, empty);
  const top = max ?? Math.max(...rows.map((r) => r.value), 1);
  return h('div', { class: 'bar-list' }, rows.map((r) => h('div', { class: 'bar-row', tabindex: 0, title: `${r.label}: ${r.display ?? r.value}` },
    h('div', { class: 'bar-label' }, h('span', {}, r.label), r.sub ? h('small', {}, r.sub) : null),
    h('div', { class: 'bar-track' },
      h('div', { class: 'bar-fill', style: { width: `${Math.max(2, (r.value / top) * 100)}%`, background: `var(${r.color ?? color})` } }),
      h('span', { class: 'bar-value' }, r.display ?? String(r.value))))));
}
