'use client';
import { useEffect, useRef, useState } from 'react';
import { Bars, PauseIcon, PlayIcon } from './Icons';

const SENTENCES = [
  'The meeting notes are due on Friday.',
  'Instead of reading them on the train, paste them in and listen on the way.',
  'Voxora highlights each sentence as it is read, so you never lose your place.',
  'Pick up where you stopped, on any device.',
];

// The hero: a working reader. It idles by moving the highlight on its own; press Listen to hear the real voice.
export default function LiveDemo() {
  const [i, setI] = useState(0);
  const [audio, setAudio] = useState<'idle' | 'loading' | 'playing'>('idle');
  const [failed, setFailed] = useState(false);
  const run = useRef(0);
  const el = useRef<HTMLAudioElement | null>(null);

  // Silent idle loop, until the person presses Listen
  useEffect(() => {
    if (audio !== 'idle') return;
    const t = setInterval(() => setI((x) => (x + 1) % SENTENCES.length), 2600);
    return () => clearInterval(t);
  }, [audio]);

  async function listen() {
    if (audio !== 'idle') { run.current++; el.current?.pause(); setAudio('idle'); return; }
    const token = ++run.current;
    setFailed(false); setAudio('loading');
    try {
      for (let k = 0; k < SENTENCES.length; k++) {
        if (run.current !== token) return;
        const r = await fetch('/api/tts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: SENTENCES[k], voice: 'jenny', preview: true }) });
        if (!r.ok) throw new Error('tts');
        const url = URL.createObjectURL(await r.blob());
        if (run.current !== token) return;
        const a = (el.current = new Audio(url));
        setI(k);
        await a.play();
        setAudio('playing');
        await new Promise<void>((res) => { a.onended = () => res(); a.onerror = () => res(); });
      }
      if (run.current === token) { setAudio('idle'); setI(0); }
    } catch {
      if (run.current === token) { setFailed(true); setAudio('idle'); }
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-panel">
      <div className="flex items-center justify-between border-b border-line px-5 py-3 text-sm text-mute">
        <span>Meeting notes</span>
        <span className="flex items-center gap-2"><Bars live={audio === 'playing'} className="text-mark" />Jenny, US English</span>
      </div>
      <p className="px-5 py-6 font-read text-[1.4rem] leading-[1.65] sm:px-7 sm:text-[1.55rem]" aria-live="off">
        {SENTENCES.map((s, k) => (
          <span key={k} className={`sent ${k === i ? 'active' : ''}`}>{s}{' '}</span>
        ))}
      </p>
      <div className="flex items-center gap-4 border-t border-line px-5 py-4">
        <button onClick={listen} aria-label={audio === 'idle' ? 'Hear this read aloud' : 'Stop'}
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-mark text-onmark transition hover:brightness-110">
          {audio === 'loading' ? <span className="spin" /> : audio === 'playing' ? <PauseIcon size={20} /> : <PlayIcon size={20} />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="h-1 rounded bg-line"><div className="h-1 rounded bg-mark transition-all duration-500" style={{ width: `${((i + 1) / SENTENCES.length) * 100}%` }} /></div>
          <p className="mt-2 text-xs text-mute">{failed ? 'Audio is not available right now. Try again in a moment.' : audio === 'idle' ? 'Press play to hear it in a real voice' : 'Reading aloud'}</p>
        </div>
      </div>
    </div>
  );
}
