import { NextResponse } from 'next/server';
import { edgeSpeak, elevenSpeak } from '@/lib/tts';
import { getVoice, LANGUAGES } from '@/lib/voices';
import { supabaseAdmin, userFromRequest } from '@/lib/supabaseAdmin';
import { limited, tooMany } from '@/lib/ratelimit';
import { addCloneChars, cloneCap, monthCloneChars } from '@/lib/cloneUsage';

export const runtime = 'nodejs';
export const maxDuration = 60;

const audio = (mp3: Buffer) => new NextResponse(new Uint8Array(mp3), { headers: { 'content-type': 'audio/mpeg', 'cache-control': 'private, max-age=3600' } });

// POST { text, voice, language?, elevenVoiceId?, elevenKey?, preview?, compact? } -> audio/mpeg
// Free voices are open to everyone. Premium voices and cloned voices need an active premium/trial account,
// and a cloned voice must belong to the signed-in person (unless they bring their own ElevenLabs key).
export async function POST(req: Request) {
  if (limited(req, 'tts', 90)) return tooMany();
  try {
    const body = await req.json();
    const text: string = String(body.text || '').slice(0, 3000);
    if (!text.trim()) return NextResponse.json({ error: 'No text' }, { status: 400 });

    // Cloned / ElevenLabs voice
    if (body.elevenVoiceId) {
      const voiceId = String(body.elevenVoiceId);
      const userKey = typeof body.elevenKey === 'string' ? body.elevenKey.trim() : '';
      const key = userKey || process.env.ELEVENLABS_API_KEY;
      if (!key) return NextResponse.json({ error: 'Voice cloning is not switched on yet. Add an ElevenLabs API key in Settings.' }, { status: 400 });

      let spend: { admin: NonNullable<ReturnType<typeof supabaseAdmin>>; userId: string } | null = null;
      if (!userKey) {
        const u = await userFromRequest(req);
        const admin = supabaseAdmin();
        if (!u || !admin || !u.ent.premium) return NextResponse.json({ error: 'premium_required' }, { status: 402 });
        const { data: own } = await admin.from('cloned_voices').select('id').eq('user_id', u.id).eq('provider_voice_id', voiceId).maybeSingle();
        if (!own) return NextResponse.json({ error: 'That voice does not belong to your account.' }, { status: 403 });
        if ((await monthCloneChars(admin, u.id)) + text.length > cloneCap()) {
          return NextResponse.json({ error: 'You have used this month\'s allowance for your own voice. It resets on the 1st, or add your own ElevenLabs key in Settings.' }, { status: 429 });
        }
        spend = { admin, userId: u.id };
      }
      const mp3 = await elevenSpeak({ text, voiceId, apiKey: key });
      if (spend) await addCloneChars(spend.admin, spend.userId, text.length).catch(() => {});
      return audio(mp3);
    }

    const voice = getVoice(String(body.voice || 'jenny'));
    if (!voice) return NextResponse.json({ error: 'Unknown voice' }, { status: 400 });
    if (!voice.free && !(body.preview && text.length <= 160)) {
      const u = await userFromRequest(req);
      if (!u?.ent.premium) return NextResponse.json({ error: 'premium_required' }, { status: 402 });
    }
    const lang = body.language && LANGUAGES[body.language];
    const mp3 = await edgeSpeak({
      text,
      edgeVoice: lang ? lang.edge : voice.edge,
      rate: voice.rate,
      pitch: voice.pitch,
      compact: Boolean(body.compact) && !body.preview,
    });
    return audio(mp3);
  } catch (e: any) {
    const detail = String(e?.message || e);
    console.error('tts failed:', detail);
    const unreachable = /closed|timed out|connection|ENOTFOUND|ECONN|WebSocket|no audio/i.test(detail);
    return NextResponse.json({ error: unreachable ? 'The voice service did not answer. Please try again in a moment.' : detail, detail }, { status: unreachable ? 502 : 500 });
  }
}
