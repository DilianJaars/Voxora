'use client';
import { useRef, useState } from 'react';
import { VOICES } from '@/lib/voices';
import type { Settings } from '@/lib/store';

type Props = {
  value: string;
  premium: boolean;
  token?: string;
  custom: Settings['customVoices'];
  elevenKey?: string;
  onChange: (id: string) => void;
  onLocked: () => void;
};

const FILTERS = ['All', 'Female', 'Male', 'US', 'UK', 'AU', 'ZA'] as const;

export default function VoicePicker({ value, premium, token, custom, elevenKey, onChange, onLocked }: Props) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');
  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  const list = VOICES.filter((v) => filter === 'All' || v.gender === filter || v.accent === filter);

  async function preview(id: string, body: Record<string, unknown>) {
    audio.current?.pause();
    setPlaying(id);
    try {
      const r = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ text: 'Paste anything. Listen to anything.', preview: true, ...body }),
      });
      if (!r.ok) throw new Error();
      const a = new Audio(URL.createObjectURL(await r.blob()));
      audio.current = a;
      a.onended = () => setPlaying(null);
      await a.play();
    } catch { setPlaying(null); }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-full border px-3 py-1 text-xs ${filter === f ? 'border-brand bg-brand/20 text-white' : 'border-line text-zinc-400'}`}>{f}</button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {custom.map((c) => (
          <div key={c.id} onClick={() => onChange('custom:' + c.id)} className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 ${value === 'custom:' + c.id ? 'border-brand bg-brand/10' : 'border-line bg-panel2'}`}>
            <div><div className="font-semibold">{c.name} <span className="text-xs text-brand-soft">cloned</span></div><div className="text-xs text-zinc-400">Your cloned voice</div></div>
            <button className="btn btn-ghost !px-3 !py-1.5" onClick={(e) => { e.stopPropagation(); preview('c' + c.id, { elevenVoiceId: c.id, elevenKey }); }}>{playing === 'c' + c.id ? '…' : '▶'}</button>
          </div>
        ))}
        {list.map((v) => {
          const locked = !v.free && !premium;
          return (
            <div key={v.id} onClick={() => (locked ? onLocked() : onChange(v.id))}
              className={`flex cursor-pointer items-center justify-between gap-2 rounded-xl border p-3 transition ${value === v.id ? 'border-brand bg-brand/10' : 'border-line bg-panel2 hover:border-zinc-600'}`}>
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-semibold">
                  {v.name}
                  <span className="rounded bg-zinc-700/60 px-1.5 py-0.5 text-[10px] font-medium text-zinc-300">{v.accent} · {v.gender[0]}</span>
                  {locked ? <span title="Premium">🔒</span> : v.free ? <span className="text-[10px] text-emerald-400">FREE</span> : null}
                </div>
                <div className="truncate text-xs text-zinc-400">{v.style}</div>
              </div>
              <button className="btn btn-ghost !px-3 !py-1.5" aria-label={`Preview ${v.name}`} onClick={(e) => { e.stopPropagation(); preview(v.id, { voice: v.id }); }}>{playing === v.id ? '…' : '▶'}</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
