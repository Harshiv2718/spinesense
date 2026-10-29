import { store } from '../store.js';
import { h, icon, painScale, modal, toast, levelBadge, fmtDur, painPill, toggle } from '../ui.js';
import { EXERCISES, byId, POSITION_LABEL, VIEW_LABEL } from '../core/exercises.js';
import { ExerciseRun } from '../core/engine.js';
import { DiscomfortDetector, SIGNALS } from '../core/discomfort.js';
import { BONES } from '../core/geometry.js';
import { CameraTracker, SimTracker } from '../vision/tracker.js';
import { Voice, Listener } from '../coach/voice.js';
import { screeningStatus, todaysPlan, applyProgression, applyNextDay, pendingNextDay } from '../program.js';
import { emergencyCallout } from './safety.js';
import { exerciseFigure } from '../figures.js';
import { repText, SIGNAL_LABEL } from './common.js';
import { Diagnostics } from './diagnostics.js';
import { hub, SensorHub } from '../sensors/hub.js';
import { SimSensor, simCalibration, simSegmentAngles } from '../sensors/sim.js';
import { openCalibrationModal, downloadClip } from './sensors.js';
import { ClipRecorder } from '../data/clip.js';
import { saveClip } from '../data/clipstore.js';
import { clipConsent, askClipConsent, testConsent, askTestConsent } from './consent.js';
import { DEFAULT_RADIO } from '../analysis/simclip.js';

const DEMO_DEFAULT = new Set(['side-bend', 'hip-hinge', 'glute-bridge']);

export function render(root, { params }) {
  const state = store.get();
  const demo = params.get('demo') === '1';
  const single = params.get('ex');
  const status = screeningStatus(state.profile?.screening);

  root.append(h('div', { class: 'page-head' }, h('div', {},
    h('h1', {}, demo ? 'Demo session' : single ? `Practice: ${byId[single]?.name ?? ''}` : 'Today’s session'),
    h('p', {}, demo ? 'A simulated person does the exercises so you can see how tracking, coaching and check-ins work. No camera needed.' : 'A quick check-in, then choose your exercises and start the camera.'))));

  if (!demo) {
    const gate = (title, body, primary) => root.append(h('div', { class: 'card' }, h('div', { class: 'empty' },
      h('h3', {}, title), h('p', {}, body),
      h('div', { class: 'row', style: { justifyContent: 'center' } },
        h('a', { class: 'btn', href: '#/session?demo=1' }, 'Try the demo instead'),
        h('a', { class: 'btn btn-primary', href: '#/safety' }, primary)))));
    if (!status.done) return gate('Do the safety check first', 'It takes two minutes, screens for symptoms that need a doctor, and sets your starting levels.', 'Start safety check');
    if (status.emergency) {
      root.append(emergencyCallout(), h('p', { class: 'muted', style: { marginTop: '16px' } }, 'Once a doctor has seen you and these symptoms have gone, ', h('a', { href: '#/safety' }, 'redo the safety check'), '.'));
      return;
    }
    if (status.needsRescreen) {
      return gate('Time to redo your safety check',
        status.outdated ? 'SpineSense now asks each warning sign separately, so please answer the new safety check once.' : 'Your last safety check is more than 4 weeks old. Symptoms change, so it needs a quick refresh.',
        'Redo safety check');
    }
    if (status.testDemoOnly) {
      return gate('Please use the demo during this test',
        'Your safety check mentioned something that needs a clinician’s view first, and nobody is supervising this test. You can still try everything in the demo. Thank you for helping.',
        'Review safety check');
    }
    if (status.blocked) {
      root.append(h('div', { class: 'callout danger' }, icon('alert'), h('div', {},
        h('strong', {}, 'Exercise sessions are paused until a doctor has checked these: '),
        h('ul', {}, status.unclearedFlags.map((f) => h('li', {}, f.text))),
        'If a doctor or physio has cleared you, record it in the ', h('a', { href: '#/safety' }, 'safety check'), ' (a clearance lasts 30 days).')));
      return;
    }
    if (!testConsent()) {
      root.append(h('div', { class: 'card' }, h('div', { class: 'empty' },
        h('h3', {}, 'Before your first camera session'),
        h('p', {}, 'Please read how this test works. It takes a minute.'),
        h('div', { class: 'row', style: { justifyContent: 'center' } },
          h('a', { class: 'btn', href: '#/session?demo=1' }, 'Try the demo instead'),
          h('button', { class: 'btn btn-primary', type: 'button', onclick: async () => {
            // Re-run the route (not render() in place) so the router keeps the session's cleanup.
            if (await askTestConsent()) dispatchEvent(new HashChangeEvent('hashchange'));
          } }, 'Read and continue')))));
      return;
    }
  }

  return setup(root, { demo, single, state });
}

// ---------------------------------------------------------------- setup

