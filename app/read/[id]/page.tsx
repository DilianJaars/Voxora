'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { addUsage, Doc, getDoc, getSettings, getUsage, saveDoc, Settings, setSettings } from '@/lib/store';
import { syncDoc } from '@/lib/sync';
import { chunkSentences, cleanForSpeech, detectChapters, estimateSeconds, fmtTime, splitSentences } from '@/lib/text';
import { FREE_LIMITS } from '@/lib/plans';
import { getVoice, LANGUAGES, VOICES } from '@/lib/voices';
import { useAccount } from '@/lib/useEntitlement';
import { supabaseBrowser } from '@/lib/supabase';
import VoicePicker from '@/components/VoicePicker';
import LimitBanner from '@/components/LimitBanner';
import { Icon, PauseIcon, PlayIcon, Skip } from '@/components/Icons';

type Chunk = { from: number; to: number; text: string };

export default function Reader() {
  const { id } = useParams<{ id: string }>();
  const acct = useAccount();
  const premium = acct.ent.premium;
  const maxSpeed = premium ? FREE_LIMITS.premiumMaxSpeed : FREE_LIMITS.maxSpeed;

  const [doc, setDoc] = useState<Doc | null>(null);
  const [settings, setS] = useState<Settings>(getSettings());
  const [idx, setIdx] = useState(0);              // current sentence
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [limit, setLimit] = useState('');
  const [panel, setPanel] = useState<'' | 'voices' | 'chapters' | 'ai' | 'text'>('');
  const [ai, setAi] = useState<{ summary?: string; notes?: string; busy?: string }>({});
  const [lang, setLang] = useState('');
  const [dl, setDl] = useState('');
  const [offlineMsg, setOfflineMsg] = useState('');
  const [time, setTime] = useState({ cur: 0, dur: 0 });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cache = useRef(new Map<number, Promise<string>>());
  const chunkIdx = useRef(0);
  const playingRef = useRef(false);
  const idxRef = useRef(0);
  const chunksRef = useRef<Chunk[]>([]);
  const textRef = useRef('');

  const sentences = useMemo(() => (doc ? splitSentences(doc.text) : []), [doc]);
  const chapters = useMemo(() => detectChapters(sentences), [sentences]);
  const chunks = useMemo(() => chunkSentences(sentences, 0), [sentences]);
  chunksRef.current = chunks;
  playingRef.current = playing;
  idxRef.current = idx;
  textRef.current = doc?.text || '';

  // ---------- load ----------
  useEffect(() => {
    getDoc(id).then((d) => { if (d) { setDoc(d); setIdx(Math.min(d.position || 0, Math.max(0, splitSentences(d.text).length - 1))); } });
    const on = () => setS(getSettings());
    window.addEventListener('voxora:settings', on);
    return () => window.removeEventListener('voxora:settings', on);
  }, [id]);

  const update = (patch: Partial<Settings>) => setS(setSettings(patch));
  const isCustom = settings.voice.startsWith('custom:');
  const authHeader = (): Record<string, string> => (acct.token ? { authorization: `Bearer ${acct.token}` } : {});

  // ---------- fetching audio (with offline cache for premium) ----------
  const cacheKey = (i: number) => `/voxora-offline/${id}/${settings.voice}/${lang || 'orig'}/${i}`;
  const fetchChunk = useCallback((i: number): Promise<string> => {
    const hit = cache.current.get(i);
    if (hit) return hit;
    const p = (async () => {
      try { const m = await caches.match(cacheKey(i)); if (m) return URL.createObjectURL(await m.blob()); } catch {}
      const c = chunksRef.current[i];
      const body: any = { text: settings.cleanText ? cleanForSpeech(c.text) || c.text : c.text, voice: settings.voice, compact: premium && settings.smartSpeed, language: lang || undefined };
      if (isCustom) { body.elevenVoiceId = settings.voice.slice(7); body.elevenKey = settings.elevenKey; }
      const r = await fetch('/api/tts', { method: 'POST', headers: { 'content-type': 'application/json', ...authHeader() }, body: JSON.stringify(body) });
      if (r.status === 402) throw new Error('premium_required');
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Voice failed');
      return URL.createObjectURL(await r.blob());
    })();
    cache.current.set(i, p);
    p.catch(() => cache.current.delete(i));
    return p;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.voice, settings.smartSpeed, settings.cleanText, settings.elevenKey, premium, lang, acct.token, id]);

  // reset audio cache when the voice/language changes
  useEffect(() => { cache.current.clear(); }, [settings.voice, settings.smartSpeed, settings.cleanText, lang]);

  const chunkOf = (sentence: number) => Math.max(0, chunksRef.current.findIndex((c) => sentence >= c.from && sentence <= c.to));

  // ---------- playback ----------
  const stop = () => { audioRef.current?.pause(); setPlaying(false); };

  const playChunk = useCallback(async (ci: number, startSentence?: number) => {
    const c = chunksRef.current[ci];
    if (!c) { setPlaying(false); return; }
    chunkIdx.current = ci;
    setErr(''); setLoading(true);
    try {
      const url = await fetchChunk(ci);
      if (!audioRef.current) audioRef.current = new Audio();
      const a = audioRef.current;
      a.src = url;
      a.playbackRate = Math.min(settings.speed, maxSpeed);
      a.preservesPitch = true;
      setIdx(startSentence ?? c.from);
      await a.play();
      setPlaying(true);
      setLoading(false);
      fetchChunk(ci + 1).catch(() => {}); // prefetch next
      // If resuming mid-chunk, jump to the proportional offset
      if (startSentence && startSentence > c.from) {
        const total = sentences.slice(c.from, c.to + 1).reduce((s, x) => s + x.text.length, 0);
        const before = sentences.slice(c.from, startSentence).reduce((s, x) => s + x.text.length, 0);
        const seek = () => { if (a.duration) a.currentTime = (before / total) * a.duration; };
        a.readyState >= 1 ? seek() : a.addEventListener('loadedmetadata', seek, { once: true });
      }
    } catch (e: any) {
      setLoading(false); setPlaying(false);
      if (e.message === 'premium_required') setLimit('That voice is a Premium voice.');
      else setErr(e.message || 'Could not load audio');
    }
  }, [fetchChunk, settings.speed, maxSpeed, sentences]);

  const toggle = async () => {
    if (playing) return stop();
    if (!premium && getUsage().listen >= FREE_LIMITS.listenSecondsPerDay) return setLimit("You've used your 30 free minutes today.");
    setLimit('');
    await playChunk(chunkOf(idx), idx);
  };

  // audio events: sentence highlight, chunk advance, usage tracking
  useEffect(() => {
    if (!audioRef.current) audioRef.current = new Audio();
    const a = audioRef.current;
    const onTime = () => {
      const c = chunksRef.current[chunkIdx.current];
      if (!c || !a.duration) return;
      setTime({ cur: a.currentTime, dur: a.duration });
      const sents = sentences.slice(c.from, c.to + 1);
      const total = sents.reduce((s, x) => s + x.text.length + 1, 0);
      let acc = 0;
      const frac = a.currentTime / a.duration;
      for (let k = 0; k < sents.length; k++) {
        acc += sents[k].text.length + 1;
        if (frac <= acc / total || k === sents.length - 1) { if (c.from + k !== idxRef.current) setIdx(c.from + k); break; }
      }
    };
    const onEnd = () => {
      const next = chunkIdx.current + 1;
      if (next < chunksRef.current.length) playChunk(next); else { setPlaying(false); }
    };
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('ended', onEnd);
    return () => { a.removeEventListener('timeupdate', onTime); a.removeEventListener('ended', onEnd); };
  }, [playChunk, sentences]);

  useEffect(() => { if (audioRef.current) audioRef.current.playbackRate = Math.min(settings.speed, maxSpeed); }, [settings.speed, maxSpeed]);

  // free-plan daily listening limit (30 min)
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      const u = addUsage('listen', 1);
      if (!premium && u.listen >= FREE_LIMITS.listenSecondsPerDay) { stop(); setLimit("You've used your 30 free minutes today."); }
    }, 1000);
    return () => clearInterval(t);
  }, [playing, premium]);

  // auto-scroll + save position
  useEffect(() => {
    document.getElementById('s' + idx)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    if (!doc) return;
    const t = setTimeout(() => { const d = { ...doc, position: idx }; saveDoc(d); syncDoc({ ...d, updatedAt: Date.now() }); }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  // skip ±10 seconds, hopping between chunks as needed
  const skip = (delta: number) => {
    const a = audioRef.current;
    if (!a || !a.duration) return;
    const t = a.currentTime + delta / 1; // playback seconds in media time
    if (t > a.duration && chunkIdx.current + 1 < chunksRef.current.length) return void playChunk(chunkIdx.current + 1);
    if (t < 0 && chunkIdx.current > 0) {
      const prev = chunkIdx.current - 1;
      return void playChunk(prev).then(() => { const x = audioRef.current!; const go = () => (x.currentTime = Math.max(0, x.duration + t)); x.readyState >= 1 ? go() : x.addEventListener('loadedmetadata', go, { once: true }); });
    }
    a.currentTime = Math.max(0, Math.min(a.duration, t));
  };

  const jump = (i: number) => { setIdx(i); if (playingRef.current) playChunk(chunkOf(i), i); };

  // Media Session = lock-screen controls + background play on mobile (Premium)
  useEffect(() => {
    if (!premium || !doc || !('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({ title: doc.title, artist: 'Voxora' });
    navigator.mediaSession.setActionHandler('play', toggle);
    navigator.mediaSession.setActionHandler('pause', toggle);
    navigator.mediaSession.setActionHandler('seekforward', () => skip(10));
    navigator.mediaSession.setActionHandler('seekbackward', () => skip(-10));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [premium, doc, playing]);

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  // ---------- actions ----------
  async function downloadMp3() {
    if (!doc) return;
    const u = getUsage();
    if (!premium && u.downloads >= FREE_LIMITS.downloadsPerDay) return setLimit("You've used your 2 free MP3 downloads today.");
    try {
      const parts: Blob[] = [];
      for (let i = 0; i < chunks.length; i++) {
        setDl(`Creating audio ${Math.round((i / chunks.length) * 100)}%`);
        parts.push(await (await fetch(await fetchChunk(i))).blob());
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(parts, { type: 'audio/mpeg' }));
      a.download = `${doc.title.replace(/[^\w\- ]+/g, '').slice(0, 60) || 'voxora'}.mp3`;
      a.click();
      addUsage('downloads', 1);
    } catch (e: any) { setErr(e.message || 'Download failed'); }
    setDl('');
  }

  async function shareAudio() {
    if (!doc) return;
    if (!premium) return setLimit('Share links are a Premium feature.');
    const sb = supabaseBrowser();
    try {
      setOfflineMsg('');
      const parts: Blob[] = [];
      for (let i = 0; i < chunks.length; i++) { setDl(`Preparing share ${Math.round((i / chunks.length) * 100)}%`); parts.push(await (await fetch(await fetchChunk(i))).blob()); }
      const r = await fetch('/api/share', { method: 'POST', headers: { 'content-type': 'application/json', ...authHeader() }, body: '{}' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Share failed');
      const up = await sb!.storage.from('shared-audio').uploadToSignedUrl(j.path, j.token, new Blob(parts, { type: 'audio/mpeg' }));
      if (up.error) throw new Error(up.error.message);
      await navigator.clipboard?.writeText(j.url);
      setOfflineMsg('Link copied');
    } catch (e: any) { setErr(e.message || 'Share failed'); }
    setDl('');
  }

  async function saveOffline() {
    try {
      const c = await caches.open('voxora-audio');
      for (let i = 0; i < chunks.length; i++) {
        setOfflineMsg(`Saving for offline ${Math.round((i / chunks.length) * 100)}%`);
        const r = await fetch(await fetchChunk(i));
        await c.put(cacheKey(i), new Response(await r.blob(), { headers: { 'content-type': 'audio/mpeg' } }));
      }
      setOfflineMsg('Saved for offline');
    } catch { setOfflineMsg('Could not save offline'); }
  }

  async function runAi(kind: 'summary' | 'notes') {
    if (!doc) return;
    if (!premium) return setLimit('AI summaries and notes are Premium features.');
    setAi((s) => ({ ...s, busy: kind }));
    const upto = kind === 'notes' ? doc.text.slice(0, sentences[Math.min(idx, sentences.length - 1)]?.end || undefined) : doc.text;
    const r = await fetch(`/api/${kind}`, { method: 'POST', headers: { 'content-type': 'application/json', ...authHeader() }, body: JSON.stringify({ text: upto }) });
    const j = await r.json();
    setAi((s) => ({ ...s, busy: '', [kind]: r.ok ? j[kind] : j.error || 'Failed' }));
    if (r.ok) { const d = { ...doc, [kind]: j[kind] }; setDoc(d); saveDoc(d); syncDoc({ ...d, updatedAt: Date.now() }); }
  }

  async function translate(to: string) {
    if (!doc) return;
    if (!to) { setLang(''); return; }
    if (!premium) return setLimit('Translation is a Premium feature.');
    setAi((s) => ({ ...s, busy: 'translate' }));
    const r = await fetch('/api/translate', { method: 'POST', headers: { 'content-type': 'application/json', ...authHeader() }, body: JSON.stringify({ text: doc.text, to }) });
    const j = await r.json();
    setAi((s) => ({ ...s, busy: '' }));
    if (!r.ok) return setErr(j.error || 'Translation failed');
    stop(); setLang(to);
    setDoc({ ...doc, text: j.text, position: 0 }); setIdx(0);
  }

  // ---------- sleep timer + keyboard shortcuts ----------
  const [sleepMin, setSleepMin] = useState(0);
  useEffect(() => {
    if (!sleepMin) return;
    const t = setTimeout(() => { stop(); setSleepMin(0); }, sleepMin * 60000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sleepMin]);

  const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 3, 3.5];
  const keys = useRef<any>({});
  keys.current = {
    toggle, skip, jump,
    next: () => jump(Math.min(sentences.length - 1, idxRef.current + 1)),
    prev: () => jump(Math.max(0, idxRef.current - 1)),
    step: (d: number) => {
      const ok = SPEEDS.filter((x) => x <= maxSpeed);
      const at = ok.indexOf(settings.speed);
      const next = ok[Math.max(0, Math.min(ok.length - 1, (at < 0 ? ok.indexOf(1) : at) + d))];
      update({ speed: next });
    },
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (/^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (t.tagName === 'BUTTON' && (e.code === 'Space' || e.key === 'Enter')) return;
      const k = keys.current;
      if (e.code === 'Space') { e.preventDefault(); k.toggle(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); k.skip(10); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); k.skip(-10); }
      else if (e.key === 'j') k.next();
      else if (e.key === 'k') k.prev();
      else if (e.key === ']') k.step(1);
      else if (e.key === '[') k.step(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!doc) return <div className="grid min-h-[60vh] place-items-center text-mute">Loading</div>;

  const fontClass = settings.font === 'serif' ? 'font-read' : settings.font === 'dyslexic' ? 'font-dyslexic tracking-wide' : 'font-hyper';
  const paras = (() => {
    const out: { s: typeof sentences; first: number }[] = [];
    sentences.forEach((s, i) => { const last = out[out.length - 1]; if (last && last.s[0].para === s.para) last.s.push(s); else out.push({ s: [s], first: i }); });
    return out;
  })();
  const remaining = estimateSeconds(sentences.slice(idx).map((s) => s.text).join(' '), settings.speed);
  const total = Math.max(1, sentences.length - 1);
  const pct = Math.round((idx / total) * 100);
  const voiceName = isCustom ? settings.customVoices.find((c) => 'custom:' + c.id === settings.voice)?.name || 'Custom' : getVoice(settings.voice)?.name;
  const tool = (active: boolean) => `btn-text !gap-1.5 rounded-md px-2.5 py-1.5 ${active ? '!text-fg bg-panel2' : ''}`;
  const sm = 'inline-flex items-center gap-1.5 hover:text-fg transition-colors';

  return (
    <div className="mx-auto max-w-2xl px-5 pb-72 pt-8">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight">{doc.title}</h1>
          <p className="mt-1 text-sm text-mute">{pct}% read, {fmtTime(remaining)} left{lang ? `, ${LANGUAGES[lang].label}` : ''}</p>
        </div>
        <div className="flex shrink-0 gap-1">
          <button className={tool(panel === 'chapters')} onClick={() => setPanel(panel === 'chapters' ? '' : 'chapters')} aria-label="Chapters"><Icon name="list" size={17} /><span className="hidden sm:inline">Chapters</span></button>
          <button className={tool(panel === 'ai')} onClick={() => setPanel(panel === 'ai' ? '' : 'ai')} aria-label="Summary, notes and translation"><Icon name="spark" size={17} /><span className="hidden sm:inline">Assist</span></button>
          <button className={tool(panel === 'text')} onClick={() => setPanel(panel === 'text' ? '' : 'text')} aria-label="Text settings"><Icon name="type" size={17} /><span className="hidden sm:inline">Text</span></button>
        </div>
      </div>

      {limit && <div className="mb-6"><LimitBanner message={limit} /></div>}
      {err && <p role="alert" className="mb-6 border-l-2 border-danger bg-panel px-4 py-3 text-sm text-danger">{err}</p>}

      {panel === 'chapters' && (
        <div className="mb-8 max-h-64 overflow-y-auto border-y border-line">
          {chapters.map((c, i) => (
            <button key={i} onClick={() => { jump(c.sentenceIndex); setPanel(''); }} className="block w-full truncate border-b border-line px-1 py-3 text-left text-sm last:border-b-0 hover:text-mark">{c.title}</button>
          ))}
        </div>
      )}

      {panel === 'text' && (
        <div className="mb-8 grid gap-5 border-y border-line py-5 text-sm sm:grid-cols-2">
          <label className="block">Theme
            <select className="input mt-1.5" value={settings.theme} onChange={(e) => update({ theme: e.target.value as any })}><option value="dark">Night</option><option value="light">Light</option></select>
          </label>
          <label className="block">Font
            <select className="input mt-1.5" value={settings.font} onChange={(e) => update({ font: e.target.value as any })}><option value="serif">Book serif</option><option value="sans">Clean sans</option><option value="dyslexic">Dyslexia friendly</option></select>
          </label>
          <label className="flex items-start gap-3 sm:col-span-2">
            <input type="checkbox" className="mt-1" checked={settings.cleanText} onChange={(e) => update({ cleanText: e.target.checked })} />
            <span>Skip citations and web addresses<span className="block text-mute">Leaves out markers like [12] and says “link” instead of spelling out a URL.</span></span>
          </label>
          <label className="block sm:col-span-2">Text size, {settings.size}px
            <input type="range" min={14} max={36} value={settings.size} onChange={(e) => update({ size: +e.target.value })} className="mt-2 w-full" />
          </label>
        </div>
      )}

      {panel === 'ai' && (
        <div className="mb-8 space-y-4 border-y border-line py-5 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn btn-quiet" onClick={() => runAi('summary')}>{ai.busy === 'summary' ? 'Working' : 'Summarise'}{!premium && <Icon name="lock" size={14} />}</button>
            <button className="btn btn-quiet" onClick={() => runAi('notes')}>{ai.busy === 'notes' ? 'Working' : 'Notes from what I heard'}{!premium && <Icon name="lock" size={14} />}</button>
            <select className="input !w-auto" value={lang} onChange={(e) => translate(e.target.value)} aria-label="Translate and read in another language">
              <option value="">Translate and read</option>
              {Object.entries(LANGUAGES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            {ai.busy === 'translate' && <span className="text-mute">Translating</span>}
          </div>
          {(ai.summary || doc.summary) && <div><div className="mb-1 font-semibold">Summary</div><p className="whitespace-pre-wrap text-mute">{ai.summary || doc.summary}</p></div>}
          {(ai.notes || doc.notes) && <div><div className="mb-1 font-semibold">Notes</div><p className="whitespace-pre-wrap text-mute">{ai.notes || doc.notes}</p></div>}
        </div>
      )}

      <article className={`${fontClass} leading-[1.75]`} style={{ fontSize: settings.size }}>
        {paras.map((p) => (
          <p key={p.first} className="mb-[1.1em]">
            {p.s.map((s, k) => {
              const i = p.first + k;
              return <span key={i} id={'s' + i} onClick={() => jump(i)} className={`sent ${i === idx ? 'active' : ''}`}>{s.text}{' '}</span>;
            })}
          </p>
        ))}
      </article>

      {/* Player */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-panel/95 backdrop-blur">
        {panel === 'voices' && (
          <div className="mx-auto max-h-[55vh] max-w-2xl overflow-y-auto border-b border-line px-5 py-4">
            <VoicePicker value={settings.voice} premium={premium} token={acct.token} custom={settings.customVoices} elevenKey={settings.elevenKey}
              onChange={(v) => { stop(); update({ voice: v }); }} onLocked={() => setLimit('That voice is a Premium voice.')} />
          </div>
        )}
        <div className="mx-auto max-w-2xl px-5 pb-4 pt-3">
          <input type="range" className="scrub" min={0} max={total} value={idx} style={{ ['--p' as any]: `${pct}%` }} onChange={(e) => jump(+e.target.value)} aria-label="Progress" />
          <div className="mt-1 flex items-center justify-between gap-3">
            <button className="btn btn-quiet !px-3 !py-2" onClick={() => setPanel(panel === 'voices' ? '' : 'voices')} aria-expanded={panel === 'voices'}><Icon name="mic" size={16} />{voiceName}</button>
            <div className="flex items-center gap-2">
              <button className="p-2 text-mute transition-colors hover:text-fg" onClick={() => skip(-10)} aria-label="Back 10 seconds"><Skip dir="back" /></button>
              <button onClick={toggle} aria-label={playing ? 'Pause' : 'Play'} className="grid h-16 w-16 place-items-center rounded-full bg-mark text-onmark transition hover:brightness-110">
                {loading ? <span className="spin" /> : playing ? <PauseIcon size={26} /> : <PlayIcon size={26} />}
              </button>
              <button className="p-2 text-mute transition-colors hover:text-fg" onClick={() => skip(10)} aria-label="Forward 10 seconds"><Skip dir="fwd" /></button>
            </div>
            <select className="rounded-lg border border-line bg-panel2 px-2.5 py-2 text-sm" value={settings.speed} onChange={(e) => update({ speed: +e.target.value })} aria-label="Speed">
              {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 3, 3.5].map((s) => (
                <option key={s} value={s} disabled={s > maxSpeed}>{s}x{s > FREE_LIMITS.maxSpeed && !premium ? ' (Premium)' : ''}</option>
              ))}
            </select>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-mute">
            <span className="tabular-nums">{fmtTime(time.cur)} / {fmtTime(time.dur)}<span className="ml-3 hidden lg:inline">Space plays, arrows skip, J and K change sentence, [ and ] change speed</span></span>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <select className="rounded-md border border-line bg-panel2 px-1.5 py-0.5 text-xs text-mute" value={sleepMin} onChange={(e) => setSleepMin(+e.target.value)} aria-label="Sleep timer">
                <option value={0}>Sleep timer off</option>
                {[10, 15, 30, 45, 60].map((m) => <option key={m} value={m}>Stop in {m} min</option>)}
              </select>
              <button className={sm} onClick={downloadMp3}><Icon name="download" size={14} />{dl || 'MP3'}</button>
              <button className={sm} onClick={() => (premium ? update({ smartSpeed: !settings.smartSpeed }) : setLimit('Smart Speed is a Premium feature.'))}><Icon name="bolt" size={14} />Smart Speed {settings.smartSpeed && premium ? 'on' : 'off'}{!premium && <Icon name="lock" size={12} />}</button>
              <button className={sm} onClick={() => (premium ? saveOffline() : setLimit('Offline listening is a Premium feature.'))}><Icon name="save" size={14} />{offlineMsg || 'Offline'}{!premium && !offlineMsg && <Icon name="lock" size={12} />}</button>
              <button className={sm} onClick={shareAudio}><Icon name="share" size={14} />Share{!premium && <Icon name="lock" size={12} />}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
