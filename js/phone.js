// Phone sensor page (phone.html): a phone strapped to the upper back records how the trunk tilts,
// as a stand-in for a SpineSense Motion sensor. The phone talks the user through calibration
// (the screen is out of sight on their back), records, and saves a file that the Recordings page
// on the computer merges into the camera clip of the same session.

import { h, icon } from './ui.js';
import { PhoneRecorder, PHONE_MAX_MINUTES, phoneSnapshot, unsentRecording } from './sensors/phone.js';
import { quatFromDeviceOrientation } from './sensors/quat.js';

const COUNTDOWN = 15; // s to strap the phone on
const REMIND = 12; // s before a calibration prompt is repeated
const FLEX_TIMEOUT = 30; // s before the forward-bend prompts give way to "stop here"
const SIDE_TIMEOUT = 20; // s before the optional side bend is skipped
const HOLD_MS = 1500; // press-and-hold to stop, so clothing brushing the screen can't
const STALL_MS = 1000; // ms without motion samples before the phone says it stopped recording
const STALL_REPEAT_MS = 30e3; // at most one such warning every 30 s
const SAVE_MS = 5000; // ms between saves of the recording while it runs
const NO_MOTION = 'No motion data is arriving. Use Chrome on Android or Safari on iPhone, and check motion sensors aren’t blocked in the browser’s site settings.';
const NO_WAKE_LOCK = 'The screen may turn off during the recording. Set the screen timeout to 10 minutes.';
const STALLED = 'The phone stopped recording. Keep the screen on.';
const FLEX_STOP = 'If bending forward hurts, stop here. Take the phone off and hold Stop.';

const root = document.getElementById('phone');
const ua = navigator.userAgent;
const platform = /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : 'other';

let rec = new PhoneRecorder({ platform });
let state = 'intro'; // intro -> ready -> countdown -> calibrating -> recording -> stopped
let error = '';
let orientation = null;
let motionEvents = 0;
let rate = 0;
let wakeLock = null;
let saved = false;
let timer = null;
let countdown = 0;
let step = null;
let stepSince = 0;
let remindedAt = 0;
let flexStopped = false; // the forward bend timed out: no more prompts, the tester can hold Stop
let wakeLockFailed = false;
let stalled = false; // no motion samples for more than STALL_MS while recording
let stallWarnedAt = -Infinity;
let stallGraceUntil = 0;
let savedAt = -Infinity; // performance.now() of the last save while recording
let recovered = null; // { rec, snapshot, sent }: an unsent recording kept from an earlier visit
let generation = 0; // counts recordings started on this page
let live = {}; // elements updated by the ticker without re-rendering

const anchorNow = () => ({ perfMs: performance.now(), epochMs: Date.now() });
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const minutes = (s) => (s < 60 ? `${Math.floor(s)} s` : `${Math.round(s / 60)} min`);

/** Speaks text (the tester can't see the screen). queue: wait for what is being said instead of cutting it off. */
function say(text, { queue = false } = {}) {
  try {
    if (!queue) speechSynthesis.cancel();
    speechSynthesis.speak(Object.assign(new SpeechSynthesisUtterance(text), { rate: 1 }));
  } catch {
    /* no speech: the text is on screen too */
  }
  navigator.vibrate?.(150);
}

// ---------- sensors ----------

function onOrientation(e) {
  if (e.beta == null) return;
  orientation = quatFromDeviceOrientation(e.alpha, e.beta, e.gamma);
}

function onMotion(e) {
  const g = e.accelerationIncludingGravity;
  if (!g || g.x == null) return;
  motionEvents++;
  rec.add({ tMs: performance.now(), q: orientation, a: [g.x, g.y, g.z] });
}

async function enableSensors() {
  error = '';
  try {
    // iPhone and iPad ask for permission, and only from a tap.
    for (const E of [globalThis.DeviceMotionEvent, globalThis.DeviceOrientationEvent]) {
      if (typeof E?.requestPermission === 'function' && (await E.requestPermission()) !== 'granted') {
        throw new Error('Motion access wasn’t allowed. On Android, allow “Motion sensors” for this site in Chrome’s site settings, then reload. On iPhone, close the tab, open the page again and tap Allow.');
      }
    }
  } catch (e) {
    error = e.message;
    return render();
  }
  addEventListener('devicemotion', onMotion);
  addEventListener('deviceorientation', onOrientation);
  state = 'ready';
  render();
  setTimeout(() => {
    if (!motionEvents) {
      error = NO_MOTION;
      render();
    }
  }, 2500);
}

