'use client';
import { useRef, useState } from 'react';
import { VOICES } from '@/lib/voices';
import { PlayIcon } from './Icons';

const ACCENT: Record<string, string> = { US: 'American', UK: 'British', AU: 'Australian', ZA: 'South African' };

export default function LandingVoices() {
  const [busy, setBusy] = useState<string | null>(null);
  const a = useRef<HTMLAudioElement | null>(null);
  const free = VOICES.filter((v) => v.free);

  async function preview(id: string) {
    a.current?.pause();
    setBusy(id);
    try {
      const r = await fetch('/api/tts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: 'Paste anything. Listen to anything.', voice: id, preview: true }) });
      if (!r.ok) throw new Error();
      const el = (a.current = new Audio(URL.createObjectURL(await r.blob())));
      el.onended = () => setBusy(null);
      await el.play();
    } catch { setBusy(null); }
  }

  return (
    <ul>
      {free.map((v) => (
        <li key={v.id} className="flex items-center gap-4 border-t border-line py-4 last:border-b">
          <button onClick={() => preview(v.id)} aria-label={`Hear ${v.name}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line text-fg transition-colors hover:border-mark hover:text-mark">
            {busy === v.id ? <span className="spin !h-4 !w-4" /> : <PlayIcon size={16} />}
          </button>
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{v.name}</div>
            <div className="truncate text-sm text-mute">{v.style}</div>
          </div>
          <div className="text-right text-sm text-mute">{ACCENT[v.accent]}<br />{v.gender}</div>
        </li>
      ))}
    </ul>
  );
}
