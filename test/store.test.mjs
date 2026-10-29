import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const KEY = 'spinesense.v1';

/** A Storage-like object. Set .failWrites to make setItem throw like a full or blocked store. */
function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    failWrites: false,
    data,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem(k, v) {
      if (this.failWrites) throw Object.assign(new Error('The quota has been exceeded.'), { name: 'QuotaExceededError' });
      data.set(k, String(v));
    },
    removeItem: (k) => data.delete(k),
  };
}

const setGlobal = (name, value) => Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });

let instance = 0;
/** A fresh copy of the store module (its own state, as on a new page load) bound to `storage` and a fake window. */
async function freshStore(storage, { navigator } = {}) {
  setGlobal('localStorage', storage);
  const win = new EventTarget();
  setGlobal('window', win);
  if (navigator) setGlobal('navigator', navigator);
  const { store } = await import(`../js/store.js?page=${++instance}`);
  return { store, win };
}

/** What the browser fires in the *other* tabs after a localStorage write. */
function storageEvent(key, storageArea) {
  return Object.assign(new Event('storage'), { key, storageArea, newValue: key == null ? null : storageArea.getItem(key) });
}

const quiet = (t) => t.mock.method(console, 'warn', () => {});

test('save() returns true and writes the whole state when storage works', async () => {
  const storage = memoryStorage();
  const { store } = await freshStore(storage);
  assert.equal(store.update((s) => { s.sessions.push({ id: 'a' }); }), true);
  assert.equal(store.save(), true);
  assert.deepEqual(JSON.parse(storage.getItem(KEY)).sessions, [{ id: 'a' }]);
  assert.equal(store.reset(), true);
  assert.deepEqual(JSON.parse(storage.getItem(KEY)).sessions, []);
});

test('save() returns false and reports the failure only once per page load when setItem throws', async (t) => {
  quiet(t);
  const storage = memoryStorage();
  storage.failWrites = true;
  const { store } = await freshStore(storage);
  const failures = [];
  store.onSaveFailed((e) => failures.push(e));
  const seen = [];
  store.subscribe((s) => seen.push(s.sessions.length));

  assert.equal(store.update((s) => { s.sessions.push({ id: 'a' }); }), false);
  assert.equal(store.save(), false);
  assert.equal(store.update((s) => { s.sessions.push({ id: 'b' }); }), false);
  assert.equal(failures.length, 1, 'one warning per page load, not one per save');
  assert.equal(failures[0].name, 'QuotaExceededError');
  assert.deepEqual(seen, [1, 1, 2], 'the in-memory state and subscribers still update');
  assert.equal(storage.getItem(KEY), null);

  // Storage recovers: saves succeed again and nothing new is reported.
  storage.failWrites = false;
  assert.equal(store.save(), true);
  storage.failWrites = true;
  assert.equal(store.save(), false);
  assert.equal(failures.length, 1);
});

test('a save-failed handler registered after the failure still hears about it once', async (t) => {
  quiet(t);
  const storage = memoryStorage();
  storage.failWrites = true;
  const { store } = await freshStore(storage);
  assert.equal(store.save(), false);
  let calls = 0;
  const off = store.onSaveFailed(() => calls++);
  assert.equal(calls, 1);
  store.save();
  assert.equal(calls, 1);
  off();
});

test('storage unavailable altogether (no localStorage) counts as a failed save', async (t) => {
  quiet(t);
  const { store } = await freshStore(undefined);
  delete globalThis.localStorage;
  let calls = 0;
  store.onSaveFailed(() => calls++);
  assert.equal(store.get().settings.voiceCoach, true, 'starts from defaults');
  assert.equal(store.save(), false);
  assert.equal(calls, 1);
});