let lastCount = 0;
setInterval(() => {
  rate = motionEvents - lastCount;
  lastCount = motionEvents;
}, 1000);

// ---------- screen ----------

/** Asks for a screen wake lock; resolves to whether the screen will stay on. */
async function keepAwake() {
  try {
    wakeLock = (await navigator.wakeLock?.request('screen')) ?? null;
  } catch {
    wakeLock = null;
  }
  if (wakeLock && !active()) {
    // Cancelled while the request was pending.
    wakeLock.release?.().catch(() => {});
    wakeLock = null;
  }
  return !!wakeLock;
}

const active = () => ['countdown', 'calibrating', 'recording'].includes(state);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') {
    if (state === 'recording') saveCurrent(); // the browser may close a hidden page
    return;
  }
  if (active() && (!wakeLock || wakeLock.released)) keepAwake();
  if (state === 'recording') {
    stalled = false;
    stallGraceUntil = performance.now() + 2000; // motion samples take a moment to come back
    say('Recording again.');
  }
});

addEventListener('pagehide', () => {
  if (state === 'recording') saveCurrent();
});

addEventListener('beforeunload', (e) => {
  if (active() || (state === 'stopped' && rec.cal && !saved)) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// ---------- flow ----------

function start() {
  say('Strap the phone onto your upper back now.'); // speaking inside the tap unlocks speech on iPhone
  const g = ++generation;
  recovered = null; // a new recording replaces the kept one
  clearSaved();
  wakeLockFailed = false;
  flexStopped = false;
  keepAwake().then((on) => {
    if (on || g !== generation || !active()) return;
    wakeLockFailed = true;
    say(NO_WAKE_LOCK, { queue: true });
    if (state === 'countdown') render();
  });
  rec = new PhoneRecorder({ platform });
  rec.addEventListener('calibration', onCalibration);
  rec.addEventListener('limit', () => stop(`Recording stopped after ${PHONE_MAX_MINUTES} minutes.`));
  rec.start(anchorNow());
  saved = false;
  state = 'countdown';
  countdown = COUNTDOWN;
  render();
  timer = setInterval(() => {
    countdown--;
    if (countdown > 0 && countdown <= 3) say(String(countdown));
    if (countdown <= 0) {
      clearInterval(timer);
      state = 'calibrating';
      step = null;
      rec.calibrate();
      timer = setInterval(remind, 1000);
      render();
    } else if (live.count) live.count.textContent = countdown;
  }, 1000);
}

function onCalibration() {
  const c = rec.calibrator;
  if (!c || state !== 'calibrating') return;
  if (c.step !== step) {
    step = c.step;
    stepSince = performance.now();
    remindedAt = stepSince;
    flexStopped = false;
    if (step === 'done') {
      clearInterval(timer);
      state = 'recording';
      stalled = false; // stallWarnedAt carries over, so the 30 s limit holds across recordings too
      stallGraceUntil = 0;
      savedAt = -Infinity; // saved straight away, then every few seconds
      say('Calibrated. Recording. On the computer, do the quick safety check first, then start your session with Record a training clip switched on. Start with a few hip hinges only if they’re in today’s plan. Do standing exercises only.');
      timer = setInterval(tick, 250);
      return render();
    }
    say(c.message);
    render();
  }
  if (live.progress) live.progress.style.width = `${Math.round(c.progress * 100)}%`;
}

function remind() {
  const c = rec.calibrator;
  if (!c || state !== 'calibrating') return;
  const waited = (performance.now() - stepSince) / 1000;
  if (c.step === 'flex' && waited > FLEX_TIMEOUT) {
    // Don't keep asking someone to bend who may be in pain. The recording runs on until they stop it.
    if (flexStopped) return;
    flexStopped = true;
    say(FLEX_STOP);
    render();
  } else if (c.step === 'side' && waited > SIDE_TIMEOUT) {
    say('Skipping the side bend.');
    c.skipSide();
  } else if (performance.now() - remindedAt > REMIND * 1000) {
    remindedAt = performance.now();
    say(c.message);
  }
}

/** While recording: says so when the motion samples stop, and keeps the recording saved. */
function watch() {
  const now = performance.now();
  if (now - (rec.lastT ?? -Infinity) <= STALL_MS) stalled = false;
  else if (!stalled && now >= stallGraceUntil) {
    stalled = true;
    if (now - stallWarnedAt >= STALL_REPEAT_MS) {
      stallWarnedAt = now;
      say(STALLED);
    }
  }
  if (now - savedAt >= SAVE_MS) {
    savedAt = now;
    saveCurrent();
  }
}

function tick() {
  watch();
  if (!live.elapsed) return;
  const s = (performance.now() - rec.anchor.perfMs) / 1000;
  live.elapsed.textContent = mmss(s);
  const a = rec.angles();
  if (a?.calibrated) live.angle.textContent = `${Math.round(a.flex)}°`;
  live.rate.textContent = `${rate}/s`;
  live.gaps.hidden = !rec.gaps.length;
  live.gaps.textContent = `Data stopped ${rec.gaps.length} time${rec.gaps.length > 1 ? 's' : ''}: keep the screen on and this page open.`;
}

function stop(message = 'Recording stopped.') {
  clearInterval(timer);
  rec.stop(anchorNow());
  wakeLock?.release?.().catch(() => {});
  wakeLock = null;
  state = 'stopped';
  saveCurrent();
  say(message);
  render();
}

function cancel() {
  clearInterval(timer);
  globalThis.speechSynthesis?.cancel();
  wakeLock?.release?.().catch(() => {});
  wakeLock = null;
  rec = new PhoneRecorder({ platform });
  state = 'ready';
  render();
}

// ---------- saving ----------

/** The file for recording r; body is its text (r.toText(), or the same text kept from an earlier visit). */
function file(r, body, kind) {
  const d = new Date(r.anchor.epochMs);
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
  return kind === 'json'
    ? new File([body], `spinesense-phone-${stamp}.json`, { type: 'application/json' })
    : new File([body], `spinesense-phone-${stamp}.txt`, { type: 'text/plain' });
}

async function share(r, body, onSent) {
  error = '';
  // Some phones only share a few file types, so fall back to plain text (the content is the same).
  const f = [file(r, body, 'json'), file(r, body, 'txt')].find((x) => navigator.canShare?.({ files: [x] }));
  if (!f) {
    error = 'This browser can’t share files. Use Download instead.';
    return render();
  }
  try {
    await navigator.share({ files: [f], title: 'SpineSense phone recording' });
    onSent();
  } catch (e) {
    if (e.name !== 'AbortError') error = `Sharing failed: ${e.message}`;
  }
  render();
}

function downloadFile(r, body, onSent) {
  const f = file(r, body, 'json');
  const a = h('a', { href: URL.createObjectURL(f), download: f.name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  onSent();
  render();
}

function currentSent() {
  saved = true;
  saveCurrent();
}

// ---------- keeping the recording ----------
// The recording is kept in IndexedDB while it runs and after it stops, so a page that closes or
// crashes loses a few seconds at most. Storage trouble (private mode, no space) is ignored: it never
// touches the recording itself, and the work runs outside the motion-sample handler.

const DB_NAME = 'spinesense-phone';
const DB_STORE = 'recordings';
const DB_KEY = 'current';
let db = null; // Promise<IDBDatabase>; stays rejected when IndexedDB isn't available
let storage = Promise.resolve(); // storage steps run one after another, in the order asked
let saveQueued = false;

function openDb() {
  db ??= new Promise((resolve, reject) => {
    let late = false;
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
    req.onsuccess = () => {
      const d = req.result;
      if (late) return d.close();
      d.onversionchange = () => {
        d.close();
        db = null;
      };
      resolve(d);
    };
    req.onerror = () => reject(req.error);
    setTimeout(() => {
      late = true;
      reject(new Error('IndexedDB didn’t open'));
    }, 5000);
  });
  return db;
}

function dbDo(mode, work) {
  return openDb().then((d) => new Promise((resolve, reject) => {
    const tx = d.transaction(DB_STORE, mode);
    const req = work(tx.objectStore(DB_STORE));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Storage aborted'));
  }));
}

/** Runs a storage step after the ones before it. Never throws or rejects. */
function queueStorage(step) {
  storage = storage.then(step).catch(() => {});
  return storage;
}

/** Saves the current recording once it is calibrated, marked sent if it was. Safe to call anywhere. */
function saveCurrent() {
  if (saveQueued) return; // the queued save will write the latest state anyway
  saveQueued = true;
  queueStorage(() => {
    saveQueued = false;
    if (!rec.anchor || !rec.cal?.ready) return;
    const snapshot = phoneSnapshot(rec, { sent: saved });
    return dbDo('readwrite', (s) => s.put(snapshot, DB_KEY));
  });
}

function clearSaved() {
  queueStorage(() => dbDo('readwrite', (s) => s.delete(DB_KEY)));
}

function loadSaved() {
  const g = generation;
  queueStorage(() => dbDo('readonly', (s) => s.get(DB_KEY)).then((snapshot) => {
    const r = unsentRecording(snapshot);
    if (!r || g !== generation) return;
    recovered = { rec: r, snapshot, sent: false };
    if (state === 'intro' || state === 'ready') render();
  }));
}

function recoveredSent(item) {
  item.sent = true;
  queueStorage(() => {
    if (recovered !== item) return; // discarded, or replaced by a new recording
    return dbDo('readwrite', (s) => s.put({ ...item.snapshot, sent: true }, DB_KEY));
  });
}

function discardRecovered() {
  if (!recovered.sent && !confirm('Discard this recording? It hasn’t been saved or sent.')) return;
  recovered = null;
  clearSaved();
  render();
}

// ---------- views ----------

function holdButton(label, onHold) {
  const fill = h('span', { class: 'hold-fill' });
  const btn = h('button', { class: 'btn btn-danger btn-block hold-btn', type: 'button' }, fill, h('span', { class: 'hold-label' }, label));
  let t = null;
  const begin = (e) => {
    e.preventDefault();
    btn.classList.add('holding');
    t = setTimeout(onHold, HOLD_MS);
  };
  const end = () => {
    btn.classList.remove('holding');
    clearTimeout(t);
  };
  btn.addEventListener('pointerdown', begin);
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(ev, end);
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
  return btn;
}

function stat(label, value, el) {
  return h('div', { class: 'stat' }, h('div', { class: 'stat-label' }, label), el ?? h('div', { class: 'stat-value' }, value));
}

/** An unsent recording kept from an earlier visit (the page closed, or was reloaded before sending). */
function recoveredCard() {
  const item = recovered;
  if (!item) return null;
  const r = item.rec;
  const body = item.snapshot.text; // exactly the file the earlier visit would have sent
  const when = new Date(r.anchor.epochMs).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  return h('section', { class: 'card stack' },
    h('h2', {}, `Unsent recording from ${when}, ${minutes(r.durationS)}`),
    h('p', { class: 'small muted' }, item.snapshot.stopped
      ? 'It’s still on this phone. Send it to the computer: a new recording replaces it.'
      : 'The page closed while it was recording, so the last few seconds may be missing. Send it to the computer: a new recording replaces it.'),
    h('button', { class: 'btn btn-primary btn-block', type: 'button', onclick: () => share(r, body, () => recoveredSent(item)) }, icon('upload'), 'Send to computer'),
    h('button', { class: 'btn btn-block', type: 'button', onclick: () => downloadFile(r, body, () => recoveredSent(item)) }, icon('download'), 'Download file'),
    item.sent ? h('p', { class: 'small', style: { color: 'var(--good-text)' } }, icon('check', 14), ' File saved or sent.') : null,
    h('button', { class: 'btn btn-block', type: 'button', onclick: discardRecovered }, icon('trash'), 'Discard'));
}

function view() {
  const supported = window.isSecureContext && 'DeviceMotionEvent' in window;
  if (state === 'intro') {
    return [
      recoveredCard(),
      h('p', { class: 'muted' }, 'Your phone can act as a back sensor. It records how your upper back tilts while the computer’s camera watches you. Afterwards you send the file to the computer, and the Recordings page compares the camera with the phone.'),
      !window.isSecureContext ? h('div', { class: 'callout warn' }, icon('alert'), h('p', { class: 'small' }, 'Open this page from its https address (the live demo). Browsers only share motion sensors with secure pages.')) : null,
      window.isSecureContext && !('DeviceMotionEvent' in window) ? h('div', { class: 'callout warn' }, icon('alert'), h('p', { class: 'small' }, 'This browser doesn’t provide motion sensors. Use Chrome on Android or Safari on iPhone.')) : null,
      h('section', { class: 'card stack' }, h('h2', {}, 'You’ll need'),
        h('ul', { class: 'small', style: { margin: 0, paddingLeft: '18px' } },
          h('li', {}, 'A stretchy belt, bandage or snug top that holds the phone flat on your upper back, just below the shoulder blades. It must not bounce or slide.'),
          h('li', {}, 'The sound on: the phone talks you through calibration.'),
          h('li', {}, 'Both the phone and the computer set to automatic date and time.'),
          h('li', {}, h('strong', {}, 'Standing exercises only.'), ' Never lie on the phone.'))),
      h('button', { class: 'btn btn-primary btn-lg btn-block', type: 'button', disabled: !supported, onclick: enableSensors }, icon('sensor'), 'Turn on motion sensors'),
      h('p', { class: 'small faint' }, 'The recording stays on this phone until you send it. No camera, no microphone, no upload.'),
    ];
  }
  if (state === 'ready') {
    live = {
      rate: h('div', { class: 'stat-value' }, '—'),
      tilt: h('div', { class: 'stat-value' }, '—'),
      orient: h('p', { class: 'small faint', hidden: !!orientation }, 'No orientation data yet: if it stays missing, the phone uses gravity alone, which is less steady during movement.'),
    };
    return [
      recoveredCard(),
      h('div', { class: 'phone-live' }, stat('Motion data', null, live.rate), stat('Tilt from flat', null, live.tilt)),
      live.orient,
      'wakeLock' in navigator ? null : h('div', { class: 'callout warn' }, icon('alert'), h('p', { class: 'small' }, 'This browser can’t keep the screen on. Set the screen timeout to 10 minutes or more first: the recording stops when the screen turns off.')),
      h('section', { class: 'card stack' }, h('h2', {}, 'How it works'),
        h('ol', { class: 'small', style: { margin: 0, paddingLeft: '18px' } },
          h('li', {}, `Tap Start, then strap the phone on within ${COUNTDOWN} seconds.`),
          h('li', {}, 'Follow the voice: stand still, bend forward and back up, then lean right and back.'),
          h('li', {}, 'When it says “Recording”, do the quick safety check on the computer first. Then start your session with “Record a training clip” switched on. Start with a few hip hinges only if they’re in today’s plan.'),
          h('li', {}, 'Afterwards, take the phone off and hold Stop for 2 seconds. Then send the file to your computer.'))),
      h('button', { class: 'btn btn-primary btn-lg btn-block', type: 'button', onclick: start }, icon('play'), 'Start'),
    ];
  }
  if (state === 'countdown') {
    live = { count: h('div', { class: 'phone-big' }, String(countdown)) };
    return [
      h('h2', {}, 'Strap the phone on now'),
      h('p', { class: 'muted' }, 'Flat against your upper back, just below the shoulder blades. Turn the sound up.'),
      wakeLockFailed ? h('div', { class: 'callout warn' }, icon('alert'), h('p', { class: 'small' }, 'This phone won’t keep the screen on. Set the screen timeout to 10 minutes or more: the recording stops when the screen turns off.')) : null,
      live.count,
      h('button', { class: 'btn btn-block', type: 'button', onclick: cancel }, 'Cancel'),
    ];
  }
  if (state === 'calibrating') {
    const c = rec.calibrator;
    const order = ['neutral', 'flex', 'side'];
    live = { progress: h('div', { class: 'disc-fill', style: { background: 'var(--accent)', width: `${Math.round((c?.progress ?? 0) * 100)}%` } }) };
    return [
      h('h2', {}, 'Calibrating'),
      h('ol', { class: 'cal-steps' }, [['neutral', 'Stand still'], ['flex', 'Bend forward'], ['side', 'Lean right']].map(([k, label]) =>
        h('li', { class: order.indexOf(k) < order.indexOf(c?.step) ? 'done' : k === c?.step ? 'current' : '' }, label))),
      h('p', { class: 'cal-msg' }, flexStopped && c?.step === 'flex' ? FLEX_STOP : c?.message ?? ''),
      h('div', { class: 'disc-meter' }, live.progress),
      flexStopped && c?.step === 'flex' ? holdButton('Hold to stop', () => stop()) : null,
      h('button', { class: 'btn btn-block', type: 'button', onclick: cancel }, 'Cancel'),
    ];
  }
  if (state === 'recording') {
    live = {
      elapsed: h('div', { class: 'phone-big' }, '0:00'),
      angle: h('div', { class: 'stat-value' }, '—'),
      rate: h('div', { class: 'stat-value' }, '—'),
      gaps: h('div', { class: 'callout warn small', hidden: true }),
    };
    return [
      h('div', { class: 'row' }, h('span', { class: 'rec-dot', 'aria-hidden': 'true' }), h('h2', {}, 'Recording')),
      live.elapsed,
      h('div', { class: 'phone-live' }, stat('Forward bend', null, live.angle), stat('Motion data', null, live.rate)),
      live.gaps,
      h('p', { class: 'small muted' }, 'Do the quick safety check on the computer first, then start your session with “Record a training clip” switched on. Start with a few hip hinges only if they’re in today’s plan. Keep this page open.'),
      holdButton('Hold to stop', () => stop()),
    ];
  }
  // stopped
  const json = rec.toJSON();
  return [
    h('h2', {}, 'Recording finished'),
    h('div', { class: 'phone-live' }, stat('Length', mmss(rec.durationS)), stat('Samples', `${rec.rateHz}/s`)),
    !json.cal ? h('div', { class: 'callout warn' }, icon('alert'), h('p', { class: 'small' }, 'Calibration didn’t finish, so this recording can’t be compared with the camera. Start again and follow the spoken steps.')) : null,
    json.gaps.length ? h('div', { class: 'callout warn' }, icon('alert'), h('p', { class: 'small' }, `The data stopped ${json.gaps.length} time${json.gaps.length > 1 ? 's' : ''} (screen off or page hidden). Those moments can’t be compared.`)) : null,
    json.cal ? h('button', { class: 'btn btn-primary btn-lg btn-block', type: 'button', onclick: () => share(rec, rec.toText(), currentSent) }, icon('upload'), 'Send to computer') : null,
    json.cal ? h('button', { class: 'btn btn-block', type: 'button', onclick: () => downloadFile(rec, rec.toText(), currentSent) }, icon('download'), 'Download file') : null,
    json.cal ? h('section', { class: 'card stack' }, h('h2', {}, 'On the computer'),
      h('ol', { class: 'small', style: { margin: 0, paddingLeft: '18px' } },
        h('li', {}, 'Get the file onto the computer: Quick Share, Phone Link, email or a cloud drive all work.'),
        h('li', {}, 'In SpineSense, open Recordings and find the clip from this session.'),
        h('li', {}, 'Choose “Add phone data”, pick the file, then Analyse.'))) : null,
    saved ? h('p', { class: 'small', style: { color: 'var(--good-text)' } }, icon('check', 14), ' File saved or sent.') : null,
    h('button', { class: 'btn btn-block', type: 'button', onclick: () => {
      if (json.cal && !saved && !confirm('Discard this recording? It hasn’t been saved or sent.')) return;
      clearSaved();
      cancel();
    } }, 'New recording'),
  ];
}

function render() {
  live = {};
  const body = view();
  root.replaceChildren(...[
    h('header', { class: 'phone-head' }, h('span', { class: 'phone-mark' }, icon('spine', 20)), h('div', {}, h('h1', {}, 'Phone as back sensor'), h('p', { class: 'small faint' }, 'SpineSense'))),
    error ? h('div', { class: 'callout warn' }, icon('alert'), h('p', { class: 'small' }, error)) : null,
    ...body,
  ].filter(Boolean));
}

// Live readouts while getting ready.
setInterval(() => {
  if (state !== 'ready' || !live.rate) return;
  if (error === NO_MOTION && motionEvents) {
    error = '';
    return render();
  }
  live.rate.textContent = rate ? `${rate}/s` : '—';
  const a = rec.angles();
  live.tilt.textContent = a ? `${Math.round(a.tilt)}°` : '—';
  live.orient.hidden = !!orientation;
}, 250);

render();
loadSaved();
