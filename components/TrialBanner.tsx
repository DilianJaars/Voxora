'use client';
import Link from 'next/link';
import { useAccount } from '@/lib/useEntitlement';
import { PLAN } from '@/lib/plans';

// Shows trial status; becomes an urgent reminder in the last 7 days before the free membership runs out.
export default function TrialBanner() {
  const { ent } = useAccount();
  if (ent.source !== 'trial' && ent.source !== 'referral') return null;
  const d = ent.daysLeft ?? 0;
  if (d > 7) return null;
  return (
    <div className="border-b border-brand/40 bg-brand/15 px-4 py-2 text-center text-sm">
      Your free Premium {ent.source === 'trial' ? 'trial' : 'bonus'} ends in <b>{d} day{d === 1 ? '' : 's'}</b>.{' '}
      <Link href="/pricing" className="font-semibold underline">Keep Premium for R{PLAN.monthlyZAR}/month</Link>
    </div>
  );
}