function setup(root, { demo, single, state }) {
  const settings = state.settings;
  const cfg = { painBefore: null, voiceCoach: settings.voiceCoach, voiceInput: settings.voiceInput && Listener.supported, face: !!settings.faceOptIn, simSensors: demo, record: false };
  const check = { quick: demo ? 'no' : null, nextDay: null };
  const pending = demo ? null : pendingNextDay(state);
  const included = {};
  const levels = {};
  let rows = [];
  let restDay = false;

  const err = h('p', { class: 'small', role: 'alert', style: { color: 'var(--critical-text)' } });
  const list = h('div', {});
  const notesBox = h('div', {});
  const startBtn = h('button', { class: 'btn btn-primary btn-lg', type: 'button' }, icon('play', 16), demo ? 'Start demo' : 'Start camera & session');

  function renderList() {
    const plan = todaysPlan(store.get(), { painToday: cfg.painBefore ?? undefined });
    restDay = !demo && !!plan?.restDay;
    notesBox.replaceChildren(...(plan?.notes?.length && !demo ? [h('div', { class: `callout ${restDay ? 'danger' : 'warn'}` }, icon('info'), h('div', { class: 'small' }, plan.notes.map((n) => h('p', {}, n))))] : []));
    startBtn.hidden = restDay;
    list.replaceChildren();
    if (restDay) return;
    const planById = Object.fromEntries((plan?.items ?? []).map((it) => [it.id, it]));
    const skippedById = Object.fromEntries((plan?.skipped ?? []).map((it) => [it.id, it]));
    rows = EXERCISES.map((spec) => {
      const p = planById[spec.id];
      const blocked = !demo && !p;
      const floorOk = spec.position !== 'floor' || !!store.get().settings.floorCamera;
      const defaultInclude = single ? spec.id === single : demo ? DEMO_DEFAULT.has(spec.id) : !!p && floorOk;
      const maxLevel = demo ? spec.levels.length - 1 : p?.maxLevel ?? 0;
      const level = Math.min(levels[spec.id] ?? p?.level ?? store.get().progress[spec.id]?.level ?? 0, maxLevel);
      return { id: spec.id, include: !blocked && (included[spec.id] ?? defaultInclude), level, maxLevel, repScale: demo ? 1 : p?.repScale ?? 1, reasons: p?.reasons ?? [], blocked, skipReason: skippedById[spec.id]?.reason };
    });
    let lastPos = null;
    for (const row of rows) {
      const spec = byId[row.id];
      if (spec.position !== lastPos) {
        list.append(h('div', { class: 'group-label' }, POSITION_LABEL[spec.position]));
        if (spec.position === 'floor' && !demo && !single) {
          list.append(toggle('My camera can go on the floor', !!store.get().settings.floorCamera, (v) => {
            store.update((s) => { s.settings.floorCamera = v; });
            for (const sp of EXERCISES) if (sp.position === 'floor') delete included[sp.id];
            renderList();
          }, 'Floor exercises need the camera at floor level, 2–3 m away and side-on. A laptop on a desk can’t see you lying down.'));
        }
        lastPos = spec.position;
      }
      const sub = h('p', { class: 'small muted' }, row.blocked ? row.skipReason ?? 'Not in today’s plan' : repText(spec, row.level, row.repScale));
      list.append(h('div', { class: `setup-item${row.blocked ? ' is-blocked' : ''}` },
        h('input', { type: 'checkbox', checked: row.include, disabled: row.blocked, 'aria-label': `Include ${spec.name}`, onchange: (e) => { row.include = e.target.checked; included[row.id] = e.target.checked; } }),
        exerciseFigure(spec.id),
        h('div', {}, h('h3', {}, spec.name), sub, row.reasons.map((r) => h('div', { class: 'reason' }, icon('info', 12), r))),
        h('select', { 'aria-label': `${spec.name} level`, disabled: row.blocked, onchange: (e) => { row.level = Number(e.target.value); levels[row.id] = row.level; sub.textContent = repText(spec, row.level, row.repScale); } },
          spec.levels.map((L, i) => h('option', { value: i, selected: i === row.level, disabled: i > row.maxLevel }, L.name)))));
    }
  }

  // Next-day check: how the back responded to the last session decides whether levels go up.
  let nextDayCard = null;
  if (pending) {
    const when = new Date(pending.date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
    const btns = [['better', 'Better'], ['usual', 'Back to usual'], ['worse', 'Worse, not settled']].map(([k, label]) => h('button', {
      class: 'btn', type: 'button', 'aria-pressed': 'false',
      onclick: () => {
        let changes = [];
        store.update((s) => {
          const ses = s.sessions.find((x) => x.id === pending.id);
          if (ses) changes = applyNextDay(s, ses, k);
        });
        check.nextDay = k;
        nextDayCard.replaceChildren(h('h2', {}, 'Thanks'), h('p', { class: 'small muted' },
          k === 'worse' ? 'Today’s plan is lighter. If your back isn’t settling within a few days, or leg symptoms spread, see a clinician.' : 'Good to hear.',
          changes.length ? ` ${changes.map((c) => `${byId[c.id].name}: ${c.reason.toLowerCase()}`).join('; ')}.` : ''));
        err.textContent = '';
        renderList();
      },
    }, label));
    nextDayCard = h('section', { class: 'card stack' }, h('h2', {}, 'How did your back respond?'),
      h('p', { class: 'small muted' }, `Compared with before your session on ${when}, how is your back now?`),
      h('div', { class: 'feel-row' }, btns));
  }

  // Quick red-flag check before every session (the full safety check runs every 4 weeks).
  let quickCard = null;
  if (!demo) {
    quickCard = h('section', { class: 'card stack' },
      h('h2', {}, 'Quick safety check'),
      h('p', { class: 'small muted' }, 'Since your last session, have you noticed any of these that are new?'),
      h('ul', { class: 'small', style: { margin: 0, paddingLeft: '18px' } },
        h('li', {}, 'Numbness or tingling around the groin, genitals or back passage'),
        h('li', {}, 'New problems peeing or controlling your bladder or bowels'),
        h('li', {}, 'A leg getting weaker, or weakness or numbness in both legs')),
      h('div', { class: 'row' },
        h('button', { class: 'btn', type: 'button', onclick: (e) => {
          check.quick = 'no';
          e.currentTarget.setAttribute('aria-pressed', 'true');
          e.currentTarget.textContent = 'No, none of these ✓';
          err.textContent = '';
        } }, 'No, none of these'),
        h('button', { class: 'btn btn-danger', type: 'button', onclick: () => {
          store.update((s) => { s.profile.screening.sessionEmergency = new Date().toISOString(); });
          root.replaceChildren(h('div', { class: 'page-head' }, h('h1', {}, 'Please get medical help now')), emergencyCallout());
        } }, 'Yes')));
  }

  // Back sensors (optional): status, calibration, and the training-clip recorder.
  // Recording needs consent first; declining switches the toggle back off.
  const recordToggle = () => {
    const el = toggle('Record a training clip', cfg.record, async (v) => {
      if (v && !clipConsent() && !(await askClipConsent())) {
        el.querySelector('input').checked = false;
        cfg.record = false;
        return;
      }
      cfg.record = v;
    }, 'Saves body landmarks (no video) to Recordings on this device. Add a back-sensor or phone recording to check the camera against it.');
    return el;
  };
  const sensorBox = h('section', { class: 'card stack' });
  const renderSensorBox = () => {
    if (demo) {
      sensorBox.replaceChildren(h('h2', {}, 'Back sensors'),
        toggle('Simulated back sensors', cfg.simSensors, (v) => { cfg.simSensors = v; }, 'The demo person wears two virtual motion sensors, so you can see lower-back tracking and hip-hinge feedback.'),
        recordToggle());
      return;
    }
    if (!store.get().settings.hardwareSensors) {
      sensorBox.replaceChildren(h('h2', {}, 'Training clip (optional)'),
        h('p', { class: 'small muted' }, 'Want to check the camera’s measurements? Your phone can record alongside as a back sensor: see ', h('a', { href: '#/recordings' }, 'Recordings'), '.'),
        recordToggle());
      return;
    }
    const up = hub.byRole('upper');
    sensorBox.replaceChildren(h('h2', {}, 'Back sensors'),
      !hub.list.length ? h('p', { class: 'small muted' }, 'Optional: strap on a motion sensor for accurate lower-back angles and hip-hinge feedback. ', h('a', { href: '#/sensors' }, 'Set up sensors'), '. No sensor? Your phone can record alongside for checking the camera: see ', h('a', { href: '#/recordings' }, 'Recordings'), '.')
        : !up ? h('p', { class: 'small muted' }, 'Sensor connected. Assign it to the upper back on the ', h('a', { href: '#/sensors' }, 'Sensors page'), '.')
          : hub.calibrated ? h('p', { class: 'small', style: { color: 'var(--good-text)' } }, icon('check', 14), ` ${hub.byRole('lower') ? 'Two sensors' : 'One sensor'} connected and calibrated.`)
            : h('div', { class: 'stack', style: { gap: '8px' } }, h('p', { class: 'small muted' }, 'Calibrate after strapping the sensors on. It takes about 15 seconds.'),
              h('button', { class: 'btn btn-sm btn-primary', type: 'button', onclick: () => openCalibrationModal() }, 'Calibrate now')),
      recordToggle());
  };
  renderSensorBox();
  hub.addEventListener('change', renderSensorBox);

  const start = () => {
    if (pending && !check.nextDay) return (err.textContent = 'First, tell us how your back responded to your last session.');
    if (check.quick !== 'no') return (err.textContent = 'Please answer the quick safety check.');
    if (!demo && cfg.painBefore == null) return (err.textContent = 'Rate your pain right now first. It’s how we track progress.');
    if (restDay) return (err.textContent = 'Today is a rest day.');
    const items = rows.filter((r) => r.include);
    if (!items.length) return (err.textContent = 'Pick at least one exercise.');
    root.replaceChildren();
    window.scrollTo(0, 0);
    // iPhone only lets a page speak after a tap, and the first cue comes after the camera and model load.
    if (cfg.voiceCoach) {
      try {
        speechSynthesis.speak(new SpeechSynthesisUtterance('Starting'));
      } catch {
        /* no speech */
      }
    }
    return new LiveSession(root, { ...cfg, items, demo, single });
  };
  let live = null;
  startBtn.addEventListener('click', () => {
    const r = start();
    if (r instanceof LiveSession) live = r;
  });

  renderList();
  root.append(h('div', { class: 'grid grid-main' },
    h('section', { class: 'card' },
      h('div', { class: 'section-title' }, h('h2', {}, 'Exercises'), h('p', {}, 'Grouped so you only move the camera twice')),
      notesBox, list),
    h('div', { class: 'stack' },
      nextDayCard,
      quickCard,
      !demo ? h('section', { class: 'card stack' }, h('h2', {}, 'How is your back right now?'), painScale(null, (n) => { cfg.painBefore = n; err.textContent = ''; renderList(); })) : null,
      h('section', { class: 'card stack' },
        h('h2', {}, 'Coaching'),
        h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: cfg.voiceCoach, onchange: (e) => { cfg.voiceCoach = e.target.checked; } }), h('span', { class: 'toggle-track' }), h('span', { class: 'toggle-text' }, h('span', {}, 'Spoken coaching'), h('small', {}, 'Rep counts, form cues and check-ins.'))),
        h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: cfg.face, onchange: (e) => { cfg.face = e.target.checked; } }), h('span', { class: 'toggle-track' }), h('span', { class: 'toggle-text' }, h('span', {}, 'Also watch facial strain (optional)'), h('small', {}, 'Off by default. Only ever a prompt to ask how you feel, and only alongside a change in how you move.'))),
        Listener.supported
          ? h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: cfg.voiceInput, onchange: (e) => { cfg.voiceInput = e.target.checked; } }), h('span', { class: 'toggle-track' }), h('span', { class: 'toggle-text' }, h('span', {}, 'Listen for "ow" and "stop"'), h('small', {}, 'Sends your microphone audio for the whole session, including anything else said in the room, to Google (Chrome) or Microsoft (Edge).')))
          : null),
      sensorBox,
      h('div', { class: 'callout info' }, icon('camera'), h('div', { class: 'small' },
        h('strong', {}, 'Before you start'),
        h('ul', {},
          h('li', {}, 'Clear about 2–3 m of floor space and stand back so your whole body, feet included, is in view.'),
          h('li', {}, 'Light from in front of you, not behind: no bright window behind you. Keep mirrors, TVs and other people out of view.'),
          h('li', {}, 'Wear fitted clothes that stand out from the wall behind you.'),
          h('li', {}, 'Stop any time: press "I feel pain" or say "stop". In standing and chair exercises, raising a hand above your head pauses too. Stop straight away if pain spreads down a leg.')))),
      startBtn,
      err)));

  return () => {
    hub.removeEventListener('change', renderSensorBox);
    live?.destroy?.();
  };
}

// ---------------------------------------------------------------- live session

