import test from 'node:test';
import assert from 'node:assert/strict';
import { Diagnostics } from '../js/views/diagnostics.js';

// The test report gets pasted into public GitHub issues: it must never reveal pain or discomfort.
test('test report leaves out pain answers, discomfort events and face scores', () => {
  const d = Object.create(Diagnostics.prototype); // skip the DOM panel the constructor builds
  Object.assign(d, {
    meta: { app: 'SpineSense', version: 'x', when: '2026-10-28T21:14:03.123Z', ua: 'test' },
    events: [
      { t: 1, ex: 'hip-hinge', type: 'exercise-start', level: 0 },
      { t: 5, ex: 'hip-hinge', type: 'discomfort-moderate', score: 1.2, signals: { face: 0.8 } },
      { t: 6, ex: 'hip-hinge', type: 'pain-answer', level: 'moderate', signals: {} },
      { t: 7, ex: 'hip-hinge', type: 'pain-check-dismissed' },
      { t: 9, ex: 'hip-hinge', type: 'skip', reason: 'couldnt-see' },
    ],
    samples: [[0, 'exercise', 'hip-hinge', 'active', 'down', 12, 30, 1, 'left', 0.3, 12, 1, 0.9, [0.4, 1], 2.1, 0.7, 30, null, null, null]],
  });
  const results = [{ id: 'hip-hinge', levelName: 'Gentle', reps: 3, targetReps: 6, aborts: 0, formScore: 90, peakBest: 40, painRating: 7, legSymptoms: true, stoppedEarly: true, events: [{ rating: 7 }] }];
  const report = JSON.parse(d.report(results));
  const text = JSON.stringify(report);
  assert.equal(report.meta.when, '2026-10-28');
  assert.deepEqual(report.events.map((e) => e.type), ['exercise-start', 'skip']);
  for (const col of ['face', 'faceZ', 'disc']) assert.ok(!report.columns.includes(col), `${col} column left in`);
  assert.equal(report.samples[0].length, report.columns.length);
  for (const word of ['painRating', 'rating', 'legSymptoms', 'stopped', 'discomfort', '"flags"']) assert.ok(!text.includes(word), `${word} leaked`);
});

test('a shared clip download leaves out pain answers, check-ins and pain-driven level drops', async () => {
  const { clipToJSON } = await import('../js/data/clip.js');
  const clip = {
    schema: 'clip.v1', id: 'c1', lm: [], world: [],
    results: [{ id: 'hip-hinge', reps: 2, painRating: 5, legSymptoms: false, feel: 'hard', stoppedEarly: true, levelChanges: [{ from: 1, to: 0 }], events: [{ t: 3, level: 'manual', signals: {}, action: 'regressed', rating: 5 }] }],
    events: [{ t: 1, type: 'rep' }, { t: 3, type: 'pain-answer', rating: 5, leg: false }],
  };
  const shared = clipToJSON(clip, { share: true });
  const text = JSON.stringify(shared);
  for (const word of ['painRating', 'legSymptoms', 'feel', 'stoppedEarly', 'levelChanges', 'regressed', 'pain-answer', 'rating']) assert.ok(!text.includes(word), `${word} leaked`);
  assert.equal(shared.results[0].reps, 2);
  assert.deepEqual(shared.events.map((e) => e.type), ['rep']);
  assert.equal(clipToJSON(clip).results[0].painRating, 5, 'the local copy keeps everything');
});
