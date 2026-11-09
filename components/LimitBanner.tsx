'use client';
import Link from 'next/link';
import { PLAN } from '@/lib/plans';

export default function LimitBanner({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-start justify-between gap-3 border-l-2 border-mark bg-panel px-4 py-3 text-sm sm:flex-row sm:items-center">
      <span>{message}</span>
      <Link href="/pricing" className="btn btn-primary !py-1.5 whitespace-nowrap">Upgrade for R{PLAN.monthlyZAR} a month</Link>
    </div>
  );
}
