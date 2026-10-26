import { h, icon, modal, toast } from '../ui.js';
import { hub } from '../sensors/hub.js';
import { BleSensor } from '../sensors/ble.js';
import { SimSensor, simCalibration } from '../sensors/sim.js';
import { ROLE_LABEL } from '../sensors/protocol.js';

const fmtDeg = (v) => {
  if (v == null || Number.isNaN(v)) return '—';
  const r = Math.round(v);
  return `${r < 0 ? '−' : ''}${Math.abs(r)}°`;
};

/** Scripted bending for the simulated sensors on this page: forward bends, then side bends. */
function scripted(role, now) {
  const c = now % 12;
  const k = c < 6 ? Math.sin((c / 6) * Math.PI) : 0;
  const ks = c >= 6 ? Math.sin(((c - 6) / 6) * Math.PI) : 0;
  return role === 'upper' ? { flex: 55 * k, side: 20 * ks } : { flex: 36 * k, side: 5 * ks };
}

export async function addSimulatedSensors() {
  for (const role of ['upper', 'lower']) {
    if (hub.devices.has(`sim-${role}`)) continue;
    const s = new SimSensor({ role, source: scripted, twist: role === 'upper' ? 14 : -18 });
    const d = await hub.add(s);
    d.cal = simCalibration(s.twist);
  }
  hub.changed();
}

export async function connectBle() {
  try {
    const sensor = await BleSensor.request();
    await hub.add(sensor);
    toast(`Connected ${sensor.name}`);
  } catch (e) {
    if (e?.name !== 'NotFoundError') toast(`Couldn’t connect: ${e.message}`, { tone: 'warn' });
  }
}

/** The 3-step calibration wizard. Resolves true when calibrated. */
export function openCalibrationModal() {
  return new Promise((resolve) => {
    let cal;
    try {
      cal = hub.calibrate();
    } catch (e) {
      toast(e.message, { tone: 'warn' });
      resolve(false);
      return;
    }
    const steps = [['neutral', 'Stand still'], ['flex', 'Bend forward'], ['side', 'Bend right']];
    const dots = h('ol', { class: 'cal-steps' }, steps.map(([k, label]) => h('li', { 'data-step': k }, label)));
    const msg = h('p', { class: 'cal-msg' });
    const bar = h('div', { class: 'disc-fill', style: { background: 'var(--accent)' } });
    const err = h('p', { class: 'small', style: { color: 'var(--critical-text)' } });
    const skip = h('button', { class: 'btn', type: 'button', onclick: () => cal.skipSide() }, 'Skip side bend');
    const dlg = modal(h('div', { class: 'stack' },
      h('h2', {}, 'Calibrate your back sensors'),
      h('p', { class: 'muted small' }, 'About 15 seconds. This teaches SpineSense how each sensor sits on your back, so it doesn’t matter exactly how it’s strapped on. Redo it whenever you re-strap the sensors.'),
      dots, msg, h('div', { class: 'disc-meter' }, bar), err,
      h('div', { class: 'actions' }, skip, h('button', { class: 'btn', type: 'button', onclick: () => { cal.cancel(); close(false); } }, 'Cancel'))),
    { label: 'Sensor calibration', dismissable: false });
    const render = () => {
      msg.textContent = cal.message;
      bar.style.width = `${Math.round(cal.progress * 100)}%`;
      err.textContent = cal.error ?? '';
      skip.hidden = cal.step !== 'side';
      const order = steps.map(([k]) => k);
      dots.querySelectorAll('li').forEach((li) => {
        const i = order.indexOf(li.dataset.step), cur = order.indexOf(cal.step);
        li.className = cal.step === 'done' || i < cur ? 'done' : i === cur ? 'current' : '';
      });
    };
    const close = (ok) => {
      cal.removeEventListener('change', render);
      dlg.close();
      resolve(ok);
    };
    cal.addEventListener('change', render);
    cal.addEventListener('done', () => {
      toast('Sensors calibrated');
      close(true);
    });
    render();
  });
}

function placementFigure() {
  const el = h('div', { class: 'placement' });
  el.innerHTML = `<svg viewBox="0 0 200 260" role="img" aria-label="Sensor placement on the back">
    <circle cx="100" cy="30" r="20" class="pl-body"/>
    <path d="M60 60 Q100 52 140 60 L150 150 Q140 175 132 190 L68 190 Q60 175 50 150 Z" class="pl-body"/>
    <path d="M68 190 L64 250 M132 190 L136 250" class="pl-line"/>
    <path d="M100 56 L100 188" class="pl-spine"/>
    <rect x="88" y="118" width="24" height="16" rx="4" class="pl-sensor"/>
    <rect x="88" y="166" width="24" height="16" rx="4" class="pl-sensor lower"/>
    <text x="118" y="130" class="pl-text">Upper: T12/L1</text>
    <text x="118" y="178" class="pl-text">Lower: sacrum</text>
  </svg>`;
  return el;
}

