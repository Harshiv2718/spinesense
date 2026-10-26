// Safety screening, the daily plan, progression rules and dashboard statistics.

import { EXERCISES, byId } from './core/exercises.js';

// Possible cauda equina syndrome or severe nerve compression. These can NEVER be overridden:
// the app shows only the emergency message until the user redoes the safety check without them.
export const EMERGENCY_FLAGS = [
  { id: 'saddle', text: 'New numbness or tingling around the groin, genitals, inner thighs or back passage' },
  { id: 'bladder', text: 'New difficulty starting to pee, a weak stream, or new loss of bladder control' },
  { id: 'bowel', text: 'New loss of bowel control, or not being able to feel when your bowel is full' },
  { id: 'sexual', text: 'New loss of sexual function or sensation in the genitals' },
  { id: 'weakness', text: 'A leg getting weaker (for example your foot catching or dragging), or weakness or numbness in both legs' },
];

// Need a doctor's assessment first. A clinician's clearance is recorded per flag, dated, and expires.
export const DOCTOR_FLAGS = [
  { id: 'bothLegs', text: 'Sciatica-type pain in both legs, or leg pain that switches sides', urgent: true },
  { id: 'trauma', text: 'Pain that started after a significant fall, accident or injury' },
  { id: 'fever', text: 'Fever or feeling generally unwell along with the back pain' },
  { id: 'weightloss', text: 'Unexplained weight loss' },
  { id: 'cancer', text: 'A history of cancer' },
  { id: 'night', text: 'Constant severe pain that is worse at night whatever position you are in' },
];

export const RED_FLAGS = [...EMERGENCY_FLAGS, ...DOCTOR_FLAGS];

// Without a clinician's OK these restrict the plan to Gentle levels with no level-ups.
export const CAUTIONS = [
  { id: 'surgery', text: 'Spinal surgery in the last 6 months' },
  { id: 'osteo', text: 'Osteoporosis or long-term steroid use' },
  { id: 'pregnant', text: 'Currently pregnant' },
];

export const AGGRAVATORS = [
  { id: 'bending', label: 'Bending forward' },
  { id: 'sitting', label: 'Sitting' },
  { id: 'standing', label: 'Standing still' },
  { id: 'walking', label: 'Walking' },
  { id: 'lifting', label: 'Lifting' },
  { id: 'morning', label: 'Stiff in the morning' },
];

export const LOCATIONS = [
  { id: 'back', label: 'Lower back only' },
  { id: 'buttock', label: 'Spreads into buttock or thigh' },
  { id: 'leg', label: 'Goes below the knee' },
];

export const DURATIONS = [
  { id: 'acute', label: 'Less than 6 weeks' },
  { id: 'subacute', label: '6–12 weeks' },
  { id: 'chronic', label: 'More than 3 months' },
];

export const SCREENING_VERSION = 2;
const DAY = 86400000;
export const CLEARANCE_DAYS = 30;
export const RESCREEN_DAYS = 28;
const REST_DAYS = 2;
const LEVEL_UP_GAP_DAYS = 7;

// Version-1 screenings combined several questions per item; read them in the strictest way.
const LEGACY_EMERGENCY = ['saddle', 'bladder', 'bilateral'];
const LEGACY_DOCTOR = { systemic: 'fever' };

export function clearanceValid(screening, id, now = Date.now()) {
  const at = screening?.clearances?.[id];
  return !!at && now - Date.parse(at) < CLEARANCE_DAYS * DAY;
}

export function screeningStatus(screening, now = Date.now()) {
  if (!screening) return { done: false };
  const rf = screening.redFlags ?? {};
  const emergencies = EMERGENCY_FLAGS.filter((f) => rf[f.id]);
  for (const id of LEGACY_EMERGENCY) {
    if (rf[id] && !emergencies.some((f) => f.id === id)) emergencies.push({ id, text: 'Possible nerve compression symptom (from an older safety check)' });
  }
  if (screening.sessionEmergency) emergencies.push({ id: 'sessionCheck', text: 'New nerve symptoms reported at the start of a session' });
  const flags = DOCTOR_FLAGS.filter((f) => rf[f.id]);
  for (const [old, id] of Object.entries(LEGACY_DOCTOR)) {
    if (rf[old] && !flags.some((f) => f.id === id)) flags.push(DOCTOR_FLAGS.find((f) => f.id === id));
  }
  const unclearedFlags = flags.filter((f) => !clearanceValid(screening, f.id, now));
  const cautions = CAUTIONS.filter((c) => screening.cautions?.[c.id]);
  const unclearedCautions = cautions.filter((c) => !clearanceValid(screening, c.id, now));
  const outdated = (screening.version ?? 1) < SCREENING_VERSION;
  const stale = (now - Date.parse(screening.date)) / DAY > RESCREEN_DAYS;
  return {
    done: true,
    emergency: emergencies.length > 0,
    emergencies,
    flags,
    unclearedFlags,
    blocked: emergencies.length > 0 || unclearedFlags.length > 0,
    cautions,
    restricted: unclearedCautions.length > 0,
    unclearedCautions,
    outdated,
    stale,
    needsRescreen: outdated || stale,
    irritability: screening.painNow >= 7 ? 'high' : screening.painNow >= 4 ? 'moderate' : 'low',
  };
}

