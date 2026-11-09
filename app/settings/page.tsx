'use client';
import { useEffect, useState } from 'react';
import { getSettings, Settings, setSettings } from '@/lib/store';
import { useAccount } from '@/lib/useEntitlement';
import { PLAN } from '@/lib/plans';
import Link from 'next/link';
import { Icon } from '@/components/Icons';

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
    setMsg(`Cloned "${j.name}". It is now your selected voice.`);
  }

  const link = ref.code && typeof location !== 'undefined' ? `${location.origin}/login?ref=${ref.code}` : '';

  return (
    <div className="mx-auto max-w-2xl px-5 py-12 sm:py-16">
      <h1 className="mb-4 text-3xl font-extrabold tracking-tight sm:text-4xl">Settings</h1>

      <section className="space-y-3 border-t border-line py-8">
        <h2 className="text-lg font-bold">Voice engine</h2>
        <p className="text-sm text-mute">Voxora uses Edge TTS by default — free, no key needed. Add an ElevenLabs API key to use your own premium engine and cloned voices.</p>
        <input className="input" type="password" placeholder="ElevenLabs API key (optional)" value={s.elevenKey || ''} onChange={(e) => upd({ elevenKey: e.target.value })} />
        <p className="text-xs text-mute">Saved only in this browser.</p>
      </section>

      <section className="space-y-3 border-t border-line py-8">
        <h2 className="text-lg font-bold">Clone a voice {!acct.ent.premium && <span className="ml-1 inline-flex items-center gap-1 text-xs font-normal text-mute"><Icon name="lock" size={12} />Premium</span>}</h2>
        <p className="text-sm text-mute">Upload a clean 10+ second sample of the voice (only voices you have permission to clone). Requires an ElevenLabs key.</p>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name this voice" />
        <input type="file" accept="audio/*" disabled={busy} onChange={(e) => e.target.files?.[0] && clone(e.target.files[0])} className="text-sm" />
        {busy && <p className="text-sm text-mute">Cloning</p>}
        {msg && <p className="text-sm text-mute">{msg}</p>}
        {s.customVoices.length > 0 && (
          <ul className="space-y-1 text-sm">{s.customVoices.map((c) => (
            <li key={c.id} className="flex justify-between"><span>{c.name}</span><button className="text-mute hover:text-danger" onClick={() => upd({ customVoices: s.customVoices.filter((x) => x.id !== c.id) })}>remove</button></li>
          ))}</ul>
        )}
      </section>

      <section className="space-y-3 border-t border-line py-8">
        <h2 className="text-lg font-bold">Refer a friend and get 1 month of Premium</h2>
        {acct.email ? (
          <>
            <p className="text-sm text-mute">When a friend signs up with your link, you both win: they get {PLAN.trialMonths} free months and you get 1 more month.</p>
            <div className="flex gap-2"><input readOnly className="input" value={link} /><button className="btn btn-quiet" onClick={() => navigator.clipboard.writeText(link)}>Copy link</button></div>
            <p className="text-xs text-mute">Friends who joined: {ref.friends ?? 0}</p>
          </>
        ) : <p className="text-sm text-mute"><Link className="underline" href="/login">Create a free account</Link> to get your referral link.</p>}
      </section>

      <section className="space-y-1 border-t border-line py-8 text-sm">
        <h2 className="text-lg font-bold">Account</h2>
        {acct.email ? (
          <p className="text-mute">{acct.email} · {acct.ent.source === 'paid' ? 'Premium' : acct.ent.source === 'trial' ? `Free trial (${acct.ent.daysLeft} days left)` : acct.ent.source === 'referral' ? `Referral bonus (${acct.ent.daysLeft} days left)` : 'Free plan'}</p>
        ) : <p className="text-mute">Not signed in.</p>}
      </section>
    </div>
  );
}
