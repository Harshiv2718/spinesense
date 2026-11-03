// Puts a trained model into models/ for the app to run in shadow mode, if it earned it.
//
//   node tools/ship-model.mjs ml/artifacts/hinge-lumbar [--permission "reference"]
//
// Refuses anything ml/train.py's gate didn't pass: simulated data, too few people, restricted data,
// or a model that doesn't clearly beat the baselines on people it never saw. A newly shipped model
// starts in shadow mode, and the previous one stays in the manifest, switched off, for rollback.

import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkModels } from './check-models.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

export async function shipModel(artifact, { models = join(ROOT, 'models'), name = basename(resolve(artifact)), permission = null } = {}) {
  const report = JSON.parse(await readFile(join(artifact, 'report.json'), 'utf8'));
  const reasons = report.gate?.reasons ?? ['no gate result in report.json'];
  if (report.simulated && !reasons.length) reasons.push('trained on simulated data');
  if (!report.gate?.passed || reasons.length) throw new Error(`Not shipping ${name}:\n  - ${reasons.join('\n  - ')}`);

  const text = await readFile(join(artifact, 'model.json'));
  const sha256 = createHash('sha256').update(text).digest('hex');
  const file = `${name}-${sha256.slice(0, 8)}.json`;
  await mkdir(join(models, name), { recursive: true });
  await writeFile(join(models, file), text);
  await copyFile(join(artifact, 'MODEL_CARD.md'), join(models, name, 'MODEL_CARD.md'));

  const manifestPath = join(models, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const previous = manifest.models.find((m) => m.status === 'shadow');
  if (previous) previous.status = 'off';
  const tiers = report.tiers;
  manifest.models.push({
    id: `${name}-${sha256.slice(0, 8)}`,
    file,
    sha256,
    featureSchema: report.featureSchema,
    licenceTier: tiers.includes('B') ? 'B' : tiers.includes('C') ? 'C' : 'A',
    permission,
    status: 'shadow',
    previous: previous?.id ?? null,
    evaluated: { subjects: report.subjects, reps: report.reps, mae: report.methods.model.mae, ci95: report.methods.model.ci95 },
  });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const check = await checkModels(models);
  if (!check.ok) throw new Error(`Shipped, but the licence gate failed:\n  - ${check.problems.join('\n  - ')}`);
  return { file, sha256 };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--permission');
  const permission = i < 0 ? null : args.splice(i, 2)[1];
  try {
    const { file } = await shipModel(args[0], { permission });
    console.log(`Shipped ${file} in shadow mode. Commit models/ to deploy it.`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
