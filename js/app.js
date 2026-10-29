// App shell: hash router, navigation and theme.

import { store } from './store.js';
import { h, icon, toast } from './ui.js';
import * as dashboard from './views/dashboard.js';
import * as session from './views/session.js';
import * as exercises from './views/exercises.js';
import * as history from './views/history.js';
import * as safety from './views/safety.js';
import * as settings from './views/settings.js';
import * as sensors from './views/sensors.js';
import * as recordings from './views/recordings.js';
import * as feedback from './views/feedback.js';

const ROUTES = { dashboard, session, exercises, history, sensors, recordings, safety, settings, feedback };
const NAV = [
  ['dashboard', 'Dashboard', 'dashboard'],
  ['session', 'Start session', 'session', 'nav-cta'],
  ['exercises', 'Exercises', 'exercises'],
  ['history', 'History', 'history'],
  ['sensors', 'Sensors', 'sensor'],
  ['recordings', 'Recordings', 'record'],
  ['safety', 'Safety check', 'safety'],
  ['settings', 'Settings', 'settings'],
  ['feedback', 'Help & feedback', 'info'],
];

let cleanup = null;
let current = 'dashboard';

// The Bluetooth sensor page stays out of the menu until someone turns hardware on in Settings.
const navItems = () => NAV.filter(([id]) => id !== 'sensors' || store.get().settings.hardwareSensors);

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '') || 'dashboard';
  const [path, query = ''] = raw.split('?');
  const [name, ...rest] = path.split('/');
  return { name, rest, params: new URLSearchParams(query) };
}

function renderNav(active) {
  const nav = document.getElementById('nav');
  nav.replaceChildren(...navItems().map(([id, label, ic, cls]) => h('a', {
    href: `#/${id}`,
    class: cls,
    'aria-label': label,
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
  current = key;
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

// ---------- browser checks ----------

// The store reports only the first failed save of a page load, so this shows once.
store.onSaveFailed(() => toast('Your sessions and safety check can’t be saved in this browser, so they’ll be gone when you close this tab. If this is a private window, open SpineSense in a normal window.', { tone: 'warn', ms: 8000 }));

// In-app browsers (Facebook, Instagram, WhatsApp, Snapchat, LINE, WeChat, TikTok, LinkedIn) and Android WebViews can’t open the camera.
const IN_APP_UA = /FBAN|FBAV|FB_IAB|FBIOS|Instagram|Line\/|Snapchat|WhatsApp|MicroMessenger|musical_ly|BytedanceWebview|LinkedInApp|; wv\)/;

async function copyLink() {
  const url = location.href;
  try {
    await navigator.clipboard.writeText(url);
    toast('Link copied. Paste it into Chrome, Edge or Safari.');
  } catch {
    toast(`Copy this link into Chrome, Edge or Safari: ${url}`, { ms: 15000 });
  }
}

/** Banner above the routed view when the camera can’t work here. It stays across routes until dismissed (this page load only). */
function browserBanner() {
  const insecure = window.isSecureContext === false;
  const embedded = IN_APP_UA.test(navigator.userAgent ?? '');
  const noCamera = typeof navigator.mediaDevices?.getUserMedia !== 'function';
  const slot = document.getElementById('app-banner');
  if (!slot || !(insecure || embedded || noCamera)) return;
  const banner = h('div', { class: 'callout warn', role: 'alert', style: { marginBottom: '18px', alignItems: 'center', flexWrap: 'wrap' } }, icon('camera'),
    h('div', { class: 'spacer', style: { minWidth: '200px' } },
      h('p', {}, h('strong', {}, 'This browser can’t use your camera. '), 'Open SpineSense in Chrome or Edge (or Safari on iPhone).'),
      insecure ? h('p', { class: 'small muted' }, 'This page isn’t on a secure (https) address, so browsers block the camera.') : null),
    h('button', { class: 'btn btn-sm', type: 'button', onclick: copyLink }, 'Copy link'),
    h('button', { class: 'btn btn-sm btn-ghost', type: 'button', 'aria-label': 'Dismiss', onclick: () => banner.remove() }, icon('x', 15)));
  slot.append(banner);
}

window.addEventListener('hashchange', route);
let hardwareShown = store.get().settings.hardwareSensors;
let themeShown = store.get().settings.theme;
store.subscribe((s) => {
  // Also runs when another tab changes the data (see store.js).
  if (s.settings.theme !== themeShown) {
    themeShown = s.settings.theme;
    applyTheme();
  }
  if (s.settings.hardwareSensors === hardwareShown) return;
  hardwareShown = s.settings.hardwareSensors;
  renderNav(current);
});
applyTheme();
browserBanner();
route();