test('a storage event for the store key reloads state with the load() merge and notifies subscribers', async () => {
  const storage = memoryStorage({ [KEY]: JSON.stringify({ version: 1, sessions: [{ id: 'old' }], settings: { theme: 'light' } }) });
  const { store, win } = await freshStore(storage);
  assert.deepEqual(store.get().sessions, [{ id: 'old' }]);
  const seen = [];
  store.subscribe((s) => seen.push(s));

  // Another tab writes a newer copy that predates some settings and the tester block.
  storage.data.set(KEY, JSON.stringify({ version: 1, profile: { name: 'Sam' }, sessions: [{ id: 'old' }, { id: 'new' }], settings: { theme: 'dark', hardwareSensors: true } }));
  win.dispatchEvent(storageEvent(KEY, storage));

  const s = store.get();
  assert.equal(seen.length, 1);
  assert.equal(seen[0], s);
  assert.deepEqual(s.sessions.map((x) => x.id), ['old', 'new']);
  assert.equal(s.profile.name, 'Sam');
  assert.equal(s.settings.theme, 'dark');
  assert.equal(s.settings.hardwareSensors, true);
  assert.equal(s.settings.voiceCoach, true, 'missing settings fall back to defaults');
  assert.equal(s.settings.sensitivity, 'medium');
  assert.deepEqual(s.tester, { introDismissed: false, done: {} }, 'missing top-level keys fall back to defaults');
  assert.deepEqual(s.progress, {});
});

test('storage events for other keys, for clear() and for sessionStorage leave state alone', async () => {
  const storage = memoryStorage({ [KEY]: JSON.stringify({ sessions: [{ id: 'mine' }] }) });
  const { store, win } = await freshStore(storage);
  const before = store.get();
  let calls = 0;
  store.subscribe(() => calls++);

  // Even with different data under our key, only an event *for our key on localStorage* may reload it.
  storage.data.set(KEY, JSON.stringify({ sessions: [] }));
  storage.data.set('spinesense.sensorcal', '{}');
  win.dispatchEvent(storageEvent('spinesense.sensorcal', storage));
  win.dispatchEvent(storageEvent('something.else', storage));
  win.dispatchEvent(storageEvent(null, storage));
  const session = memoryStorage({ [KEY]: JSON.stringify({ sessions: [] }) });
  win.dispatchEvent(storageEvent(KEY, session));

  assert.equal(calls, 0);
  assert.equal(store.get(), before);
  assert.deepEqual(store.get().sessions, [{ id: 'mine' }]);
});

test('an unreadable value from another tab keeps this tab’s state instead of resetting it', async (t) => {
  quiet(t);
  const storage = memoryStorage({ [KEY]: JSON.stringify({ sessions: [{ id: 'mine' }] }) });
  const { store, win } = await freshStore(storage);
  let calls = 0;
  store.subscribe(() => calls++);
  storage.data.set(KEY, '{not json');
  win.dispatchEvent(storageEvent(KEY, storage));
  assert.equal(calls, 0);
  assert.deepEqual(store.get().sessions, [{ id: 'mine' }]);
});

test('two tabs: a save in one tab no longer erases what the other tab saved', async () => {
  const storage = memoryStorage();
  const a = await freshStore(storage);
  const b = await freshStore(storage);
  // The browser tells every other tab about a write.
  const write = (from, to, fn) => {
    from.store.update(fn);
    to.win.dispatchEvent(storageEvent(KEY, storage));
  };
  write(a, b, (s) => { s.sessions.push({ id: 'from-a' }); });
  write(b, a, (s) => { s.sessions.push({ id: 'from-b' }); });
  write(a, b, (s) => { s.profile = { name: 'Sam', screening: { date: 'x' } }; });
  const saved = JSON.parse(storage.getItem(KEY));
  assert.deepEqual(saved.sessions.map((x) => x.id), ['from-a', 'from-b']);
  assert.equal(saved.profile.screening.date, 'x');
  assert.deepEqual(b.store.get().sessions.map((x) => x.id), ['from-a', 'from-b']);
});

