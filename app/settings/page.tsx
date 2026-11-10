'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSettings, Settings, setSettings } from '@/lib/store';
import { useAccount } from '@/lib/useEntitlement';
import { PLAN } from '@/lib/plans';
import { Icon } from '@/components/Icons';

export default function SettingsPage() {
  const acct = useAccount();
  const [s, setS] = useState<Settings>(getSettings());
  const [ref, setRef] = useState<{ code?: string; friends?: number }>({});
  const upd = (p: Partial<Settings>) => setS(setSettings(p));

  useEffect(() => {
    if (!acct.token) return;
    fetch('/api/referral', { headers: { authorization: `Bearer ${acct.token}` } }).then((r) => r.json()).then(setRef).catch(() => {});
  }, [acct.token]);

  const link = ref.code && typeof location !== 'undefined' ? `${location.origin}/login?ref=${ref.code}` : '';

  return (
    <div className="mx-auto max-w-2xl px-5 py-12 sm:py-16">
      <h1 className="mb-4 text-3xl font-extrabold tracking-tight sm:text-4xl">Settings</h1>

      <section className="space-y-3 border-t border-line py-8">
        <h2 className="text-lg font-bold">Voice engine</h2>
        <p className="text-sm text-mute">Voxora uses Edge TTS by default. It is free and needs no key. If you have an ElevenLabs account, add its API key to make and use your own voice with your own allowance.</p>
        <input className="input" type="password" autoComplete="off" placeholder="ElevenLabs API key (optional)" value={s.elevenKey || ''} onChange={(e) => upd({ elevenKey: e.target.value })} />
        <p className="text-xs text-mute">Saved only in this browser.</p>
      </section>

      <section className="space-y-3 border-t border-line py-8">
        <h2 className="text-lg font-bold">Your own voice {!acct.ent.premium && <span className="ml-1 inline-flex items-center gap-1 text-xs font-normal text-mute"><Icon name="lock" size={12} />Premium</span>}</h2>
        <p className="text-sm text-mute">Record a short script, get it checked, and have your books and articles read in your voice. Your voices are managed from your dashboard.</p>
        <div className="flex flex-wrap gap-3"><Link href="/voice" className="btn btn-quiet"><Icon name="mic" size={16} />Record my voice</Link><Link href="/dashboard" className="btn btn-quiet">My voices</Link></div>
      </section>

      <section className="space-y-3 border-t border-line py-8">
        <h2 className="text-lg font-bold">Refer a friend and get 1 month of Premium</h2>
        {acct.email ? (
          <>
            <p className="text-sm text-mute">When a friend signs up with your link they get {PLAN.trialMonths} free months and you get 1 more month.</p>
            <div className="flex gap-2"><input readOnly className="input" value={link} aria-label="Your referral link" /><button className="btn btn-quiet" onClick={() => navigator.clipboard.writeText(link)}>Copy link</button></div>
            <p className="text-xs text-mute">Friends who joined: {ref.friends ?? 0}</p>
          </>
        ) : <p className="text-sm text-mute"><Link className="underline" href="/login">Create a free account</Link> to get your referral link.</p>}
      </section>

      <section className="space-y-1 border-t border-line py-8 text-sm">
        <h2 className="text-lg font-bold">Account</h2>
        {acct.email ? (
          <p className="text-mute">{acct.email}, {acct.ent.source === 'paid' ? 'Premium' : acct.ent.source === 'trial' ? `free trial (${acct.ent.daysLeft} days left)` : acct.ent.source === 'referral' ? `referral bonus (${acct.ent.daysLeft} days left)` : 'free plan'}. <Link href="/dashboard" className="text-mark underline underline-offset-4">Open dashboard</Link></p>
        ) : <p className="text-mute">Not signed in.</p>}
      </section>
    </div>
  );
}
