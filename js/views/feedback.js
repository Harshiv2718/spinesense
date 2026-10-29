// Help & feedback: what to try during a user test, how to report it, and exactly what a report holds.
// Feedback goes to public GitHub issues, so nothing here ever adds health details to it.

import { store } from '../store.js';
import { h, icon, toast } from '../ui.js';
import { VERSION, buildInfo } from '../version.js';
import { screeningStatus } from '../program.js';
import { testConsent, askTestConsent } from './consent.js';

export const FEEDBACK_URL = 'https://github.com/Harshiv2718/spinesense/issues/new?template=tester-feedback.yml';

// auto: ticks itself from what the app already knows; the rest the tester ticks.
// Goals rather than button names, so the test shows whether people can find their way; safety actions
// keep their labels.
const TASKS = [
  { id: 'safety', label: 'Find out whether SpineSense thinks it’s OK for you to exercise today', auto: (s) => screeningStatus(s.profile?.screening).done },
  { id: 'demo', label: 'Without turning on your camera, see what a session will be like' },
  { id: 'setup', label: 'Set up your camera so SpineSense can see you for a standing exercise' },
  { id: 'camera', label: 'Do two or three standing exercises, only as far as is comfortable', auto: (s) => s.sessions.some((x) => !x.sample && x.exercises?.some((e) => e.reps > 0)) },
  { id: 'pain', label: 'Pretend an exercise starts to hurt: press “I feel pain” and answer what it asks (no real pain needed)' },
  { id: 'skip', label: 'You don’t want to do an exercise: move past it, then finish the session' },
  { id: 'review', label: 'Find out what SpineSense suggests for next time, and how today compares with earlier sessions' },
  { id: 'privacy', label: 'Find out whether your video is stored or sent anywhere' },
  { id: 'phone', label: 'Optional: check the camera against your phone strapped to your back', optional: true },
  { id: 'feedback', label: 'Send your feedback (about 5 minutes)', href: FEEDBACK_URL, external: true },
];

export async function deviceInfo() {
  const b = await buildInfo();
  const gl = (() => {
    try {
      return !!document.createElement('canvas').getContext('webgl2');
    } catch {
      return false;
    }
  })();
  return [
    `SpineSense ${VERSION} (${b.sha})`,
    `Browser: ${navigator.userAgent}`,
    `Screen: ${screen.width}×${screen.height} at ${devicePixelRatio}x; window ${innerWidth}×${innerHeight}`,
    `CPU cores: ${navigator.hardwareConcurrency ?? 'unknown'}; WebGL2: ${gl ? 'yes' : 'no'}`,
    `Camera API: ${navigator.mediaDevices?.getUserMedia ? 'yes' : 'no'}; speech: ${'speechSynthesis' in window ? 'yes' : 'no'}`,
  ].join('\n');
}

async function copy(text, done) {
  try {
    await navigator.clipboard.writeText(text);
    toast(done);
  } catch {
    toast('Couldn’t copy automatically. Select the text and copy it yourself.', { tone: 'warn' });
  }
}

function consentCard() {
  const c = testConsent();
  return h('section', { class: 'card stack' }, h('h2', {}, 'How this test works'),
    h('p', { class: 'small muted' }, c ? `You read and agreed to the test information on ${new Date(c.at).toLocaleDateString()}.` : 'You’ll be asked to read a short information sheet before your first camera session. You must be 18 or over.'),
    h('div', { class: 'row' }, h('button', { class: 'btn btn-sm', type: 'button', onclick: () => askTestConsent() }, c ? 'Read it again' : 'Read it now')));
}