export function render(root) {
  const supported = BleSensor.supported;
  root.append(h('div', { class: 'page-head' },
    h('div', {}, h('h1', {}, 'Back sensors'),
      h('p', {}, 'Strap one or two small motion sensors to your back for accurate lower-back angles, the one thing a webcam can’t measure well.')),
    h('div', { class: 'row' },
      h('button', { class: 'btn', type: 'button', onclick: () => addSimulatedSensors() }, 'Try simulated sensors'),
      h('button', { class: 'btn btn-primary', type: 'button', disabled: !supported, onclick: () => connectBle() }, icon('sensor', 16), 'Connect a sensor'))));
  if (!supported) {
    root.append(h('div', { class: 'callout warn', style: { marginBottom: '16px' } }, icon('info'),
      h('p', { class: 'small' }, 'This browser doesn’t support Web Bluetooth. Use Chrome or Edge on a computer or an Android phone. You can still try the simulated sensors.')));
  }

  const devicesBox = h('div', { class: 'stack' });
  const calBox = h('div', {});
  const live = {};
  const liveCard = h('section', { class: 'card stack' },
    h('div', { class: 'section-title' }, h('h2', {}, 'Live angles'), (live.mode = h('span', { class: 'chip' }, 'No sensor'))),
    h('div', { class: 'gauges' }, ['trunk', 'pelvis', 'lumbar'].map((k) => h('div', { class: 'gauge' },
      h('div', { class: 'gauge-label' }, { trunk: 'Trunk (upper sensor)', pelvis: 'Pelvis (lower sensor)', lumbar: 'Lower back (difference)' }[k]),
      (live[k] = h('div', { class: 'gauge-value' }, '—')),
      (live[`${k}Side`] = h('div', { class: 'gauge-sub' }, 'Side bend —'))))),
    (live.canvas = h('canvas', { class: 'trace', height: 140 })),
    h('div', { class: 'legend' }, h('span', { class: 'legend-item' }, h('span', { class: 'key-line', style: { background: 'var(--series-1)' } }), 'Trunk forward bend'), h('span', { class: 'legend-item' }, h('span', { class: 'key-line', style: { background: 'var(--series-2)' } }), 'Lower back forward bend')));

  const recBtn = h('button', { class: 'btn btn-sm', type: 'button' }, 'Record 30 s of raw data');
  recBtn.addEventListener('click', () => {
    if (!hub.list.length) return toast('Connect a sensor first', { tone: 'warn' });
    hub.startRecording();
    recBtn.disabled = true;
    recBtn.textContent = 'Recording…';
    setTimeout(() => {
      const rec = hub.stopRecording();
      recBtn.disabled = false;
      recBtn.textContent = 'Record 30 s of raw data';
      download(`spinesense-sensors-${new Date().toISOString().slice(0, 19).replace(/:/g, '')}.json`, rec);
    }, 30000);
  });

  root.append(h('div', { class: 'grid grid-main' },
    h('div', { class: 'stack' }, devicesBox, liveCard),
    h('div', { class: 'stack' },
      calBox,
      h('section', { class: 'card stack' }, h('h2', {}, 'Where to put them'), placementFigure(),
        h('ul', { class: 'small muted', style: { margin: 0, paddingLeft: '18px' } },
          h('li', {}, 'Upper sensor: on the spine at the level of your lowest ribs (T12/L1).'),
          h('li', {}, 'Lower sensor: flat on the bony triangle at the base of your spine (sacrum), between the two dimples.'),
          h('li', {}, 'Use kinesiology tape or a snug elastic strap. Which way round doesn’t matter: calibration handles it.'),
          h('li', {}, 'One sensor (upper) gives trunk angle. Two give the true lower-back angle.')),
        h('a', { href: 'docs/hardware.md', target: '_blank', class: 'small' }, 'Hardware guide: parts, wiring and firmware')),
      h('section', { class: 'card stack' }, h('h2', {}, 'Raw data'), h('p', { class: 'small muted' }, 'Saves the raw sensor stream as a JSON file for checking firmware or building datasets. Nothing is uploaded.'), recBtn))));

  const metaEls = new Map();
  const meta = (d) => [d.simulated ? 'Simulated' : d.info?.board, d.status, d.battery != null ? `battery ${d.battery}%` : null, d.status === 'connected' ? `${hub.rate(d)} Hz` : null].filter(Boolean).join(' · ');
  const renderDevices = () => {
    const list = hub.list;
    metaEls.clear();
    devicesBox.replaceChildren(list.length
      ? h('section', { class: 'card stack' }, h('h2', {}, 'Connected sensors'), ...list.map((d) => h('div', { class: 'device' },
        h('span', { class: `status-dot ${d.status}` }),
        h('div', { class: 'spacer' }, h('strong', {}, d.name), (() => {
          const el = h('div', { class: 'small faint' }, meta(d));
          metaEls.set(d.id, el);
          return el;
        })()),
        h('select', { 'aria-label': 'Body position', onchange: (e) => hub.setRole(d.id, e.target.value) },
          ['unknown', 'upper', 'lower'].map((r) => h('option', { value: r, selected: d.role === r }, ROLE_LABEL[r]))),
        d.simulated ? null : h('button', { class: 'btn btn-sm', type: 'button', onclick: () => d.driver.identify() }, 'Identify'),
        h('button', { class: 'btn btn-sm btn-ghost', type: 'button', onclick: () => hub.remove(d.id) }, 'Remove'))))
      : h('section', { class: 'card' }, h('div', { class: 'empty' }, h('h3', {}, 'No sensors yet'), h('p', {}, 'Connect a SpineSense Motion sensor over Bluetooth, or try the simulated ones to see how it works.'))));
    const up = hub.byRole('upper');
    calBox.replaceChildren(h('section', { class: 'card stack' },
      h('h2', {}, 'Calibration'),
      !up ? h('p', { class: 'small muted' }, 'Assign a sensor to the upper back first.')
        : hub.calibrated ? h('p', { class: 'small', style: { color: 'var(--good-text)' } }, icon('check', 14), ' Calibrated. Redo it whenever you re-strap the sensors.')
          : h('p', { class: 'small muted' }, 'Strap the sensors on, then calibrate. It takes about 15 seconds.'),
      h('button', { class: `btn ${hub.calibrated ? '' : 'btn-primary'}`, type: 'button', disabled: !up, onclick: () => openCalibrationModal() }, hub.calibrated ? 'Recalibrate' : 'Calibrate now')));
  };

  // Live readout + rolling trace
  const trace = [];
  const draw = () => {
    const s = hub.snapshot();
    live.mode.textContent = s.ok ? (s.mode === 'dual' ? 'Two sensors' : 'One sensor') : { none: 'No sensor', uncalibrated: 'Needs calibration', lost: 'Signal lost' }[s.mode];
    live.trunk.textContent = fmtDeg(s.trunk?.flex);
    live.pelvis.textContent = fmtDeg(s.pelvis?.flex);
    live.lumbar.textContent = fmtDeg(s.lumbar?.flex);
    live.trunkSide.textContent = `Side bend ${fmtDeg(s.trunk?.side)}`;
    live.pelvisSide.textContent = `Side bend ${fmtDeg(s.pelvis?.side)}`;
    live.lumbarSide.textContent = `Side bend ${fmtDeg(s.lumbar?.side)}`;
    const now = performance.now() / 1000;
    if (s.ok) trace.push([now, s.trunk.flex, s.lumbar?.flex ?? null]);
    while (trace.length && now - trace[0][0] > 10) trace.shift();
    const c = live.canvas;
    const W = (c.width = Math.round(c.clientWidth * (devicePixelRatio || 1)));
    const H = (c.height = Math.round(140 * (devicePixelRatio || 1)));
    const g = c.getContext('2d');
    const css = getComputedStyle(document.documentElement);
    const y = (v) => H - ((v + 30) / 120) * H; // -30..90 degrees
    g.clearRect(0, 0, W, H);
    g.strokeStyle = css.getPropertyValue('--grid');
    g.lineWidth = 1;
    for (const v of [0, 30, 60, 90]) {
      g.beginPath();
      g.moveTo(0, y(v));
      g.lineTo(W, y(v));
      g.stroke();
    }
    [[1, '--series-1'], [2, '--series-2']].forEach(([k, color]) => {
      g.strokeStyle = css.getPropertyValue(color);
      g.lineWidth = 2 * (devicePixelRatio || 1);
      g.beginPath();
      let pen = false;
      for (const p of trace) {
        if (p[k] == null) continue;
        const x = W - ((now - p[0]) / 10) * W;
        pen ? g.lineTo(x, y(p[k])) : g.moveTo(x, y(p[k]));
        pen = true;
      }
      g.stroke();
    });
  };

  renderDevices();
  const onChange = () => renderDevices();
  hub.addEventListener('change', onChange);
  let lastRates = 0;
  const timer = setInterval(() => {
    draw();
    if (performance.now() - lastRates > 1000) {
      lastRates = performance.now();
      for (const d of hub.list) {
        const el = metaEls.get(d.id);
        if (el) el.textContent = meta(d);
      }
    }
  }, 100);
  return () => {
    clearInterval(timer);
    hub.removeEventListener('change', onChange);
  };
}

export function download(filename, data) {
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
