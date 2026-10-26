// App shell: hash router, navigation and theme.

import { store } from './store.js';
import { h, icon } from './ui.js';
import * as dashboard from './views/dashboard.js';
import * as session from './views/session.js';
import * as exercises from './views/exercises.js';
import * as history from './views/history.js';
import * as safety from './views/safety.js';
import * as settings from './views/settings.js';
import * as sensors from './views/sensors.js';
import * as recordings from './views/recordings.js';

const ROUTES = { dashboard, session, exercises, history, sensors, recordings, safety, settings };
const NAV = [
  ['dashboard', 'Dashboard', 'dashboard'],
  ['session', 'Start session', 'session', 'nav-cta'],
  ['exercises', 'Exercises', 'exercises'],
  ['history', 'History', 'history'],
  ['sensors', 'Sensors', 'sensor'],
  ['recordings', 'Recordings', 'record'],
  ['safety', 'Safety check', 'safety'],
  ['settings', 'Settings', 'settings'],
];

let cleanup = null;

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '') || 'dashboard';
  const [path, query = ''] = raw.split('?');
  const [name, ...rest] = path.split('/');
  return { name, rest, params: new URLSearchParams(query) };
}

function renderNav(active) {
  const nav = document.getElementById('nav');
  nav.replaceChildren(...NAV.map(([id, label, ic, cls]) => h('a', {
    href: `#/${id}`,
    class: cls,
    'aria-current': id === active ? 'page' : null,
    onclick: (e) => {
      if (window.__sessionLive && id !== 'session' && !confirm('Leave the session? Progress from this session will not be saved.')) e.preventDefault();
    },
  }, icon(ic, 18), h('span', {}, label))));
}

function route() {
  try {
    cleanup?.();
  } catch (e) {
    console.error(e);
  }
  cleanup = null;
  window.__sessionLive = false;
  const { name, rest, params } = parseHash();
  const key = ROUTES[name] ? name : 'dashboard';
  renderNav(key);
  document.body.dataset.route = key;
  const view = document.getElementById('view');
  view.replaceChildren();
  cleanup = ROUTES[key].render(view, { params, rest }) ?? null;
  window.scrollTo(0, 0);
  view.focus({ preventScroll: true });
}

function applyTheme() {
  const t = store.get().settings.theme;
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
  const btn = document.getElementById('theme-btn');
  const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  btn.replaceChildren(icon(dark ? 'moon' : 'sun', 15), h('span', {}, t === 'system' ? `Auto (${dark ? 'dark' : 'light'})` : dark ? 'Dark' : 'Light'));
}

document.getElementById('theme-btn').addEventListener('click', () => {
  const order = ['system', 'light', 'dark'];
  store.update((s) => {
    s.settings.theme = order[(order.indexOf(s.settings.theme) + 1) % order.length];
  });
  applyTheme();
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
document.getElementById('brand-mark').append(icon('spine', 20));

window.addEventListener('hashchange', route);
applyTheme();
route();
