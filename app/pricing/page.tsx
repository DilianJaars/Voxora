'use client';
import Link from 'next/link';
import { useState } from 'react';
import { PLAN } from '@/lib/plans';
import { useAccount } from '@/lib/useEntitlement';
import { Icon } from '@/components/Icons';

const FREE = ['5 natural voices (American, British, South African)', '30 minutes of listening a day', '2 MP3 downloads a day', '3 web, YouTube or photo imports a day', 'Speed up to 2.5x', 'A library of 10 documents', 'Night mode and a dyslexia friendly font'];
const PREMIUM = ['Unlimited listening', 'All 24 voices, including Australian', 'Voice cloning from a 10-second sample', 'Unlimited MP3 downloads', 'Unlimited library and file size', 'Unlimited web, YouTube and photo imports', 'Offline listening and background play', 'Speed up to 3.5x and Smart Speed', 'Summaries and notes', 'Translate and read in another language', 'Share a link to your audio'];

const List = ({ items }: { items: string[] }) => (
  <ul className="mt-6 space-y-3 text-sm">
    {items.map((f) => <li key={f} className="flex gap-3"><Icon name="check" size={16} className="mt-0.5 shrink-0 text-mark" />{f}</li>)}
  </ul>
);

export default function Pricing() {
  const acct = useAccount();
  const [yearly, setYearly] = useState(false);
  const [provider, setProvider] = useState<'payfast' | 'yoco' | 'stripe'>('payfast');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function checkout() {
    setMsg('');
    if (!acct.token) { setMsg('Create an account first. It takes seconds and starts your 2 free months.'); return; }
    setBusy(true);
    const r = await fetch('/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${acct.token}` }, body: JSON.stringify({ plan: yearly ? 'yearly' : 'monthly', provider }) });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) return setMsg(j.error || 'Checkout failed. Try again.');
    if (j.url) return void (location.href = j.url);
    if (j.form) {
      const f = document.createElement('form'); f.method = 'POST'; f.action = j.form.action;
      Object.entries(j.form.fields).forEach(([k, v]) => { const i = document.createElement('input'); i.type = 'hidden'; i.name = k; i.value = String(v); f.appendChild(i); });
      document.body.appendChild(f); f.submit();
    }
  }

  const seg = (on: boolean) => `rounded-md px-4 py-2 text-sm transition-colors ${on ? 'bg-mark font-semibold text-onmark' : 'text-mute hover:text-fg'}`;

  return (
    <div className="mx-auto max-w-5xl px-5 py-12 sm:py-16">
      <h1 className="max-w-xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">Everything for R{PLAN.monthlyZAR} a month</h1>
      <p className="mt-4 max-w-xl text-lg text-mute">New accounts get Premium free for {PLAN.trialMonths} months. We email you before it ends, and never charge a card without you choosing to pay.</p>

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

          {acct.ent.source === 'paid' ? (
            <p className="mt-8 border-l-2 border-ok bg-panel px-4 py-3 text-sm">You have Premium until {new Date(acct.ent.endsAt!).toLocaleDateString()}.</p>
          ) : (
            <div className="mt-8">
              {acct.ent.source === 'trial' && <p className="mb-4 text-sm text-mute">Your free trial has {acct.ent.daysLeft} days left. Upgrade now to keep Premium without a break.</p>}
              <div className="mb-4 grid grid-cols-3 gap-1.5 text-xs">
                {([['payfast', 'PayFast or SnapScan'], ['yoco', 'Card with Yoco'], ['stripe', 'International card']] as const).map(([k, l]) => (
                  <button key={k} onClick={() => setProvider(k)} aria-pressed={provider === k} className={`rounded-lg border px-2 py-2.5 transition-colors ${provider === k ? 'border-mark text-fg' : 'border-line text-mute hover:text-fg'}`}>{l}</button>
                ))}
              </div>
              <button disabled={busy} onClick={checkout} className="btn btn-primary w-full !py-3.5 text-base">{busy ? 'Opening checkout' : 'Upgrade to Premium'}</button>
              {msg && <p role="alert" className="mt-3 text-sm text-danger">{msg}</p>}
            </div>
          )}
        </section>
      </div>
      <p className="mt-12 text-sm text-mute">Premium unlocks the moment your payment clears.</p>
    </div>
  );
}
