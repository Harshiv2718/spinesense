import { byId } from '../core/exercises.js';
import { SIGNALS } from '../core/discomfort.js';

export function repText(spec, levelIdx, repScale = 1) {
  const L = spec.levels[levelIdx];
  const reps = Math.max(1, Math.round(L.reps * repScale));
  const each = spec.alternating ? ' each side' : '';
  return spec.kind === 'hold' ? `${reps} × ${L.hold}s hold${each}` : `${reps} reps${each}`;
}

export const exName = (id) => byId[id]?.name ?? id;

export const SIGNAL_LABEL = {
  ...Object.fromEntries(Object.entries(SIGNALS).map(([k, v]) => [k, v.label])),
  voice: 'Said "ow"',
  manual: 'Pain button',
};

export const EVENT_LABEL = {
  mild: 'Eased off',
  moderate: 'Pain check',
  voice: 'Pain check (voice)',
  manual: 'Pain check (button)',
};

export const ACTION_LABEL = {
  eased: 'range reduced',
  continued: 'continued',
  regressed: 'switched to easier level',
  stopped: 'exercise stopped',
};

export function sortedSessions(state) {
  return [...state.sessions].sort((a, b) => new Date(a.date) - new Date(b.date));
}
