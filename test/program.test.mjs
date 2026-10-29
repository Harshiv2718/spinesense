import test from 'node:test';
import assert from 'node:assert/strict';
import {
  todaysPlan, applyProgression, applyNextDay, pendingNextDay, computeStats, initialProgress, screeningStatus,
  painTriggers, sampleSessions, screeningAnswered, buildScreening, SCREENING_VERSION, TEST_ROUND,
} from '../js/program.js';

const DAY = 86400000;
const NOW = Date.parse('2026-10-17T12:00:00Z');
const iso = (msAgo = 0) => new Date(NOW - msAgo).toISOString();
const screening = (over = {}) => ({ version: SCREENING_VERSION, date: iso(), redFlags: {}, cautions: {}, clearances: {}, location: 'back', duration: 'subacute', painNow: 4, aggravators: [], ...over });
const stateWith = (sc) => ({ profile: { screening: sc }, progress: initialProgress(sc), sessions: [] });
const goodEx = (id, over = {}) => ({ id, reps: 6, targetReps: 6, formScore: 90, trackingQuality: 0.95, painRating: 1, feel: 'right', ...over });
// Safety check form answers, as the safety view collects them.
const answers = (over = {}) => ({ redFlags: {}, cautions: {}, cleared: {}, noPain: false, location: null, duration: null, painNow: null, aggravators: [], ...over });

// ---------- red flags ----------

test('cauda equina flags can never be overridden, even with a clearance recorded', () => {
  for (const id of ['saddle', 'bladder', 'bowel', 'sexual', 'weakness']) {
    const st = screeningStatus(screening({ redFlags: { [id]: true }, clearances: { [id]: iso() } }), NOW);
    assert.equal(st.emergency, true, id);
    assert.equal(st.blocked, true, id);
  }
});

test('older safety checks: the combined "bilateral" item is read as an emergency and forces a re-screen', () => {
  const st = screeningStatus({ date: iso(), redFlags: { bilateral: true }, clearedByClinician: true, painNow: 3 }, NOW);
  assert.equal(st.emergency, true);
  assert.equal(st.needsRescreen, true);
});

test('a symptom reported in the pre-session quick check locks sessions', () => {
  const st = screeningStatus(screening({ sessionEmergency: iso() }), NOW);
  assert.equal(st.emergency, true);
});

test('doctor-first flags need their own dated clearance, which expires after 30 days', () => {
  assert.equal(screeningStatus(screening({ redFlags: { trauma: true } }), NOW).blocked, true);
  assert.equal(screeningStatus(screening({ redFlags: { trauma: true }, clearances: { trauma: iso(DAY) } }), NOW).blocked, false);
  assert.equal(screeningStatus(screening({ redFlags: { trauma: true }, clearances: { trauma: iso(31 * DAY) } }), NOW).blocked, true);
  // A clearance for one flag does not clear another.
  assert.equal(screeningStatus(screening({ redFlags: { trauma: true, cancer: true }, clearances: { trauma: iso() } }), NOW).blocked, true);
});

test('the full safety check expires after 4 weeks', () => {
  assert.equal(screeningStatus(screening({ date: iso(29 * DAY) }), NOW).stale, true);
  assert.equal(screeningStatus(screening({ date: iso(3 * DAY) }), NOW).needsRescreen, false);
});

test('cautions without a clinician OK restrict the plan to Gentle and block level-ups', () => {
  const st = stateWith(screening({ cautions: { surgery: true } }));
  st.progress['glute-bridge'].level = 2;
  const plan = todaysPlan(st, { now: NOW });
  assert.ok(plan.items.every((i) => i.level === 0 && i.maxLevel === 0));
  applyProgression(st, { id: 's1', exercises: [goodEx('hip-hinge')] }, NOW);
  const changes = applyProgression(st, { id: 's2', exercises: [goodEx('hip-hinge')] }, NOW);
  assert.deepEqual(changes, []);
  const cleared = stateWith(screening({ cautions: { surgery: true }, clearances: { surgery: iso() } }));
  assert.equal(todaysPlan(cleared, { now: NOW }).restricted, false);
});

// ---------- no back pain, and redoing the check ----------

test('"no back pain right now" completes the safety check with pain 0 and the standard plan, nothing location-driven', () => {
  // Earlier answers (pain below the knee, sitting aggravates) are left over in the form but must not count.
  const a = answers({ noPain: true, location: 'leg', aggravators: ['sitting', 'bending'] });
  assert.equal(screeningAnswered(answers()), false);
  assert.equal(screeningAnswered(a), true);
  const sc = buildScreening(a, NOW);
  assert.equal(sc.painNow, 0);
  assert.equal(sc.location, null);
  assert.deepEqual(sc.aggravators, []);
  const st = screeningStatus(sc, NOW);
  assert.equal(st.done, true);
  assert.equal(st.blocked, false);
  assert.equal(st.needsRescreen, false);
  const plan = todaysPlan(stateWith(sc), { now: NOW });
  assert.deepEqual(plan.notes, []);
  assert.deepEqual(plan.skipped, []);
  assert.ok(plan.items.some((i) => i.id === 'knee-to-chest'));
  assert.ok(plan.items.every((i) => i.repScale === 1 && i.reasons.length === 0));
  // Defence in depth: a stored no-pain screening with stray location answers still gets no location notes.
  const stray = todaysPlan(stateWith({ ...sc, location: 'leg', aggravators: ['sitting'] }), { now: NOW });
  assert.deepEqual(stray.notes, []);
  assert.ok(stray.items.some((i) => i.id === 'knee-to-chest'));
});

