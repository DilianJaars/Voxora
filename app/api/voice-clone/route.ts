import { NextResponse } from 'next/server';
import { noAdmin, supabaseAdmin, userFromRequest } from '@/lib/supabaseAdmin';
import { limited, tooMany } from '@/lib/ratelimit';
import { cloneCap, maxVoices, monthCloneChars } from '@/lib/cloneUsage';

export const runtime = 'nodejs';
export const maxDuration = 60;

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'cache-control': 'no-store' } });

// GET: whether voice cloning is available, plus the signed-in person's allowance for this month.
export async function GET(req: Request) {
  const u = await userFromRequest(req);
  const out: Record<string, unknown> = { available: Boolean(process.env.ELEVENLABS_API_KEY), maxVoices: maxVoices(), capChars: cloneCap(), usedChars: 0 };
  if (u) out.usedChars = await monthCloneChars(u.db, u.id);
  return json(out);
}

// POST multipart { sample (wav/audio), name, consent, quality?, elevenKey? }: makes a voice from a recording and keeps it in the person's account.
// Edge TTS cannot clone, so this uses ElevenLabs Instant Voice Cloning (the site's key, or the person's own key from Settings).
export async function POST(req: Request) {
  if (limited(req, 'clone', 6, 3600_000)) return tooMany();
  const u = await userFromRequest(req);
  if (!u) return json({ error: 'Sign in to create your voice.' }, 401);
  if (!u.ent.premium) return json({ error: 'premium_required' }, 402);
  const admin = supabaseAdmin();
  if (!admin) return noAdmin();

  const form = await req.formData();
  const sample = form.get('sample') as File | null;
  const name = String(form.get('name') || 'My voice').replace(/[^\p{L}\p{N} '\-]/gu, '').trim().slice(0, 40) || 'My voice';
  if (form.get('consent') !== 'true') return json({ error: 'Confirm that this is your own voice, or that the speaker agreed.' }, 400);
  if (!sample || sample.size < 20_000) return json({ error: 'The recording is too short. Record the whole script.' }, 400);
  if (sample.size > 15 * 1024 * 1024) return json({ error: 'The recording is too large (15 MB maximum).' }, 413);

  const userKey = String(form.get('elevenKey') || '').trim();
  const key = userKey || process.env.ELEVENLABS_API_KEY;
  if (!key) return json({ error: 'Your own voice needs an ElevenLabs key. Add yours in Settings.' }, 400);

  if (!userKey) {
    const { count } = await admin.from('cloned_voices').select('id', { count: 'exact', head: true }).eq('user_id', u.id);
    if ((count ?? 0) >= maxVoices()) return json({ error: `You can keep ${maxVoices()} voices. Delete one on your dashboard to make another.` }, 400);
  }

  let quality: unknown = null;
  try { const q = JSON.parse(String(form.get('quality') || 'null')); if (q && typeof q === 'object') quality = q; } catch {}

  const fd = new FormData();
  fd.append('name', `Voxora ${name}`);
  fd.append('files', sample, 'voice.wav');
  fd.append('remove_background_noise', 'true');
  fd.append('description', 'Created in Voxora with the speaker\'s consent.');
  const r = await fetch('https://api.elevenlabs.io/v1/voices/add', { method: 'POST', headers: { 'xi-api-key': key }, body: fd });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) {
    const detail = j?.detail?.message || j?.detail?.status || '';
    const msg = r.status === 401 ? 'The ElevenLabs key was not accepted.'
      : /instant|cloning|subscription|plan/i.test(String(detail)) ? 'The ElevenLabs plan does not include voice cloning. It needs a paid plan with Instant Voice Cloning.'
      : `ElevenLabs could not make a voice from this recording${detail ? `: ${detail}` : '.'}`;
    return json({ error: msg }, 400);
  }

  const { data: row, error } = await admin.from('cloned_voices')
    .insert({ user_id: u.id, name, provider_voice_id: j.voice_id, quality, key_source: userKey ? 'user' : 'server' }).select('id').single();
  if (error || !row) return json({ error: 'The voice was made but could not be saved to your account. Try again.' }, 500);

  // Keep the recording privately in the person's own folder
  const path = `${u.id}/${row.id}.wav`;
  const up = await admin.storage.from('voice-samples').upload(path, sample, { contentType: 'audio/wav', upsert: true });
  if (!up.error) await admin.from('cloned_voices').update({ sample_path: path }).eq('id', row.id);

  return json({ id: j.voice_id, name, rowId: row.id });
}

// DELETE ?id=<row id>: removes the voice, the stored recording and (when the site's key made it) the voice at ElevenLabs.
export async function DELETE(req: Request) {
  const u = await userFromRequest(req);
  if (!u) return json({ error: 'Sign in required' }, 401);
  const admin = supabaseAdmin();
  if (!admin) return noAdmin();
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return json({ error: 'Missing voice' }, 400);
  const { data: v } = await admin.from('cloned_voices').select('id,provider_voice_id,sample_path,key_source').eq('id', id).eq('user_id', u.id).maybeSingle();
  if (!v) return json({ error: 'Voice not found' }, 404);

  let remote = false;
  if (v.key_source === 'server' && process.env.ELEVENLABS_API_KEY) {
    const r = await fetch(`https://api.elevenlabs.io/v1/voices/${encodeURIComponent(v.provider_voice_id)}`, { method: 'DELETE', headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY } }).catch(() => null);
    remote = Boolean(r?.ok);
  }
  if (v.sample_path) await admin.storage.from('voice-samples').remove([v.sample_path]);
  await admin.from('cloned_voices').delete().eq('id', v.id);
  return json({ ok: true, removedAtProvider: remote });
}