class LiveSession {
  constructor(root, cfg) {
    this.root = root;
    this.cfg = cfg;
    this.settings = store.get().settings;
    this.results = [];
    this.idx = -1;
    this.mode = 'loading';
    this.paused = false;
    this.startedAt = Date.now();
    this.voice = new Voice(cfg.voiceCoach);
    this.det = new DiscomfortDetector({ sensitivity: this.settings.sensitivity });
    this.lastText = new Map();
    this.diag = new Diagnostics({ demo: !!cfg.demo, model: this.settings.modelVariant, sensitivity: this.settings.sensitivity, face: cfg.face, plan: cfg.items.map((i) => `${i.id}@${i.level}`) });
    this.diag.results = () => this.results;
    // Real sessions use the app-wide sensor hub; the demo gets its own simulated pair.
    this.sensors = cfg.demo ? (cfg.simSensors ? new SensorHub({ clock: () => this.now() }) : null) : this.settings.hardwareSensors ? hub : null;
    // The Sensors page's "Try simulated sensors" must not feed made-up angles into a real session.
    if (!cfg.demo && this.sensors?.list.some((d) => d.simulated)) {
      for (const d of this.sensors.list.filter((x) => x.simulated)) this.sensors.remove(d.id);
      toast('Simulated sensors disconnected: a real session only uses real sensors.');
    }
    this.faults = {};
    this.rec = cfg.record ? new ClipRecorder({ consent: clipConsent(), plan: cfg.items.map((i) => `${i.id}@${i.level}`), simulated: !!cfg.demo }) : null;
    this.build();
    this.tracker = cfg.demo ? new SimTracker() : new CameraTracker({ video: this.video, variant: this.settings.modelVariant, face: cfg.face });
    window.__sessionLive = true;
    this.onUnload = (e) => {
      if (this.mode === 'summary' || this.mode === 'loading' || this.destroyed) return;
      e.preventDefault();
      e.returnValue = '';
    };
    addEventListener('beforeunload', this.onUnload);
    this.boot();
    // Route changes call the cleanup returned by render(); keep a handle for it.
    root.__live = this;
  }

  // ---------- DOM ----------
  build() {
    const u = (this.ui = {});
    this.video = h('video', { playsinline: true, muted: true });
    this.canvas = h('canvas', {});
    u.chips = h('div', { class: 'hud-top' });
    u.msg = h('div', { class: 'hud-msg', hidden: true });
    u.meterLabel = h('span', {});
    u.meterValue = h('span', {});
    u.meterFill = h('div', { class: 'meter-fill' });
    u.meterTarget = h('div', { class: 'meter-target', style: { left: '80%' } });
    u.bottom = h('div', { class: 'hud-bottom', hidden: true }, h('div', { class: 'row' }, u.meterLabel, u.meterValue), h('div', { class: 'meter' }, u.meterFill, u.meterTarget));
    u.ringArc = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    u.ringNum = h('div', { class: 'num' });
    u.ring = h('div', { class: 'hold-ring', hidden: true });
    u.ring.innerHTML = '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="rgba(0,0,0,.55)" stroke="rgba(255,255,255,.18)" stroke-width="8"/></svg>';
    Object.entries({ cx: 50, cy: 50, r: 44, fill: 'none', stroke: '#0ca30c', 'stroke-width': 8, 'stroke-linecap': 'round', 'stroke-dasharray': `${2 * Math.PI * 44}`, 'stroke-dashoffset': `${2 * Math.PI * 44}` }).forEach(([k, v]) => u.ringArc.setAttribute(k, v));
    u.ring.firstChild.append(u.ringArc);
    u.ring.append(u.ringNum);
    u.flash = h('div', { class: 'flash' });
    u.loading = h('div', { class: 'stage-loading' }, h('div', {}, h('div', { class: 'spinner' }), u.loadingText = h('div', {}, 'Starting…')));
    this.stage = h('div', { class: 'stage' }, this.video, this.cfg.demo ? h('div', { class: 'floorline' }) : null, this.canvas,
      h('div', { class: 'hud' }, u.chips, h('div', { class: 'hud-center' }, u.msg), u.ring, u.bottom), u.flash, u.loading);

    u.step = h('div', { class: 'step' });
    u.name = h('h2', {});
    u.badges = h('div', { class: 'row', style: { gap: '6px' } });
    u.big = h('span', { class: 'big' }, '0');
    u.of = h('span', { class: 'of' });
    u.sides = h('div', { class: 'sides' });
    u.cue = h('div', { class: 'cue' });
    u.discLevel = h('span', { class: 'faint' }, 'Your rating decides');
    u.discFill = h('div', { class: 'disc-fill' });
    u.discMarks = [h('div', { class: 'disc-mark' }), h('div', { class: 'disc-mark' })];
    u.signals = {};
    for (const [k, v] of Object.entries(SIGNALS)) u.signals[k] = h('span', { class: 'signal' }, v.label);
    u.voiceChip = h('span', { class: 'signal', hidden: true }, icon('mic', 12), 'Listening');
    u.faceStatus = h('div', { class: 'face-status' });
    u.queue = h('ol', { class: 'queue' });
    u.sensorRows = {};
    const sensorRow = (k, label) => [h('span', {}, label), h('div', { class: 'sensor-bar' }, (u.sensorRows[`${k}Bar`] = h('div', {}))), (u.sensorRows[k] = h('span', { class: 'val' }, '—'))];
    u.sensorMode = h('span', { class: 'faint' }, '—');
    u.sensorCard = h('div', { class: 'card', hidden: !this.sensors?.list.length && !this.cfg.simSensors },
      h('div', { class: 'disc-head' }, h('span', {}, 'Back sensor'), u.sensorMode),
      h('div', { class: 'sensor-rows' }, sensorRow('trunk', 'Trunk'), sensorRow('pelvis', 'Pelvis'), sensorRow('lumbar', 'Lower back')));
    const roundBtn = this.cfg.demo && this.cfg.simSensors ? h('button', { class: 'btn btn-sm', type: 'button', style: { gridColumn: '1 / -1' }, onclick: (e) => {
      this.faults.round = !this.faults.round;
      e.currentTarget.textContent = this.faults.round ? 'Stop rounding the lower back' : 'Simulate rounded lower back';
      toast(this.faults.round ? 'The demo person now bends from the lower back instead of the hips' : 'Back to a good hip hinge');
    } }, 'Simulate rounded lower back') : null;
    const demoBtn = this.cfg.demo ? h('button', { class: 'btn btn-sm', type: 'button', style: { gridColumn: '1 / -1' }, onclick: () => { this.tracker.simulatePain(); toast('The demo person will start hurting on the next rep'); } }, icon('face', 15), 'Simulate pain on next rep') : null;

    const panel = h('aside', { class: 'live-panel' },
      h('div', { class: 'card ex-head' }, u.step, u.name, u.badges),
      h('div', { class: 'card' }, h('div', { class: 'reps' }, u.big, u.of), u.sides, h('div', { style: { borderTop: '1px solid var(--grid)', marginTop: '12px', paddingTop: '10px' } }, u.cue)),
      h('div', { class: 'card' },
        h('div', { class: 'disc-head' }, h('span', {}, 'Movement watch'), u.discLevel),
        h('div', { class: 'disc-meter' }, u.discFill, ...u.discMarks),
        h('div', { class: 'signals' }, Object.values(u.signals), u.voiceChip),
        u.faceStatus),
      u.sensorCard,
      h('div', { class: 'card' }, u.queue),
      this.diag.el);
    const controls = h('div', { class: 'controls' },
      h('button', { class: 'btn btn-danger btn-pain', type: 'button', onclick: () => this.painCheck('manual', ['manual']) }, icon('alert', 17), 'I feel pain'),
      h('button', { class: 'btn', type: 'button', onclick: () => this.pause() }, icon('pause', 15), 'Pause'),
      h('button', { class: 'btn', type: 'button', onclick: () => this.skip() }, icon('skip', 15), 'Skip'),
      demoBtn,
      roundBtn,
      h('button', { class: 'btn btn-ghost', type: 'button', style: { gridColumn: '1 / -1' }, onclick: () => this.end() }, icon('stop', 15), 'End session'));
    panel.children[1].after(controls);

    this.root.append(h('div', { class: 'live' }, this.stage, panel));
    this.renderQueue();
  }

  setText(el, text) {
    if (this.lastText.get(el) !== text) {
      this.lastText.set(el, text);
      el.textContent = text;
    }
  }

  chips(list) {
    const key = JSON.stringify(list);
    if (this.lastChips === key) return;
    this.lastChips = key;
    this.ui.chips.replaceChildren(...list.map(([text, tone]) => h('span', { class: `hud-chip ${tone ?? ''}` }, tone !== undefined ? h('span', { class: 'dot' }) : null, text)));
  }

