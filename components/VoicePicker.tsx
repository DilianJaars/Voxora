'use client';
import { useRef, useState } from 'react';
import { VOICES } from '@/lib/voices';
import type { Settings } from '@/lib/store';
import { Bars, Icon, PlayIcon } from './Icons';

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

  const row = (key: string, selected: boolean, onPick: () => void, content: React.ReactNode, previewBody: Record<string, unknown>) => (
    <li key={key} className={`flex items-center gap-3 border-t border-line py-3 pl-3 ${selected ? 'border-l-2 border-l-mark bg-panel2/60' : 'border-l-2 border-l-transparent'}`}>
      <button onClick={onPick} className="min-w-0 flex-1 text-left">{content}</button>
      <button className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line text-fg transition-colors hover:border-mark hover:text-mark" aria-label="Preview voice" onClick={() => preview(key, previewBody)}>
        {playing === key ? <Bars live className="text-mark !h-3.5" /> : <PlayIcon size={14} />}
      </button>
    </li>
  );

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f} className={`rounded-md px-2.5 py-1 text-xs transition-colors ${filter === f ? 'bg-mark text-onmark font-semibold' : 'text-mute hover:text-fg'}`}>{f}</button>
        ))}
      </div>
      <ul>
        {custom.map((c) => row('c' + c.id, value === 'custom:' + c.id, () => onChange('custom:' + c.id),
          <><div className="font-semibold">{c.name}</div><div className="text-xs text-mute">Your cloned voice</div></>, { elevenVoiceId: c.id, elevenKey }))}
        {list.map((v) => {
          const locked = !v.free && !premium;
          return row(v.id, value === v.id, () => (locked ? onLocked() : onChange(v.id)),
            <>
              <div className="flex items-center gap-2 font-semibold">
                {v.name}
                {locked && <Icon name="lock" size={13} className="text-mute" />}
                {v.free && <span className="text-xs font-normal text-ok">Free</span>}
              </div>
              <div className="truncate text-xs text-mute">{v.style}. {v.accent}, {v.gender.toLowerCase()}</div>
            </>, { voice: v.id });
        })}
      </ul>
      <a href="/voice" className="mt-3 inline-flex items-center gap-1.5 text-sm text-mark underline underline-offset-4"><Icon name="mic" size={14} />Record your own voice</a>
    </div>
  );
}