/** Starting levels after the screening: conservative, everything Gentle unless pain is low. */
export function initialProgress(screening) {
  const low = screening.painNow <= 3 && screening.duration !== 'acute';
  const progress = {};
  for (const ex of EXERCISES) {
    const level = low && (ex.id === 'arm-raise' || ex.id === 'sit-to-stand' || ex.id === 'glute-bridge') ? 1 : 0;
    progress[ex.id] = { level, good: 0, restUntil: null };
  }
  return progress;
}

function recentDiscomfort(sessions, id, n = 2) {
  const recent = sessions.filter((s) => !s.sample && s.exercises.some((e) => e.id === id)).slice(-n);
  return recent.some((s) => s.exercises.find((e) => e.id === id)?.events?.some((ev) => ev.level !== 'mild'));
}

/** The latest real session still waiting for its next-day answer (asked between 12 hours and 7 days later). */
export function pendingNextDay(state, now = Date.now()) {
  const last = state.sessions.filter((s) => !s.sample).sort((a, b) => Date.parse(b.date) - Date.parse(a.date))[0];
  if (!last || last.nextDay) return null;
  const age = now - Date.parse(last.date);
  return age >= 0.5 * DAY && age <= 7 * DAY ? last : null;
}

function worseRecently(state, now) {
  return state.sessions.some((s) => s.nextDay === 'worse' && s.nextDayAt && now - Date.parse(s.nextDayAt) < 3 * DAY);
}

/**
 * Today's plan, with the reason behind every adjustment.
 * painToday is today's pre-session rating; it falls back to the screening score.
 */
export function todaysPlan(state, { painToday, now = Date.now() } = {}) {
  const sc = state.profile?.screening;
  if (!sc) return null;
  const status = screeningStatus(sc, now);
  const pain = painToday ?? sc.painNow;
  if (pain >= 8) {
    return {
      restDay: true,
      items: [],
      skipped: [],
      minutes: 0,
      notes: ['Pain of 8/10 or more: today is a rest day, not an exercise day. Find a comfortable position and move gently around the house if you can. If the pain is severe and not easing, spreads down a leg, or comes with numbness or bladder or bowel changes, get medical help.'],
    };
  }
  const agg = new Set(sc.aggravators ?? []);
  const flexSensitive = agg.has('bending') || agg.has('sitting');
  const extSensitive = agg.has('standing') || agg.has('walking');
  const flare = worseRecently(state, now);
  const high = pain >= 7 || flare;
  const notes = [];
  if (pain >= 7) notes.push('Your pain is high today, so everything is Gentle with fewer reps. Gentle movement still helps.');
  if (flare) notes.push('Your back was worse after a recent session, so today is lighter. If it isn’t settling within a few days, or leg symptoms spread, see a clinician.');
  if (status.restricted) notes.push(`Gentle levels only until a clinician OKs exercise for you (${status.unclearedCautions.map((c) => c.text.toLowerCase()).join('; ')}).`);
  if (sc.location === 'leg') notes.push('Pain below the knee can mean an irritated nerve. Keep movements small and stop if leg symptoms spread further down. A physio check is a good idea.');
  if (flexSensitive) notes.push('Bending or sitting aggravates your back, so forward-bending moves stay small.');

  const items = [];
  const skipped = [];
  for (const spec of EXERCISES) {
    const prog = state.progress[spec.id] ?? { level: 0 };
    if (prog.restUntil && now < prog.restUntil) {
      skipped.push({ id: spec.id, reason: `Resting until ${new Date(prog.restUntil).toLocaleDateString(undefined, { weekday: 'long' })} after it bothered you` });
      continue;
    }
    if (spec.id === 'knee-to-chest' && flexSensitive) {
      skipped.push({ id: spec.id, reason: 'Skipped because bending or sitting makes your pain worse' });
      continue;
    }
    if (spec.id === 'bird-dog' && high) {
      skipped.push({ id: spec.id, reason: 'Added back once your pain settles below 7/10' });
      continue;
    }
    let level = prog.level ?? 0;
    const reasons = [];
    if ((high || status.restricted) && level > 0) {
      level = 0;
      reasons.push(status.restricted ? 'Gentle until a clinician OKs more' : 'Gentle while pain is high');
    }
    if (spec.id === 'hip-hinge' && flexSensitive && level > 0 && pain >= 5) {
      level = 0;
      reasons.push('Kept small: bending aggravates your back');
    }
    if (recentDiscomfort(state.sessions, spec.id)) reasons.push('Felt harder recently. Go gently');
    if (spec.id === 'knee-to-chest' && extSensitive) reasons.push('Often eases backs that ache with standing or walking');
    items.push({ id: spec.id, level, repScale: high ? 0.6 : 1, reasons, maxLevel: status.restricted || high ? 0 : spec.levels.length - 1 });
  }
  const minutes = Math.max(5, Math.round(items.reduce((a, it) => a + estimateSec(byId[it.id], it.level, it.repScale), 0) / 60));
  return { items, skipped, notes, minutes, restricted: status.restricted };
}

