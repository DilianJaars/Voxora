'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { addUsage, createDoc, getUsage, listDocs } from '@/lib/store';
import { FREE_LIMITS } from '@/lib/plans';
import { useAccount } from '@/lib/useEntitlement';
import LimitBanner from '@/components/LimitBanner';
import { Icon } from '@/components/Icons';

const TABS = [
  ['paste', 'Paste text', 'paste'],
  ['file', 'Upload', 'file'],
  ['url', 'Web link', 'link'],
  ['youtube', 'YouTube', 'video'],
  ['cloud', 'Drive or Dropbox', 'cloud'],
  ['photo', 'Photo', 'camera'],
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
    if (!ent.premium && (await listDocs()).length >= FREE_LIMITS.maxDocs) { setLimit(true); setError(`Your free library holds ${FREE_LIMITS.maxDocs} documents. Delete one in Library, or upgrade.`); setBusy(''); return; }
    const d = await createDoc(title, body, source);
    router.push(`/read/${d.id}`);
  }

  async function fromApi(init: RequestInit, counts: boolean) {
    setError('');
    if (counts && !guardImport()) return;
    setBusy('Extracting text');
    try {
      const r = await fetch('/api/extract', init);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Something went wrong. Try again.');
      if (counts) addUsage('imports', 1);
      await open(j.title, j.text, j.source);
    } catch (e: any) { setError(e.message); setBusy(''); }
  }

  async function onFile(f: File) {
    if (!ent.premium && f.size > FREE_LIMITS.maxFileMB * 1024 * 1024) { setLimit(true); setError(`Free plan files can be up to ${FREE_LIMITS.maxFileMB} MB.`); return; }
    if (/^image\//.test(f.type)) return onPhoto(f);
    const fd = new FormData(); fd.append('file', f);
    await fromApi({ method: 'POST', body: fd }, false);
  }

  async function onPhoto(f: File) {
    setError('');
    if (!guardImport()) return;
    try {
      setBusy('Reading the page');
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng');
      const { data } = await worker.recognize(f);
      await worker.terminate();
      const t = data.text.replace(/-\n/g, '').replace(/\n(?!\n)/g, ' ').replace(/ {2,}/g, ' ').trim();
      if (t.length < 5) throw new Error('No text found in that photo. Try a sharper shot in better light.');
      addUsage('imports', 1);
      await open('Photo ' + new Date().toLocaleDateString(), t, 'ocr');
    } catch (e: any) { setError(e.message); setBusy(''); }
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">What should we read to you?</h1>

      <div role="tablist" className="mt-8 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map(([k, label, icon]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setError(''); }}
            className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-sm transition-colors ${tab === k ? 'border-mark text-fg' : 'border-transparent text-mute hover:text-fg'}`}>
            <Icon name={icon} size={16} />{label}
          </button>
        ))}
      </div>

      <div className="pt-6">
        {tab === 'paste' && (
          <>
            <textarea className="input min-h-[240px] resize-y font-read text-lg leading-relaxed" placeholder="Paste or type text here" value={text} onChange={(e) => setText(e.target.value)} />
            <button disabled={text.trim().length < 3 || !!busy} onClick={() => open(text.trim().split('\n')[0].slice(0, 60), text.trim(), 'paste')} className="btn btn-primary mt-4 !px-6 !py-3">Listen</button>
          </>
        )}

        {tab === 'file' && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
            onClick={() => fileRef.current?.click()} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
            className={`grid min-h-[240px] cursor-pointer place-items-center rounded-xl border border-dashed p-8 text-center transition-colors ${drag ? 'border-mark bg-panel' : 'border-line hover:border-mute'}`}>
            <div>
              <Icon name="download" size={28} className="mx-auto rotate-180 text-mark" />
              <p className="mt-3 font-semibold">Drop a file here, or click to choose one</p>
              <p className="mt-1 text-sm text-mute">PDF, Word, EPUB or text{!ent.premium && `, up to ${FREE_LIMITS.maxFileMB} MB`}</p>
            </div>
            <input ref={fileRef} type="file" hidden accept=".pdf,.docx,.epub,.txt,.md,.html,image/*" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          </div>
        )}

        {(tab === 'url' || tab === 'youtube' || tab === 'cloud') && (
          <>
            <input className="input" placeholder={tab === 'url' ? 'https://example.com/article' : tab === 'youtube' ? 'https://youtube.com/watch?v=VIDEO_ID' : 'Share link from Google Drive or Dropbox'} value={link} onChange={(e) => setLink(e.target.value)} />
            <p className="mt-2 text-sm text-mute">
              {tab === 'url' && 'We find the main article text and leave out menus and ads.'}
              {tab === 'youtube' && 'We read the video transcript, so the video needs captions.'}
              {tab === 'cloud' && 'Set the file to “Anyone with the link” first. PDF, Word, EPUB, text and Google Docs work.'}
            </p>
            <button disabled={!link.trim() || !!busy} onClick={() => fromApi({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: tab, value: link.trim() }) }, tab !== 'cloud')} className="btn btn-primary mt-4 !px-6 !py-3">Fetch and listen</button>
          </>
        )}

        {tab === 'photo' && (
          <div onClick={() => photoRef.current?.click()} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && photoRef.current?.click()}
            className="grid min-h-[240px] cursor-pointer place-items-center rounded-xl border border-dashed border-line p-8 text-center transition-colors hover:border-mute">
            <div>
              <Icon name="camera" size={28} className="mx-auto text-mark" />
              <p className="mt-3 font-semibold">Photograph a page</p>
              <p className="mt-1 text-sm text-mute">We read the text and speak it. A flat page in good light works best.</p>
            </div>
            <input ref={photoRef} type="file" hidden accept="image/*" capture="environment" onChange={(e) => e.target.files?.[0] && onPhoto(e.target.files[0])} />
          </div>
        )}

        {busy && <p className="mt-4 flex items-center gap-3 text-sm text-mute"><span className="spin !h-4 !w-4" />{busy}</p>}
        {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}
      </div>

      {limit && <div className="mt-6"><LimitBanner message={`Free plan limits: ${FREE_LIMITS.importsPerDay} web, YouTube or photo imports a day, ${FREE_LIMITS.maxDocs} documents, ${FREE_LIMITS.maxFileMB} MB files.`} /></div>}
    </div>
  );
}
