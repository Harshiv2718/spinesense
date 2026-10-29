import { store } from '../store.js';
import { h, icon, toggle, toast } from '../ui.js';
import { CameraTracker } from '../vision/tracker.js';
import { Listener } from '../coach/voice.js';
import { hub } from '../sensors/hub.js';
import { deleteAllClips } from '../data/clipstore.js';

export function render(root) {
  const st = store.get().settings;
  const set = (k, v) => store.update((s) => { s.settings[k] = v; });

  root.append(h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, 'Settings'), h('p', {}, 'Coaching, detection and your data.'))));

  const camSelect = h('select', { onchange: (e) => set('cameraId', e.target.value) }, h('option', { value: '' }, 'Default camera'));
  CameraTracker.cameras().then((cams) => {
    cams.forEach((c, i) => camSelect.append(h('option', { value: c.deviceId, selected: c.deviceId === st.cameraId }, c.label || `Camera ${i + 1}`)));
  });

  root.append(h('div', { class: 'grid grid-2' },
    h('section', { class: 'card stack' },
      h('h2', {}, 'Coaching'),
      toggle('Spoken coaching', st.voiceCoach, (v) => set('voiceCoach', v), 'Counts reps, cues your form and checks in when something looks uncomfortable.'),
      toggle('Listen for "ow" and "stop"', st.voiceInput, (v) => set('voiceInput', v),
        Listener.supported ? 'Sends your microphone audio for the whole session, including anything else said in the room, to Google (Chrome) or Microsoft (Edge). Off by default.' : 'Not supported in this browser. Try Chrome or Edge.'),
      h('div', { class: 'field' }, h('label', {}, 'Camera'), camSelect, h('small', {}, 'Camera names appear after you allow camera access once.'))),
    h('section', { class: 'card stack' },
      h('h2', {}, 'Discomfort detection'),
      toggle('Also watch facial strain (optional)', st.faceOptIn, (v) => set('faceOptIn', v), 'Off by default. Compares your face with your relaxed and effort faces. It never acts on its own: it only prompts a check-in when your movement also changes, and your own rating always decides.'),
      h('div', { class: 'field' }, h('label', {}, 'Sensitivity'),
        h('select', { onchange: (e) => set('sensitivity', e.target.value) },
          [['low', 'Low: only clear signs'], ['medium', 'Medium (recommended)'], ['high', 'High: check in early']].map(([v, l]) => h('option', { value: v, selected: st.sensitivity === v }, l)))),
      h('div', { class: 'field' }, h('label', {}, 'Body-tracking model'),
        h('select', { onchange: (e) => set('modelVariant', e.target.value) },
          [['lite', 'Lite: fastest, older laptops'], ['full', 'Full (recommended)'], ['heavy', 'Heavy: most accurate, needs a good GPU']].map(([v, l]) => h('option', { value: v, selected: st.modelVariant === v }, l))))),
    h('section', { class: 'card stack' },
      h('h2', {}, 'Back-sensor hardware'),
      toggle('Show hardware sensor options', st.hardwareSensors, (v) => {
        set('hardwareSensors', v);
        if (!v) for (const d of hub.list) hub.remove(d.id); // nothing keeps streaming once hidden
      }, 'For SpineSense Motion Bluetooth sensors (ESP32 boards you build or flash yourself). Leave it off if you don’t have one: the camera, the demo’s simulated sensors and the phone sensor work without it.')),
    h('section', { class: 'card stack' },
      h('h2', {}, 'Your data'),
      h('p', { class: 'muted small' }, 'Sessions, pain ratings and settings are stored only in this browser. Video is processed on this device and never saved or uploaded.'),
      h('div', { class: 'row' },
        h('button', { class: 'btn btn-sm', type: 'button', onclick: exportData }, icon('download', 15), 'Export JSON'),
        h('label', { class: 'btn btn-sm' }, icon('upload', 15), 'Import JSON', h('input', { type: 'file', accept: 'application/json', hidden: true, onchange: importData })),
        h('button', {
          class: 'btn btn-sm btn-danger',
          type: 'button',
          onclick: () => {
            if (!confirm('Delete all sessions, training clips, your safety check and settings? This cannot be undone.')) return;
            store.reset();
            try {
              localStorage.removeItem('spinesense.sensorcal');
            } catch {
              /* storage unavailable */
            }
            deleteAllClips()
              .catch(() => {})
              .finally(() => {
                toast('All data deleted');
                location.hash = '#/dashboard';
              });
          },
        }, icon('trash', 15), 'Delete all data'))),
    h('section', { class: 'card stack' },
      h('h2', {}, 'About'),
      h('p', { class: 'small muted' }, 'SpineSense uses Google MediaPipe to track 33 body points and 52 facial expression scores in your browser. The discomfort detector combines grimace, range drop, slowing, guarding, shaking and bracing, each measured against your own baseline.'),
      h('p', { class: 'small muted' }, 'It is an exercise companion, not a medical device, and it cannot diagnose anything. If pain is severe, spreading down a leg, or comes with numbness, weakness or bladder or bowel changes, see a doctor.'))));
}

function exportData() {
  if (!confirm('This file contains your health information: pain ratings, symptoms and session history. Keep it private and only share it with people you trust, such as your physio. Export now?')) return;
  const blob = new Blob([store.exportJSON()], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `spinesense-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function importData(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  file.text().then((text) => {
    try {
      store.importJSON(text);
      toast('Data imported');
      location.hash = '#/dashboard';
    } catch (err) {
      toast(`Import failed: ${err.message}`, { tone: 'warn' });
    }
  });
}
