import { store } from '../store.js';
import { h, icon, painPill, fmtDate, fmtRel, levelBadge, emptyState, toast } from '../ui.js';
import { lineChart, barList } from '../charts.js';
import { exerciseFigure } from '../figures.js';
import { byId } from '../core/exercises.js';
import { screeningStatus, todaysPlan, computeStats, painTriggers, sampleSessions } from '../program.js';
import { emergencyCallout } from './safety.js';
import { repText, exName, SIGNAL_LABEL, sortedSessions } from './common.js';

function greeting() {
  const hr = new Date().getHours();
  return hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
}

function stat(label, value, unit, delta, ic) {
  return h('div', { class: 'card stat' },
    h('div', { class: 'stat-label' }, ic ? icon(ic, 15) : null, label),
    h('div', { class: 'stat-value' }, value, unit ? h('small', {}, unit) : null),
    h('div', { class: 'stat-delta' }, delta ?? ' '));
}

function deltaText(cur, prev, { lowerIsBetter = false, digits = 0, unit = '', period = 'vs previous 7 days' } = {}) {
  if (cur == null || prev == null) return h('span', {}, 'No earlier data to compare');
  const d = cur - prev;
  if (Math.abs(d) < 10 ** -digits / 2) return h('span', {}, `No change ${period}`);
  const good = lowerIsBetter ? d < 0 : d > 0;
  return h('span', {}, h('span', { class: good ? 'delta-good' : 'delta-bad' }, `${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(digits)}${unit}`), ` ${period}`);
}

