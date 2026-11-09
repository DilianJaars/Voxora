export const PLAN = {
  monthlyZAR: 10,
  yearlyZAR: 100,
  trialMonths: 2,
  trialReminderDays: [7, 1], // remind this many days before the free trial ends
};

export const FREE_LIMITS = {
  listenSecondsPerDay: 30 * 60,
  downloadsPerDay: 2,
  importsPerDay: 3,      // YouTube + URL + photo OCR
  maxSpeed: 2.5,
  premiumMaxSpeed: 3.5,
  maxDocs: 10,
  maxFileMB: 10,
};

export type Entitlement = {
  premium: boolean;
  source: 'paid' | 'trial' | 'referral' | 'free';
  endsAt?: string | null;
  daysLeft?: number | null;
};

// Premium = paid subscription OR active free trial OR referral bonus
export function computeEntitlement(p: {
  premium_until?: string | null;
  trial_ends_at?: string | null;
  referral_bonus_until?: string | null;
} | null): Entitlement {
  if (!p) return { premium: false, source: 'free' };
  const now = Date.now();
  const t = (s?: string | null) => (s ? new Date(s).getTime() : 0);
  const paid = t(p.premium_until);
  const trial = t(p.trial_ends_at);
  const ref = t(p.referral_bonus_until);
  const days = (ms: number) => Math.max(0, Math.ceil((ms - now) / 86400000));
  if (paid > now) return { premium: true, source: 'paid', endsAt: p.premium_until, daysLeft: days(paid) };
  if (ref > now) return { premium: true, source: 'referral', endsAt: p.referral_bonus_until, daysLeft: days(ref) };
  if (trial > now) return { premium: true, source: 'trial', endsAt: p.trial_ends_at, daysLeft: days(trial) };
  return { premium: false, source: 'free' };
}
