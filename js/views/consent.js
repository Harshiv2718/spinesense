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
        h('li', {}, 'your body landmarks (33 points per camera frame) and any back-sensor or phone readings'),
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

// ---------- user-test participation ----------
// Testers aren't supervised, so before their first camera session they read how the test works and
// confirm they're adults. Versioned: a changed information sheet asks again.

export const TEST_CONSENT_VERSION = 1;

export function testConsent() {
  const c = store.get().consent?.test;
  return c?.version === TEST_CONSENT_VERSION ? c : null;
}

/** Shows the tester information sheet. Resolves true once the tester agrees. */
export function askTestConsent() {
  return new Promise((resolve) => {
    const agree = h('button', { class: 'btn btn-primary', type: 'button', disabled: true }, 'I agree, continue');
    const boxes = [
      'I’m 18 or over.',
      'I understand SpineSense is an early, unvalidated prototype, and that I stop if anything hurts.',
      'I won’t put my name or health details in the public feedback form.',
    ].map((text) => h('input', { type: 'checkbox', 'aria-label': text, onchange: () => { agree.disabled = !boxes.every((b) => b.checked); } }));
    let dlg;
    const done = (ok) => {
      dlg.close();
      resolve(ok);
    };
    agree.addEventListener('click', () => {
      store.update((s) => {
        s.consent = { ...(s.consent ?? {}), test: { version: TEST_CONSENT_VERSION, at: new Date().toISOString() } };
      });
      done(true);
    });
    dlg = modal(h('div', { class: 'stack' },
      h('h2', {}, 'About this test'),
      h('ul', { class: 'small', style: { margin: 0, paddingLeft: '18px' } },
        h('li', {}, 'SpineSense is a student portfolio project by its developer (GitHub: Harshiv2718). This test checks whether the camera coaching works and is easy to use.'),
        h('li', {}, 'It’s an early prototype: its rep counting and discomfort signals are tuned on simulated movement and haven’t been validated on people. It isn’t a medical device and can’t diagnose anything.'),
        h('li', {}, 'Taking part is voluntary. Stop any time, for any reason.'),
        h('li', {}, 'Only do exercises that feel comfortable. Stop if pain increases. If pain spreads down a leg, or comes with numbness, weakness, or bladder or bowel changes, stop and see a doctor.'),
        h('li', {}, 'Your video is analysed on this device and never recorded or sent. Your answers and sessions stay in this browser; Settings → Delete all data removes them. Nothing reaches the developer unless you send it.'),
        h('li', {}, 'To track your body the page downloads software from jsDelivr and Google, and the site is hosted by GitHub. Like any website, they see your IP address and browser, never your video or answers.'),
        h('li', {}, 'The feedback form is a public GitHub issue linked to your account. You can edit what you posted, or ask the developer to delete it.')),
      ...boxes.map((b, i) => h('label', { class: 'choice' }, b, h('span', {}, b.getAttribute('aria-label')))),
      h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: () => done(false) }, 'Not now'), agree)),
    { label: 'About this test', dismissable: false });
  });
}