function estimateSec(spec, level, repScale = 1) {
  const L = spec.levels[level];
  const reps = Math.max(1, Math.round(L.reps * repScale)) * (spec.alternating ? 2 : 1);
  const per = spec.kind === 'hold' ? (L.hold ?? 3) + 3.5 : 4;
  return 35 + reps * per;
}

/**
 * Progression at save time. Regressions and rests apply immediately and are never rate-limited.
 * Level-ups are only marked pending: they need the next-day "back to usual" answer (applyNextDay).
 */
export function applyProgression(state, session, now = Date.now()) {
  const changes = [];
  const restricted = screeningStatus(state.profile?.screening, now).restricted;
  for (const ex of session.exercises) {
    if (ex.skipped && !ex.reps) continue;
    const spec = byId[ex.id];
    const prog = (state.progress[ex.id] ??= { level: 0, good: 0, restUntil: null });
    const from = prog.level;
    const hurt = ex.stoppedEarly || ex.legSymptoms || (ex.painRating ?? 0) >= 6;
    if (hurt) {
      prog.good = 0;
      prog.pendingUp = null;
      prog.restUntil = now + REST_DAYS * DAY;
      if (prog.level > 0) prog.level--;
      const reason = ex.legSymptoms ? 'Resting for 2 days after leg symptoms' : prog.level < from ? 'Eased back and resting for 2 days after it bothered you' : 'Resting for 2 days after it bothered you';
      changes.push({ id: ex.id, from, to: prog.level, reason });
      continue;
    }
    // Form only counts when tracking was reliable: single-webcam angles carry several degrees of error.
    const formOk = (ex.trackingQuality ?? 0) < 0.8 || (ex.formScore ?? 100) >= 60;
    const good = ex.reps >= ex.targetReps && (ex.painRating ?? 0) <= 3 && ex.feel !== 'hard' && formOk;
    if (!good) {
      prog.good = 0;
      continue;
    }
    prog.good = (prog.good ?? 0) + 1;
    const recentlyUp = prog.lastLevelUpAt && now - prog.lastLevelUpAt < LEVEL_UP_GAP_DAYS * DAY;
    if (prog.good >= 2 && !restricted && !recentlyUp && prog.level < spec.levels.length - 1) {
      prog.pendingUp = { sessionId: session.id };
      changes.push({ id: ex.id, from, to: from, pending: true, reason: 'Ready to level up if your back is back to usual tomorrow' });
    }
  }
  return changes;
}

/** The next-day answer: 'better' | 'usual' | 'worse'. Mutates state; returns level changes. */
export function applyNextDay(state, session, answer, now = Date.now()) {
  session.nextDay = answer;
  session.nextDayAt = new Date(now).toISOString();
  const changes = [];
  for (const ex of session.exercises) {
    const prog = state.progress[ex.id];
    if (!prog) continue;
    const from = prog.level;
    if (answer === 'worse') {
      prog.good = 0;
      prog.pendingUp = null;
      if (((ex.painRating ?? 0) >= 4 || ex.events?.length) && prog.level > 0) {
        prog.level--;
        changes.push({ id: ex.id, from, to: prog.level, reason: 'Eased back: your back was worse the next day' });
      }
    } else if (prog.pendingUp?.sessionId === session.id && prog.level < byId[ex.id].levels.length - 1) {
      prog.level++;
      prog.good = 0;
      prog.pendingUp = null;
      prog.lastLevelUpAt = now;
      changes.push({ id: ex.id, from, to: prog.level, reason: 'Levelled up: comfortable, and your back was fine the next day' });
    }
  }
  session.levelChanges = [...(session.levelChanges ?? []), ...changes];
  return changes;
}

// ---------- stats ----------

