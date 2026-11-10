'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useAccount } from '@/lib/useEntitlement';
import { getSettings, setSettings } from '@/lib/store';
import { analyse, Analysis, decodeToMono, encodeWav } from '@/lib/voiceAnalysis';
import { syncMyVoices } from '@/lib/myvoices';
import { fmtTime } from '@/lib/text';
import LimitBanner from '@/components/LimitBanner';
import { Icon, PlayIcon } from '@/components/Icons';

// Varied on purpose: statements, a question, an exclamation, a list, numbers and local place names.
const SCRIPT = [
  'The quiet harbour woke slowly as the first boats slipped out into the morning light.',
  'Have you ever noticed how a good story can make an hour feel like a minute?',
  "I can't believe we actually made it, and honestly, it was worth every step!",
  'Please remember to bring your passport, two photographs, and a bottle of water.',
  'On Tuesday the market opens at seven, and by nine the best fruit is already gone.',
  'She paused, took a slow breath, and began to read the letter aloud.',
  'Numbers are easier to follow when you say them clearly: one hundred and twenty, three thousand, and forty-five.',
  'Wait, was that the right turn? No, keep going, the lake is just ahead.',
  'Cape Town, Johannesburg, Durban, and Gqeberha each have a rhythm all their own.',
  'Whatever you choose to listen to next, take your time and enjoy it.',
];

const verdictText = { good: 'Good', ok: 'Usable', poor: 'Needs another take' } as const;

