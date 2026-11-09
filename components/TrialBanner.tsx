'use client';
import Link from 'next/link';
import { useAccount } from '@/lib/useEntitlement';
import { PLAN } from '@/lib/plans';

// Shows trial status; becomes a reminder in the last 7 days before the free membership runs out.
export default function TrialBanner() {
  const { ent } = useAccount();
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
