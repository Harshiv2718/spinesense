// Local clip library in IndexedDB (clips are too big for localStorage). Two stores: the full clip,
// and a small summary for listing, so the Recordings page never loads megabytes just to show a list.

import { summarize } from './clip.js';

const DB_NAME = 'spinesense';
const DB_VERSION = 1;

function open() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('This browser has no IndexedDB, so clips can’t be stored.'));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('clips')) db.createObjectStore('clips', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('clipMeta')) db.createObjectStore('clipMeta', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(stores, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(stores, mode);
    let result;
    Promise.resolve(fn(...stores.map((s) => t.objectStore(s)))).then((v) => (result = v));
    t.oncomplete = () => {
      db.close();
      resolve(result);
    };
    t.onerror = () => {
      db.close();
      const e = t.error;
      reject(e?.name === 'QuotaExceededError' ? new Error('Not enough storage space for this clip. Delete older clips in Recordings and try again.') : e);
    };
    t.onabort = t.onerror;
  });
}

const req = (r) => new Promise((resolve, reject) => {
  r.onsuccess = () => resolve(r.result);
  r.onerror = () => reject(r.error);
});

export async function saveClip(clip) {
  const meta = summarize(clip);
  await tx(['clips', 'clipMeta'], 'readwrite', (clips, metas) => {
    clips.put(clip);
    metas.put(meta);
  });
  return meta;
}

export async function listClips() {
  const all = await tx(['clipMeta'], 'readonly', (metas) => req(metas.getAll()));
  return (all ?? []).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getClip(id) {
  return tx(['clips'], 'readonly', (clips) => req(clips.get(id)));
}

export function deleteClip(id) {
  return tx(['clips', 'clipMeta'], 'readwrite', (clips, metas) => {
    clips.delete(id);
    metas.delete(id);
  });
}

export function deleteAllClips() {
  return tx(['clips', 'clipMeta'], 'readwrite', (clips, metas) => {
    clips.clear();
    metas.clear();
  });
}

export async function storageUsage() {
  try {
    const { usage, quota } = await navigator.storage.estimate();
    return { usage, quota };
  } catch {
    return null;
  }
}
