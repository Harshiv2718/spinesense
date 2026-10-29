// Recordings: the local clip library, the camera-vs-sensor analysis, and consent management.

import { h, icon, toast, fmtDate, fmtTime, emptyState } from '../ui.js';
import { listClips, getClip, deleteClip, saveClip, storageUsage } from '../data/clipstore.js';
import { clipFromJSON } from '../data/clip.js';
import { analyzeClip, ICC_MIN_SPREAD } from '../analysis/agreement.js';
import { blandAltmanSVG } from '../analysis/plots.js';
import { simulateClip } from '../analysis/simclip.js';
import { mergePhone, removePhone } from '../analysis/phonemerge.js';
import { byId } from '../core/exercises.js';
import { clipConsent, withdrawClipConsent } from './consent.js';
import { downloadClip } from './sensors.js';

const mb = (b) => `${(b / 1e6).toFixed(1)} MB`;

// Phones only share motion sensors with https pages, so a local copy of the app points phones at the live demo.
const LIVE_DEMO = 'https://harshiv2718.github.io/spinesense/';
const phoneUrl = () => (location.protocol === 'https:' ? new URL('phone.html', location.href.split('#')[0]).href : `${LIVE_DEMO}phone.html`);
const phoneOf = (clip) => (clip.sensors ?? []).find((s) => s.source === 'phone');

