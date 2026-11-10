import { NextResponse } from 'next/server';
import { supabaseAdmin, userFromRequest } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

// Referral code and friend count for the signed-in user. The 1-month reward is granted by the database when a friend signs up with the code.
export async function GET(req: Request) {
  const u = await userFromRequest(req);
  if (!u) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  const admin = supabaseAdmin(); // counting other people's rows needs the service key; the code itself does not
  let friends = 0;
  if (admin) {
    const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('referred_by', u.id);
    friends = count ?? 0;
  }
  return NextResponse.json({ code: u.profile?.referral_code, friends });
}