export function render(root) {
  const state = store.get();
  const sessions = sortedSessions(state);
  const status = screeningStatus(state.profile?.screening);
  const plan = todaysPlan(state);
  const stats = computeStats(sessions);
  const hasSample = sessions.some((s) => s.sample);

  const loadSample = () => {
    store.update((s) => {
      s.sessions = [...s.sessions.filter((x) => !x.sample), ...sampleSessions()];
    });
    toast('Sample data loaded. Clear it any time.');
    root.replaceChildren();
    render(root);
  };
  const clearSample = () => {
    store.update((s) => {
      s.sessions = s.sessions.filter((x) => !x.sample);
    });
    toast('Sample data cleared');
    root.replaceChildren();
    render(root);
  };

  root.append(h('div', { class: 'page-head' },
    h('div', {}, h('h1', {}, `${greeting()}${state.profile?.name ? `, ${state.profile.name}` : ''}`),
      h('p', {}, `${fmtDate(Date.now(), { weekday: 'long', day: 'numeric', month: 'long' })} · ${stats.sessions7 ? `${stats.sessions7} session${stats.sessions7 === 1 ? '' : 's'} in the last 7 days` : 'Let’s get moving'}`)),
    h('div', { class: 'row' },
      h('a', { class: 'btn', href: '#/session?demo=1' }, icon('play', 16), 'Demo (no camera)'),
      h('a', { class: 'btn btn-primary', href: '#/session' }, icon('session', 18), 'Start session'))));

  if (hasSample) {
    root.append(h('div', { class: 'callout info sample-banner' }, icon('info'),
      h('div', { class: 'spacer' }, h('strong', {}, 'You’re looking at sample data. '), 'It shows how the dashboard fills in after a few weeks of sessions.'),
      h('button', { class: 'btn btn-sm', type: 'button', onclick: clearSample }, 'Clear sample data')));
  }

  if (!status.done) {
    root.append(h('div', { class: 'card', style: { marginBottom: '16px' } },
      h('div', { class: 'row', style: { alignItems: 'flex-start', gap: '16px' } },
        h('div', { class: 'brand-mark', style: { width: '44px', height: '44px', borderRadius: '12px' } }, icon('safety', 22)),
        h('div', { class: 'spacer' },
          h('h2', {}, 'Start with the 2-minute safety check'),
          h('p', { class: 'muted', style: { marginTop: '4px' } }, 'A few questions screen for warning signs that need a doctor rather than exercise, and tailor your starting plan to where your pain is and what makes it worse.')),
        h('div', { class: 'row' },
          !hasSample ? h('button', { class: 'btn', type: 'button', onclick: loadSample }, 'Preview with sample data') : null,
          h('a', { class: 'btn btn-primary', href: '#/safety' }, 'Start safety check')))));
  } else if (status.emergency) {
    root.append(h('div', { style: { marginBottom: '16px' } }, emergencyCallout()));
  } else if (status.needsRescreen) {
    root.append(h('div', { class: 'callout warn', style: { marginBottom: '16px' } }, icon('safety'),
      h('div', { class: 'spacer' }, h('strong', {}, 'Time to redo your safety check. '), status.outdated ? 'It now asks each warning sign separately.' : 'Your last one is more than 4 weeks old.'),
      h('a', { class: 'btn btn-sm', href: '#/safety' }, 'Redo safety check')));
  } else if (status.blocked) {
    root.append(h('div', { class: 'callout danger', style: { marginBottom: '16px' } }, icon('alert'),
      h('div', {}, h('strong', {}, 'Please see a doctor before exercising. '), `Your safety check flagged: ${status.unclearedFlags.map((f) => f.text.toLowerCase()).join('; ')}. `,
        h('a', { href: '#/safety' }, 'Update safety check'))));
  }

  // KPI row
  root.append(h('div', { class: 'grid grid-kpi', style: { marginBottom: '16px' } },
    stat('Weeks on track', String(stats.weeksOnTrack), stats.weeksOnTrack === 1 ? 'week' : 'weeks', h('span', {}, '2+ sessions a week. Rest and flare days count too')),
    stat('Sessions this week', `${stats.sessions7}`, `/ ${stats.weeklyGoal}`, deltaText(stats.sessions7, stats.sessionsPrev7)),
    stat('Average pain', stats.pain7 == null ? '—' : stats.pain7.toFixed(1), '/10', deltaText(stats.pain7, stats.painPrev7, { lowerIsBetter: true, digits: 1 })),
    stat('Total reps', stats.totalReps.toLocaleString(), null, h('span', {}, `${stats.totalMinutes} min of movement`))));

  const left = h('div', { class: 'stack' });
  const right = h('div', { class: 'stack' });
  root.append(h('div', { class: 'grid grid-main' }, left, right));

  // Pain chart
  const labels = sessions.map((s) => fmtDate(s.date, { day: 'numeric', month: 'short' }));
  left.append(h('section', { class: 'card' },
    h('div', { class: 'section-title' }, h('h2', {}, 'Pain over time'), h('p', {}, 'Rated before and after each session, 0–10')),
    sessions.length >= 2
      ? lineChart({ labels, title: 'Pain before and after each session', yMax: 10, series: [
        { name: 'Before session', color: '--series-1', values: sessions.map((s) => s.painBefore ?? null) },
        { name: 'After session', color: '--series-2', values: sessions.map((s) => s.painAfter ?? null) },
      ] })
      : emptyState('Your pain trend appears after two sessions', 'Each session asks how your back feels before and after. Watching that line drift down is the best motivation there is.')));

  // Mobility chart
  const peak = (s, id) => s.exercises.find((e) => e.id === id)?.peakBest ?? null;
  const mobSessions = sessions.filter((s) => peak(s, 'hip-hinge') != null || peak(s, 'side-bend') != null);
  left.append(h('section', { class: 'card' },
    h('div', { class: 'section-title' }, h('h2', {}, 'Range of motion'), h('p', {}, 'Best rep each session, in degrees')),
    mobSessions.length >= 2
      ? lineChart({ labels: mobSessions.map((s) => fmtDate(s.date, { day: 'numeric', month: 'short' })), unit: '°', title: 'Range of motion per session', series: [
        { name: 'Forward bend (hip hinge)', color: '--series-1', values: mobSessions.map((s) => peak(s, 'hip-hinge')) },
        { name: 'Side bend', color: '--series-2', values: mobSessions.map((s) => peak(s, 'side-bend')) },
      ] })
      : emptyState('Mobility tracking starts with your first hinge', 'The camera measures how far you bend forward and sideways. Over a few weeks this chart shows your back loosening up.')));

  // Form quality
  const formBy = {};
  for (const s of sessions.slice(-12)) for (const e of s.exercises) if (e.formScore != null) (formBy[e.id] ??= []).push(e.formScore);
  const formRows = Object.entries(formBy).map(([id, arr]) => {
    const v = Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
    return { label: exName(id), value: v, display: `${v}%`, sub: `${arr.length} session${arr.length > 1 ? 's' : ''}` };
  }).sort((a, b) => b.value - a.value);
  left.append(h('section', { class: 'card' },
    h('div', { class: 'section-title' }, h('h2', {}, 'Form quality'), h('p', {}, 'Reps without a form correction, last 12 sessions')),
    barList(formRows, { max: 100, color: '--series-1', empty: 'Form scores appear after your first session.' })));

  // Today's plan
  if (plan) {
    const planCard = h('section', { class: 'card' },
      h('div', { class: 'section-title' }, h('h2', {}, 'Today’s plan'), h('p', {}, `About ${plan.minutes} min · ${plan.items.length} exercises`)));
    if (plan.notes.length) planCard.append(h('div', { class: 'callout warn', style: { marginBottom: '8px' } }, icon('info'), h('div', { class: 'small' }, plan.notes.map((n) => h('p', {}, n)))));
    planCard.append(h('ul', { class: 'plan-list' }, plan.items.map((it) => {
      const spec = byId[it.id];
      return h('li', { class: 'plan-item' },
        exerciseFigure(it.id),
        h('div', {}, h('h3', {}, spec.name), h('p', {}, repText(spec, it.level, it.repScale)),
          it.reasons.map((r) => h('div', { class: 'reason' }, icon('info', 12), r))),
        levelBadge(spec, it.level));
    })));
    if (plan.skipped.length) planCard.append(h('p', { class: 'small faint', style: { marginTop: '8px' } }, plan.skipped.map((x) => `${exName(x.id)}: ${x.reason}.`).join(' ')));
    planCard.append(h('a', { class: 'btn btn-primary', href: '#/session', style: { marginTop: '14px', width: '100%' } }, icon('session'), status.blocked ? 'See a doctor first' : status.needsRescreen ? 'Redo safety check first' : 'Start today’s session'));
    right.append(planCard);
  }

  // What felt harder
  const triggers = painTriggers(sessions);
  right.append(h('section', { class: 'card' },
    h('div', { class: 'section-title' }, h('h2', {}, 'What felt harder'), h('p', {}, 'Last 30 days')),
    triggers.length
      ? barList(triggers.map((t) => {
        const sig = Object.entries(t.signals).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => SIGNAL_LABEL[k] ?? k);
        return { label: exName(t.id), value: t.serious * 2 + (t.events - t.serious), display: [t.serious ? `${t.serious} pain check${t.serious === 1 ? '' : 's'}` : null, t.events > t.serious ? `${t.events - t.serious} ease-off` : null].filter(Boolean).join(' · '), sub: sig.length ? `Detected via ${sig.join(', ').toLowerCase()}` : null };
      }), { color: '--series-2' })
      : h('p', { class: 'muted small' }, 'Nothing has felt harder yet. When an exercise does, it shows up here with what was noticed (a drop in range, slowing, guarding or shaking) and how you rated it.')));

  // Recent sessions
  const recent = sessions.slice(-5).reverse();
  right.append(h('section', { class: 'card' },
    h('div', { class: 'section-title' }, h('h2', {}, 'Recent sessions'), recent.length ? h('a', { href: '#/history', class: 'small' }, 'View all') : null),
    recent.length
      ? h('div', { class: 'recent-list' }, recent.map((s) => h('a', { class: 'recent-item', href: `#/history/${s.id}` },
        h('div', {}, h('h3', {}, fmtRel(s.date)), h('p', {}, `${s.exercises.length} exercises · ${s.exercises.reduce((a, e) => a + (e.reps ?? 0), 0)} reps${s.exercises.some((e) => e.events?.length) ? ' · check-ins' : ''}`)),
        h('div', { class: 'row', style: { gap: '4px' } }, painPill(s.painBefore), h('span', { class: 'faint' }, '→'), painPill(s.painAfter)),
        icon('chevron', 16))))
      : h('div', {}, h('p', { class: 'muted small' }, 'No sessions yet.'),
        !hasSample ? h('button', { class: 'link-btn', type: 'button', style: { marginTop: '6px' }, onclick: loadSample }, 'Preview the dashboard with sample data') : null)));
}
