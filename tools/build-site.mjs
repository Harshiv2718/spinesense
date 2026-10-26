// Builds the public site for GitHub Pages from an explicit allowlist.
// Research notes, reports, verification files and local tooling config never get published.
//
//   node tools/build-site.mjs [outDir]     (default: _site)

import { cp, mkdir, rm, readdir, stat, writeFile } from 'node:fs/promises';
import { join, resolve, relative, sep, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

/** Everything the app needs at runtime, plus the public docs it links to. */
export const ALLOW = ['index.html', 'css', 'js', 'docs', 'models'];

/** Never published, even if someone adds them to ALLOW by mistake. */
export const DENY = ['research_notes', 'reports', 'active', '.claude', 'test', 'tools', 'firmware', 'ml', 'node_modules', '.git', '.github'];

async function exists(p) {
  return !!(await stat(p).catch(() => null));
}

async function listFiles(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await listFiles(p)));
    else out.push(p);
  }
  return out;
}

export async function buildSite(outDir = join(ROOT, '_site')) {
  const out = resolve(outDir);
  // Never wipe the project itself, a parent of it, or a folder we're about to copy from.
  const norm = (p) => (process.platform === 'win32' ? p.toLowerCase() : p);
  const isAncestorOrSelf = norm(out) === norm(ROOT) || norm(ROOT).startsWith(norm(out.endsWith(sep) ? out : out + sep));
  const rel = relative(ROOT, out); // absolute when on another drive (Windows)
  const insideSource = !isAbsolute(rel) && !rel.startsWith('..') && ALLOW.includes(rel.split(sep)[0]);
  if (isAncestorOrSelf || insideSource) throw new Error(`Refusing to build into ${out}`);
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  for (const entry of ALLOW) {
    if (DENY.includes(entry)) throw new Error(`${entry} is on the deny list`);
    const src = join(ROOT, entry);
    if (await exists(src)) await cp(src, join(out, entry), { recursive: true });
  }
  await writeFile(join(out, '.nojekyll'), ''); // serve files as-is (no Jekyll processing)
  const files = (await listFiles(out)).map((f) => relative(out, f).split(sep).join('/'));
  const leaked = files.filter((f) => DENY.includes(f.split('/')[0]) || /(^|\/)\.(env|git)/.test(f));
  if (leaked.length) throw new Error(`Private files in the build: ${leaked.join(', ')}`);
  return { out, files };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { out, files } = await buildSite(process.argv[2] ? resolve(process.argv[2]) : undefined);
  console.log(`Built ${files.length} files into ${relative(process.cwd(), out) || out}`);
}
