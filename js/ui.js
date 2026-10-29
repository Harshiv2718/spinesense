// Small DOM helpers, icons, modals and shared widgets.

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.setAttribute('class', v);
    else if (k === 'html') el.innerHTML = v; // trusted static markup only (icons)
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

const ICONS = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  session: '<rect x="3" y="6" width="12" height="12" rx="2"/><path d="M15 10.5l4.6-2.6a.9.9 0 0 1 1.4.8v6.6a.9.9 0 0 1-1.4.8L15 13.5"/>',
  exercises: '<path d="M22 12h-4l-3 8L9 4l-3 8H2"/>',
  history: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  safety: '<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3z"/><path d="M9 12l2 2 4-4"/>',
  settings: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  alert: '<path d="M12 3.5l9 16H3l9-16z"/><path d="M12 10v4M12 17v.01"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  face: '<circle cx="12" cy="12" r="9"/><path d="M9 10h.01M15 10h.01M9 15.5c1.6-1.2 4.4-1.2 6 0"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  pause: '<path d="M9 5v14M15 5v14"/>',
  play: '<path d="M7 4.5v15l12-7.5-12-7.5z"/>',
  skip: '<path d="M5 5l10 7-10 7V5zM19 5v14"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  hand: '<path d="M7 11V5.5a1.5 1.5 0 0 1 3 0V10M10 9.5V4a1.5 1.5 0 0 1 3 0v6M13 10V5a1.5 1.5 0 0 1 3 0v6M16 11V8a1.5 1.5 0 0 1 3 0v6a7 7 0 0 1-7 7h-.5a6.5 6.5 0 0 1-5.3-2.7L3.6 14.6a1.5 1.5 0 0 1 2.4-1.8L7 14"/>',
  flame: '<path d="M12 3c.8 3 4.5 5 4.5 9.5a4.5 4.5 0 0 1-9 0c0-2.2 1-3.5 2.2-4.5.1 1.8.9 3 2.1 3.3-.3-3 .2-5.6.2-8.3z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.01"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
  record: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none"/>',
  sensor: '<rect x="8" y="6" width="8" height="12" rx="2"/><path d="M12 9.5v.01M4.5 9a6 6 0 0 0 0 6M19.5 9a6 6 0 0 1 0 6M2 7a9 9 0 0 0 0 10M22 7a9 9 0 0 1 0 10"/>',
  spine: '<rect x="9" y="2.5" width="6" height="3.2" rx="1.4"/><rect x="8.4" y="7.2" width="7.2" height="3.2" rx="1.4"/><rect x="8" y="11.9" width="8" height="3.4" rx="1.5"/><rect x="8.4" y="16.8" width="7.2" height="3.4" rx="1.5"/><path d="M12 20.4v1.6"/>',
};

export function icon(name, size = 18) {
  const s = h('span', { class: 'icon', 'aria-hidden': 'true' });
  s.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] ?? ''}</svg>`;
  return s;
}

// ---------- pain scale ----------

export function painBand(n) {
  if (n == null) return { key: 'none', label: '—' };
  if (n <= 3) return { key: 'good', label: n === 0 ? 'No pain' : 'Mild' };
  if (n <= 5) return { key: 'warning', label: 'Moderate' };
  if (n <= 7) return { key: 'serious', label: 'Severe' };
  return { key: 'critical', label: 'Very severe' };
}

/** 0–10 pain picker. onPick(n). */
export function painScale(value, onPick, { compact = false } = {}) {
  const wrap = h('div', { class: `pain-scale${compact ? ' compact' : ''}`, role: 'radiogroup', 'aria-label': 'Pain from 0 to 10' });
  const buttons = [];
  for (let n = 0; n <= 10; n++) {
    const b = h('button', {
      type: 'button',
      class: `pain-btn band-${painBand(n).key}`,
      role: 'radio',
      'aria-checked': String(value === n),
      onclick: () => {
        buttons.forEach((x, i) => x.setAttribute('aria-checked', String(i === n)));
        caption.textContent = `${n}/10 · ${painBand(n).label}`;
        onPick(n);
      },
    }, String(n));
    buttons.push(b);
    wrap.append(b);
  }
  const caption = h('div', { class: 'pain-caption' }, value == null ? '0 = no pain · 10 = worst imaginable' : `${value}/10 · ${painBand(value).label}`);
  const outer = h('div', { class: 'pain-wrap' }, wrap, caption);
  outer.select = (n) => buttons[n]?.click();
  return outer;
}

export function painPill(n) {
  const b = painBand(n);
  return h('span', { class: `pill band-${b.key}` }, n == null ? '—' : `${n}/10`);
}

// ---------- modal & toast ----------

export function modal(content, { label = 'Dialog', dismissable = true, wide = false } = {}) {
  const root = document.getElementById('modal-root');
  const panel = h('div', { class: `modal${wide ? ' wide' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': label }, content);
  const backdrop = h('div', { class: 'modal-backdrop' }, panel);
  const close = () => {
    backdrop.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => {
    if (e.key === 'Escape' && dismissable) close();
  };
  if (dismissable) backdrop.addEventListener('click', (e) => e.target === backdrop && close());
  document.addEventListener('keydown', onKey);
  root.append(backdrop);
  panel.querySelector('button, [tabindex]')?.focus({ preventScroll: true });
  return { close, panel };
}

/** Copies text; if the browser refuses, shows it selected in a dialog so it can be copied by hand. */
export async function copyText(text, { done = 'Copied', title = 'Copy this' } = {}) {
  try {
    await navigator.clipboard.writeText(text);
    toast(done);
  } catch {
    const ta = h('textarea', { readonly: true, rows: Math.min(10, text.split('\n').length + 1), style: { width: '100%', fontFamily: 'monospace', fontSize: '12px' } }, text);
    const dlg = modal(h('div', { class: 'stack' }, h('h2', {}, title), h('p', { class: 'muted small' }, 'Your browser didn’t allow copying automatically. Select the text below and copy it.'), ta,
      h('div', { class: 'actions' }, h('button', { class: 'btn btn-primary', type: 'button', onclick: () => dlg.close() }, 'Done'))), { label: title });
    ta.select();
  }
}

export function toast(message, { tone = 'info', ms = 3200 } = {}) {
  const root = document.getElementById('toast-root');
  const t = h('div', { class: `toast tone-${tone}`, role: 'status' }, message);
  root.append(t);
  setTimeout(() => t.classList.add('out'), ms);
  setTimeout(() => t.remove(), ms + 400);
}

// ---------- formatting ----------

export const fmtDate = (d, opts = { weekday: 'short', day: 'numeric', month: 'short' }) => new Date(d).toLocaleDateString(undefined, opts);
export const fmtTime = (d) => new Date(d).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
export const fmtDur = (sec) => {
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  return m ? `${m} min${s ? ` ${s}s` : ''}` : `${s}s`;
};

export function fmtRel(d) {
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return fmtDate(d);
}

export function levelBadge(spec, level) {
  return h('span', { class: `level-badge l${level}` }, spec.levels[level].name);
}

export function toggle(label, checked, onChange, hint) {
  const input = h('input', { type: 'checkbox', checked: !!checked, onchange: (e) => onChange(e.target.checked) });
  return h('label', { class: 'toggle' }, input, h('span', { class: 'toggle-track', 'aria-hidden': 'true' }), h('span', { class: 'toggle-text' }, h('span', {}, label), hint ? h('small', {}, hint) : null));
}

export function emptyState(title, body, action) {
  return h('div', { class: 'empty' }, h('h3', {}, title), h('p', {}, body), action ?? null);
}
