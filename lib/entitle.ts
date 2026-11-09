import { supabaseAdmin } from './supabaseAdmin';

// Extend a user's paid premium from max(now, current end) by N months. Called by payment webhooks.
// `ref` is the provider's payment id: a retried webhook with the same ref is ignored, so nobody gets double months.
export async function grantPremium(userId: string, months: number, provider: string, opts: { ref?: string; amountCents?: number; currency?: string } = {}) {
  const admin = supabaseAdmin();
  if (!admin) throw new Error('Supabase not configured');
  if (opts.ref) {
    const { data: seen } = await admin.from('payments').select('id').eq('provider_ref', `${provider}:${opts.ref}`).maybeSingle();
    if (seen) return;
  }
  const { data: p } = await admin.from('profiles').select('premium_until').eq('id', userId).maybeSingle();
  const base = Math.max(Date.now(), p?.premium_until ? new Date(p.premium_until).getTime() : 0);
  const end = new Date(base);
  end.setMonth(end.getMonth() + months);
  await admin.from('payments').insert({
    user_id: userId, provider, provider_ref: opts.ref ? `${provider}:${opts.ref}` : null,
    amount_cents: opts.amountCents ?? null, currency: (opts.currency || 'ZAR').toUpperCase(), months,
  });
  await admin.from('profiles').update({ premium_until: end.toISOString(), payment_provider: provider }).eq('id', userId);
}
