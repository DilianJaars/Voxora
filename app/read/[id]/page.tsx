'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { addUsage, Doc, getDoc, getSettings, getUsage, saveDoc, Settings, setSettings } from '@/lib/store';
import { syncDoc } from '@/lib/sync';
import { chunkSentences, detectChapters, estimateSeconds, fmtTime, splitSentences } from '@/lib/text';
import { FREE_LIMITS } from '@/lib/plans';
import { getVoice, LANGUAGES, VOICES } from '@/lib/voices';
import { useAccount } from '@/lib/useEntitlement';
import { supabaseBrowser } from '@/lib/supabase';
import VoicePicker from '@/components/VoicePicker';
import LimitBanner from '@/components/LimitBanner';

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
      const body: any = { text: c.text, voice: settings.voice, compact: premium && settings.smartSpeed, language: lang || undefined };
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
  }, [settings.voice, settings.smartSpeed, settings.elevenKey, premium, lang, acct.token, id]);

  // reset audio cache when the voice/language changes
  useEffect(() => { cache.current.clear(); }, [settings.voice, settings.smartSpeed, lang]);

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
      setOfflineMsg('Link copied ✓');
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
      setOfflineMsg('Saved for offline listening ✓');
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

  if (!doc) return <div className="grid min-h-[60vh] place-items-center text-zinc-400">Loading…</div>;

  const fontClass = settings.font === 'serif' ? 'font-[Lora,serif]' : settings.font === 'dyslexic' ? 'font-dyslexic tracking-wide' : 'font-sans';
  const paras = (() => {
    const out: { s: typeof sentences; first: number }[] = [];
    sentences.forEach((s, i) => { const last = out[out.length - 1]; if (last && last.s[0].para === s.para) last.s.push(s); else out.push({ s: [s], first: i }); });
    return out;
  })();
  const remaining = estimateSeconds(sentences.slice(idx).map((s) => s.text).join(' '), settings.speed);
  const pct = sentences.length ? Math.round((idx / sentences.length) * 100) : 0;
  const voiceName = isCustom ? settings.customVoices.find((c) => 'custom:' + c.id === settings.voice)?.name || 'Custom' : getVoice(settings.voice)?.name;

  return (
    <div className="mx-auto max-w-3xl px-4 pb-64 pt-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold">{doc.title}</h1>
          <p className="text-xs text-zinc-400">{pct}% · {fmtTime(remaining)} left{lang ? ` · ${LANGUAGES[lang].label}` : ''}</p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          <button className="btn btn-ghost !px-3 !py-1.5" onClick={() => setPanel(panel === 'chapters' ? '' : 'chapters')}>☰ Chapters</button>
          <button className="btn btn-ghost !px-3 !py-1.5" onClick={() => setPanel(panel === 'ai' ? '' : 'ai')}>✨ AI</button>
          <button className="btn btn-ghost !px-3 !py-1.5" onClick={() => setPanel(panel === 'text' ? '' : 'text')}>Aa</button>
        </div>
      </div>

      {limit && <div className="mb-4"><LimitBanner message={limit} /></div>}
      {err && <p className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{err}</p>}

      {panel === 'chapters' && (
        <div className="card mb-4 max-h-64 space-y-1 overflow-y-auto">
          {chapters.map((c, i) => (
            <button key={i} onClick={() => { jump(c.sentenceIndex); setPanel(''); }} className="block w-full truncate rounded-lg px-3 py-2 text-left text-sm hover:bg-panel2">{c.title}</button>
          ))}
        </div>
      )}

      {panel === 'text' && (
        <div className="card mb-4 grid gap-4 text-sm sm:grid-cols-2">
          <label>Theme
            <select className="input mt-1" value={settings.theme} onChange={(e) => update({ theme: e.target.value as any })}><option value="dark">Night mode</option><option value="light">Light</option></select>
          </label>
          <label>Font
            <select className="input mt-1" value={settings.font} onChange={(e) => update({ font: e.target.value as any })}><option value="sans">Clean sans</option><option value="serif">Book serif</option><option value="dyslexic">Dyslexia-friendly</option></select>
          </label>
          <label className="sm:col-span-2">Text size: {settings.size}px
            <input type="range" min={14} max={36} value={settings.size} onChange={(e) => update({ size: +e.target.value })} className="mt-1 w-full" />
          </label>
        </div>
      )}

      {panel === 'ai' && (
        <div className="card mb-4 space-y-3 text-sm">
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-ghost" onClick={() => runAi('summary')}>{ai.busy === 'summary' ? '…' : '📝 Summarise'}{!premium && ' 🔒'}</button>
            <button className="btn btn-ghost" onClick={() => runAi('notes')}>{ai.busy === 'notes' ? '…' : '🗒 Notes from what I heard'}{!premium && ' 🔒'}</button>
            <select className="input !w-auto" value={lang} onChange={(e) => translate(e.target.value)}>
              <option value="">🌍 Translate & read…</option>
              {Object.entries(LANGUAGES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            {ai.busy === 'translate' && <span className="self-center text-zinc-400">Translating…</span>}
          </div>
          {(ai.summary || doc.summary) && <div><div className="mb-1 font-semibold">Summary</div><p className="whitespace-pre-wrap text-zinc-300">{ai.summary || doc.summary}</p></div>}
          {(ai.notes || doc.notes) && <div><div className="mb-1 font-semibold">Notes</div><p className="whitespace-pre-wrap text-zinc-300">{ai.notes || doc.notes}</p></div>}
        </div>
      )}

      <article className={`${fontClass} leading-relaxed`} style={{ fontSize: settings.size }}>
        {paras.map((p) => (
          <p key={p.first} className="mb-5">
            {p.s.map((s, k) => {
              const i = p.first + k;
              return <span key={i} id={'s' + i} onClick={() => jump(i)} className={`sent ${i === idx ? 'active' : ''}`}>{s.text}{' '}</span>;
            })}
          </p>
        ))}
      </article>

      {/* Player bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-panel/95 backdrop-blur">
        {panel === 'voices' && (
          <div className="mx-auto max-h-[55vh] max-w-3xl overflow-y-auto border-b border-line p-4">
            <VoicePicker value={settings.voice} premium={premium} token={acct.token} custom={settings.customVoices} elevenKey={settings.elevenKey}
              onChange={(v) => { stop(); update({ voice: v }); }} onLocked={() => setLimit('That voice is a Premium voice.')} />
          </div>
        )}
        <div className="mx-auto max-w-3xl px-4 py-3">
          <input type="range" min={0} max={Math.max(1, sentences.length - 1)} value={idx} onChange={(e) => jump(+e.target.value)} className="w-full" aria-label="Progress" />
          <div className="mt-1 flex items-center justify-between gap-2">
            <button className="btn btn-ghost !px-3 !py-2" onClick={() => setPanel(panel === 'voices' ? '' : 'voices')}>🎙 {voiceName}</button>
            <div className="flex items-center gap-3">
              <button className="btn btn-ghost !px-3" onClick={() => skip(-10)} aria-label="Back 10 seconds">⏪ 10</button>
              <button onClick={toggle} aria-label={playing ? 'Pause' : 'Play'} className="grid h-16 w-16 place-items-center rounded-full bg-brand text-2xl text-white shadow-[0_8px_30px_-6px_rgba(139,92,246,.9)] transition active:scale-95">
                {loading ? <span className="animate-spin">◌</span> : playing ? '❚❚' : '▶'}
              </button>
              <button className="btn btn-ghost !px-3" onClick={() => skip(10)} aria-label="Forward 10 seconds">10 ⏩</button>
            </div>
            <div className="flex items-center gap-1">
              <select className="rounded-full border border-line bg-panel2 px-2 py-2 text-sm" value={settings.speed} onChange={(e) => update({ speed: +e.target.value })} aria-label="Speed">
                {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 3, 3.5].map((s) => (
                  <option key={s} value={s} disabled={s > maxSpeed}>{s}x{s > FREE_LIMITS.maxSpeed && !premium ? ' 🔒' : ''}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
            <span>{fmtTime(time.cur)} / {fmtTime(time.dur)}</span>
            <div className="flex flex-wrap gap-2">
              <button className="hover:text-white" onClick={downloadMp3}>{dl || '⬇ MP3'}</button>
              <button className="hover:text-white" onClick={() => (premium ? update({ smartSpeed: !settings.smartSpeed }) : setLimit('Smart Speed is a Premium feature.'))}>⚡ Smart Speed {settings.smartSpeed && premium ? 'on' : 'off'}{!premium && ' 🔒'}</button>
              <button className="hover:text-white" onClick={() => (premium ? saveOffline() : setLimit('Offline listening is a Premium feature.'))}>{offlineMsg || `📴 Offline${premium ? '' : ' 🔒'}`}</button>
              <button className="hover:text-white" onClick={shareAudio}>🔗 Share{!premium && ' 🔒'}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
