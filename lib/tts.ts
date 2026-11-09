import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { getVoice } from './voices';
import { toExpressiveSSML } from './text';

// Synthesize one chunk of text to MP3 with Edge TTS (free, no key).
export async function edgeSpeak(opts: { text: string; edgeVoice: string; rate?: string; pitch?: string; compact?: boolean }): Promise<Buffer> {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(opts.edgeVoice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
  const { audioStream } = tts.toStream(toExpressiveSSML(opts.text, opts.compact), {
    rate: opts.rate || '+0%',
    pitch: opts.pitch || '+0Hz',
  });
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    audioStream.on('data', (c: Buffer) => chunks.push(c));
    audioStream.on('end', () => resolve());
    audioStream.on('error', reject);
  });
  tts.close();
  return Buffer.concat(chunks);
}

// Synthesize with ElevenLabs (premium voices / cloned voices) using the user's own key or the server key.
export async function elevenSpeak(opts: { text: string; voiceId: string; apiKey: string }): Promise<Buffer> {
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${opts.voiceId}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': opts.apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({ text: opts.text, model_id: 'eleven_multilingual_v2' }),
  });
  if (!r.ok) throw new Error(`ElevenLabs error ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return Buffer.from(await r.arrayBuffer());
}

export { getVoice };
