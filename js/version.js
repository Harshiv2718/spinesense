// App version, shown on the Help & feedback page and in test reports. The deployed site also has a
// build.json (written by tools/build-site.mjs) naming the exact commit; local copies say "local".

export const VERSION = '0.3.0';

let build = null;

export function buildInfo() {
  build ??= fetch('build.json', { cache: 'no-store' })
    .then((res) => (res.ok ? res.json() : null))
    .catch(() => null) // offline, or running locally
    .then((b) => b ?? { version: VERSION, sha: 'local', builtAt: null });
  return build;
}
