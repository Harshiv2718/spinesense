// Local-only persistence. Nothing here ever leaves the browser.
//
// Did it save? store.save() returns true when the data reached localStorage and false when the
// browser refused it (storage full, private window, storage blocked). update(), reset() and
// importJSON() return the same value, so check it before telling someone "Session saved". The
// in-memory state (and every subscriber) is updated either way. The first failed save on a page
// load is also reported to store.onSaveFailed(fn) handlers, so the shell warns once, not on
// every save.
//
// Several tabs: when another tab writes our key, this tab reloads its copy (same merge as at
// start-up) and notifies subscribers, so its next save can't wipe what the other tab wrote.

const KEY = 'spinesense.v1';

const DEFAULTS = {
  version: 1,
  profile: null, // { name, screening: {...} }
  progress: {}, // exerciseId -> { level, good, restUntil }
  sessions: [],
  consent: {}, // { clips: { version, at, scopes } }
  settings: {
    voiceCoach: true,
    voiceInput: false,
    faceOptIn: false, // facial-strain signal is opt-in
    sensitivity: 'medium',
    modelVariant: 'full',
    cameraId: '',
    theme: 'system',
    hardwareSensors: false, // SpineSense Motion (Bluetooth) options stay hidden until someone has the hardware
  },
  tester: { introDismissed: false, done: {} }, // Help & feedback checklist
};

const clone = (o) => JSON.parse(JSON.stringify(o));
const merge = (s) => ({ ...clone(DEFAULTS), ...s, settings: { ...DEFAULTS.settings, ...(s.settings ?? {}) } });

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return merge(JSON.parse(raw));
  } catch (e) {
    console.warn('Could not read saved data', e);
  }
  return clone(DEFAULTS);
}

let state = load();
const listeners = new Set();
const notify = () => {
  for (const fn of listeners) fn(state);
};

// ---------- failed saves ----------

const failureHandlers = new Set();
let failed = false; // a save has failed on this page load
let failure = null;

function callHandler(fn, e) {
  try {
    fn(e);
  } catch (err) {
    console.error(err);
  }
}

function reportFailure(e) {
  if (failed) return; // once per page load
  failed = true;
  failure = e;
  for (const fn of failureHandlers) callHandler(fn, e);
}

// ---------- ask the browser not to evict ----------

let persistAsked = false;

/** Once a safety check is on disk, ask the browser to keep this site's data (fewer evictions on Safari/Chrome). */
function askToPersist() {
  if (persistAsked || !state.profile?.screening) return;
  persistAsked = true;
  try {
    const p = (typeof navigator === 'undefined' ? undefined : navigator)?.storage?.persist?.();
    p?.catch?.(() => {});
  } catch {
    /* not supported: nothing to do */
  }
}

// ---------- other tabs ----------

function onStorage(e) {
  if (e?.key !== KEY) return; // other keys, and clear() (key null), never touch our state
  try {
    if (e.storageArea && e.storageArea !== localStorage) return; // sessionStorage
  } catch {
    return;
  }
  let next;
  try {
    const raw = localStorage.getItem(KEY);
    next = raw ? merge(JSON.parse(raw)) : clone(DEFAULTS);
  } catch (err) {
    console.warn('Could not read data saved by another tab', err);
    return; // keep what this tab has rather than replace it with defaults
  }
  state = next;
  notify();
}

if (typeof window !== 'undefined') window.addEventListener?.('storage', onStorage);

export const store = {
  get: () => state,
  /** Writes the whole state. Returns true if it was stored, false if the browser refused (see top of file). */
  save() {
    let ok = true;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      ok = false;
      console.warn('Could not save data', e);
      reportFailure(e);
    }
    if (ok) askToPersist();
    notify();
    return ok;
  },
  update(fn) {
    fn(state);
    return store.save();
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  /** fn(error) runs on the first failed save of this page load (at once if one already failed). Returns an unsubscribe. */
  onSaveFailed(fn) {
    failureHandlers.add(fn);
    if (failed) callHandler(fn, failure);
    return () => failureHandlers.delete(fn);
  },
  reset() {
    state = clone(DEFAULTS);
    return store.save();
  },
  exportJSON: () => JSON.stringify(state, null, 2),
  importJSON(text) {
    const s = JSON.parse(text);
    if (!s || !Array.isArray(s.sessions)) throw new Error('Not a SpineSense export');
    // Hardware visibility belongs to this device, not to whoever made the export.
    const settings = { ...DEFAULTS.settings, ...(s.settings ?? {}), hardwareSensors: state.settings.hardwareSensors };
    state = { ...clone(DEFAULTS), ...s, settings };
    return store.save();
  },
};