  message(text, small) {
    const u = this.ui;
    if (!text) {
      u.msg.hidden = true;
      this.lastMsg = null;
      return;
    }
    const key = text + (small ?? '');
    if (this.lastMsg === key) return;
    this.lastMsg = key;
    u.msg.hidden = false;
    u.msg.replaceChildren(text, small ? h('small', {}, small) : '');
  }

  cue(text, tone = '') {
    const u = this.ui;
    u.cue.className = `cue ${tone}`;
    u.cue.replaceChildren(icon(tone === 'form' ? 'alert' : tone === 'ok' ? 'check' : 'info', 18), h('span', {}, text));
  }

  flash(level) {
    this.ui.flash.className = `flash ${level}`;
    clearTimeout(this.flashT);
    this.flashT = setTimeout(() => { this.ui.flash.className = 'flash'; }, level === 'moderate' ? 2500 : 1500);
  }

  renderQueue() {
    this.ui.queue.replaceChildren(...this.cfg.items.map((it, i) => {
      const r = this.results[i];
      const cls = i === this.idx ? 'current' : i < this.idx ? 'done' : '';
      const ic = r?.stoppedEarly ? icon('alert', 14) : r?.skipped ? icon('skip', 14) : i < this.idx ? icon('check', 14) : i === this.idx ? icon('play', 12) : h('span', { class: 'faint' }, String(i + 1));
      return h('li', { class: cls }, h('span', { class: 'q-icon' }, ic), byId[it.id].name);
    }));
  }

