'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { addUsage, createDoc, getUsage, listDocs } from '@/lib/store';
import { FREE_LIMITS } from '@/lib/plans';
import { useAccount } from '@/lib/useEntitlement';
import LimitBanner from '@/components/LimitBanner';

const TABS = [
  ['paste', '✍️ Paste text'],
  ['file', '📄 Upload'],
  ['url', '🌐 Web link'],
  ['youtube', '▶️ YouTube'],
  ['cloud', '☁️ Drive / Dropbox'],
  ['photo', '📸 Photo'],
] as const;
type Tab = (typeof TABS)[number][0];

export default function AppHome() {
  const router = useRouter();
  const { ent } = useAccount();
  const [tab, setTab] = useState<Tab>('paste');
  const [text, setText] = useState('');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [limit, setLimit] = useState(false);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  // URL / YouTube / photo imports are limited to 3 per day on the free plan
  const guardImport = () => {
    if (!ent.premium && getUsage().imports >= FREE_LIMITS.importsPerDay) { setLimit(true); return false; }
    setLimit(false);
    return true;
  };

  async function open(title: string, body: string, source: string) {
    if (!ent.premium && (await listDocs()).length >= FREE_LIMITS.maxDocs) { setLimit(true); setError(`Free library holds ${FREE_LIMITS.maxDocs} documents. Delete one in your Library or upgrade.`); setBusy(''); return; }
    const d = await createDoc(title, body, source);
    router.push(`/read/${d.id}`);
  }

  async function fromApi(init: RequestInit, counts: boolean) {
    setError('');
    if (counts && !guardImport()) return;
    setBusy('Extracting text…');
    try {
      const r = await fetch('/api/extract', init);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Something went wrong');
      if (counts) addUsage('imports', 1);
      await open(j.title, j.text, j.source);
    } catch (e: any) { setError(e.message); setBusy(''); }
  }

  async function onFile(f: File) {
    if (!ent.premium && f.size > FREE_LIMITS.maxFileMB * 1024 * 1024) { setLimit(true); setError(`Free plan files are limited to ${FREE_LIMITS.maxFileMB}MB.`); return; }
    if (/^image\//.test(f.type)) return onPhoto(f);
    const fd = new FormData(); fd.append('file', f);
    await fromApi({ method: 'POST', body: fd }, false);
  }

  async function onPhoto(f: File) {
    setError('');
    if (!guardImport()) return;
    try {
      setBusy('Reading the page (OCR)…');
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng');
      const { data } = await worker.recognize(f);
      await worker.terminate();
      const t = data.text.replace(/-\n/g, '').replace(/\n(?!\n)/g, ' ').replace(/ {2,}/g, ' ').trim();
      if (t.length < 5) throw new Error('Could not find any text in that photo. Try a sharper, well-lit shot.');
      addUsage('imports', 1);
      await open('Photo ' + new Date().toLocaleDateString(), t, 'ocr');
    } catch (e: any) { setError(e.message); setBusy(''); }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-center text-3xl font-extrabold sm:text-4xl">What do you want to <span className="text-brand-soft">listen</span> to?</h1>
      <p className="mt-2 text-center text-zinc-400">Paste anything. Listen to anything.</p>

      <div className="mt-8 flex gap-2 overflow-x-auto pb-2">
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => { setTab(k); setError(''); }} className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm ${tab === k ? 'border-brand bg-brand/20 text-white' : 'border-line text-zinc-400 hover:text-white'}`}>{label}</button>
        ))}
      </div>

      <div className="card mt-3">
        {tab === 'paste' && (
          <>
            <textarea className="input min-h-[220px] resize-y" placeholder="Paste or type any text here…" value={text} onChange={(e) => setText(e.target.value)} />
            <button disabled={text.trim().length < 3 || !!busy} onClick={() => open(text.trim().split('\n')[0].slice(0, 60), text.trim(), 'paste')} className="btn btn-primary mt-3 w-full !py-3.5 text-base">▶ Listen</button>
          </>
        )}

        {tab === 'file' && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
            onClick={() => fileRef.current?.click()}
            className={`grid min-h-[220px] cursor-pointer place-items-center rounded-xl border-2 border-dashed p-8 text-center transition ${drag ? 'border-brand bg-brand/10' : 'border-line'}`}>
            <div><div className="text-4xl">📂</div><p className="mt-2 font-semibold">Drag & drop or click to upload</p><p className="text-sm text-zinc-400">PDF, DOCX, EPUB, TXT{!ent.premium && ` · up to ${FREE_LIMITS.maxFileMB}MB on free`}</p></div>
            <input ref={fileRef} type="file" hidden accept=".pdf,.docx,.epub,.txt,.md,.html,image/*" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          </div>
        )}

        {(tab === 'url' || tab === 'youtube' || tab === 'cloud') && (
          <>
            <input className="input" placeholder={tab === 'url' ? 'https://… paste an article link' : tab === 'youtube' ? 'https://youtube.com/watch?v=… (uses the transcript)' : 'Public Google Drive or Dropbox share link'} value={link} onChange={(e) => setLink(e.target.value)} />
            {tab === 'cloud' && <p className="mt-2 text-xs text-zinc-400">Set the file to "Anyone with the link" then paste the link. Works with PDF, DOCX, EPUB, TXT and Google Docs.</p>}
            <button disabled={!link.trim() || !!busy} onClick={() => fromApi({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: tab, value: link.trim() }) }, tab !== 'cloud')} className="btn btn-primary mt-3 w-full !py-3.5 text-base">▶ Fetch & listen</button>
          </>
        )}

        {tab === 'photo' && (
          <div onClick={() => photoRef.current?.click()} className="grid min-h-[220px] cursor-pointer place-items-center rounded-xl border-2 border-dashed border-line p-8 text-center">
            <div><div className="text-4xl">📸</div><p className="mt-2 font-semibold">Take a photo of a page or book</p><p className="text-sm text-zinc-400">We'll read the text and speak it. Good light + flat page works best.</p></div>
            <input ref={photoRef} type="file" hidden accept="image/*" capture="environment" onChange={(e) => e.target.files?.[0] && onPhoto(e.target.files[0])} />
          </div>
        )}

        {busy && <p className="mt-3 animate-pulse text-center text-sm text-brand-glow">{busy}</p>}
        {error && <p className="mt-3 text-center text-sm text-red-400">{error}</p>}
      </div>

      {limit && <div className="mt-4"><LimitBanner message={`Free plan limits: ${FREE_LIMITS.importsPerDay} web / YouTube / photo imports per day, ${FREE_LIMITS.maxDocs} documents, ${FREE_LIMITS.maxFileMB}MB files.`} /></div>}
    </div>
  );
}
