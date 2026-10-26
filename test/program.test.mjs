import test from 'node:test';
import assert from 'node:assert/strict';
import {
  todaysPlan, applyProgression, applyNextDay, pendingNextDay, computeStats, initialProgress, screeningStatus,
  painTriggers, sampleSessions, SCREENING_VERSION,
} from '../js/program.js';

const DAY = 86400000;
const NOW = Date.parse('2026-10-17T12:00:00Z');
const iso = (msAgo = 0) => new Date(NOW - msAgo).toISOString();
const screening = (over = {}) => ({ version: SCREENING_VERSION, date: iso(), redFlags: {}, cautions: {}, clearances: {}, location: 'back', duration: 'subacute', painNow: 4, aggravators: [], ...over });
const stateWith = (sc) => ({ profile: { screening: sc }, progress: initialProgress(sc), sessions: [] });
const goodEx = (id, over = {}) => ({ id, reps: 6, targetReps: 6, formScore: 90, trackingQuality: 0.95, painRating: 1, feel: 'right', ...over });

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
