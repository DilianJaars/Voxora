import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { computeEntitlement, Entitlement } from './plans';

// Full-access client for webhooks and account tools. Needs SUPABASE_SERVICE_ROLE_KEY, which must never reach the browser.
export function supabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export const supabaseConfigured = () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export type AuthedUser = { id: string; email?: string; ent: Entitlement; profile: any; db: SupabaseClient };

// Who is asking? Checks the "Authorization: Bearer <token>" header with Supabase and reads the person's membership.
// It uses the person's own token, so it works without the service key and can only ever see that person's own rows.
export async function userFromRequest(req: Request): Promise<AuthedUser | null> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !anon) return null;
  const db = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return null;
  const read = () => db.from('profiles').select('*').eq('id', data.user!.id).maybeSingle();
  let { data: p } = await read();
  if (!p) { await db.rpc('ensure_profile'); ({ data: p } = await read()); }
  return { id: data.user.id, email: data.user.email, ent: computeEntitlement(p), profile: p, db };
}

const noAdmin = () => new Response(JSON.stringify({ error: 'This part of the site is not fully set up yet. The site owner needs to add the Supabase service key.' }), { status: 503, headers: { 'content-type': 'application/json' } });
export { noAdmin };

// Premium gate for API routes. Only when there are no accounts at all (local development) is everything open.
export async function requirePremium(req: Request): Promise<Response | null> {
  if (!supabaseConfigured()) return null;
  const u = await userFromRequest(req);
  if (u?.ent.premium) return null;
  return new Response(JSON.stringify({ error: 'premium_required', signedIn: Boolean(u) }), { status: 402, headers: { 'content-type': 'application/json' } });
}
