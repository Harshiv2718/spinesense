// Writes the results section of docs/validation.md (and Bland–Altman SVGs in docs/validation/) from
// recorded clips.
//
//   node tools/validate-clips.mjs clips/*.json     real clips exported from the Recordings page
//   node tools/validate-clips.mjs --simulate       a simulated session (tests the pipeline only)

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { clipFromJSON } from '../js/data/clip.js';
import { analyzeClip, agreement, ICC_MIN_SPREAD } from '../js/analysis/agreement.js';
import { blandAltmanSVG } from '../js/analysis/plots.js';
import { simulateClip } from '../js/analysis/simclip.js';
import { byId } from '../js/core/exercises.js';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DOC = join(ROOT, 'docs', 'validation.md');
const START = '<!-- results:start -->';
const END = '<!-- results:end -->';

const args = process.argv.slice(2);
const simulate = args.includes('--simulate');
const files = args.filter((a) => !a.startsWith('--'));
if (!simulate && !files.length) {
  console.error('Usage: node tools/validate-clips.mjs [--simulate] [clip.json ...]');
  process.exit(1);
}

const clips = simulate ? [await simulateClip()] : await Promise.all(files.map(async (f) => clipFromJSON(JSON.parse(await readFile(f, 'utf8')))));
const analyses = clips.map((c) => ({ clip: c, res: analyzeClip(c) })).filter((a) => a.res.ok);
if (!analyses.length) {
  console.error('No clip had calibrated sensor data to compare against.');
  process.exit(1);
}

// Pool rep-peak and frame pairs across clips, per exercise.
const pooled = {};
for (const { res } of analyses) {
  for (const [id, e] of Object.entries(res.perExercise)) {
    const p = (pooled[id] ??= { view: e.view, measure: e.measure, reps: [], frames: [], clips: 0 });
    p.reps.push(...e.repPairs);
    p.frames.push(...e.pairs);
    p.clips++;
  }
}

await mkdir(join(ROOT, 'docs', 'validation'), { recursive: true });
const kind = simulate || analyses.every((a) => a.clip.simulated) ? 'SIMULATED' : 'REAL';
const lines = [];
lines.push(`### ${kind === 'SIMULATED' ? 'Simulated run (pipeline check, not real-world accuracy)' : 'Results'}`, '');
lines.push(`Generated ${new Date().toISOString().slice(0, 10)} by \`node tools/validate-clips.mjs${simulate ? ' --simulate' : ''}\` from ${analyses.length} clip${analyses.length > 1 ? 's' : ''}.`, '');
if (kind === 'SIMULATED') {
  lines.push('> These numbers come from the simulated person and simulated sensors (with injected radio delay, clock offset and drift). They show the pipeline works end to end and recovers the timing correctly. They say nothing about real camera accuracy. Real results replace this section once clips are recorded.', '');
}
lines.push('**Time alignment**', '', '| Clip | Clock offset (camera vs sensor) | Correlation | Smoothing delay |', '|---|---|---|---|');
for (const { clip, res } of analyses) {
  lines.push(`| ${clip.id} | ${Math.round(res.lag.lag * 1000)} ms | ${res.lag.r != null ? res.lag.r.toFixed(2) : '—'} | ${Math.round(res.smoothingDelay * 1000)} ms |`);
}
lines.push('', '**Agreement by exercise** (rep peaks are the main result; frames are secondary because neighbouring frames are not independent)', '');
lines.push('| Exercise | Compared | Reps | Bias | 95% limits of agreement | ICC(A,1) | Frame MAE | Frame CCC |', '|---|---|---|---|---|---|---|---|');
let narrow = false;
for (const [id, p] of Object.entries(pooled)) {
  const r = agreement(p.reps);
  const icc = r.icc == null ? '—' : r.spread < ICC_MIN_SPREAD ? ((narrow = true), 'n/a (see note)') : r.icc;
  const f = agreement(p.frames);
  const name = byId[id]?.name ?? id;
  lines.push(`| ${name} | ${p.measure} | ${r.n ?? 0} | ${r.bias ?? '—'}° | ${r.loa ? `${r.loa[0]}° to ${r.loa[1]}°` : '—'} | ${icc} | ${f.mae ?? '—'}° | ${f.ccc ?? '—'} |`);
  const svg = blandAltmanSVG({ pairs: p.frames.filter((_, i) => i % 2 === 0), repPairs: p.reps, stats: r.n >= 3 ? r : f, title: `${name}: camera − sensor${kind === 'SIMULATED' ? ' (simulated)' : ''}`, theme: 'static' });
  await writeFile(join(ROOT, 'docs', 'validation', `${id}.svg`), svg);
}
lines.push('');
if (narrow) lines.push(`Note: ICC not reported because the reps were all about the same depth (sensor SD under ${ICC_MIN_SPREAD}°), so there was too little variation for it to mean anything. Vary the depth between reps to measure it.`, '');
for (const id of Object.keys(pooled)) lines.push(`![Bland–Altman plot for ${byId[id]?.name ?? id}](validation/${id}.svg)`, '');

const doc = await readFile(DOC, 'utf8');
const a = doc.indexOf(START);
const b = doc.indexOf(END);
if (a < 0 || b < a) throw new Error(`docs/validation.md needs ${START} and ${END} markers`);
await writeFile(DOC, `${doc.slice(0, a + START.length)}\n${lines.join('\n')}\n${doc.slice(b)}`);
console.log(`Wrote results for ${Object.keys(pooled).length} exercises from ${analyses.length} clip(s) (${kind}) to docs/validation.md`);
for (const f of files) console.log(`  used ${basename(f)}`);
