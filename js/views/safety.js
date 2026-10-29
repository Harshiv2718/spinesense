import { store } from '../store.js';
import { h, icon, painScale, toast, fmtDate } from '../ui.js';
import {
  EMERGENCY_FLAGS, DOCTOR_FLAGS, CAUTIONS, AGGRAVATORS, LOCATIONS, DURATIONS, NO_PAIN, CLEARANCE_DAYS, TEST_ROUND, TEST_DEMO_MESSAGE,
  initialProgress, screeningStatus, screeningAnswered, buildScreening,
} from '../program.js';
import { EXERCISES } from '../core/exercises.js';

// A way out for a mistaken "Yes". It only opens the safety check: the lock stays until that is redone.
const redoLink = () => h('p', { class: 'small', style: { marginTop: '8px' } },
  h('a', { href: '#/safety', onclick: () => { if (location.hash === '#/safety') setTimeout(() => location.reload(), 0); } }, 'I answered by mistake: redo the safety check'));

export function emergencyCallout({ redo = true } = {}) {
  return h('div', { class: 'callout danger', role: 'alert' }, icon('alert'),
    h('div', {},
      h('strong', {}, 'These can be signs of cauda equina syndrome, a medical emergency.'),
      h('p', { class: 'small', style: { marginTop: '4px' } }, 'Go to an emergency department now, or call your local emergency number. Do not exercise. SpineSense stays locked until you redo this safety check and none of these apply.'),
      redo ? redoLink() : null));
}

