import { createHash } from 'crypto';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { toExpressiveSSML } from './text';

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Microsoft closes the socket on us if we open too many at once, so keep a small number in flight.
let active = 0;
const waiters: (() => void)[] = [];
async function slot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= 3) await new Promise<void>((r) => waiters.push(r));
  active++;
  try { return await fn(); } finally { active--; waiters.shift()?.(); }
}

// Repeated phrases (landing demo, voice previews) are served from memory instead of calling Microsoft again.
const cache = new Map<string, Buffer>();
let cacheBytes = 0;
const CACHE_MAX = 40 * 1024 * 1024;
function remember(key: string, buf: Buffer) {
  if (buf.length > 2 * 1024 * 1024) return;
  cache.set(key, buf);
  cacheBytes += buf.length;
  while (cacheBytes > CACHE_MAX) {
    const first = cache.keys().next().value as string;
    cacheBytes -= cache.get(first)!.length;
    cache.delete(first);
  }
}

async function synth(body: string, edgeVoice: string, rate: string, pitch: string): Promise<Buffer> {
  const tts = new MsEdgeTTS({ connectionTimeoutMs: 10000, synthesisTimeoutMs: 30000 });
  try {
    await tts.setMetadata(edgeVoice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(body, { rate, pitch });
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      audioStream.on('data', (c: Buffer) => chunks.push(c));
      audioStream.on('end', () => resolve());
      audioStream.on('error', reject);
    });
    return Buffer.concat(chunks);
  } finally {
    tts.close();
  }
}

// Synthesize one chunk of text to MP3 with Edge TTS (free, no key).
// Attempt 1: expressive pauses. Attempt 2: plain text (in case the pause markup was rejected).
// Attempt 3: plain text in two halves (in case the request was too long for the service).
export async function edgeSpeak(opts: { text: string; edgeVoice: string; rate?: string; pitch?: string; compact?: boolean }): Promise<Buffer> {
  const rate = opts.rate || '+0%';
  const pitch = opts.pitch || '+0Hz';
  const key = createHash('sha1').update([opts.edgeVoice, rate, pitch, opts.compact ? 'c' : '', opts.text].join('|')).digest('hex');
  const hit = cache.get(key);
  if (hit) return hit;

  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const buf = await slot(async () => {
        if (attempt === 0) return synth(toExpressiveSSML(opts.text, opts.compact), opts.edgeVoice, rate, pitch);
        if (attempt === 1 || opts.text.length < 120) return synth(esc(opts.text), opts.edgeVoice, rate, pitch);
        const cut = opts.text.indexOf(' ', Math.floor(opts.text.length / 2));
        const at = cut > 0 ? cut : Math.floor(opts.text.length / 2);
        const a = await synth(esc(opts.text.slice(0, at)), opts.edgeVoice, rate, pitch);
        const b = await synth(esc(opts.text.slice(at)), opts.edgeVoice, rate, pitch);
        return Buffer.concat([a, b]);
      });
      if (buf.length < 500) throw new Error('The voice service returned no audio.');
      remember(key, buf);
      return buf;
    } catch (e) {
      last = e;
      if (attempt < 2) await sleep(500 * (attempt + 1));
    }
  }
  throw last;
}

// Synthesize with ElevenLabs (premium voices / cloned voices) using the user's own key or the server key.
export async function elevenSpeak(opts: { text: string; voiceId: string; apiKey: string }): Promise<Buffer> {
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(opts.voiceId)}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': opts.apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({ text: opts.text, model_id: 'eleven_multilingual_v2' }),
  });
  if (!r.ok) throw new Error(`ElevenLabs error ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return Buffer.from(await r.arrayBuffer());
}
