// Local-only persistence. Nothing here ever leaves the browser.

const KEY = 'spinesense.v1';

const DEFAULTS = {
  version: 1,
  profile: null, // { name, screening: {...} }
  progress: {}, // exerciseId -> { level, good, restUntil }
  sessions: [],
  settings: {
    voiceCoach: true,
    voiceInput: false,
    faceOptIn: false, // facial-strain signal is opt-in
    sensitivity: 'medium',
    modelVariant: 'full',
    cameraId: '',
    theme: 'system',
  },
};

const clone = (o) => JSON.parse(JSON.stringify(o));

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      return { ...clone(DEFAULTS), ...s, settings: { ...DEFAULTS.settings, ...(s.settings ?? {}) } };
    }
  } catch (e) {
    console.warn('Could not read saved data', e);
  }
  return clone(DEFAULTS);
}

let state = load();
const listeners = new Set();

export const store = {
  get: () => state,
  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Could not save data', e);
    }
    for (const fn of listeners) fn(state);
  },
  update(fn) {
    fn(state);
    store.save();
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  reset() {
    state = clone(DEFAULTS);
    store.save();
  },
  exportJSON: () => JSON.stringify(state, null, 2),
  importJSON(text) {
    const s = JSON.parse(text);
    if (!s || !Array.isArray(s.sessions)) throw new Error('Not a SpineSense export');
    state = { ...clone(DEFAULTS), ...s, settings: { ...DEFAULTS.settings, ...(s.settings ?? {}) } };
    store.save();
  },
};
