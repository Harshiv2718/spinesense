// Builds the training table for ml/train.py from recorded clips: one JSON row per hip-hinge rep.
//
//   node tools/build-dataset.mjs clips/*.json --out ml/data/hinge.jsonl [--subject NAME] [--tier A]
//   node tools/build-dataset.mjs --simulate 16 --out ml/data/sim.jsonl      simulated people (pipeline check only)
//   node tools/build-dataset.mjs --simulate 16 --no-cue --out ...           negative control: nothing to learn
//
// Rows go in ml/data/, which git ignores: they hold movement data.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { clipFromJSON } from '../js/data/clip.js';
import { clipRows, simulatedSubject } from '../js/analysis/dataset.js';
import { simulateClip } from '../js/analysis/simclip.js';
import { FEATURE_SCHEMA, FEATURE_NAMES } from '../js/core/features.js';

const SETS = 3; // the blueprint asks for three hinge sets per person

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? fallback : args.splice(i, 2)[1];
};
const out = resolve(opt('out', 'ml/data/hinge.jsonl'));
const tier = opt('tier', 'A');
const subject = opt('subject', undefined);
const simulate = Number(opt('simulate', 0));
const noCue = args.includes('--no-cue');
const files = args.filter((a) => !a.startsWith('--'));
if (!simulate && !files.length) {
  console.error('Usage: node tools/build-dataset.mjs [clip.json ...] [--simulate N] --out file.jsonl');
  process.exit(1);
}

const rows = [];
const skipped = [];
const add = (name, clip) => {
  const r = clipRows(clip, { subject: subject ?? clip.participant, tier });
  rows.push(...r.rows);
  if (r.skipped) skipped.push(`${name}: ${r.skipped}`);
};
for (const f of files) add(f, clipFromJSON(JSON.parse(await readFile(f, 'utf8'))));
for (let i = 0; i < simulate; i++) {
  const person = simulatedSubject(i, { cue: !noCue });
  for (let set = 0; set < SETS; set++) {
    add(`${person.id} set ${set + 1}`, await simulateClip({ exercises: ['hip-hinge'], subject: { ...person, seed: person.seed + set * 100 } }));
  }
}

await mkdir(dirname(out), { recursive: true });
await writeFile(out, `${rows.map((r) => JSON.stringify(r)).join('\n')}\n`);
await writeFile(`${out}.names.json`, JSON.stringify({ schema: FEATURE_SCHEMA, names: FEATURE_NAMES }));
const people = new Set(rows.map((r) => r.subject)).size;
console.log(`Wrote ${rows.length} reps from ${people} ${people === 1 ? 'person' : 'people'} to ${out}`);
for (const s of skipped) console.log(`  skipped ${s}`);
