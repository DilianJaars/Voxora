import { NextResponse } from 'next/server';
import { supabaseAdmin, userFromRequest } from '@/lib/supabaseAdmin';
import { limited, tooMany } from '@/lib/ratelimit';

export const runtime = 'nodejs';

// Download everything Voxora holds about the signed-in user (their own data only).
export async function GET(req: Request) {
  if (limited(req, 'export', 5)) return tooMany();
  const u = await userFromRequest(req);
  const admin = supabaseAdmin();
  if (!u || !admin) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  const [profile, docs, payments, usage, voices] = await Promise.all([
    admin.from('profiles').select('email,premium_until,trial_ends_at,referral_bonus_until,referral_code,created_at').eq('id', u.id).maybeSingle(),
    admin.from('documents').select('id,title,source,text,position,summary,notes,created_at,updated_at').eq('user_id', u.id),
    admin.from('payments').select('provider,amount_cents,currency,months,created_at').eq('user_id', u.id),
    admin.from('usage_daily').select('day,listen_seconds,downloads,imports').eq('user_id', u.id),
    admin.from('cloned_voices').select('name,created_at').eq('user_id', u.id),
  ]);
  const body = JSON.stringify({ exportedAt: new Date().toISOString(), account: { id: u.id, email: u.email }, profile: profile.data, documents: docs.data, payments: payments.data, usage: usage.data, clonedVoices: voices.data }, null, 2);
  return new NextResponse(body, { headers: { 'content-type': 'application/json', 'content-disposition': 'attachment; filename="voxora-my-data.json"', 'cache-control': 'no-store' } });
}