export function render(root) {
  const listBox = h('div', {});
  const analysisBox = h('div', {});
  const consentBox = h('div', {});
  const status = h('p', { class: 'small faint' });

  const simBtn = h('button', { class: 'btn', type: 'button' }, 'Create a simulated clip');
  simBtn.addEventListener('click', async () => {
    simBtn.disabled = true;
    simBtn.textContent = 'Simulating…';
    try {
      await new Promise((r) => setTimeout(r, 30));
      const clip = await simulateClip();
      await saveClip(clip);
      toast('Simulated clip saved');
      await refresh();
      await analyse(clip.id);
    } catch (e) {
      toast(e.message, { tone: 'warn' });
    } finally {
      simBtn.disabled = false;
      simBtn.textContent = 'Create a simulated clip';
    }
  });

  const importInput = h('input', { type: 'file', accept: 'application/json', hidden: true, onchange: async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const clip = clipFromJSON(JSON.parse(await file.text()));
      await saveClip(clip);
      toast('Clip imported');
      await refresh();
    } catch (err) {
      toast(`Import failed: ${err.message}`, { tone: 'warn' });
    }
  } });

  root.append(h('div', { class: 'page-head' },
    h('div', {}, h('h1', {}, 'Recordings'),
      h('p', {}, 'Training clips: body landmarks, plus phone or back-sensor readings if you add them, never video. Stored only in this browser. Use them to check how closely the camera matches a back sensor.')),
    h('div', { class: 'row' }, h('label', { class: 'btn' }, icon('upload', 15), 'Import clip', importInput), simBtn)));
  const url = phoneUrl();
  const phoneCard = h('section', { class: 'card stack' }, h('h2', {}, 'Use your phone as a back sensor'),
    h('p', { class: 'small muted' }, 'Strap your phone to your upper back and it records how your trunk tilts, so you can check the camera against it. No extra hardware needed.'),
    h('ol', { class: 'small muted', style: { margin: 0, paddingLeft: '18px' } },
      h('li', {}, 'On the phone, open ', h('a', { href: url, target: '_blank', rel: 'noopener' }, url.replace(/^https:\/\//, '')), ' and follow the spoken steps.'),
      h('li', {}, 'When it says “Recording”, start a session here with “Record a training clip” on. Standing exercises only.'),
      h('li', {}, 'Send the phone’s file to this computer, then choose “Add phone data” on the session’s clip.')),
    h('div', { class: 'row' }, h('button', { class: 'btn btn-sm', type: 'button', onclick: async () => {
      try {
        await navigator.clipboard.writeText(url);
        toast('Link copied');
      } catch {
        toast(url);
      }
    } }, 'Copy phone link')),
    h('p', { class: 'small faint' }, 'Turn on automatic date and time on both devices. The phone sits higher on the back than a dedicated sensor would, and its accuracy hasn’t been bench-tested yet.'));

  root.append(h('div', { class: 'grid grid-main' }, h('div', { class: 'stack' }, listBox, analysisBox), h('div', { class: 'stack' }, consentBox, phoneCard, h('section', { class: 'card stack' }, h('h2', {}, 'How to record'),
    h('ol', { class: 'small muted', style: { margin: 0, paddingLeft: '18px' } },
      h('li', {}, 'Optional: set up your phone as a back sensor (see above).'),
      h('li', {}, 'Start a session and switch on "Record a training clip".'),
      h('li', {}, 'Begin with the standing hip hinge: its clear up-and-down movement lets the analysis line up camera and sensor time.'),
      h('li', {}, 'Finish the session; the clip appears here.')),
    h('p', { class: 'small faint' }, '“Create a simulated clip” runs the whole pipeline with a simulated person and simulated sensors, including realistic radio delay and clock drift.'), status))));

  async function refresh() {
    let clips = [];
    try {
      clips = await listClips();
    } catch (e) {
      listBox.replaceChildren(h('div', { class: 'callout warn' }, icon('alert'), h('p', { class: 'small' }, e.message)));
      return;
    }
    const usage = await storageUsage();
    status.textContent = usage ? `Browser storage used by this site: ${mb(usage.usage)} of ${mb(usage.quota)}.` : '';
    listBox.replaceChildren(h('section', { class: 'card' },
      h('div', { class: 'section-title' }, h('h2', {}, 'Clips'), h('p', {}, `${clips.length} saved`)),
      clips.length ? h('div', { class: 'table-scroll' }, h('table', { class: 'data-table' },
        h('thead', {}, h('tr', {}, ['Recorded', 'Length', 'Exercises', 'Sensors', 'Size', ''].map((t) => h('th', {}, t)))),
        h('tbody', {}, clips.map((c) => h('tr', {},
          h('td', {}, `${fmtDate(c.createdAt)} ${fmtTime(c.createdAt)}`, c.simulated ? h('span', { class: 'pill', style: { marginLeft: '6px' } }, 'simulated') : null),
          h('td', {}, `${Math.round(c.durationS)} s`),
          h('td', {}, c.exercises.map((id) => byId[id]?.name ?? id).join(', ')),
          h('td', {}, c.sensors.length ? c.sensors.join(' + ') : '—'),
          h('td', {}, mb(c.bytes)),
          h('td', {}, h('div', { class: 'row', style: { gap: '6px', flexWrap: 'nowrap' } },
            c.sensors.length ? h('button', { class: 'btn btn-sm btn-primary', type: 'button', onclick: () => analyse(c.id) }, 'Analyse')
              : h('label', { class: 'btn btn-sm btn-primary', title: 'Merge a recording from the phone sensor page into this clip' }, 'Add phone data',
                h('input', { type: 'file', accept: '.json,.txt,application/json,text/plain', hidden: true, onchange: (e) => e.target.files?.[0] && addPhone(c.id, e.target.files[0]) })),
            h('button', { class: 'btn btn-sm', type: 'button', onclick: async () => downloadClip(await getClip(c.id)) }, 'Download'),
            h('button', { class: 'btn btn-sm btn-ghost', type: 'button', onclick: async () => {
              if (!confirm('Delete this clip? This cannot be undone.')) return;
              await deleteClip(c.id);
              analysisBox.replaceChildren();
              refresh();
            } }, 'Delete'))))))))
        : emptyState('No clips yet', 'Switch on “Record a training clip” in a session (then add your phone’s data), or create a simulated clip to see the analysis.')));
    const consent = clipConsent();
    consentBox.replaceChildren(h('section', { class: 'card stack' },
      h('h2', {}, 'Consent'),
      consent
        ? h('p', { class: 'small' }, `Recording allowed since ${fmtDate(consent.at)}. You can withdraw at any time; that deletes every clip on this device.`)
        : h('p', { class: 'small muted' }, 'Recording is off. You’ll be asked for consent the first time you switch on "Record a training clip" in a session.'),
      consent ? h('button', { class: 'btn btn-danger btn-sm', type: 'button', onclick: async () => {
        if (!confirm('Withdraw consent and delete all clips on this device?')) return;
        await withdrawClipConsent();
        analysisBox.replaceChildren();
        toast('Consent withdrawn and all clips deleted');
        refresh();
      } }, 'Withdraw and delete all clips') : null));
  }

  async function addPhone(id, file) {
    try {
      const phone = JSON.parse(await file.text());
      const m = mergePhone(await getClip(id), phone);
      await saveClip(m.clip);
      toast(`Phone data added (clocks ${Math.abs(m.offset).toFixed(1)} s apart, movement match ${m.r.toFixed(2)})`);
      await refresh();
      await analyse(id);
    } catch (e) {
      toast(e instanceof SyntaxError ? 'That file isn’t a phone recording' : e.message, { tone: 'warn', ms: 7000 });
    }
  }

  async function analyse(id) {
    analysisBox.replaceChildren(h('section', { class: 'card' }, h('p', { class: 'muted' }, 'Analysing…')));
    await new Promise((r) => setTimeout(r, 20));
    const clip = await getClip(id);
    const res = analyzeClip(clip);
    if (!res.ok) {
      analysisBox.replaceChildren(h('section', { class: 'card' }, h('p', { class: 'muted' }, res.reason)));
      return;
    }
    const rows = Object.entries(res.perExercise);
    const phone = phoneOf(clip);
    const card = h('section', { class: 'card stack' },
      h('div', { class: 'section-title' }, h('h2', {}, phone ? 'Camera vs phone on the back' : 'Camera vs back sensor'), h('p', {}, clip.simulated ? 'Simulated clip: tests the pipeline, not real-world accuracy' : fmtDate(clip.createdAt))),
      phone?.sync?.warnings?.length ? h('div', { class: 'callout warn' }, icon('alert'), h('ul', { class: 'small', style: { margin: 0 } }, phone.sync.warnings.map((w) => h('li', {}, w)))) : null,
      h('div', { class: 'summary-grid', style: { gridTemplateColumns: 'repeat(3, minmax(0,1fr))' } },
        phone
          ? stat('Clock offset', `${(phone.sync.wallClockOffsetS + res.lag.lag).toFixed(2)} s`, `phone vs computer, found from the movement (correlation ${res.lag.r != null ? res.lag.r.toFixed(2) : phone.sync.r})`)
          : stat('Clock offset', `${Math.round(res.lag.lag * 1000)} ms`, res.lag.r != null ? `correlation ${res.lag.r.toFixed(2)}` : res.lag.method),
        stat('Smoothing delay', `${Math.round(res.smoothingDelay * 1000)} ms`, 'added by the landmark filter'),
        stat('Exercises compared', String(rows.length), 'with sensor data')),
      rows.length ? h('div', { class: 'table-scroll' }, h('table', { class: 'data-table' },
        h('thead', {}, h('tr', {}, ['Exercise', 'Compared', 'Reps', 'Bias (reps)', '95% limits (reps)', 'ICC (reps)', 'MAE (frames)', 'CCC (frames)'].map((t) => h('th', {}, t)))),
        h('tbody', {}, rows.map(([exId, e]) => h('tr', {},
          h('td', {}, byId[exId]?.name ?? exId),
          h('td', {}, e.measure),
          h('td', {}, String(e.reps.n ?? 0)),
          h('td', {}, e.reps.bias != null ? `${e.reps.bias}°` : '—'),
          h('td', {}, e.reps.loa ? `${e.reps.loa[0]}° to ${e.reps.loa[1]}°` : '—'),
          h('td', {}, e.reps.icc == null ? '—' : e.reps.spread < ICC_MIN_SPREAD ? h('span', { title: `Reps were all about the same depth (sensor SD under ${ICC_MIN_SPREAD}°), too little variation for an ICC.` }, 'n/a') : e.reps.icc),
          h('td', {}, e.frames.mae != null ? `${e.frames.mae}°` : '—'),
          h('td', {}, e.frames.ccc ?? '—')))))) : h('p', { class: 'muted' }, 'No exercise had enough paired camera and sensor data.'),
      h('p', { class: 'small faint' }, 'Bias = camera minus sensor. Limits of agreement: 95% of differences fall between them. Rep peaks are the main comparison because neighbouring frames are not independent. ICC needs reps of different depths; it shows n/a when they were all alike. Plots: small dots are frames, large dots are rep peaks.'));
    if (phone) {
      card.append(h('div', { class: 'row' }, h('button', { class: 'btn btn-sm btn-ghost', type: 'button', onclick: async () => {
        if (!confirm('Remove the phone data from this clip? You can add it again from the file.')) return;
        await saveClip(removePhone(clip));
        analysisBox.replaceChildren();
        refresh();
      } }, 'Remove phone data')));
    }
    for (const [exId, e] of rows) {
      const plot = h('div', { class: 'ba-plot' });
      plot.innerHTML = blandAltmanSVG({ pairs: e.pairs, repPairs: e.repPairs, stats: e.reps.n >= 3 ? e.reps : e.frames, title: `${byId[exId]?.name ?? exId}: camera − sensor`, theme: 'css' });
      card.append(plot);
    }
    analysisBox.replaceChildren(card);
  }

  function stat(label, value, sub) {
    return h('div', { class: 'stat' }, h('div', { class: 'stat-label' }, label), h('div', { class: 'stat-value', style: { fontSize: '22px' } }, value), h('div', { class: 'stat-delta' }, sub));
  }

  refresh();
}