export function computeStats(sessions, now = Date.now()) {
  const inRange = (s, from, to) => {
    const t = new Date(s.date).getTime();
    return t > from && t <= to;
  };
  const week = (k) => sessions.filter((s) => inRange(s, now - 7 * (k + 1) * DAY, now - 7 * k * DAY)).length;
  // Consistency, not streaks: a week is "on track" with 2+ sessions, and rest or flare days never break it.
  let weeksOnTrack = week(0) >= 2 ? 1 : 0;
  for (let k = 1; week(k) >= 2; k++) weeksOnTrack++;
  const last7 = sessions.filter((s) => inRange(s, now - 7 * DAY, now));
  const prev7 = sessions.filter((s) => inRange(s, now - 14 * DAY, now - 7 * DAY));
  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
  const pain = (arr) => avg(arr.map((s) => s.painBefore).filter((x) => x != null));
  const reps = sessions.reduce((a, s) => a + s.exercises.reduce((b, e) => b + (e.reps ?? 0), 0), 0);
  const forms = sessions.flatMap((s) => s.exercises.map((e) => e.formScore).filter((x) => x != null));
  return {
    weeksOnTrack,
    weeklyGoal: 3,
    sessions7: last7.length,
    sessionsPrev7: prev7.length,
    pain7: pain(last7),
    painPrev7: pain(prev7),
    totalReps: reps,
    totalMinutes: Math.round(sessions.reduce((a, s) => a + (s.durationSec ?? 0), 0) / 60),
    avgForm: avg(forms),
  };
}

/** Which exercises triggered discomfort, and through which signals. */
export function painTriggers(sessions, days = 30, now = Date.now()) {
  const out = {};
  for (const s of sessions) {
    if (new Date(s.date).getTime() < now - days * DAY) continue;
    for (const e of s.exercises) {
      for (const ev of e.events ?? []) {
        const row = (out[e.id] ??= { id: e.id, events: 0, serious: 0, signals: {} });
        row.events++;
        if (ev.level !== 'mild') row.serious++;
        for (const sig of ev.signals ?? []) row.signals[sig] = (row.signals[sig] ?? 0) + 1;
      }
    }
  }
  return Object.values(out).sort((a, b) => b.serious - a.serious || b.events - a.events);
}

// ---------- sample data (clearly flagged) ----------

export function sampleSessions(now = Date.now()) {
  const sessions = [];
  const offsets = [20, 19, 17, 16, 14, 13, 12, 10, 9, 7, 6, 4, 3, 2, 1, 0];
  offsets.forEach((daysAgo, i) => {
    const k = i / (offsets.length - 1);
    const date = new Date(now - daysAgo * DAY);
    date.setHours(8 + (i % 3) * 5, 15, 0, 0);
    const painBefore = Math.round(Math.max(1, 6.5 - 4 * k + (i % 3 === 0 ? 0.8 : 0)));
    const ex = (id, level, reps, targetReps, peak, form, extra = {}) => ({
      id, level, levelName: byId[id].levels[level].name, reps, targetReps, peakBest: peak, peakAvg: Math.round(peak * 0.93),
      unit: byId[id].unit, formScore: form, painRating: Math.max(0, painBefore - 2), feel: 'right', events: [], formCounts: {}, ...extra,
    });
    const lvl = k > 0.55 ? 1 : 0;
    const exercises = [
      ex('arm-raise', 1, 8, 8, Math.round(128 + 20 * k), 92),
      ex('side-bend', lvl, 10 + lvl * 6, 10 + lvl * 6, Math.round(13 + 9 * k), Math.round(78 + 15 * k), { asymmetry: { left: Math.round(14 + 9 * k), right: Math.round(11 + 10 * k), pct: Math.round(22 - 18 * k) } }),
      ex('hip-hinge', lvl, 6 + lvl * 2, 6 + lvl * 2, Math.round(24 + 22 * k), Math.round(70 + 22 * k)),
      ex('glute-bridge', lvl, 6 + lvl * 2, 6 + lvl * 2, Math.round(17 + 10 * k), Math.round(80 + 12 * k)),
      ex('bird-dog', 0, 6, 6, Math.round(72 + 14 * k), Math.round(74 + 18 * k)),
    ];
    if (i === 2 || i === 5) {
      exercises[2].events = [{ t: 41, level: 'moderate', signals: ['range', 'guard'], rating: 5, action: 'regressed' }];
      exercises[2].painRating = 5;
    }
    if (i === 3) exercises[1].events = [{ t: 22, level: 'mild', signals: ['face'], action: 'eased' }];
    if (i === 7) exercises[4].events = [{ t: 30, level: 'moderate', signals: ['shake', 'guard'], rating: 4, action: 'regressed' }];
    sessions.push({
      id: `sample-${i}`,
      sample: true,
      date: date.toISOString(),
      durationSec: 840 + (i % 4) * 60,
      painBefore,
      painAfter: Math.max(0, painBefore - 1 - (i % 2)),
      exercises,
    });
  });
  return sessions;
}
