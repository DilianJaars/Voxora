'use client';
import Link from 'next/link';
import { PLAN } from '@/lib/plans';

export default function LimitBanner({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-between gap-2 rounded-xl border border-brand/40 bg-brand/10 px-4 py-3 text-sm sm:flex-row">
      <span>{message}</span>
      <Link href="/pricing" className="btn btn-primary !py-1.5 whitespace-nowrap">Upgrade to Premium – R{PLAN.monthlyZAR}/month</Link>
    </div>
  );
}
