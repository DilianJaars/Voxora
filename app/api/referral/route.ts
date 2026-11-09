import { NextResponse } from 'next/server';
import { supabaseAdmin, userFromRequest } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

// Referral stats for the signed-in user. The 1-month reward is granted by the DB trigger when a friend signs up with the code.
export async function GET(req: Request) {
  const u = await userFromRequest(req);
  const admin = supabaseAdmin();
  if (!u || !admin) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  const { data: me } = await admin.from('profiles').select('referral_code').eq('id', u.id).maybeSingle();
  const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('referred_by', u.id);
  return NextResponse.json({ code: me?.referral_code, friends: count ?? 0 });
}
