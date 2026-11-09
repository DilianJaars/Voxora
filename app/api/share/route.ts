import { NextResponse } from 'next/server';
import { requirePremium, supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

// Premium: returns a signed upload URL for the public "shared-audio" bucket plus the final public link.
export async function POST(req: Request) {
  const denied = await requirePremium(req);
  if (denied) return denied;
  const admin = supabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Sharing needs Supabase to be configured.' }, { status: 501 });
  const path = `${crypto.randomUUID()}.mp3`;
  const { data, error } = await admin.storage.from('shared-audio').createSignedUploadUrl(path);
  if (error || !data) return NextResponse.json({ error: error?.message || 'Could not create upload' }, { status: 500 });
  const { data: pub } = admin.storage.from('shared-audio').getPublicUrl(path);
  return NextResponse.json({ path, token: data.token, url: pub.publicUrl });
}
