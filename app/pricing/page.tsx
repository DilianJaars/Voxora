'use client';
import Link from 'next/link';
import { useState } from 'react';
import { PLAN } from '@/lib/plans';
import { useAccount } from '@/lib/useEntitlement';
import { startFreePremium } from '@/lib/trial';
import { Icon } from '@/components/Icons';

const FREE = ['5 natural voices (American, British, South African)', '30 minutes of listening a day', '2 MP3 downloads a day', '3 web, YouTube or photo imports a day', 'Speed up to 2.5x', 'A library of 10 documents', 'Night mode and a dyslexia friendly font'];
const PREMIUM = ['Unlimited listening', 'All 24 voices, including Australian', 'Your own voice: record a short script and have books read in it', 'Unlimited MP3 downloads', 'Unlimited library and file size', 'Unlimited web, YouTube and photo imports', 'Offline listening and background play', 'Speed up to 3.5x and Smart Speed', 'Summaries and notes', 'Translate and read in another language', 'Share a link to your audio'];

const List = ({ items }: { items: string[] }) => (
  <ul className="mt-6 space-y-3 text-sm">
    {items.map((f) => <li key={f} className="flex gap-3"><Icon name="check" size={16} className="mt-0.5 shrink-0 text-mark" />{f}</li>)}
  </ul>
);

export default function Pricing() {
  const acct = useAccount();
  const [yearly, setYearly] = useState(false);
  const [provider, setProvider] = useState<'payfast' | 'yoco' | 'stripe'>('payfast');
  const [showPay, setShowPay] = useState(false);
  const [msg, setMsg] = useState<{ k: 'ok' | 'err'; t: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [starting, setStarting] = useState(false);

  async function startFree() {
    setMsg(null); setStarting(true);
    const r = await startFreePremium();
    setStarting(false);
    setMsg(r.ok ? { k: 'ok', t: `Premium is on for ${PLAN.trialMonths} months. Add payment any time before it ends.` } : { k: 'err', t: r.error || 'Could not start free Premium.' });
  }

  async function checkout() {
    setMsg(null);
    if (!acct.token) { setMsg({ k: 'err', t: 'Create an account first. It takes seconds.' }); return; }
    setBusy(true);
    const r = await fetch('/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${acct.token}` }, body: JSON.stringify({ plan: yearly ? 'yearly' : 'monthly', provider }) });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) return setMsg({ k: 'err', t: j.error || 'Checkout failed. Try again.' });
    if (j.url) return void (location.href = j.url);
    if (j.form) {
      const f = document.createElement('form'); f.method = 'POST'; f.action = j.form.action;
      Object.entries(j.form.fields).forEach(([k, v]) => { const i = document.createElement('input'); i.type = 'hidden'; i.name = k; i.value = String(v); f.appendChild(i); });
      document.body.appendChild(f); f.submit();
    }
  }

  const seg = (on: boolean) => `rounded-md px-4 py-2 text-sm transition-colors ${on ? 'bg-mark font-semibold text-onmark' : 'text-mute hover:text-fg'}`;
  const signedIn = Boolean(acct.email);
  const onTrial = acct.ent.source === 'trial';
  const offerFree = signedIn && acct.trialAvailable && !showPay;

  return (
    <div className="mx-auto max-w-5xl px-5 py-12 sm:py-16">
      <h1 className="max-w-xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">Everything for R{PLAN.monthlyZAR} a month</h1>
      <p className="mt-4 max-w-xl text-lg text-mute">Start Premium free for {PLAN.trialMonths} months with no card and no payment method. Add payment later, and we email you before the free period ends.</p>

      <div className="mt-8 inline-flex rounded-lg border border-line p-1">
        <button onClick={() => setYearly(false)} className={seg(!yearly)}>Monthly</button>
        <button onClick={() => setYearly(true)} className={seg(yearly)}>Yearly, save R{PLAN.monthlyZAR * 12 - PLAN.yearlyZAR}</button>
      </div>

      <div className="mt-10 grid gap-x-16 gap-y-12 md:grid-cols-2">
        <section>
          <h2 className="text-xl font-bold">Free</h2>
          <div className="mt-2 text-5xl font-extrabold tracking-tight">R0</div>
          <List items={FREE} />
          <Link href="/app" className="btn btn-quiet mt-8">Start listening</Link>
        </section>

        <section className="border-t-2 border-mark pt-6 md:border-l md:border-t-0 md:pl-16 md:pt-0 md:[border-left-color:rgb(var(--line))]">
          <h2 className="text-xl font-bold">Premium</h2>
          <div className="mt-2 text-5xl font-extrabold tracking-tight">R{yearly ? PLAN.yearlyZAR : PLAN.monthlyZAR}<span className="text-lg font-medium text-mute"> a {yearly ? 'year' : 'month'}</span></div>
          <List items={PREMIUM} />

          <div className="mt-8">
            {acct.ent.source === 'paid' ? (
              <p className="border-l-2 border-ok bg-panel px-4 py-3 text-sm">You have Premium until {new Date(acct.ent.endsAt!).toLocaleDateString()}.</p>
            ) : !signedIn ? (
              <>
                <Link href="/login" className="btn btn-primary w-full !py-3.5 text-base">Create an account to start free</Link>
                <p className="mt-3 text-sm text-mute">No card needed. You start Premium from your dashboard.</p>
              </>
            ) : offerFree ? (
              <>
                <button disabled={starting} onClick={startFree} className="btn btn-primary w-full !py-3.5 text-base">{starting ? 'Starting Premium' : `Start Premium free for ${PLAN.trialMonths} months`}</button>
                <p className="mt-3 text-sm text-mute">No card and no payment method. You pick how to pay later, and we remind you before it ends.</p>
                <button onClick={() => setShowPay(true)} className="btn-text mt-3">Pay now instead</button>
              </>
            ) : (
              <>
                {onTrial && <p className="mb-4 text-sm text-mute">Your free Premium has {acct.ent.daysLeft} days left and ends on {new Date(acct.ent.endsAt!).toLocaleDateString()}. Paying now is optional, and extends Premium from that date.</p>}
                <div className="mb-4 grid grid-cols-3 gap-1.5 text-xs">
                  {([['payfast', 'PayFast or SnapScan'], ['yoco', 'Card with Yoco'], ['stripe', 'International card']] as const).map(([k, l]) => (
                    <button key={k} onClick={() => setProvider(k)} aria-pressed={provider === k} className={`rounded-lg border px-2 py-2.5 transition-colors ${provider === k ? 'border-mark text-fg' : 'border-line text-mute hover:text-fg'}`}>{l}</button>
                  ))}
                </div>
                <button disabled={busy} onClick={checkout} className="btn btn-primary w-full !py-3.5 text-base">{busy ? 'Opening checkout' : onTrial ? 'Add payment now' : 'Upgrade to Premium'}</button>
                {showPay && acct.trialAvailable && <button onClick={() => setShowPay(false)} className="btn-text mt-3">Start free instead</button>}
              </>
            )}
            {msg && <p role={msg.k === 'err' ? 'alert' : 'status'} className={`mt-3 text-sm ${msg.k === 'err' ? 'text-danger' : 'text-ok'}`}>{msg.t}</p>}
          </div>
        </section>
      </div>
      <p className="mt-12 text-sm text-mute">Paid Premium unlocks the moment your payment clears. One free period per account.</p>
    </div>
  );
}
