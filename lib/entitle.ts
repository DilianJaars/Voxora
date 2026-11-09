import { supabaseAdmin } from './supabaseAdmin';

// Extend a user's paid premium from max(now, current end) by N months. Called by payment webhooks.
export async function grantPremium(userId: string, months: number, provider: string) {
  const admin = supabaseAdmin();
  if (!admin) throw new Error('Supabase not configured');
  const { data: p } = await admin.from('profiles').select('premium_until').eq('id', userId).maybeSingle();
  const base = Math.max(Date.now(), p?.premium_until ? new Date(p.premium_until).getTime() : 0);
  const end = new Date(base);
  end.setMonth(end.getMonth() + months);
  await admin.from('profiles').update({ premium_until: end.toISOString(), payment_provider: provider }).eq('id', userId);
}
