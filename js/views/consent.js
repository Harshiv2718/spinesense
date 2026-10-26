// Consent for recording training clips. Asked once, versioned, and withdrawable (which deletes all clips).

import { store } from '../store.js';
import { h, icon, modal, toast } from '../ui.js';
import { deleteAllClips } from '../data/clipstore.js';

export const CLIP_CONSENT_VERSION = 1;

export function clipConsent() {
  const c = store.get().consent?.clips;
  return c?.version === CLIP_CONSENT_VERSION ? c : null;
}

/** Shows the consent dialog. Resolves true if the user allows recording. */
export function askClipConsent() {
  return new Promise((resolve) => {
    const allow = h('button', { class: 'btn btn-primary', type: 'button', disabled: true }, 'Allow recording');
    const agree = h('input', { type: 'checkbox', onchange: (e) => { allow.disabled = !e.target.checked; } });
    let dlg;
    const done = (ok) => {
      dlg.close();
      resolve(ok);
    };
    allow.addEventListener('click', () => {
      store.update((s) => {
        s.consent = { ...(s.consent ?? {}), clips: { version: CLIP_CONSENT_VERSION, at: new Date().toISOString(), scopes: ['landmarks', 'sensors', 'self-report'] } };
      });
      toast('Clip recording allowed. Manage or withdraw it on the Recordings page.');
      done(true);
    });
    dlg = modal(h('div', { class: 'stack' },
      h('h2', {}, 'Record training clips?'),
      h('p', { class: 'muted' }, 'A clip saves what SpineSense measured during the session, so it can be checked and used to improve the tracking:'),
      h('ul', { class: 'small', style: { margin: 0, paddingLeft: '18px' } },
        h('li', {}, 'your body landmarks (33 points per camera frame) and back-sensor readings'),
        h('li', {}, 'the exercises, reps and timings, and the pain and leg-symptom answers you give'),
        h('li', {}, h('strong', {}, 'no video or images'), ', ever')),
      h('div', { class: 'callout', style: { padding: '10px 12px' } }, icon('safety', 15), h('div', { class: 'small' },
        h('p', {}, 'Clips are stored only in this browser, on this device. Nothing is uploaded.'),
        h('p', {}, 'You can review, download or delete any clip on the Recordings page. Withdrawing consent deletes all of them.'),
        h('p', {}, 'Movement data can sometimes identify a person, so only share a downloaded clip with people you trust.'),
        h('p', {}, 'Only record yourself, or an adult who has agreed to it.'))),
      h('label', { class: 'choice' }, agree, h('span', {}, 'I understand, and I want to record training clips')),
      h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: () => done(false) }, 'Not now'), allow)),
    { label: 'Recording consent', dismissable: false });
  });
}

export async function withdrawClipConsent() {
  await deleteAllClips();
  store.update((s) => {
    if (s.consent) delete s.consent.clips;
  });
}
