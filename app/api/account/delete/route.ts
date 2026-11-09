import { NextResponse } from 'next/server';
import { supabaseAdmin, userFromRequest } from '@/lib/supabaseAdmin';
import { limited, tooMany } from '@/lib/ratelimit';

export const runtime = 'nodejs';

// Permanently deletes the account. Documents, usage, payments records and cloned-voice rows cascade with the user.
export async function POST(req: Request) {
  if (limited(req, 'delete', 3)) return tooMany();
  const u = await userFromRequest(req);
  const admin = supabaseAdmin();
  if (!u || !admin) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  const { confirm } = await req.json().catch(() => ({}));
  if (confirm !== 'DELETE') return NextResponse.json({ error: 'Type DELETE to confirm.' }, { status: 400 });
  const { error } = await admin.auth.admin.deleteUser(u.id);
  if (error) return NextResponse.json({ error: 'Could not delete the account. Try again.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
