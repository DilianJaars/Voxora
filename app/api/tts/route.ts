import { NextResponse } from 'next/server';
import { edgeSpeak, elevenSpeak } from '@/lib/tts';
import { getVoice, LANGUAGES } from '@/lib/voices';
import { userFromRequest } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const maxDuration = 60;

// POST { text, voice, language?, elevenVoiceId?, elevenKey? } -> audio/mpeg
// Free voices are open to everyone; premium + cloned voices need an active premium/trial account
// (or the caller's own ElevenLabs key, which they pay for themselves).
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const text: string = String(body.text || '').slice(0, 3000);
    if (!text.trim()) return NextResponse.json({ error: 'No text' }, { status: 400 });

    // Cloned / ElevenLabs voice
    if (body.elevenVoiceId) {
      const key = body.elevenKey || process.env.ELEVENLABS_API_KEY;
      if (!key) return NextResponse.json({ error: 'Add an ElevenLabs API key in Settings to use this voice.' }, { status: 400 });
      if (!body.elevenKey) {
        const u = await userFromRequest(req);
        if (!u?.ent.premium) return NextResponse.json({ error: 'premium_required' }, { status: 402 });
      }
      const mp3 = await elevenSpeak({ text, voiceId: body.elevenVoiceId, apiKey: key });
      return new NextResponse(new Uint8Array(mp3), { headers: { 'content-type': 'audio/mpeg', 'cache-control': 'private, max-age=3600' } });
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
    return new NextResponse(new Uint8Array(mp3), { headers: { 'content-type': 'audio/mpeg', 'cache-control': 'private, max-age=3600' } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'TTS failed' }, { status: 500 });
  }
}
