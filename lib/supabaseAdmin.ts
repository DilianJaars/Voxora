import { createClient, SupabaseClient } from '@supabase/supabase-js';

export function supabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

// Resolve the user (and entitlement) from a "Authorization: Bearer <jwt>" header.
import { computeEntitlement, Entitlement } from './plans';
export async function userFromRequest(req: Request): Promise<{ id: string; email?: string; ent: Entitlement } | null> {
  const admin = supabaseAdmin();
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!admin || !token) return null;
  const { data } = await admin.auth.getUser(token);
  if (!data.user) return null;
  const { data: p } = await admin.from('profiles').select('premium_until,trial_ends_at,referral_bonus_until').eq('id', data.user.id).maybeSingle();
  return { id: data.user.id, email: data.user.email, ent: computeEntitlement(p) };
}

// Premium gate for API routes. With Supabase unconfigured (local dev) there are no accounts, so everything is open.
export async function requirePremium(req: Request): Promise<Response | null> {
  if (!supabaseAdmin()) return null;
  const u = await userFromRequest(req);
  if (u?.ent.premium) return null;
  return new Response(JSON.stringify({ error: 'premium_required' }), { status: 402, headers: { 'content-type': 'application/json' } });
}