export default function VoicePage() {
  const acct = useAccount();
  const [cfg, setCfg] = useState<{ available: boolean; maxVoices: number } | null>(null);
  const [mode, setMode] = useState<'record' | 'upload'>('record');
  const [rec, setRec] = useState<'idle' | 'recording'>('idle');
  const [secs, setSecs] = useState(0);
  const [level, setLevel] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState('');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [pcm, setPcm] = useState<{ samples: Float32Array; rate: number } | null>(null);
  const [name, setName] = useState('My voice');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ k: 'ok' | 'err'; t: string } | null>(null);
  const [done, setDone] = useState(false);
  const [hasKey, setHasKey] = useState(false);

  const mr = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const raf = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { setHasKey(Boolean(getSettings().elevenKey)); }, []);
  useEffect(() => {
    fetch('/api/voice-clone', { headers: acct.token ? { authorization: `Bearer ${acct.token}` } : {} }).then((r) => r.json()).then(setCfg).catch(() => {});
  }, [acct.token]);
  useEffect(() => () => { cleanup(); }, []);

  function cleanup() {
    cancelAnimationFrame(raf.current);
    if (timer.current) clearInterval(timer.current);
    stream.current?.getTracks().forEach((t) => t.stop());
  }

  async function startRecording() {
    setMsg(null); setBlob(null); setAnalysis(null); setPcm(null); setUrl(''); setDone(false);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false } });
      stream.current = s;
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new Ctx();
      const an = ctx.createAnalyser(); an.fftSize = 1024;
      ctx.createMediaStreamSource(s).connect(an);
      const buf = new Uint8Array(an.fftSize);
      const tick = () => {
        an.getByteTimeDomainData(buf);
        let peak = 0; for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i] - 128) / 128);
        setLevel(peak);
        raf.current = requestAnimationFrame(tick);
      };
      tick();
      chunks.current = [];
      const r = new MediaRecorder(s);
      mr.current = r;
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = async () => {
        ctx.close(); cleanup(); setLevel(0);
        await receive(new Blob(chunks.current, { type: r.mimeType || 'audio/webm' }));
      };
      r.start();
      setRec('recording'); setSecs(0);
      timer.current = setInterval(() => setSecs((x) => x + 1), 1000);
    } catch {
      setMsg({ k: 'err', t: 'The microphone is blocked. Allow microphone access for this site in your browser, then try again.' });
    }
  }
  function stopRecording() { setRec('idle'); mr.current?.stop(); }

  async function receive(b: Blob) {
    try {
      const d = await decodeToMono(b);
      setPcm(d); setBlob(b); setUrl(URL.createObjectURL(b)); setAnalysis(analyse(d.samples, d.rate));
    } catch {
      setMsg({ k: 'err', t: 'That audio could not be read. Try recording again, or upload an MP3, WAV or M4A file.' });
    }
  }

  async function create() {
    if (!pcm || !analysis) return;
    setBusy(true); setMsg(null);
    const fd = new FormData();
    fd.append('sample', encodeWav(pcm.samples, pcm.rate), 'voice.wav');
    fd.append('name', name); fd.append('consent', 'true'); fd.append('quality', JSON.stringify(analysis));
    const key = getSettings().elevenKey; if (key) fd.append('elevenKey', key);
    const r = await fetch('/api/voice-clone', { method: 'POST', headers: { authorization: `Bearer ${acct.token}` }, body: fd });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setMsg({ k: 'err', t: j.error === 'premium_required' ? 'Your own voice is a Premium feature.' : j.error || 'Something went wrong. Try again.' });
    await syncMyVoices();
    setSettings({ voice: 'custom:' + j.id });
    setDone(true);
    setMsg({ k: 'ok', t: `${j.name} is ready and selected as your reading voice.` });
  }

  const premium = acct.ent.premium;
  const engineMissing = cfg && !cfg.available && !hasKey;
  const canCreate = Boolean(analysis && analysis.verdict !== 'poor' && consent && name.trim() && premium && !engineMissing && acct.token);

  return (
    <div className="mx-auto max-w-2xl px-5 py-12 sm:py-16">
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">Read to me in my own voice</h1>
      <p className="mt-3 max-w-xl text-lg text-mute">Record a short script, we check the recording, and then your books and articles are read in a voice made from yours. It stays in your account and only you can use it.</p>

      {!acct.loading && !acct.email && <div className="mt-8"><LimitBanner message="Sign in first. Your voice is saved to your own account." /></div>}
      {acct.email && !premium && <div className="mt-8"><LimitBanner message="Reading in your own voice is a Premium feature." /></div>}
      {engineMissing && acct.email && premium && (
        <p className="mt-8 border-l-2 border-mark bg-panel px-4 py-3 text-sm">Voice making is not switched on for this site yet. You can use your own ElevenLabs key in <Link href="/settings" className="text-mark underline underline-offset-4">Settings</Link>, or ask the site owner to add one.</p>
      )}

      <div className="mt-10 inline-flex rounded-lg border border-line p-1 text-sm">
        {(['record', 'upload'] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)} className={`rounded-md px-4 py-2 transition-colors ${mode === m ? 'bg-mark font-semibold text-onmark' : 'text-mute hover:text-fg'}`}>{m === 'record' ? 'Record now' : 'Upload a recording'}</button>
        ))}
      </div>

      {mode === 'record' ? (
        <section className="mt-6">
          <p className="text-sm text-mute">Find a quiet room and hold your phone or microphone about a hand's width from your mouth. Read the whole script in your normal speaking voice, with feeling on the question and the exclamation.</p>
          <div className="mt-5 rounded-xl border border-line bg-panel p-5 font-read text-xl leading-[1.7] sm:p-7">
            {SCRIPT.map((s, i) => <span key={i}>{s} </span>)}
          </div>
          <div className="mt-6 flex items-center gap-5">
            {rec === 'idle' ? (
              <button onClick={startRecording} className="btn btn-primary !px-6 !py-3"><Icon name="mic" size={18} />{blob ? 'Record again' : 'Start recording'}</button>
            ) : (
              <button onClick={stopRecording} className="btn !px-6 !py-3 border border-danger text-danger hover:bg-danger/10">Stop</button>
            )}
            {rec === 'recording' && (
              <div className="flex flex-1 items-center gap-4" aria-live="off">
                <span className="tabular-nums text-lg">{fmtTime(secs)}</span>
                <div className="h-1.5 flex-1 rounded bg-line"><div className="h-1.5 rounded bg-mark transition-[width] duration-75" style={{ width: `${Math.min(100, level * 130)}%` }} /></div>
              </div>
            )}
          </div>
        </section>
      ) : (
        <section className="mt-6">
          <p className="text-sm text-mute">Upload a clear recording of the voice, 30 seconds or more, with no music or other people talking. MP3, WAV, M4A and WebM work.</p>
          <input type="file" accept="audio/*" className="mt-4 text-sm" onChange={(e) => e.target.files?.[0] && receive(e.target.files[0])} />
        </section>
      )}

      {analysis && blob && (
        <section className="mt-10 border-t border-line pt-8">
          <h2 className="text-xl font-bold tracking-tight">How the recording looks</h2>
          <div className="mt-4 flex items-end gap-5">
            <div className="text-6xl font-extrabold leading-none tabular-nums">{analysis.score}</div>
            <div className="pb-1"><div className="font-semibold">{verdictText[analysis.verdict]}</div><div className="text-sm text-mute">out of 100</div></div>
          </div>
          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
            <div><dt className="text-mute">Speech</dt><dd className="font-semibold tabular-nums">{analysis.speechSeconds} s</dd></div>
            <div><dt className="text-mute">Loudness</dt><dd className="font-semibold tabular-nums">{analysis.levelDb} dB</dd></div>
            <div><dt className="text-mute">Clearer than noise by</dt><dd className="font-semibold tabular-nums">{analysis.snrDb} dB</dd></div>
            <div><dt className="text-mute">Distortion</dt><dd className="font-semibold tabular-nums">{analysis.clipPct}%</dd></div>
          </dl>
          <ul className="mt-5 space-y-2 text-sm">{analysis.tips.map((t) => <li key={t} className="flex gap-2"><Icon name={analysis.verdict === 'good' ? 'check' : 'sliders'} size={16} className="mt-0.5 shrink-0 text-mark" />{t}</li>)}</ul>
          {url && <audio controls src={url} className="mt-6 w-full" />}

          <div className="mt-8 space-y-4">
            <label className="block text-sm">Name this voice<input className="input mt-1.5" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} /></label>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>This is my own voice, or the speaker has agreed that I can make a voice from it.</span>
            </label>
            <p className="text-sm text-mute">The recording is sent to ElevenLabs to build the voice, and a copy is kept privately in your account. Deleting the voice on your dashboard removes both.</p>
            <button onClick={create} disabled={!canCreate || busy} className="btn btn-primary !px-6 !py-3">{busy ? 'Making your voice' : 'Create my voice'}</button>
            {analysis.verdict === 'poor' && <p className="text-sm text-danger">Record again before creating the voice. The tips above say what to change.</p>}
          </div>
        </section>
      )}

      {msg && <p role={msg.k === 'err' ? 'alert' : 'status'} className={`mt-6 text-sm ${msg.k === 'err' ? 'text-danger' : 'text-ok'}`}>{msg.t}</p>}
      {done && <div className="mt-6 flex flex-wrap gap-3"><Link href="/app" className="btn btn-primary"><PlayIcon size={14} />Read something in my voice</Link><Link href="/dashboard" className="btn btn-quiet">See it on my dashboard</Link></div>}
    </div>
  );
}