test('asks the browser to keep the data once, after the first successful save with a safety check', async (t) => {
  quiet(t);
  let asked = 0;
  const nav = { storage: { persist() { asked++; return Promise.resolve(true); } } };
  const storage = memoryStorage();
  const { store } = await freshStore(storage, { navigator: nav });

  store.update((s) => { s.sessions.push({ id: 'demo' }); });
  assert.equal(asked, 0, 'not before there is a safety check');

  storage.failWrites = true;
  store.update((s) => { s.profile = { name: 'Sam', screening: { date: 'x' } }; });
  assert.equal(asked, 0, 'not after a failed save');

  storage.failWrites = false;
  store.save();
  assert.equal(asked, 1);
  store.update((s) => { s.sessions.push({ id: 'more' }); });
  store.save();
  assert.equal(asked, 1, 'only once per page load');
});

test('a returning user with a saved safety check is asked about on the first save', async () => {
  let asked = 0;
  const nav = { storage: { persist() { asked++; return Promise.resolve(false); } } };
  const storage = memoryStorage({ [KEY]: JSON.stringify({ sessions: [], profile: { screening: { date: 'x' } } }) });
  const { store } = await freshStore(storage, { navigator: nav });
  assert.equal(asked, 0, 'loading alone asks nothing');
  assert.equal(store.save(), true);
  assert.equal(asked, 1);
});

test('missing or failing persist() never breaks saving', async () => {
  const screened = (s) => { s.profile = { screening: { date: 'x' } }; };
  for (const nav of [{}, { storage: {} }, { storage: { persist: () => Promise.reject(new Error('denied')) } }, { storage: { persist() { throw new Error('nope'); } } }]) {
    const { store } = await freshStore(memoryStorage(), { navigator: nav });
    assert.equal(store.update(screened), true);
  }
  // Let any rejected promise settle: an unhandled rejection would fail this file.
  await new Promise((r) => setTimeout(r, 10));
});

test('importJSON still keeps this device’s hardware setting and returns the save result', async () => {
  const storage = memoryStorage({ [KEY]: JSON.stringify({ sessions: [], settings: { hardwareSensors: true } }) });
  const { store } = await freshStore(storage);
  const ok = store.importJSON(JSON.stringify({ sessions: [{ id: 'imported' }], settings: { hardwareSensors: false, theme: 'dark' } }));
  assert.equal(ok, true);
  assert.equal(store.get().settings.hardwareSensors, true);
  assert.equal(store.get().settings.theme, 'dark');
  assert.deepEqual(JSON.parse(storage.getItem(KEY)).sessions, [{ id: 'imported' }]);
});

// app.js needs a DOM, so its in-app-browser check is tested through the pattern it declares.
test('the in-app browser pattern catches embedded browsers but not normal Chrome, Edge, Safari or Firefox', async () => {
  const src = await readFile(new URL('../js/app.js', import.meta.url), 'utf8');
  const m = src.match(/^const IN_APP_UA = \/(.+)\/([a-z]*);$/m);
  assert.ok(m, 'app.js declares IN_APP_UA as a regex literal');
  const re = new RegExp(m[1], m[2]);
  const normal = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
    'Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1',
  ];
  const embedded = [
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0.0.0;FBBV/600000000]',
    'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/470.0.0.0;]',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 340.0.0.0 (iPhone15,2; iOS 17_5; en_US)',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.10.0',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Snapchat/13.0.0.0 (like Safari/8618.2.12.10.5)',
    'WhatsApp/2.24.10 A',
    'Mozilla/5.0 (Linux; Android 13; SM-S911B; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0.0.0 Mobile Safari/537.36',
  ];
  for (const ua of normal) assert.equal(re.test(ua), false, `flagged a normal browser: ${ua}`);
  for (const ua of embedded) assert.equal(re.test(ua), true, `missed an in-app browser: ${ua}`);
});
