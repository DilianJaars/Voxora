'use client';
import { useEffect, useState } from 'react';
import { getSettings, Settings, setSettings } from '@/lib/store';
import { useAccount } from '@/lib/useEntitlement';
import { PLAN } from '@/lib/plans';
import Link from 'next/link';

export default function SettingsPage() {
  const acct = useAccount();
  const [s, setS] = useState<Settings>(getSettings());
  const [name, setName] = useState('My voice');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [ref, setRef] = useState<{ code?: string; friends?: number }>({});
  const upd = (p: Partial<Settings>) => setS(setSettings(p));

  useEffect(() => {
    if (!acct.token) return;
    fetch('/api/referral', { headers: { authorization: `Bearer ${acct.token}` } }).then((r) => r.json()).then(setRef).catch(() => {});
  }, [acct.token]);

  async function clone(file: File) {
    setMsg('');
    if (!acct.ent.premium) return setMsg('Voice cloning is a Premium feature.');
    setBusy(true);
    const fd = new FormData();
    fd.append('sample', file); fd.append('name', name); if (s.elevenKey) fd.append('elevenKey', s.elevenKey);
    const r = await fetch('/api/voice-clone', { method: 'POST', headers: acct.token ? { authorization: `Bearer ${acct.token}` } : {}, body: fd });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) return setMsg(j.error || 'Cloning failed');
    upd({ customVoices: [...s.customVoices, { id: j.id, name: j.name, provider: 'elevenlabs' }], voice: 'custom:' + j.id });
    setMsg(`Cloned "${j.name}" ✓ It's selected as your voice.`);
  }

  const link = ref.code && typeof location !== 'undefined' ? `${location.origin}/login?ref=${ref.code}` : '';

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <h1 className="text-3xl font-extrabold">Settings</h1>

      <section className="card space-y-3">
        <h2 className="font-bold">Voice engine</h2>
        <p className="text-sm text-zinc-400">Voxora uses Edge TTS by default — free, no key needed. Add an ElevenLabs API key to use your own premium engine and cloned voices.</p>
        <input className="input" type="password" placeholder="ElevenLabs API key (optional)" value={s.elevenKey || ''} onChange={(e) => upd({ elevenKey: e.target.value })} />
        <p className="text-xs text-zinc-500">Stored only in this browser.</p>
      </section>

      <section className="card space-y-3">
        <h2 className="font-bold">🧬 Clone a voice {!acct.ent.premium && <span className="text-xs text-brand-soft">Premium</span>}</h2>
        <p className="text-sm text-zinc-400">Upload a clean 10+ second sample of the voice (only voices you have permission to clone). Requires an ElevenLabs key.</p>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name this voice" />
        <input type="file" accept="audio/*" disabled={busy} onChange={(e) => e.target.files?.[0] && clone(e.target.files[0])} className="text-sm" />
        {busy && <p className="animate-pulse text-sm text-brand-glow">Cloning…</p>}
        {msg && <p className="text-sm text-amber-300">{msg}</p>}
        {s.customVoices.length > 0 && (
          <ul className="space-y-1 text-sm">{s.customVoices.map((c) => (
            <li key={c.id} className="flex justify-between"><span>{c.name}</span><button className="text-zinc-500 hover:text-red-400" onClick={() => upd({ customVoices: s.customVoices.filter((x) => x.id !== c.id) })}>remove</button></li>
          ))}</ul>
        )}
      </section>

      <section className="card space-y-3">
        <h2 className="font-bold">🎁 Refer a friend — get 1 month Premium free</h2>
        {acct.email ? (
          <>
            <p className="text-sm text-zinc-400">When a friend signs up with your link, you both win: they get {PLAN.trialMonths} free months and you get 1 more month.</p>
            <div className="flex gap-2"><input readOnly className="input" value={link} /><button className="btn btn-primary" onClick={() => navigator.clipboard.writeText(link)}>Copy</button></div>
            <p className="text-xs text-zinc-500">Friends joined: {ref.friends ?? 0}</p>
          </>
        ) : <p className="text-sm text-zinc-400"><Link className="underline" href="/login">Create a free account</Link> to get your referral link.</p>}
      </section>

      <section className="card space-y-1 text-sm">
        <h2 className="font-bold">Account</h2>
        {acct.email ? (
          <p className="text-zinc-400">{acct.email} · {acct.ent.source === 'paid' ? 'Premium' : acct.ent.source === 'trial' ? `Free trial (${acct.ent.daysLeft} days left)` : acct.ent.source === 'referral' ? `Referral bonus (${acct.ent.daysLeft} days left)` : 'Free plan'}</p>
        ) : <p className="text-zinc-400">Not signed in.</p>}
      </section>
    </div>
  );
}
