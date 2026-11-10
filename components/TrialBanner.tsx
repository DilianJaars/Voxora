'use client';
import Link from 'next/link';
import { useAccount } from '@/lib/useEntitlement';
import { PLAN } from '@/lib/plans';

// Trial reminder in the last 7 days, and a notice when a signed-in person's membership could not be read.
export default function TrialBanner() {
  const { ent, loading, email, profileOk } = useAccount();

  if (!loading && email && !profileOk) {
    return (
      <div role="alert" className="border-b border-line bg-panel2 px-5 py-2.5 text-center text-sm">
        You are signed in, but we could not load your membership, so Premium is not showing. Refresh the page, or sign out and back in. If it keeps happening, the site owner needs to finish the database setup.
      </div>
    );
  }
  if (ent.source !== 'trial' && ent.source !== 'referral') return null;
  const d = ent.daysLeft ?? 0;
  if (d > 7) return null;
  return (
    <div className="border-b border-line bg-panel2 px-5 py-2.5 text-center text-sm">
      Your free Premium {ent.source === 'trial' ? 'trial' : 'bonus'} ends in {d} day{d === 1 ? '' : 's'}.{' '}
      <Link href="/pricing" className="font-semibold text-mark underline underline-offset-4">Keep Premium for R{PLAN.monthlyZAR} a month</Link>
    </div>
  );
}
