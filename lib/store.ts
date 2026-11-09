'use client';
// Local-first library (IndexedDB) + simple settings and daily usage counters (localStorage).
export type Doc = {
  id: string;
  title: string;
  source: string;          // 'paste' | 'file:name.pdf' | 'url:...' | 'youtube:...' | 'ocr'
  text: string;
  position: number;        // sentence index to resume from
  createdAt: number;
  updatedAt: number;
  language?: string;
  summary?: string;
  notes?: string;
};

const DB = 'voxora', STORE = 'docs';
function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
const tx = async <T,>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const db = await open();
  return new Promise((res, rej) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
};

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export const listDocs = async () => ((await tx<Doc[]>('readonly', (s) => s.getAll())) || []).sort((a, b) => b.updatedAt - a.updatedAt);
export const getDoc = (id: string) => tx<Doc | undefined>('readonly', (s) => s.get(id));
export const saveDoc = async (d: Doc) => { await tx('readwrite', (s) => s.put({ ...d, updatedAt: Date.now() })); };
export const deleteDoc = async (id: string) => { await tx('readwrite', (s) => s.delete(id)); };

export async function createDoc(title: string, text: string, source: string): Promise<Doc> {
  const d: Doc = { id: uid(), title: title || 'Untitled', source, text, position: 0, createdAt: Date.now(), updatedAt: Date.now() };
  await saveDoc(d);
  return d;
}

// ---------- settings ----------
export type Settings = {
  voice: string;
  speed: number;
  theme: 'dark' | 'light';
  font: 'sans' | 'serif' | 'dyslexic';
  size: number;               // reading text px
  elevenKey?: string;
  customVoices: { id: string; name: string; provider: 'elevenlabs' }[];
  smartSpeed: boolean;
};
export const DEFAULT_SETTINGS: Settings = { voice: 'jenny', speed: 1, theme: 'dark', font: 'sans', size: 20, customVoices: [], smartSpeed: false };
export const getSettings = (): Settings => {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem('voxora.settings') || '{}') }; } catch { return DEFAULT_SETTINGS; }
};
export const setSettings = (patch: Partial<Settings>) => {
  const s = { ...getSettings(), ...patch };
  localStorage.setItem('voxora.settings', JSON.stringify(s));
  window.dispatchEvent(new Event('voxora:settings'));
  return s;
};

// ---------- daily usage ----------
type Usage = { day: string; listen: number; downloads: number; imports: number };
const today = () => new Date().toISOString().slice(0, 10);
export const getUsage = (): Usage => {
  try {
    const u = JSON.parse(localStorage.getItem('voxora.usage') || 'null');
    if (u && u.day === today()) return u;
  } catch {}
  return { day: today(), listen: 0, downloads: 0, imports: 0 };
};
export const addUsage = (k: 'listen' | 'downloads' | 'imports', n: number) => {
  const u = getUsage();
  u[k] += n;
  localStorage.setItem('voxora.usage', JSON.stringify(u));
  window.dispatchEvent(new Event('voxora:usage'));
  return u;
};