export function render(root) {
  const state = store.get();
  const prev = state.profile?.screening;
  // Warning signs and clearances start blank every time: nothing carries over from an earlier check.
  const draft = {
    name: state.profile?.name ?? '',
    redFlags: {},
    cautions: {},
    cleared: {},
    noPain: false,
    location: prev?.location ?? null,
    duration: prev?.duration ?? null,
    painNow: null,
    aggravators: [...(prev?.aggravators ?? [])],
  };

  root.append(h('div', { class: 'page-head' },
    h('div', {}, h('h1', {}, 'Safety check'),
      h('p', {}, prev ? `Last completed ${fmtDate(prev.date)}. Answer the warning signs fresh each time; redo it whenever your symptoms change.` : 'Two minutes. It screens for warning signs and tailors your starting plan.'))));

  // Inside the form a mistaken tick is simply unticked, so no redo link here.
  const emergencyBox = emergencyCallout({ redo: false });
  emergencyBox.hidden = true;
  const update = () => {
    emergencyBox.hidden = !EMERGENCY_FLAGS.some((f) => draft.redFlags[f.id]);
  };

  const flagItem = (it, bag, { clearance, note } = {}) => {
    const clearRow = clearance
      ? h('label', { class: 'choice clear-row', hidden: !bag[it.id] },
        h('input', { type: 'checkbox', onchange: (e) => { draft.cleared[it.id] = e.target.checked; } }),
        h('span', {}, clearance))
      : null;
    const noteRow = note ? h('p', { class: 'small flag-note', hidden: !bag[it.id] }, note) : null;
    return h('div', { class: 'flag-item' },
      h('label', { class: 'choice flag' },
        h('input', { type: 'checkbox', checked: !!bag[it.id], onchange: (e) => {
          bag[it.id] = e.target.checked;
          if (clearRow) clearRow.hidden = !e.target.checked;
          if (noteRow) noteRow.hidden = !e.target.checked;
          if (!e.target.checked) draft.cleared[it.id] = false;
          update();
        } }),
        h('span', {}, it.text)),
      noteRow, clearRow);
  };

  const radios = (name, items, key) => h('div', { class: 'choice-grid' }, items.map((it) => h('label', { class: 'choice' },
    h('input', { type: 'radio', name, value: it.id, checked: draft[key] === it.id, onchange: () => { draft[key] = it.id; } }),
    h('span', {}, it.label))));

  // "No back pain right now" hides only these pain questions; the warning signs above are always asked.
  const painFields = [
    h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Where do you feel it?'), radios('location', LOCATIONS, 'location')),
    h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'How long have you had it?'), radios('duration', DURATIONS, 'duration')),
    h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'How bad is it right now?'), painScale(draft.painNow, (n) => { draft.painNow = n; })),
    h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'What makes it worse?'), h('small', {}, 'Tick all that apply. This picks which exercises to start with.'),
      h('div', { class: 'choice-grid' }, AGGRAVATORS.map((a) => h('label', { class: 'choice' },
        h('input', { type: 'checkbox', checked: draft.aggravators.includes(a.id), onchange: (e) => {
          draft.aggravators = e.target.checked ? [...draft.aggravators, a.id] : draft.aggravators.filter((x) => x !== a.id);
        } }),
        h('span', {}, a.label))))),
  ];
  const noPainChoice = h('label', { class: 'choice' },
    h('input', { type: 'checkbox', checked: draft.noPain, onchange: (e) => {
      draft.noPain = e.target.checked;
      for (const el of painFields) el.hidden = draft.noPain;
    } }),
    h('span', {}, NO_PAIN.label));

  // The test round ignores self-reported clearances, so their checkboxes are not offered.
  const form = h('form', { class: 'stack', novalidate: true });
  form.append(
    h('section', { class: 'card stack' },
      h('div', {}, h('h2', {}, '1. Emergency signs'), h('p', { class: 'muted small' }, 'Tick anything that is new or getting worse.')),
      h('div', { class: 'choice-list' }, EMERGENCY_FLAGS.map((f) => flagItem(f, draft.redFlags))),
      emergencyBox),
    h('section', { class: 'card stack' },
      h('div', {}, h('h2', {}, '2. See a doctor first'), h('p', { class: 'muted small' }, TEST_ROUND ? 'Tick anything that applies.' : `Tick anything that applies. If a doctor or physio has already checked it, tick the box underneath; that clearance lasts ${CLEARANCE_DAYS} days.`)),
      h('div', { class: 'choice-list' }, DOCTOR_FLAGS.map((f) => flagItem(f, draft.redFlags, {
        clearance: TEST_ROUND ? null : 'A doctor or physio has assessed this and cleared me to exercise',
        note: f.urgent ? 'See a doctor within about 2 weeks.' : null,
      })))),
    h('section', { class: 'card stack' },
      h('div', {}, h('h2', {}, '3. Take extra care'), h('p', { class: 'muted small' }, TEST_ROUND ? 'Tick anything that applies.' : 'Without a clinician’s OK, your plan stays at the Gentle level.')),
      h('div', { class: 'choice-list' }, CAUTIONS.map((c) => flagItem(c, draft.cautions, { clearance: TEST_ROUND ? null : 'My clinician has OK’d this kind of exercise' })))),
    h('section', { class: 'card stack' },
      h('h2', {}, '4. About your pain'),
      noPainChoice,
      painFields),
    h('section', { class: 'card stack' },
      h('h2', {}, '5. About you'),
      h('div', { class: 'field' }, h('label', { for: 'name' }, 'First name (optional)'),
        h('input', { type: 'text', id: 'name', value: draft.name, maxlength: 40, autocomplete: 'given-name', oninput: (e) => { draft.name = e.target.value; } })),
      h('p', { class: 'small muted' }, 'Everything you enter stays in this browser on this device.')),
  );
  const error = h('p', { class: 'small', style: { color: 'var(--critical-text)' }, role: 'alert' });
  form.append(h('div', { class: 'row' }, h('button', { class: 'btn btn-primary btn-lg', type: 'submit' }, 'Save safety check'), error));
  root.append(form);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!screeningAnswered(draft)) {
      error.textContent = `Please answer where the pain is, how long you’ve had it, and how bad it is now, or tick “${NO_PAIN.label}”.`;
      return;
    }
    // A fresh screening replaces the old one, which clears any emergency reported in a session's quick check.
    const screening = buildScreening(draft);
    store.update((s) => {
      s.profile = { ...(s.profile ?? {}), name: draft.name.trim(), screening };
      const init = initialProgress(screening);
      for (const ex of EXERCISES) s.progress[ex.id] ??= init[ex.id];
    });
    const st = screeningStatus(screening);
    if (st.emergency) {
      root.replaceChildren(h('div', { class: 'page-head' }, h('h1', {}, 'Please get medical help now')), emergencyCallout(),
        h('p', { class: 'muted', style: { marginTop: '16px' } }, h('a', { href: '#/safety', onclick: () => setTimeout(() => location.reload(), 0) }, 'Redo the safety check'), ' once a doctor has seen you and these symptoms have gone.'));
      window.scrollTo({ top: 0 });
      return;
    }
    if (st.testDemoOnly) {
      root.replaceChildren(h('div', { class: 'page-head' }, h('h1', {}, 'Safety check saved')),
        h('div', { class: 'callout info' }, icon('info'), h('div', {},
          h('strong', {}, TEST_DEMO_MESSAGE),
          st.flags.length ? h('p', { class: 'small', style: { marginTop: '4px' } }, `Please also see a doctor about: ${st.flags.map((f) => f.text.toLowerCase()).join('; ')}.`) : null)),
        h('div', { class: 'row', style: { marginTop: '16px' } },
          h('a', { class: 'btn btn-primary', href: '#/session?demo=1' }, icon('play', 16), 'Watch the demo'),
          h('a', { class: 'btn', href: '#/dashboard' }, 'Go to the dashboard')));
      window.scrollTo({ top: 0 });
      return;
    }
    if (st.blocked) {
      toast('Saved. Please see a doctor before starting exercise.', { tone: 'warn', ms: 5000 });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    toast(st.restricted ? 'Saved. Your plan stays Gentle until a clinician OKs more.' : 'Safety check saved. Your plan is ready.');
    location.hash = '#/dashboard';
  });
}