test('"no back pain right now" never bypasses the warning signs', () => {
  for (const id of ['saddle', 'bladder', 'bowel', 'sexual', 'weakness']) {
    const st = screeningStatus(buildScreening(answers({ noPain: true, redFlags: { [id]: true } }), NOW), NOW);
    assert.equal(st.emergency, true, id);
    assert.equal(st.blocked, true, id);
  }
  const doctor = screeningStatus(buildScreening(answers({ noPain: true, redFlags: { trauma: true } }), NOW), NOW);
  assert.equal(doctor.blocked, true);
  assert.deepEqual(doctor.unclearedFlags.map((f) => f.id), ['trauma']);
  const caution = screeningStatus(buildScreening(answers({ noPain: true, cautions: { pregnant: true } }), NOW), NOW);
  assert.equal(caution.restricted, true);
});

test('a redone safety check with no warning signs clears an emergency from the session quick check', () => {
  const st = stateWith(screening({ sessionEmergency: iso(DAY) }));
  assert.equal(screeningStatus(st.profile.screening, NOW).emergency, true);
  // The safety view saves the fresh screening in place of the old one.
  st.profile.screening = buildScreening(answers({ noPain: true }), NOW);
  assert.equal(st.profile.screening.sessionEmergency, undefined);
  const after = screeningStatus(st.profile.screening, NOW);
  assert.equal(after.emergency, false);
  assert.equal(after.blocked, false);
  // Redone with an emergency sign still ticked, it stays locked.
  assert.equal(screeningStatus(buildScreening(answers({ noPain: true, redFlags: { bladder: true } }), NOW), NOW).emergency, true);
});

// ---------- test round ----------

test('test round: any see-a-doctor sign or caution means demo only, even with a clearance', { skip: !TEST_ROUND && 'only during the test round' }, () => {
  const doctor = stateWith(screening({ redFlags: { trauma: true }, clearances: { trauma: iso() } }));
  const st = screeningStatus(doctor.profile.screening, NOW);
  assert.equal(st.blocked, false, 'the clearance itself is still valid');
  assert.equal(st.testDemoOnly, true);
  const plan = todaysPlan(doctor, { now: NOW });
  assert.equal(plan.demoOnly, true);
  assert.deepEqual(plan.items, []);
  assert.ok(plan.notes.some((n) => /use the demo instead of exercising/.test(n)));
  assert.equal(screeningStatus(screening({ cautions: { osteo: true }, clearances: { osteo: iso() } }), NOW).testDemoOnly, true);
  // Self-reported clearances are not saved during the test round.
  assert.deepEqual(buildScreening(answers({ noPain: true, redFlags: { cancer: true }, cleared: { cancer: true } }), NOW).clearances, {});
  // An emergency still wins over demo only.
  const emergency = screeningStatus(screening({ redFlags: { bladder: true, trauma: true } }), NOW);
  assert.equal(emergency.emergency, true);
  assert.equal(emergency.testDemoOnly, false);
});

test('a clean safety check is not demo only', () => {
  const st = stateWith(screening());
  assert.equal(screeningStatus(st.profile.screening, NOW).testDemoOnly, false);
  const plan = todaysPlan(st, { now: NOW });
  assert.equal(plan.demoOnly, undefined);
  assert.ok(plan.items.length > 0);
});

// ---------- today's plan ----------

test("today's pain rating drives the plan: 8+ is a rest day, 7 is Gentle with fewer reps", () => {
  const st = stateWith(screening({ painNow: 2 }));
  st.progress['glute-bridge'].level = 2;
  assert.equal(todaysPlan(st, { painToday: 8, now: NOW }).restDay, true);
  const high = todaysPlan(st, { painToday: 7, now: NOW });
  assert.ok(high.items.every((i) => i.level === 0 && i.repScale < 1));
  assert.ok(!high.items.some((i) => i.id === 'bird-dog'));
  assert.equal(todaysPlan(st, { painToday: 2, now: NOW }).items.find((i) => i.id === 'glute-bridge').level, 2);
});

test('plan skips knee-to-chest when bending or sitting aggravates the back', () => {
  const plan = todaysPlan(stateWith(screening({ aggravators: ['sitting'] })), { now: NOW });
  assert.ok(!plan.items.some((i) => i.id === 'knee-to-chest'));
  assert.ok(plan.skipped.some((i) => i.id === 'knee-to-chest'));
});

// ---------- progression ----------

