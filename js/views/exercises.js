import { store } from '../store.js';
import { h, icon } from '../ui.js';
import { EXERCISES, POSITION_LABEL, VIEW_LABEL } from '../core/exercises.js';
import { exerciseFigure } from '../figures.js';
import { painTriggers } from '../program.js';
import { repText } from './common.js';

export function render(root) {
  const state = store.get();
  const triggers = Object.fromEntries(painTriggers(state.sessions, 30).map((t) => [t.id, t]));

  root.append(h('div', { class: 'page-head' },
    h('div', {}, h('h1', {}, 'Exercise library'),
      h('p', {}, 'Seven exercises commonly used in back-pain rehab. Each one is tracked by the camera, with three levels to move between.'))));

  root.append(h('div', { class: 'ex-grid' }, EXERCISES.map((spec) => {
    const level = state.progress[spec.id]?.level ?? 0;
    const trig = triggers[spec.id];
    return h('article', { class: 'card ex-card' },
      exerciseFigure(spec.id),
      h('div', {},
        h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h2', {}, spec.name), h('span', { class: 'chip' }, spec.category)),
        h('p', { class: 'muted small', style: { marginTop: '4px' } }, spec.short)),
      h('div', { class: 'meta' },
        h('span', { class: 'chip' }, POSITION_LABEL[spec.position]),
        h('span', { class: 'chip' }, icon('camera', 13), VIEW_LABEL[spec.view]),
        trig ? h('span', { class: 'pill band-warning' }, `Felt harder ${trig.events} time${trig.events > 1 ? 's' : ''}`) : null),
      h('ol', {}, spec.steps.map((st) => h('li', {}, st))),
      h('div', { class: 'callout', style: { padding: '10px 12px' } }, icon('info', 15), h('p', { class: 'small' }, spec.caution)),
      h('div', { class: 'levels' }, spec.levels.map((L, i) => h('div', { class: `lvl${i === level ? ' current' : ''}` },
        h('strong', {}, L.name), repText(spec, i), h('br'), L.note))),
      h('details', {}, h('summary', { class: 'small', style: { cursor: 'pointer', color: 'var(--ink-2)' } }, 'Why this helps'), h('p', { class: 'small muted', style: { marginTop: '6px' } }, spec.why)),
      h('div', { class: 'foot' },
        h('a', { class: 'btn btn-primary btn-sm', href: `#/session?ex=${spec.id}` }, icon('session', 15), 'Practice'),
        h('a', { class: 'btn btn-sm', href: `#/session?ex=${spec.id}&demo=1` }, 'Watch demo')));
  })));
}
