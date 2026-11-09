'use client';
import Link from 'next/link';
import { useState } from 'react';
import { PLAN } from '@/lib/plans';
import { useAccount } from '@/lib/useEntitlement';

const FREE = ['5 natural voices (US, UK, South African)', '30 minutes of listening per day', '2 MP3 downloads per day', '3 web / YouTube / photo imports per day', 'Speed up to 2.5x', 'Library of 10 documents', 'Night mode & dyslexia-friendly font'];
const PREMIUM = ['Unlimited listening time', 'All 20+ voices (US, UK, AU, ZA)', 'Voice cloning from a 10-second sample', 'Unlimited MP3 downloads', 'Unlimited library & file size', 'Unlimited YouTube, web & photo OCR', 'Offline listening & background play', 'Speed up to 3.5x + Smart Speed', 'AI summaries & AI notes', 'Translate & read in another language', 'Share a link to your audio'];

export default function Pricing() {
  const acct = useAccount();
  const [yearly, setYearly] = useState(false);
  const [provider, setProvider] = useState<'payfast' | 'yoco' | 'stripe'>('payfast');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function checkout() {
    setMsg('');
    if (!acct.token) { setMsg('Please create a free account first — it takes 10 seconds and starts your 2 free months.'); return; }
    setBusy(true);
    const r = await fetch('/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${acct.token}` }, body: JSON.stringify({ plan: yearly ? 'yearly' : 'monthly', provider }) });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) return setMsg(j.error || 'Checkout failed');
    if (j.url) return void (location.href = j.url);
    if (j.form) { // PayFast: post a signed form
      const f = document.createElement('form'); f.method = 'POST'; f.action = j.form.action;
      Object.entries(j.form.fields).forEach(([k, v]) => { const i = document.createElement('input'); i.type = 'hidden'; i.name = k; i.value = String(v); f.appendChild(i); });
      document.body.appendChild(f); f.submit();
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-center text-4xl font-extrabold">Simple pricing</h1>
      <p className="mt-2 text-center text-zinc-400">Everything for the price of a coffee. New accounts start with {PLAN.trialMonths} months of Premium free.</p>

      <div className="mx-auto mt-6 flex w-fit rounded-full border border-line p-1 text-sm">
        <button onClick={() => setYearly(false)} className={`rounded-full px-5 py-2 ${!yearly ? 'bg-brand text-white' : 'text-zinc-400'}`}>Monthly</button>
        <button onClick={() => setYearly(true)} className={`rounded-full px-5 py-2 ${yearly ? 'bg-brand text-white' : 'text-zinc-400'}`}>Yearly <span className="text-xs text-emerald-300">save R20</span></button>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="card">
          <h2 className="text-xl font-bold">Free</h2>
          <div className="mt-2 text-4xl font-extrabold">R0</div>
          <ul className="mt-5 space-y-2 text-sm text-zinc-300">{FREE.map((f) => <li key={f}>✓ {f}</li>)}</ul>
          <Link href="/app" className="btn btn-ghost mt-6 w-full">Start free</Link>
        </div>
        <div className="card border-brand shadow-[0_0_60px_-20px_rgba(139,92,246,.8)]">
          <div className="flex items-center justify-between"><h2 className="text-xl font-bold">Premium</h2><span className="rounded-full bg-brand px-3 py-1 text-xs font-bold">{PLAN.trialMonths} MONTHS FREE</span></div>
          <div className="mt-2 text-4xl font-extrabold">R{yearly ? PLAN.yearlyZAR : PLAN.monthlyZAR}<span className="text-base font-medium text-zinc-400"> / {yearly ? 'year' : 'month'}</span></div>
          <ul className="mt-5 space-y-2 text-sm text-zinc-300">{PREMIUM.map((f) => <li key={f}>✓ {f}</li>)}</ul>

          {acct.ent.source === 'paid' ? (
            <p className="mt-6 rounded-xl bg-emerald-500/10 p-3 text-center text-sm text-emerald-300">You're Premium until {new Date(acct.ent.endsAt!).toLocaleDateString()}</p>
          ) : (
            <>
              {acct.ent.source === 'trial' && <p className="mt-5 text-xs text-brand-glow">Free trial: {acct.ent.daysLeft} days left. Upgrade now and keep going without a break.</p>}
              <div className="mt-5 flex gap-2 text-xs">
                {([['payfast', 'PayFast / SnapScan'], ['yoco', 'Yoco card'], ['stripe', 'International (Stripe)']] as const).map(([k, l]) => (
                  <button key={k} onClick={() => setProvider(k)} className={`flex-1 rounded-lg border px-2 py-2 ${provider === k ? 'border-brand bg-brand/15' : 'border-line text-zinc-400'}`}>{l}</button>
                ))}
              </div>
              <button disabled={busy} onClick={checkout} className="btn btn-primary mt-4 w-full !py-3.5 text-base">{busy ? '…' : 'Upgrade to Premium'}</button>
              {msg && <p className="mt-3 text-sm text-amber-300">{msg}</p>}
            </>
          )}
        </div>
      </div>
      <p className="mt-6 text-center text-xs text-zinc-500">Premium unlocks instantly after payment. We email you before your free trial ends — never a surprise charge.</p>
    </div>
  );
}