test('two comfortable sessions only make a level-up pending; it applies after a "back to usual" next day', () => {
  const st = stateWith(screening());
  const s1 = { id: 's1', date: iso(3 * DAY), exercises: [goodEx('hip-hinge')] };
  const s2 = { id: 's2', date: iso(DAY), exercises: [goodEx('hip-hinge')] };
  assert.deepEqual(applyProgression(st, s1, NOW), []);
  const pending = applyProgression(st, s2, NOW);
  assert.equal(pending[0].pending, true);
  assert.equal(st.progress['hip-hinge'].level, 0);
  const changes = applyNextDay(st, s2, 'usual', NOW);
  assert.equal(changes[0].to, 1);
  assert.equal(st.progress['hip-hinge'].level, 1);
});

test('no more than one level-up per exercise per week', () => {
  const st = stateWith(screening());
  st.progress['hip-hinge'].lastLevelUpAt = NOW - 2 * DAY;
  applyProgression(st, { id: 'a', exercises: [goodEx('hip-hinge')] }, NOW);
  assert.deepEqual(applyProgression(st, { id: 'b', exercises: [goodEx('hip-hinge')] }, NOW), []);
});

test('one session rated "easy" no longer levels up on its own', () => {
  const st = stateWith(screening());
  assert.deepEqual(applyProgression(st, { id: 'a', exercises: [goodEx('hip-hinge', { feel: 'easy' })] }, NOW), []);
  assert.equal(st.progress['hip-hinge'].pendingUp, undefined);
});

test('a "worse" next day cancels the pending level-up, eases back what hurt, and lightens the next plan', () => {
  const st = stateWith(screening());
  st.progress['glute-bridge'].level = 1;
  st.progress['hip-hinge'].pendingUp = { sessionId: 's9' };
  const ses = { id: 's9', date: iso(DAY), exercises: [goodEx('hip-hinge'), goodEx('glute-bridge', { painRating: 4 })] };
  st.sessions.push(ses);
  applyNextDay(st, ses, 'worse', NOW);
  assert.equal(st.progress['hip-hinge'].pendingUp, null);
  assert.equal(st.progress['hip-hinge'].level, 0);
  assert.equal(st.progress['glute-bridge'].level, 0);
  const plan = todaysPlan(st, { now: NOW + 3600e3 });
  assert.ok(plan.items.every((i) => i.repScale < 1));
  assert.ok(plan.notes.some((n) => /worse after a recent session/.test(n)));
});

test('pain of 6+ rests the exercise for 2 days even at the Gentle level; leg symptoms do too', () => {
  const st = stateWith(screening());
  applyProgression(st, { id: 'a', exercises: [goodEx('bird-dog', { painRating: 6 })] }, NOW);
  assert.ok(st.progress['bird-dog'].restUntil > NOW);
  applyProgression(st, { id: 'b', exercises: [goodEx('side-bend', { legSymptoms: true, painRating: 2 })] }, NOW);
  assert.ok(st.progress['side-bend'].restUntil > NOW);
  const plan = todaysPlan(st, { now: NOW });
  assert.ok(plan.skipped.some((s) => s.id === 'bird-dog') && plan.skipped.some((s) => s.id === 'side-bend'));
});

test('form scores only gate progression when tracking was reliable', () => {
  const st = stateWith(screening());
  const shaky = goodEx('hip-hinge', { formScore: 40, trackingQuality: 0.5 });
  applyProgression(st, { id: 'a', exercises: [shaky] }, NOW);
  assert.equal(st.progress['hip-hinge'].good, 1);
  applyProgression(st, { id: 'b', exercises: [goodEx('hip-hinge', { formScore: 40, trackingQuality: 0.95 })] }, NOW);
  assert.equal(st.progress['hip-hinge'].good, 0);
});

test('the next-day question is asked between 12 hours and 7 days after a session', () => {
  const st = stateWith(screening());
  st.sessions.push({ id: 'x', date: iso(2 * 3600e3), exercises: [] });
  assert.equal(pendingNextDay(st, NOW), null);
  st.sessions[0].date = iso(DAY);
  assert.equal(pendingNextDay(st, NOW).id, 'x');
  st.sessions[0].nextDay = 'usual';
  assert.equal(pendingNextDay(st, NOW), null);
});

// ---------- stats ----------

test('consistency stats and harder-exercise ranking from sample data', () => {
  const sessions = sampleSessions(NOW);
  const stats = computeStats(sessions, NOW);
  assert.ok(stats.weeksOnTrack >= 2);
  assert.ok(stats.pain7 < stats.painPrev7, 'sample pain should be improving');
  assert.equal(painTriggers(sessions, 30, NOW)[0].id, 'hip-hinge');
});

test('an emergency sign saves and locks even with the pain questions left blank', async () => {
  const { buildScreening, screeningStatus, screeningAnswered, EMERGENCY_FLAGS } = await import('../js/program.js');
  const answers = { redFlags: { [EMERGENCY_FLAGS[0].id]: true }, cautions: {}, noPain: false, location: null, duration: null, painNow: null, aggravators: [] };
  assert.equal(screeningAnswered(answers), false, 'the pain questions really are blank');
  const st = screeningStatus(buildScreening(answers));
  assert.equal(st.emergency, true);
  assert.equal(st.testDemoOnly, false, 'the emergency message wins over demo-only');
});
