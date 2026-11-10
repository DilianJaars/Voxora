import { NextResponse } from 'next/server';
import { edgeSpeak } from '@/lib/tts';
import { limited, tooMany } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Open /api/health on the live site to see whether the server can reach the voice service, and the exact error if not.
export async function GET(req: Request) {
  if (limited(req, 'health', 6)) return tooMany();
  const t0 = Date.now();
  try {
    const mp3 = await edgeSpeak({ text: 'Voxora voice check ' + Date.now(), edgeVoice: 'en-US-JennyNeural' });
    return NextResponse.json({ voice: 'ok', bytes: mp3.length, ms: Date.now() - t0 });
  } catch (e: any) {
    return NextResponse.json({ voice: 'failed', error: String(e?.message || e), ms: Date.now() - t0 }, { status: 502 });
  }
}
