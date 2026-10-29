import { store } from '../store.js';
import { h, icon, painPill, fmtDate, fmtTime, fmtDur, emptyState, levelBadge } from '../ui.js';
import { byId } from '../core/exercises.js';
import { exName, SIGNAL_LABEL, EVENT_LABEL, ACTION_LABEL, sortedSessions } from './common.js';

export function render(root, { rest }) {
  const sessions = sortedSessions(store.get()).reverse();
  if (rest[0]) return detail(root, sessions.find((s) => s.id === rest[0]));

  root.append(h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, 'History'), h('p', {}, `${sessions.length} session${sessions.length === 1 ? '' : 's'} recorded`))));
  if (!sessions.length) {
    root.append(h('div', { class: 'card' }, emptyState('No sessions yet', 'Finish a session and it will appear here with reps, form, range and any discomfort that was detected.', h('a', { class: 'btn btn-primary', href: '#/session' }, 'Start a session'))));
    return;
  }
  root.append(h('div', { class: 'card', style: { padding: '8px 12px' } }, h('div', { class: 'table-scroll' },
    h('table', { class: 'history-table' },
      h('thead', {}, h('tr', {}, ['Date', 'Exercises', 'Reps', 'Avg form', 'Discomfort', 'Pain before → after', ''].map((t) => h('th', {}, t)))),
      h('tbody', {}, sessions.map((s) => {
        const reps = s.exercises.reduce((a, e) => a + (e.reps ?? 0), 0);
        const forms = s.exercises.map((e) => e.formScore).filter((x) => x != null);
        const events = s.exercises.reduce((a, e) => a + (e.events?.length ?? 0), 0);
        const go = () => { location.hash = `#/history/${s.id}`; };
        return h('tr', { tabindex: 0, onclick: go, onkeydown: (e) => e.key === 'Enter' && go() },
          h('td', {}, h('strong', {}, fmtDate(s.date)), h('div', { class: 'small faint' }, `${fmtTime(s.date)}${s.sample ? ' · sample' : ''}`)),
          h('td', {}, String(s.exercises.length)),
          h('td', {}, String(reps)),
          h('td', {}, forms.length ? `${Math.round(forms.reduce((a, b) => a + b, 0) / forms.length)}%` : '—'),
          h('td', {}, events ? h('span', { class: 'pill band-serious' }, `${events} flagged`) : h('span', { class: 'faint' }, 'None')),
          h('td', {}, h('span', { class: 'row', style: { gap: '4px' } }, painPill(s.painBefore), '→', painPill(s.painAfter))),
          h('td', {}, icon('chevron', 16)));
      }))))));
}

function detail(root, s) {
  root.append(h('a', { href: '#/history', class: 'small', style: { display: 'inline-block', marginBottom: '12px' } }, '← All sessions'));
  if (!s) {
    root.append(h('div', { class: 'card' }, emptyState('Session not found', 'It may have been deleted.')));
    return;
  }
  const reps = s.exercises.reduce((a, e) => a + (e.reps ?? 0), 0);
  root.append(h('div', { class: 'page-head' }, h('div', {},
    h('h1', {}, fmtDate(s.date, { weekday: 'long', day: 'numeric', month: 'long' })),
    h('p', {}, `${fmtTime(s.date)} · ${fmtDur(s.durationSec ?? 0)} · ${reps} reps${s.sample ? ' · sample data' : ''}`)),
  h('div', { class: 'row' }, h('span', { class: 'muted small' }, 'Pain'), painPill(s.painBefore), '→', painPill(s.painAfter))));

  if (s.levelChanges?.length) {
    root.append(h('div', { class: 'callout info', style: { marginBottom: '16px' } }, icon('info'),
      h('div', {}, s.levelChanges.map((c) => h('p', { class: 'small' }, h('strong', {}, exName(c.id)), `: ${c.reason}${c.from !== c.to ? ` (${byId[c.id].levels[c.from].name} → ${byId[c.id].levels[c.to].name})` : ''}`)))));
  }

  root.append(h('div', { class: 'grid grid-2' }, s.exercises.map((e) => {
    const spec = byId[e.id];
    return h('section', { class: 'card stack', style: { gap: '12px' } },
      h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h2', {}, spec.name), levelBadge(spec, e.level)),
      h('div', { class: 'summary-grid', style: { gridTemplateColumns: 'repeat(3, minmax(0,1fr))' } },
        mini('Reps', `${e.reps}/${e.targetReps}`),
        mini('Form', e.formScore == null ? '—' : `${e.formScore}%`),
        mini('Best range', e.peakBest == null ? '—' : `${e.peakBest}${e.unit}`)),
      e.sensor ? h('p', { class: 'small muted' }, `Back sensor (${e.sensor.mode === 'dual' ? 'two sensors' : 'one sensor'}): trunk bend up to ${e.sensor.trunkFlexMax ?? '—'}°${e.sensor.lumbarFlexMax != null ? `, lower back up to ${e.sensor.lumbarFlexMax}°` : ''}`) : null,
      e.asymmetry ? h('p', { class: 'small muted' }, `Average left ${e.asymmetry.left}${e.unit} · right ${e.asymmetry.right}${e.unit} (${e.asymmetry.pct}% difference)`) : null,
      Object.keys(e.formCounts ?? {}).length ? h('p', { class: 'small muted' }, `Form cues: ${Object.entries(e.formCounts).map(([k, n]) => `${k.replace('-', ' ')} ×${n}`).join(', ')}`) : null,
      e.skipped ? h('p', { class: 'small faint' }, 'Skipped') : null,
      e.events?.length
        ? h('ul', { class: 'timeline' }, e.events.map((ev) => h('li', {},
          h('span', { class: 'tl-dot', style: { background: ev.level === 'mild' ? 'var(--warning)' : 'var(--critical)' } }),
          h('div', {}, h('strong', {}, `${EVENT_LABEL[ev.level] ?? ev.level}`), ` at ${Math.round(ev.t)}s`,
            ev.rating != null ? ` · rated ${ev.rating}/10` : '', ev.action ? ` · ${ACTION_LABEL[ev.action] ?? ev.action}` : '',
            ev.signals?.length ? h('div', { class: 'small faint' }, `Signals: ${ev.signals.map((x) => SIGNAL_LABEL[x] ?? x).join(', ')}`) : null))))
        : h('p', { class: 'small faint' }, 'No discomfort detected'),
      h('div', { class: 'row small muted' }, 'Pain during:', painPill(e.painRating), e.feel ? h('span', { class: 'chip' }, { easy: 'Felt easy', right: 'Just right', hard: 'Felt hard' }[e.feel]) : null));
  })));

  root.append(h('div', { style: { marginTop: '20px' } }, h('button', {
    class: 'btn btn-danger btn-sm',
    type: 'button',
    onclick: () => {
      if (!confirm('Delete this session? This cannot be undone.')) return;
      store.update((st) => {
        st.sessions = st.sessions.filter((x) => x.id !== s.id);
      });
      location.hash = '#/history';
    },
  }, icon('trash', 14), 'Delete session')));
}

function mini(label, value) {
  return h('div', { class: 'stat' }, h('div', { class: 'stat-label' }, label), h('div', { class: 'stat-value', style: { fontSize: '22px' } }, value));
}
