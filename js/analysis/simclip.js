// A fully simulated recording session: the same recorder, engine and sensor hub as a real session,
// driven by the simulated person and simulated sensors with realistic radio timing. Lets the whole
// measurement pipeline (time alignment -> agreement -> report) run and be tested without hardware.

import { byId } from '../core/exercises.js';
import { ExerciseRun } from '../core/engine.js';
import { SimPerson, SIM_ASPECT } from '../core/sim.js';
import { makeFrame } from '../core/geometry.js';
import { LandmarkSmoother } from '../core/filters.js';
import { SensorHub } from '../sensors/hub.js';
import { SimSensor, simCalibration, simSegmentAngles } from '../sensors/sim.js';
import { ClipRecorder } from '../data/clip.js';

export const DEFAULT_RADIO = { offset: 3.7, drift: 35, latency: 0.025, jitter: 0.008, burst: 0.02 };

/**
 * cameraDelay: how late the camera's timestamps are (e.g. processing time used instead of capture time).
 * Returns the finished clip.v1 object.
 */
export async function simulateClip({ exercises = ['hip-hinge', 'side-bend', 'glute-bridge'], level = 1, radio = DEFAULT_RADIO, cameraDelay = 0.06, faults = {}, maxPerExercise = 120 } = {}) {
  let t = 10;
  let pose = null;
  let view = 'side';
  const hub = new SensorHub({ clock: () => t });
  const source = (role) => (pose ? simSegmentAngles(pose, view, faults)[role] : { flex: 0, side: 0 });
  const sensors = [
    new SimSensor({ role: 'upper', source, interval: false, twist: 12, radio, seed: 11 }),
    new SimSensor({ role: 'lower', source, interval: false, twist: -18, radio: { ...radio, offset: radio.offset + 1.9, drift: -(radio.drift ?? 0) }, seed: 29 }),
  ];
  for (const s of sensors) {
    const d = await hub.add(s);
    d.cal = simCalibration(s.twist);
  }
  hub.startRecording();
  const rec = new ClipRecorder({
    simulated: true,
    consent: { version: 1, at: new Date().toISOString(), note: 'simulated data, no person involved' },
    capture: { source: 'simulated', tasksVersion: 'simulated', poseModel: 'SimPerson', poseDelegate: 'none', aspect: SIM_ASPECT, videoSize: [1280, 720], cameraDelay },
    plan: exercises.map((id) => `${id}@${level}`),
  });
  rec.clip.clock = { perfS: t, epochMs: Date.now() }; // simulated time starts at t
  const results = [];
  const STEP = 1 / 150; // base tick: sensors every 3 ticks (50 Hz), camera every 5 ticks (30 Hz)
  for (const id of exercises) {
    const spec = byId[id];
    view = spec.view;
    const person = new SimPerson(id, { kind: spec.kind, hold: spec.levels[level].hold ?? 3, view });
    const run = new ExerciseRun(spec, level);
    const smooth = new LandmarkSmoother();
    const smoothW = new LandmarkSmoother();
    const start = t;
    for (let k = 0; t - start < maxPerExercise && run.phase !== 'complete'; k++) {
      t += STEP;
      const fr = person.frame(t - start);
      pose = fr;
      if (k % 3 === 0) sensors.forEach((s) => s.tick(t));
      if (k % 5 !== 0) continue;
      const f = makeFrame(smooth.apply(fr.lm, t), smoothW.apply(fr.world, t), fr.aspect, t);
      f.sensors = hub.snapshot(t);
      const st = run.update(f);
      for (const ev of st.events) if (ev.type !== 'hold-tick' && ev.type !== 'rep-start') rec.addEvent(t, id, ev);
      rec.addFrame({ t: t + cameraDelay, tCapture: t + cameraDelay, raw: { lm: fr.lm, world: fr.world } }, { ex: id, level, phase: st.phase, rep: st.reps, state: st.repState });
    }
    results.push(run.summary());
    t += 3; // rest between exercises
  }
  return rec.finish({ sensors: hub.list, sensorRaw: hub.stopRecording(), results });
}
