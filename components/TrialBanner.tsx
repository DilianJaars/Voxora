'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useAccount } from '@/lib/useEntitlement';
import { startFreePremium } from '@/lib/trial';
import { PLAN } from '@/lib/plans';

// One slim bar for three situations: membership could not load, free Premium is available to start, or the free period is ending.
export default function TrialBanner() {
  const { ent, loading, email, profileOk, trialAvailable } = useAccount();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  if (!loading && email && !profileOk) {
    return (
      <div role="alert" className="border-b border-line bg-panel2 px-5 py-2.5 text-center text-sm">
        You are signed in, but we could not load your membership, so Premium is not showing. Refresh the page, or sign out and back in. If it keeps happening, the site owner needs to finish the database setup.
      </div>
    );
  }

  if (!loading && email && trialAvailable) {
    return (
      <div className="border-b border-line bg-panel2 px-5 py-2.5 text-center text-sm">
        Start Premium free for {PLAN.trialMonths} months. No card needed, and you choose how to pay later.{' '}
        <button
          disabled={busy}
          onClick={async () => { setBusy(true); setErr(''); const r = await startFreePremium(); setBusy(false); if (!r.ok) setErr(r.error || ''); }}
          className="font-semibold text-mark underline underline-offset-4 disabled:opacity-60"
        >{busy ? 'Starting' : 'Start free Premium'}</button>
        {err && <span role="alert" className="ml-2 text-danger">{err}</span>}
      </div>
    );
  }

  if (ent.source !== 'trial' && ent.source !== 'referral') return null;
  const d = ent.daysLeft ?? 0;
  if (d > 7) return null;
  return (
    <div className="border-b border-line bg-panel2 px-5 py-2.5 text-center text-sm">
      Your free Premium {ent.source === 'trial' ? 'trial' : 'bonus'} ends in {d} day{d === 1 ? '' : 's'}.{' '}
      <Link href="/pricing" className="font-semibold text-mark underline underline-offset-4">Add payment to keep Premium for R{PLAN.monthlyZAR} a month</Link>
    </div>
  );
}