export function render(root) {
  const state = store.get();
  const done = state.tester?.done ?? {};
  const version = h('span', {}, VERSION);
  buildInfo().then((b) => version.replaceChildren(`${VERSION} · build ${b.sha}`));

  const checklist = h('ul', { class: 'checklist' }, TASKS.map((t) => {
    const auto = t.auto?.(state) ?? false;
    const box = h('input', {
      type: 'checkbox',
      checked: auto || !!done[t.id],
      disabled: auto,
      'aria-label': t.label,
      onchange: (e) => store.update((s) => {
        s.tester ??= { introDismissed: false, done: {} };
        s.tester.done[t.id] = e.target.checked;
      }),
    });
    const link = t.href ? h('a', { href: t.href, ...(t.external ? { target: '_blank', rel: 'noopener' } : {}) }, t.label) : h('span', {}, t.label);
    return h('li', { class: t.optional ? 'optional' : null }, h('label', { class: 'choice' }, box, link), auto ? h('span', { class: 'small faint' }, 'done') : null);
  }));

  const info = h('pre', { class: 'device-info' }, 'Collecting…');
  deviceInfo().then((t) => { info.textContent = t; });

  root.append(h('div', { class: 'page-head' },
    h('div', {}, h('h1', {}, 'Help test SpineSense'),
      h('p', {}, 'You’re trying an early version. Thank you! Work through the list in any order, then tell us what happened. About 20–30 minutes.'))));

  root.append(h('div', { class: 'grid grid-main' },
    h('div', { class: 'stack' },
      h('section', { class: 'card stack' }, h('div', { class: 'section-title' }, h('h2', {}, 'What to try'), h('p', {}, 'Ticks are saved in this browser')), checklist),
      h('section', { class: 'card stack' }, h('h2', {}, 'Send feedback'),
        h('p', { class: 'small muted' }, 'The feedback form is on GitHub (you’ll need a free account). It’s public, so please leave out your name, health details and pain ratings.'),
        h('div', { class: 'row' },
          h('a', { class: 'btn btn-primary', href: FEEDBACK_URL, target: '_blank', rel: 'noopener' }, 'Open the feedback form'),
          h('button', { class: 'btn', type: 'button', onclick: async () => copy(await deviceInfo(), 'Device details copied. Paste them into the form.') }, 'Copy device details')),
        info,
        h('p', { class: 'small faint' }, 'No GitHub account? Send your notes and the device details above to whoever invited you to test.'),
        h('p', { class: 'small muted' }, 'If tracking went wrong, open “Tracking details” during a session (or use the button on the session summary) and choose “Copy test report”. It holds tracking numbers, the app version and your browser and screen size: no images, nothing about pain or discomfort. Read it before you paste it.'),
        h('p', { class: 'small muted' }, 'Clip, phone and data-export files can contain your pain answers or body measurements. Send those only privately to the person running the test, never in the form.'))),
    h('div', { class: 'stack' },
      h('div', { class: 'callout warn' }, icon('safety'), h('div', { class: 'small' },
        h('p', {}, h('strong', {}, 'Test gently. '), 'Only try exercises that feel comfortable, and stop if pain increases.'),
        h('p', {}, 'Stop and see a doctor if pain spreads down a leg, or comes with numbness, weakness, or bladder or bowel changes.'),
        h('p', {}, 'SpineSense is an exercise companion, not a medical device. It can’t diagnose anything.'))),
      consentCard(),
      h('section', { class: 'card stack' }, h('h2', {}, 'Your privacy'),
        h('ul', { class: 'small muted', style: { margin: 0, paddingLeft: '18px' } },
          h('li', {}, 'Your camera video is analysed on this device and never recorded or sent anywhere.'),
          h('li', {}, 'Your safety answers, pain ratings, sessions and clips are saved unencrypted in this browser only, so anyone using this browser profile can see them. Settings → Delete all data removes them.'),
          h('li', {}, 'To track your body, the page downloads software from jsDelivr and Google, and the site is hosted by GitHub. Like any website, they see your IP address and browser, never your video or answers.'),
          h('li', {}, 'If you turn on “Listen for ow and stop”, your browser sends microphone audio from the whole session to Google (Chrome) or Microsoft (Edge). It’s off by default.'),
          h('li', {}, 'The feedback form is a public GitHub issue linked to your account.'))),
      h('section', { class: 'card stack' }, h('h2', {}, 'In this test'),
        h('ul', { class: 'small muted', style: { margin: 0, paddingLeft: '18px' } },
          h('li', {}, 'Use Chrome or Edge on a laptop or desktop with a webcam. Phones and other browsers may work but are less tested.'),
          h('li', {}, 'Stand 2–3 m from the camera, with your whole body in view, in good light.'),
          h('li', {}, 'No extra hardware needed. The Bluetooth back sensors aren’t part of this test.'),
          h('li', {}, 'Video never leaves your device. Your sessions stay in this browser until you delete them (Settings → Delete all data).'))),
      h('section', { class: 'card stack' }, h('h2', {}, 'Version'), h('p', { class: 'small muted' }, version),
        h('p', { class: 'small faint' }, 'Mention this in your feedback so problems can be matched to the right build.')))));
}
