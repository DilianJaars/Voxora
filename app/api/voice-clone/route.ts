import { NextResponse } from 'next/server';
import { requirePremium, supabaseAdmin, userFromRequest } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const maxDuration = 60;

// POST multipart { name, sample (audio, ~10s+), elevenKey? } -> creates an instant voice clone via ElevenLabs.
// Edge TTS cannot clone, so cloning needs an ElevenLabs key (user's own from Settings, or the server's).
export async function POST(req: Request) {
  const denied = await requirePremium(req);
  if (denied) return denied;
  const form = await req.formData();
  const sample = form.get('sample') as File | null;
  const name = String(form.get('name') || 'My voice').slice(0, 40);
  const key = String(form.get('elevenKey') || '') || process.env.ELEVENLABS_API_KEY;
  if (!sample) return NextResponse.json({ error: 'Upload a voice sample (about 10 seconds or more).' }, { status: 400 });
  if (!key) return NextResponse.json({ error: 'Voice cloning needs an ElevenLabs API key. Add yours in Settings.' }, { status: 400 });

  const fd = new FormData();
  fd.append('name', `Voxora – ${name}`);
  fd.append('files', sample, sample.name || 'sample.mp3');
  fd.append('remove_background_noise', 'true');
  const r = await fetch('https://api.elevenlabs.io/v1/voices/add', { method: 'POST', headers: { 'xi-api-key': key }, body: fd });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return NextResponse.json({ error: j?.detail?.message || `ElevenLabs rejected the sample (${r.status}). Cloning needs a plan that includes Instant Voice Cloning.` }, { status: 400 });

  const u = await userFromRequest(req);
  const admin = supabaseAdmin();
  if (u && admin) await admin.from('cloned_voices').insert({ user_id: u.id, name, provider_voice_id: j.voice_id });
  return NextResponse.json({ id: j.voice_id, name });
}