  // ---------- lifecycle ----------
  async boot() {
    // The user can end the session while this is still loading; nothing may start after that.
    const gone = () => this.destroyed || this.mode === 'summary';
    let stage = 'camera';
    try {
      if (!this.cfg.demo) {
        if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('No camera access in this browser'), { name: 'NoMediaDevices' });
        // Ask for the camera before the ~13 MB download, so a refusal doesn't waste it.
        this.ui.loadingText.textContent = 'Waiting for camera permission…';
        await this.tracker.startCamera(this.settings.cameraId);
        if (gone()) return this.tracker.stop();
      }
      stage = 'load';
      let timer;
      const slow = new Promise((_, reject) => {
        timer = setTimeout(() => reject(Object.assign(new Error('Download timed out'), { name: 'TimeoutError' })), LOAD_TIMEOUT_MS);
      });
      await Promise.race([this.tracker.load((m) => { this.ui.loadingText.textContent = m; }), slow]).finally(() => clearTimeout(timer));
      if (this.cfg.demo) {
        this.ui.loadingText.textContent = 'Starting demo…';
        await this.tracker.startCamera(this.settings.cameraId);
      }
    } catch (e) {
      console.error(e);
      this.tracker.stop();
      if (gone()) return;
      const err = cameraError(e, stage);
      this.ui.loading.replaceChildren(h('div', { style: { maxWidth: '440px' } },
        h('h2', { style: { color: '#fff', marginBottom: '8px' } }, err.title),
        h('p', { style: { opacity: 0.85, marginBottom: '14px' } }, err.body),
        h('div', { class: 'row', style: { justifyContent: 'center' } },
          h('button', { class: 'btn', type: 'button', onclick: () => location.reload() }, 'Retry'),
          h('a', { class: 'btn btn-primary', href: '#/session?demo=1' }, 'Try the demo'))));
      return;
    }
    if (gone()) return this.tracker.stop();
    this.ui.loading.remove();
    if (!this.cfg.demo) {
      const [vw, vh] = this.tracker.size;
      this.stage.style.aspectRatio = `${vw} / ${vh}`;
    }
    if (this.cfg.demo && this.sensors) await this.addDemoSensors();
    if (this.rec) {
      const [vw, vh] = this.tracker.size;
      this.rec.clip.capture = { ...this.tracker.info, aspect: vw / vh, videoSize: [vw, vh] };
      this.sensors?.startRecording();
    }
    this.tracker.start((f) => this.onFrame(f));
    this.watch();
    if (this.cfg.voiceInput) {
      this.listener = new Listener((k, v) => this.onVoice(k, v), (s) => {
        this.ui.voiceChip.hidden = s !== 'listening';
        if (s === 'denied') toast('Microphone blocked, so voice commands are off', { tone: 'warn' });
      });
      this.listener.start();
    }
    if (this.cfg.face && (this.cfg.demo || this.tracker.face)) this.calibrate();
    else this.next();
  }

  async addDemoSensors() {
    const source = (role) => (this.simPose && this.spec ? simSegmentAngles(this.simPose, this.spec.view, this.faults)[role] : { flex: 0, side: 0 });
    this.demoSensors = [];
    for (const [role, twist] of [['upper', 11], ['lower', -16]]) {
      // Realistic timing (clock offset, drift, radio delay and bursts) so recordings exercise time alignment.
      const radio = { ...DEFAULT_RADIO, offset: DEFAULT_RADIO.offset + (role === 'lower' ? 1.9 : 0), drift: role === 'lower' ? -DEFAULT_RADIO.drift : DEFAULT_RADIO.drift };
      const sensor = new SimSensor({ role, source, interval: false, twist, radio, seed: role === 'lower' ? 29 : 11 });
      const d = await this.sensors.add(sensor);
      d.cal = simCalibration(twist);
      this.demoSensors.push(sensor);
    }
  }

  destroy() {
    this.demoSensors?.forEach((s) => s.disconnect());
    if (this.rec && this.sensors?.recording) this.sensors.stopRecording();
    this.destroyed = true;
    window.__sessionLive = false;
    clearInterval(this.watchdog);
    removeEventListener('beforeunload', this.onUnload);
    document.removeEventListener('visibilitychange', this.onHidden);
    this.tracker?.stop();
    this.listener?.stop();
    this.voice.stop();
    clearTimeout(this.flashT);
    document.getElementById('modal-root').replaceChildren();
  }

  // ---------- calibration ----------
  calibrate() {
    this.mode = 'calibrate';
    this.calSamples = [];
    this.calStart = this.now();
    if (this.cfg.demo) this.tracker.setCalibrating();
    this.setText(this.ui.step, 'Getting ready');
    this.setText(this.ui.name, 'Face calibration');
    this.ui.badges.replaceChildren(h('span', { class: 'chip' }, icon('face', 13), 'About 3 seconds'));
    this.setText(this.ui.big, '—');
    this.setText(this.ui.of, '');
    this.cue('Face the camera, relax your face and breathe normally. This teaches SpineSense what your neutral expression looks like.');
    this.voice.say('First, face the camera and relax your face for a few seconds.', { priority: true });
  }

  calibrateFrame({ face, t }) {
    if (face?.found && face.frontal && face.score != null) this.calSamples.push(face.score);
    const n = this.calSamples.length;
    this.message('Face the camera and relax', `Learning your neutral expression… ${Math.min(100, Math.round((n / 40) * 100))}%`);
    if (n >= 40) {
      this.det.calibrateFace(this.calSamples);
      this.faceCalibrated = true;
      this.voice.say('Got it.', { priority: true });
      this.next();
    } else if (t - this.calStart > 12) {
      toast('Couldn’t see your face clearly. Using movement signals only.', { tone: 'warn' });
      this.next();
    }
  }

  // ---------- exercise flow ----------
  next() {
    if (this.mode === 'summary' || this.destroyed) return;
    this.idx++;
    this.paused = false;
    this.completing = false;
    this.renderQueue();
    if (this.idx >= this.cfg.items.length) {
      this.run = null;
      return this.finish();
    }
    const it = this.cfg.items[this.idx];
    const spec = byId[it.id];
    const prev = this.cfg.items[this.idx - 1];
    const moved = !prev || byId[prev.id].position !== spec.position || byId[prev.id].view !== spec.view;
    this.spec = spec;
    this.run = new ExerciseRun(spec, it.level, { repScale: it.repScale });
    this.events = [];
    this.exStart = this.now();
    this.det.resetExercise();
    this.mode = 'exercise';
    if (this.cfg.demo) this.tracker.setExercise(spec, spec.levels[it.level]);
    this.diag.event(this.now(), spec.id, { type: 'exercise-start', level: it.level });
    this.setText(this.ui.step, `Exercise ${this.idx + 1} of ${this.cfg.items.length}`);
    this.setText(this.ui.name, spec.name);
    this.renderBadges();
    this.cue(moved ? spec.camera : spec.steps[0]);
    this.voice.say(`${spec.name}. ${moved ? `${spec.camera.split('.')[0]}. ` : ''}${spec.steps[0]}`, { priority: true });
  }

  renderBadges() {
    this.ui.badges.replaceChildren(levelBadge(this.spec, this.run.levelIdx), h('span', { class: 'chip' }, icon('camera', 13), VIEW_LABEL[this.spec.view]), h('span', { class: 'chip' }, POSITION_LABEL[this.spec.position]));
  }

  /** Session clock: the latest frame time, so event timestamps match the frames that caused them. */
  now() {
    return this.lastT ?? performance.now() / 1000;
  }

  onFrame(fr) {
    if (this.destroyed) return;
    this.lastT = fr.t;
    this.lastFrameAt = performance.now();
    this.checkSpeed(fr.fps);
    this.draw(fr.frame);
    const tracking = !!fr.frame;
    this.chips([
      ...(this.cfg.demo ? [['Demo person']] : []),
      ...(this.lastSnapshot?.ok ? [[this.lastSnapshot.mode === 'dual' ? 'Back sensors' : 'Back sensor', '']] : []),
      [tracking ? `Tracking · ${fr.fps} fps` : 'Looking for you…', tracking ? (fr.fps < 12 ? 'warn' : '') : 'bad'],
    ]);
    if (this.mode === 'calibrate') {
      this.diag.sample(this, fr, null, null);
      return this.calibrateFrame(fr);
    }
    if (this.mode !== 'exercise' || this.paused) return;
    if (!fr.frame) {
      this.message('Step into view', 'I can’t see anyone yet');
      return;
    }
    const f = fr.frame;
    const t = fr.t;
    if (this.demoSensors) {
      this.simPose = f;
      this.demoSensors.forEach((s) => s.tick(t));
    }
    f.sensors = this.sensors ? this.sensors.snapshot(t) : null;
    this.lastSnapshot = f.sensors;
    if (this.spec.gesturePause && this.run.phase === 'active' && this.handRaised(f, t)) return this.pause('Hand raised');

    const st = this.run.update(f);
    if (fr.face && this.cfg.face) this.det.pushFace(fr.face.score, t, fr.face.frontal, fr.face.eyes);
    for (const ev of st.events) {
      this.det.onEvent(ev, st);
      this.handleEvent(ev, st);
    }
    this.det.onJitter(st.jitter, st.target);
    const d = st.phase === 'active' ? this.det.tick(t) : null;
    this.renderState(st, d, fr.face);
    this.renderSensors(f.sensors, t);
    this.rec?.addFrame(fr, { ex: this.spec.id, level: this.run.levelIdx, phase: st.phase, rep: st.reps, state: st.repState });
    this.diag.sample(this, fr, st, d);
    if (d?.trigger) this.onDiscomfort(d, t);
    if (st.phase === 'complete' && !this.completing) {
      this.completing = true;
      setTimeout(() => this.completeExercise(), 700);
    }
  }

  renderSensors(sn, t) {
    const u = this.ui;
    if (!this.sensors || t - (this.lastSensorUi ?? 0) < 0.1) return;
    this.lastSensorUi = t;
    u.sensorCard.hidden = !this.sensors.list.length;
    this.setText(u.sensorMode, sn?.ok ? (sn.mode === 'dual' ? 'Two sensors' : 'One sensor') : { uncalibrated: 'Needs calibration', lost: 'Signal lost', none: 'Not connected' }[sn?.mode] ?? '—');
    const set = (k, v) => {
      this.setText(u.sensorRows[k], v == null ? '—' : `${Math.round(v)}°`);
      const bar = u.sensorRows[`${k}Bar`];
      bar.style.width = `${v == null ? 0 : Math.max(0, Math.min(100, (Math.abs(v) / 90) * 100))}%`;
      bar.style.background = k === 'lumbar' ? 'var(--series-2)' : 'var(--series-1)';
    };
    set('trunk', sn?.trunk?.flex);
    set('pelvis', sn?.pelvis?.flex);
    set('lumbar', sn?.lumbar?.flex);
  }

  handRaised(f, t) {
    const nose = f.p(0);
    const up = (i) => f.vis(i) > 0.6 && f.p(i).y < nose.y - 0.08;
    if (up(15) || up(16)) {
      this.handSince ??= t;
      return t - this.handSince > 1.0;
    }
    this.handSince = null;
    return false;
  }

  handleEvent(ev, st) {
    const spec = this.spec;
    if (ev.type !== 'hold-tick' && ev.type !== 'rep-start') {
      this.diag.event(this.now(), spec.id, ev);
      this.rec?.addEvent(this.now(), spec.id, ev);
    }
    switch (ev.type) {
      case 'ready':
        this.voice.say(spec.kind === 'hold' ? 'Good. Begin when ready.' : 'Good. Begin.', { priority: true });
        this.cue(spec.steps[1] ?? spec.steps[0]);
        break;
      case 'rep': {
        const n = spec.alternating && ev.rep.limb ? st.bySide[ev.rep.limb] : ev.count;
        if (spec.kind === 'reps') this.voice.count(String(n));
        if (!ev.rep.issues.length) this.cue(spec.kind === 'hold' ? 'Nice hold. Lower slowly.' : 'Good rep', 'ok');
        break;
      }
      case 'hold-start':
        this.voice.count('Hold');
        this.cue('Hold it there. Breathe.', 'ok');
        break;
      case 'hold-tick':
        if (ev.remaining <= 3) this.voice.count(String(ev.remaining));
        break;
      case 'hold-done':
        this.voice.say('And slowly lower.', { priority: true });
        break;
      case 'form':
        this.voice.say(ev.cue, { key: ev.id, gap: 9000 });
        this.cue(ev.cue, 'form');
        break;
      case 'switch-side':
        this.voice.say('Now switch to the other side.', { priority: true });
        this.cue('Now switch to the other side');
        break;
      case 'complete':
        this.voice.say(`Nice work. That's the ${spec.name.toLowerCase()} done.`, { priority: true });
        break;
    }
  }

  renderState(st, d, face) {
    const u = this.ui;
    const spec = this.spec;
    // centre message
    if (st.phase !== 'active') this.message(st.message, st.settling ? 'Capturing your starting position' : spec.camera.split('.')[0]);
    else if (!st.tracking) this.message(st.message);
    else this.message(null);
    // meter
    u.bottom.hidden = st.phase !== 'active';
    if (st.phase === 'active') {
      this.setText(u.meterLabel, `${spec.metricLabel}${st.bySide && spec.alternating ? '' : ''}`);
      this.setText(u.meterValue, `${Math.round(st.value)}${spec.unit} / ${Math.round(st.target)}${spec.unit}`);
      u.meterFill.style.width = `${Math.min(100, (st.value / st.target) * 80)}%`;
      u.meterFill.classList.toggle('reached', st.value >= 0.9 * st.target);
    }
    // hold ring
    const holding = st.repState === 'holding';
    u.ring.hidden = !holding;
    if (holding) {
      const C = 2 * Math.PI * 44;
      u.ringArc.setAttribute('stroke-dashoffset', String(C * (1 - Math.min(1, st.holdSec / st.holdTarget))));
      this.setText(u.ringNum, String(Math.max(0, Math.ceil(st.holdTarget - st.holdSec))));
    }
    // reps
    if (spec.alternating) {
      const total = st.bySide.left + st.bySide.right;
      this.setText(u.big, String(total));
      this.setText(u.of, `/ ${st.targetReps * 2}`);
      this.setText(u.sides, `Left ${st.bySide.left}/${st.targetReps}  ·  Right ${st.bySide.right}/${st.targetReps}`);
    } else {
      this.setText(u.big, String(st.reps));
      this.setText(u.of, `/ ${st.targetReps}${spec.kind === 'hold' ? ` holds of ${st.holdTarget}s` : ' reps'}`);
      this.setText(u.sides, '');
    }
    // discomfort
    if (d) {
      const pct = Math.min(100, (d.score / d.thresholds.moderate) * 100);
      u.discFill.style.width = `${pct}%`;
      u.discFill.style.background = d.level === 'moderate' ? 'var(--critical)' : d.level === 'mild' ? 'var(--warning)' : 'var(--good)';
      u.discMarks[0].style.left = `${(d.thresholds.mild / d.thresholds.moderate) * 100}%`;
      u.discMarks[1].style.left = 'calc(100% - 2px)';
      this.setText(u.discLevel, d.level === 'moderate' ? 'Checking in' : d.level === 'mild' ? 'Easing off' : 'Your rating decides');
      for (const [k, el] of Object.entries(u.signals)) el.classList.toggle('on', d.signals[k] > 0.25);
    }
    const faceText = !this.cfg.face ? 'Face watching is off'
      : spec.view === 'side' ? 'Side-on exercise: face not visible, watching movement instead'
        : face?.found && face.frontal ? `Face: watching${this.faceCalibrated ? ' (calibrated to you)' : ''}`
          : face ? 'Face: not clearly visible' : this.lastText.get(u.faceStatus) ?? 'Face: looking…';
    this.setText(u.faceStatus, faceText);
  }

  draw(frame) {
    const c = this.canvas;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.round(c.clientWidth * dpr), H = Math.round(c.clientHeight * dpr);
    if (c.width !== W || c.height !== H) {
      c.width = W;
      c.height = H;
    }
    const g = c.getContext('2d');
    g.clearRect(0, 0, W, H);
    if (!frame) return;
    const lm = frame.lm;
    const issue = this.mode === 'exercise' && this.run?.cur?.issues?.size > 0 && this.run.repState !== 'rest';
    const P = (i) => [lm[i].x * W, lm[i].y * H];
    g.lineCap = 'round';
    g.lineWidth = Math.max(3, W / 240);
    g.strokeStyle = issue ? '#fab219' : 'rgba(255,255,255,0.92)';
    g.shadowColor = 'rgba(0,0,0,0.5)';
    g.shadowBlur = 6;
    for (const [a, b] of BONES) {
      if (a < 11 || (lm[a].visibility ?? 1) < 0.3 || (lm[b].visibility ?? 1) < 0.3) continue;
      g.beginPath();
      g.moveTo(...P(a));
      g.lineTo(...P(b));
      g.stroke();
    }
    g.shadowBlur = 0;
    for (let i = 11; i < 33; i++) {
      if ((lm[i].visibility ?? 1) < 0.3 || (i > 16 && i < 23)) continue;
      g.beginPath();
      g.arc(...P(i), Math.max(3.5, W / 300), 0, Math.PI * 2);
      g.fillStyle = '#3987e5';
      g.fill();
      g.lineWidth = Math.max(1.5, W / 700);
      g.strokeStyle = '#fff';
      g.stroke();
    }
    // head: sized from the ears (front view) or nose-to-ear distance (side view)
    if ((lm[0].visibility ?? 1) > 0.3) {
      const [nx, ny] = P(0), [lx, ly] = P(7), [rx, ry] = P(8);
      const r = Math.max(Math.hypot(lx - rx, ly - ry) * 0.6, Math.hypot(nx - (lx + rx) / 2, ny - (ly + ry) / 2) * 0.9, W / 160);
      const cx = (nx + (lx + rx) / 2) / 2, cy = (ny + (ly + ry) / 2) / 2;
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.lineWidth = Math.max(3, W / 240);
      g.strokeStyle = issue ? '#fab219' : 'rgba(255,255,255,0.92)';
      g.stroke();
    }
  }

  // ---------- discomfort ----------
  onDiscomfort(d, t) {
    const signals = d.top.length ? d.top : ['range'];
    this.diag.event(t, this.spec.id, { type: `discomfort-${d.trigger}`, score: d.score, signals });
    if (d.trigger === 'mild') {
      this.run.easeOff();
      this.events.push({ t: t - this.exStart, level: 'mild', signals, action: 'eased' });
      this.voice.say('That looked like harder work, so I’ve made the target smaller. Only go as far as feels comfortable.', { priority: true });
      this.cue('That looked harder than your earlier reps, so the range is smaller now. Only go as far as feels comfortable.', 'form');
      this.flash('mild');
    } else {
      this.painCheck('moderate', signals);
    }
  }

  /** The camera cannot see nerve symptoms, so every check-in asks about the legs directly. */
  legQuestion() {
    const q = { leg: null };
    const btns = [['no', 'No'], ['yes', 'Yes, new or spreading']].map(([k, label]) => h('button', {
      class: 'btn', type: 'button', 'aria-pressed': 'false',
      onclick: (e) => {
        q.leg = k === 'yes';
        btns.forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget)));
        q.onAnswer?.();
      },
    }, label));
    q.el = h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Any new or spreading leg symptoms (pain below the knee, tingling or numbness)?'), h('div', { class: 'toggle-btns' }, btns));
    return q;
  }

  /** A dialog that must be answered first: no pain check opens over it (a voice "ow" could). */
  blockingModal(content, opts) {
    const dlg = modal(content, opts);
    this.blocking = true;
    const close = dlg.close.bind(dlg);
    dlg.close = () => {
      this.blocking = false;
      close();
    };
    return dlg;
  }

  painCheck(level, signals) {
    if (this.checking || this.blocking || this.mode !== 'exercise') return;
    this.checking = true;
    this.paused = true;
    const t = this.now() - this.exStart;
    this.flash('moderate');
    this.voice.say('Let’s pause. Any new leg symptoms? And how is your pain right now, from zero to ten?', { priority: true });
    const why = level === 'moderate' ? 'That looked harder than your earlier reps.' : level === 'voice' ? 'I heard you.' : 'Thanks for telling me.';
    const leg = this.legQuestion();
    let dlg;
    let picked = null;
    const hint = h('p', { class: 'small', style: { color: 'var(--critical-text)' } });
    const close = () => {
      dlg.close();
      this.painModal = null;
    };
    const done = (n, legAnswer = leg.leg) => {
      close();
      this.answerPain(n, { t, level, signals, leg: !!legAnswer });
    };
    // Picking a number (or saying one) only selects it: the answer counts once it's confirmed.
    const submit = h('button', { class: 'btn btn-primary', type: 'button', disabled: true, onclick: () => {
      if (leg.leg == null) return (hint.textContent = 'Please answer the leg question too.');
      done(picked);
    } }, 'Confirm');
    leg.onAnswer = () => { hint.textContent = ''; };
    const scale = painScale(null, (n) => {
      picked = n;
      submit.disabled = false;
    });
    dlg = modal(h('div', { class: 'stack', style: { gap: '14px' } },
      h('h2', {}, 'Let’s check in'),
      h('p', { class: 'muted' }, `${why} How does your back feel right now?`),
      leg.el,
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Pain right now'), scale),
      h('div', { class: 'callout', style: { padding: '10px 12px' } }, h('p', { class: 'small' }, '0–3: carry on gently · 4–5: switch to an easier version · 6–7: stop this exercise · 8+: stop for today')),
      hint,
      h('div', { class: 'actions' },
        level === 'manual' ? h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => {
          close();
          this.diag.event(this.now(), this.spec.id, { type: 'pain-check-dismissed' });
          this.checking = false;
          this.paused = false;
          this.det.acknowledge(this.now());
          this.voice.say('Okay, carrying on.', { priority: true });
        } }, 'Pressed by mistake: carry on') : null,
        h('button', { class: 'btn btn-danger', type: 'button', onclick: () => done(6, leg.leg ?? false) }, 'Stop this exercise'),
        submit)),
    { label: 'Pain check', dismissable: false });
    this.painModal = scale;
  }

  answerPain(n, { t, level, signals, leg = false }) {
    const ev = { t, level, signals, rating: n, leg };
    this.diag.event(this.now(), this.spec.id, { type: 'pain-answer', level, rating: n, leg, signals });
    this.checking = false;
    this.det.acknowledge(this.now());
    if (leg) {
      ev.action = 'stopped';
      this.events.push(ev);
      this.recordCurrent({ stoppedEarly: true, legSymptoms: true, painRating: n, feel: 'hard' });
      return n >= 8 ? this.highPainStop() : this.legStop();
    }
    if (n <= 3) {
      ev.action = 'continued';
      this.voice.say('Okay. Carry on gently, and stop if it gets worse.', { priority: true });
      this.cue('Carry on gently. Stop if it gets worse.');
      this.events.push(ev);
      this.paused = false;
    } else if (n <= 5) {
      if (this.run.regress()) {
        ev.action = 'regressed';
        this.voice.say(`Let's switch to an easier version: ${this.run.level.name}. ${this.run.level.note}.`, { priority: true });
        this.cue(`Switched to ${this.run.level.name}: ${this.run.level.note}`, 'form');
        this.renderBadges();
        if (this.cfg.demo) this.tracker.setExercise(this.spec, this.run.level);
      } else {
        ev.action = 'eased';
        this.run.easeOff();
        this.voice.say('This is already the easiest level, so keep the movement small and comfortable.', { priority: true });
        this.cue('Keep it small and comfortable', 'form');
      }
      this.events.push(ev);
      this.paused = false;
    } else {
      ev.action = 'stopped';
      this.events.push(ev);
      this.recordCurrent({ stoppedEarly: true, painRating: n, feel: 'hard' });
      if (n >= 8) return this.highPainStop();
      this.painStop();
    }
  }

  /** Pain of 6-7/10: the exercise stops and rests; the user chooses whether to carry on with the next one. */
  painStop() {
    this.voice.say('Let’s stop this exercise. It will rest for a couple of days.', { priority: true });
    const last = this.idx + 1 >= this.cfg.items.length;
    const dlg = this.blockingModal(h('div', { class: 'stack' },
      h('h2', {}, 'Stop this exercise'),
      h('p', { class: 'muted' }, 'It will rest for a couple of days. Only carry on if the next exercise feels comfortable to try.'),
      h('div', { class: 'actions' },
        last ? null : h('button', { class: 'btn', type: 'button', onclick: () => { dlg.close(); this.next(); } }, 'Try the next exercise gently'),
        h('button', { class: 'btn btn-primary', type: 'button', onclick: () => { dlg.close(); this.finish(); } }, 'End session'))),
    { label: 'Exercise stopped', dismissable: false });
  }

  /** New or spreading leg symptoms: stop the exercise, rest it, and point to care. */
  legStop() {
    this.voice.say('Let’s stop this exercise. New or spreading leg symptoms are a reason to rest it.', { priority: true });
    const last = this.idx + 1 >= this.cfg.items.length;
    const dlg = this.blockingModal(h('div', { class: 'stack' },
      h('h2', {}, 'Stop this exercise'),
      h('p', { class: 'muted' }, 'New or spreading leg symptoms mean this exercise rests for at least 2 days. If they keep spreading, or haven’t settled within a day or two, see a doctor or physio.'),
      h('div', { class: 'callout danger', style: { padding: '10px 12px' } }, h('p', { class: 'small' }, 'Get urgent medical help if you notice numbness around the groin or genitals, bladder or bowel changes, or a leg getting weaker.')),
      h('div', { class: 'actions' },
        last ? null : h('button', { class: 'btn', type: 'button', onclick: () => { dlg.close(); this.next(); } }, 'Try the next exercise gently'),
        h('button', { class: 'btn btn-primary', type: 'button', onclick: () => { dlg.close(); this.finish(); } }, 'End session'))),
    { label: 'Leg symptoms', dismissable: false });
  }

  /** Pain of 8/10 or more ends the session: there is no option to carry on. */
  highPainStop() {
    this.voice.say('Your pain is high. Let’s stop for today.', { priority: true });
    const dlg = this.blockingModal(h('div', { class: 'stack' },
      h('h2', {}, 'Your pain is high. Let’s stop for today'),
      h('p', { class: 'muted' }, 'Rest in a comfortable position and move gently around the house when you can. If the pain is severe and not easing, spreads down a leg, or comes with numbness, weakness or bladder or bowel changes, get medical help.'),
      h('div', { class: 'actions' },
        h('button', { class: 'btn btn-primary', type: 'button', onclick: () => { dlg.close(); this.finish(); } }, 'End session'))),
    { label: 'High pain', dismissable: false });
  }

  onVoice(kind, value) {
    if (this.painModal && kind === 'number' && value >= 0 && value <= 10) return this.painModal.select(value); // still needs Confirm
    if (this.feedbackScale && kind === 'number' && value >= 0 && value <= 10) return this.feedbackScale.select(value);
    if (kind === 'pain') return this.painCheck('voice', ['voice']);
    if (kind === 'stop') return this.pause('You said stop');
    if (kind === 'resume' && this.pauseDlg) {
      this.pauseDlg.close();
      this.pauseDlg = null;
      this.resume();
    }
  }

  // ---------- controls ----------
  pause(reason = 'Paused') {
    if (this.mode !== 'exercise' || this.paused) return;
    this.paused = true;
    this.handSince = null;
    this.voice.say('Paused. Say continue, or press resume when you’re ready.', { priority: true });
    const dlg = this.blockingModal(h('div', { class: 'stack' },
      h('h2', {}, reason === 'Paused' ? 'Paused' : `Paused: ${reason.toLowerCase()}`),
      h('p', { class: 'muted' }, 'Take your time.'),
      h('div', { class: 'actions' },
        h('button', { class: 'btn btn-danger', type: 'button', onclick: () => { dlg.close(); this.pauseDlg = null; this.paused = false; this.painCheck('manual', ['manual']); } }, 'I feel pain'),
        h('button', { class: 'btn', type: 'button', onclick: () => { dlg.close(); this.pauseDlg = null; this.paused = false; this.skip(); } }, 'Skip exercise'),
        h('button', { class: 'btn', type: 'button', onclick: () => { dlg.close(); this.pauseDlg = null; this.finish(); } }, 'End session'),
        h('button', { class: 'btn btn-primary', type: 'button', onclick: () => { dlg.close(); this.pauseDlg = null; this.resume(); } }, icon('play', 14), 'Resume'))),
    { label: 'Paused', dismissable: false });
    this.pauseDlg = dlg;
  }

  resume() {
    this.paused = false;
    this.voice.say('Resuming.', { priority: true });
  }

  skip() {
    if (this.mode !== 'exercise') return;
    this.paused = true;
    const pick = (reason) => {
      dlg.close();
      this.paused = false;
      if (reason === 'hurts') return this.painCheck('manual', ['manual']);
      this.diag.event(this.now(), this.spec.id, { type: 'skip', reason });
      this.recordCurrent({ skipped: true, skipReason: reason });
      this.next();
    };
    const dlg = this.blockingModal(h('div', { class: 'stack' },
      h('h2', {}, 'Skip this exercise?'),
      h('p', { class: 'muted' }, 'Why are you skipping it?'),
      h('div', { class: 'choice-list' }, SKIP_REASONS.map(([k, label]) => h('button', { class: 'btn', type: 'button', onclick: () => pick(k) }, label))),
      h('div', { class: 'actions' }, h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => { dlg.close(); this.paused = false; } }, 'Don’t skip'))),
    { label: 'Skip exercise', dismissable: false });
  }

  end() {
    if (this.mode === 'summary') return;
    if (!confirm('End the session now? Finished exercises will be kept.')) return;
    this.finish();
  }

  recordCurrent(extra) {
    if (!this.run || this.results[this.idx]) return;
    this.results[this.idx] = { ...this.run.summary(), painRating: null, feel: null, events: this.events, ...extra };
  }

  completeExercise() {
    if (this.destroyed || this.mode !== 'exercise') return;
    this.paused = true;
    const s = this.run.summary();
    const fb = { painRating: null, feel: null };
    const nextBtn = h('button', { class: 'btn btn-primary', type: 'button', disabled: true }, this.idx + 1 < this.cfg.items.length ? 'Next exercise' : 'Finish session');
    const leg = this.legQuestion();
    const ready = () => { nextBtn.disabled = fb.painRating == null || leg.leg == null; };
    leg.onAnswer = ready;
    const scale = painScale(null, (n) => { fb.painRating = n; ready(); });
    const feelBtns = [['easy', 'Too easy'], ['right', 'Just right'], ['hard', 'Too hard']].map(([k, label]) => h('button', {
      class: 'btn', type: 'button', 'aria-pressed': 'false',
      onclick: (e) => { fb.feel = k; feelBtns.forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); },
    }, label));
    this.feedbackScale = scale;
    this.voice.say('How was that? Any new leg symptoms? And rate your pain from zero to ten.', { priority: true });
    const checkIns = this.events.length;
    const dlg = this.blockingModal(h('div', { class: 'stack' },
      h('h2', {}, `${this.spec.name}: done`),
      h('div', { class: 'row small muted' },
        h('span', { class: 'chip' }, `${s.reps}/${s.targetReps} ${this.spec.kind === 'hold' ? 'holds' : 'reps'}`),
        s.formScore != null ? h('span', { class: 'chip' }, `Form ${s.formScore}%`) : null,
        s.peakBest != null ? h('span', { class: 'chip' }, `Best ${s.peakBest}${s.unit}`) : null,
        s.asymmetry ? h('span', { class: 'chip' }, `L ${s.asymmetry.left}${s.unit} · R ${s.asymmetry.right}${s.unit}`) : null,
        checkIns ? h('span', { class: 'pill band-warning' }, `${checkIns} check-in${checkIns > 1 ? 's' : ''}`) : null),
      leg.el,
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Pain during this exercise'), scale),
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'How did it feel?'), h('div', { class: 'feel-row' }, feelBtns)),
      h('div', { class: 'actions' }, nextBtn)),
    { label: 'Exercise feedback', dismissable: false });
    nextBtn.addEventListener('click', () => {
      dlg.close();
      this.feedbackScale = null;
      this.results[this.idx] = { ...s, ...fb, legSymptoms: leg.leg, events: this.events, stoppedEarly: false };
      if (fb.painRating >= 8) return this.highPainStop();
      if (leg.leg) return this.legStop();
      this.next();
    });
  }

  // ---------- summary ----------
  finish() {
    if (this.mode === 'summary') return;
    if (this.mode === 'exercise' && this.run?.reps.length) this.recordCurrent({ stoppedEarly: false });
    this.mode = 'summary';
    this.tracker.stop();
    this.listener?.stop();
    clearInterval(this.watchdog);
    window.__sessionLive = false;
    this.blocking = false;
    document.getElementById('modal-root').replaceChildren();
    const results = this.results.filter(Boolean);
    const durationSec = Math.round((Date.now() - this.startedAt) / 1000);
    const reps = results.reduce((a, r) => a + r.reps, 0);
    const forms = results.map((r) => r.formScore).filter((x) => x != null);
    const flags = results.reduce((a, r) => a + (r.events?.length ?? 0), 0);
    this.voice.say(`Session complete. ${reps} reps. Well done.`, { priority: true });
    let painAfter = null;

    let clip = null;
    if (this.rec) {
      clip = this.rec.finish({ sensors: this.sensors?.list ?? [], sensorRaw: this.sensors?.recording ? this.sensors.stopRecording() : null, results });
      this.rec = null;
      saveClip(clip)
        .then(() => toast(`Training clip saved to Recordings (${clip.frames.rows.length} frames)`))
        .catch((e) => toast(`${e.message} Use "Download clip" to keep it.`, { tone: 'warn', ms: 6000 }));
    }
    const saved = this.cfg.demo ? null : this.saveSession(results, durationSec);
    const hasSensor = results.some((r) => r.sensor);
    const root = this.root;
    root.replaceChildren(
      h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, 'Session complete'), h('p', {}, `${fmtDur(durationSec)} · ${results.length} exercise${results.length === 1 ? '' : 's'}${this.cfg.demo ? ' · demo' : ''}`))),
      h('div', { class: 'summary-grid', style: { marginBottom: '16px' } },
        tile('Total reps', String(reps)),
        tile('Average form', forms.length ? `${Math.round(forms.reduce((a, b) => a + b, 0) / forms.length)}%` : '—'),
        tile('Discomfort flags', String(flags)),
        tile('Pain before', this.cfg.painBefore == null ? '—' : `${this.cfg.painBefore}/10`)),
      h('div', { class: 'grid grid-main' },
        h('section', { class: 'card' },
          h('div', { class: 'section-title' }, h('h2', {}, 'Exercises')),
          results.length ? h('div', { class: 'table-scroll' }, h('table', { class: 'data-table' },
            h('thead', {}, h('tr', {}, ['Exercise', 'Level', 'Reps', 'Form', 'Best', hasSensor ? 'Lower back (sensor)' : null, 'Pain', 'Flags'].filter(Boolean).map((x) => h('th', {}, x)))),
            h('tbody', {}, results.map((r) => h('tr', {},
              h('td', {}, byId[r.id].name, r.stoppedEarly ? h('span', { class: 'faint' }, ' (stopped)') : r.skipped ? h('span', { class: 'faint' }, ' (skipped)') : ''),
              h('td', {}, r.levelName),
              h('td', {}, `${r.reps}/${r.targetReps}`),
              h('td', {}, r.formScore == null ? '—' : `${r.formScore}%`),
              h('td', {}, r.peakBest == null ? '—' : `${r.peakBest}${r.unit}`),
              hasSensor ? h('td', {}, r.sensor ? (r.sensor.lumbarFlexMax != null ? `${r.sensor.lumbarFlexMax}°` : `trunk ${r.sensor.trunkFlexMax}°`) : '—') : null,
              h('td', {}, painPill(r.painRating)),
              h('td', {}, r.events?.length ? String(r.events.length) : '—')))))) : h('p', { class: 'muted' }, 'No exercises were completed.')),
        h('div', { class: 'stack' },
          saved ? h('section', { class: 'card stack' }, h('h2', {}, 'How is your back now?'), painScale(null, (n) => { painAfter = n; this.updateSession(saved.id, { painAfter }); })) : null,
          this.cfg.demo
            ? h('div', { class: 'callout info' }, icon('info'), h('p', { class: 'small' }, 'Demo sessions aren’t saved. Do the safety check and start a real session to begin tracking.'))
            : null,
          !this.cfg.demo && !saved ? h('div', { class: 'callout info' }, icon('info'), h('p', { class: 'small' }, 'Nothing was saved, because no exercise was done.')) : null,
          saved ? h('a', { class: 'btn btn-primary btn-lg', href: `#/history/${saved.id}` }, 'Done') : h('a', { class: 'btn btn-primary btn-lg', href: '#/dashboard' }, 'Back to dashboard'),
          clip ? h('a', { class: 'btn', href: '#/recordings' }, icon('record', 15), 'Open in Recordings') : null,
          clip ? h('button', { class: 'btn', type: 'button', onclick: () => downloadClip(clip) }, icon('download', 15), 'Download clip (.json)') : null,
          clip ? h('p', { class: 'small faint' }, 'The clip holds body landmarks (and sensor readings, if any), not video. Keep downloaded copies private.') : null,
          h('button', { class: 'btn', type: 'button', onclick: () => this.diag.copy(results) }, 'Copy test report'))));

  }

  /** Saves the session as soon as it ends. Nothing is saved if no exercise was actually done. */
  saveSession(results, durationSec) {
    if (!results.some((r) => r.reps > 0 || r.stoppedEarly || r.legSymptoms)) return null;
    const session = {
      id: `s-${Date.now().toString(36)}`,
      date: new Date(this.startedAt).toISOString(),
      durationSec,
      painBefore: this.cfg.painBefore,
      painAfter: null,
      exercises: results,
    };
    // Practice skips level-ups, but an exercise that hurt still rests and drops a level.
    const hurt = results.some((r) => r.stoppedEarly || r.legSymptoms || (r.painRating ?? 0) >= 6);
    const ok = store.update((s) => {
      session.levelChanges = this.cfg.single && !hurt ? [] : applyProgression(s, session);
      s.sessions.push(session);
    });
    const ups = session.levelChanges.filter((c) => c.to > c.from).length;
    // store.update() reports whether the browser actually kept it (private windows may not).
    if (ok) toast(ups ? `Session saved. ${ups} exercise${ups > 1 ? 's' : ''} levelled up!` : 'Session saved');
    return session;
  }

  updateSession(id, patch) {
    store.update((s) => {
      const found = s.sessions.find((x) => x.id === id);
      if (found) Object.assign(found, patch);
    });
  }

  // ---------- health checks ----------
  /** Camera stopped (unplugged, taken by another app) or the page was hidden: pause and say so. */
  watch() {
    this.lastFrameAt = performance.now();
    this.watchdog = setInterval(() => {
      if (this.mode !== 'exercise' || this.paused || this.stalled) return;
      if (performance.now() - this.lastFrameAt < 3000) return;
      this.stalled = true;
      this.paused = true;
      this.voice.say('The camera stopped. Check it, then press retry.', { priority: true });
      this.blockingModal(h('div', { class: 'stack' },
        h('h2', {}, 'The camera stopped'),
        h('p', { class: 'muted' }, 'No picture for a few seconds. It may be unplugged or in use by another app, such as a video call. Exercises you finished are kept.'),
        h('div', { class: 'actions' },
          h('button', { class: 'btn', type: 'button', onclick: () => this.finish() }, 'End session'),
          h('button', { class: 'btn btn-primary', type: 'button', onclick: () => {
            this.finish();
            location.reload();
          } }, 'Save and retry'))),
      { label: 'Camera stopped', dismissable: false });
    }, 1000);
    this.onHidden = () => {
      if (document.visibilityState === 'hidden' && this.mode === 'exercise') this.pause('You left the page');
    };
    document.addEventListener('visibilitychange', this.onHidden);
  }

  /** Slow tracking makes coaching unreliable: say so once, with what to change. */
  checkSpeed(fps) {
    if (this.cfg.demo || this.speedWarned || this.mode !== 'exercise' || fps == null) return;
    this.slowSince = fps < 12 ? (this.slowSince ?? performance.now()) : null;
    if (this.slowSince == null || performance.now() - this.slowSince < 6000) return;
    this.speedWarned = true;
    this.diag.event(this.now(), this.spec?.id ?? null, { type: 'slow-tracking', fps });
    toast(`Tracking is slow on this computer (${fps} fps), so reps and cues may be off. In Settings, choose the Lite model and turn off facial strain.`, { tone: 'warn', ms: 9000 });
  }
}

const SKIP_REASONS = [['couldnt-see', 'It couldn’t see me properly'], ['hurts', 'It hurts'], ['too-hard', 'Too hard'], ['unclear', 'Not sure what to do'], ['other', 'Something else']];
const LOAD_TIMEOUT_MS = 45000;

/** Readable messages for the ways starting the camera or the models can fail. */
function cameraError(e, stage) {
  const name = e?.name;
  if (name === 'NoMediaDevices') return { title: 'This browser can’t use your camera', body: 'Open SpineSense in Chrome or Edge (or Safari on iPhone). Browsers inside other apps often can’t use the camera.' };
  if (name === 'NotAllowedError') return { title: 'Camera access was blocked', body: 'Click the camera icon in the address bar, choose Allow, then press Retry. Video stays on this device.' };
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return { title: 'No camera found', body: 'Check your webcam is connected, or pick another camera in Settings.' };
  if (name === 'NotReadableError' || name === 'AbortError' || name === 'TrackStartError') return { title: 'Your camera is busy', body: 'Another app is using it (a video call, or the Camera app). Close that app, then press Retry.' };
  if (name === 'TimeoutError') return { title: 'The download is taking too long', body: 'The body-tracking model (about 13 MB) comes from Google’s servers the first time. Try a faster or different network, or try the demo.' };
  if (stage === 'load') return { title: 'Couldn’t load body tracking', body: `${e?.message ?? e}. The models download from Google’s servers on first use, so an internet connection is needed.` };
  return { title: 'Couldn’t start the camera', body: `${e?.message ?? e}. Try closing other apps that use the camera, then press Retry.` };
}

function tile(label, value) {
  return h('div', { class: 'card stat' }, h('div', { class: 'stat-label' }, label), h('div', { class: 'stat-value' }, value));
}
