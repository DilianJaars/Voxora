// Checks a voice recording in the browser before it is used to make a voice: length, loudness, clipping and background noise.
export type Analysis = {
  seconds: number;        // total recording length
  speechSeconds: number;  // time actually spent talking
  levelDb: number;        // average speech level, dBFS
  peakDb: number;
  noiseDb: number;        // background level, dBFS
  snrDb: number;          // speech louder than background by this much
  clipPct: number;        // share of samples at the maximum
  score: number;          // 0 to 100
  verdict: 'good' | 'ok' | 'poor';
  tips: string[];
};

const db = (x: number) => 20 * Math.log10(Math.max(x, 1e-6));

export async function decodeToMono(blob: Blob): Promise<{ samples: Float32Array; rate: number }> {
  const Ctx = window.AudioContext || (window as any).webkitAudioContext;
  const ctx = new Ctx();
  try {
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    const out = new Float32Array(buf.length);
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < buf.length; i++) out[i] += d[i] / buf.numberOfChannels;
    }
    return { samples: out, rate: buf.sampleRate };
  } finally {
    ctx.close();
  }
}

export function analyse(samples: Float32Array, rate: number): Analysis {
  const seconds = samples.length / rate;
  const frame = Math.max(1, Math.round(rate * 0.05));
  const rms: number[] = [];
  let peak = 0, clipped = 0;
  for (let i = 0; i + frame <= samples.length; i += frame) {
    let sum = 0;
    for (let j = 0; j < frame; j++) {
      const v = samples[i + j], a = Math.abs(v);
      sum += v * v;
      if (a > peak) peak = a;
      if (a >= 0.99) clipped++;
    }
    rms.push(Math.sqrt(sum / frame));
  }
  const sorted = [...rms].sort((a, b) => a - b);
  const noise = sorted[Math.floor(sorted.length * 0.1)] || 1e-6;
  const gate = Math.max(noise * 3.16, 0.01); // speech = at least 10 dB above the background
  const speech = rms.filter((r) => r > gate);
  const speechSeconds = speech.length * 0.05;
  const level = speech.length ? Math.sqrt(speech.reduce((a, r) => a + r * r, 0) / speech.length) : 0;
  const levelDb = db(level), noiseDb = db(noise), peakDb = db(peak);
  const snrDb = levelDb - noiseDb;
  const clipPct = samples.length ? (clipped / samples.length) * 100 : 0;

  const tips: string[] = [];
  if (speechSeconds < 15) tips.push('Too short. Read the whole script, aiming for at least 30 seconds of speech.');
  else if (speechSeconds < 30) tips.push('A little short. Reading the full script gives a more accurate voice.');
  if (levelDb < -38) tips.push('Very quiet. Move closer to the microphone and speak up.');
  else if (levelDb < -30) tips.push('A bit quiet. Move closer to the microphone.');
  if (clipPct > 2) tips.push('The sound is distorting. Move back from the microphone or speak softer.');
  else if (clipPct > 0.3) tips.push('Some peaks are distorting. Move slightly back from the microphone.');
  if (snrDb < 10) tips.push('Too much background noise. Find a quiet room and turn off fans or music.');
  else if (snrDb < 20) tips.push('Some background noise. A quieter room will sound more like you.');

  const poor = speechSeconds < 15 || levelDb < -38 || clipPct > 2 || snrDb < 10;
  const ok = speechSeconds < 30 || levelDb < -30 || clipPct > 0.3 || snrDb < 20;
  const verdict: Analysis['verdict'] = poor ? 'poor' : ok ? 'ok' : 'good';
  if (verdict === 'good') tips.push('Clear, loud enough and quiet in the background. This will make a good voice.');

  const score = Math.max(0, Math.min(100, Math.round(
    100 - Math.max(0, 30 - speechSeconds) * 2 - Math.max(0, -30 - levelDb) * 3 - Math.min(40, clipPct * 10) - Math.max(0, 25 - snrDb) * 2)));
  const r1 = (n: number) => Math.round(n * 10) / 10;
  return { seconds: r1(seconds), speechSeconds: r1(speechSeconds), levelDb: r1(levelDb), peakDb: r1(peakDb), noiseDb: r1(noiseDb), snrDb: r1(snrDb), clipPct: r1(clipPct), score, verdict, tips };
}

// 16-bit mono WAV at 24 kHz: small, and accepted everywhere.
export function encodeWav(samples: Float32Array, rate: number): Blob {
  const target = 24000;
  let data = samples;
  if (rate !== target) {
    const ratio = rate / target;
    const n = Math.floor(samples.length / ratio);
    data = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const pos = i * ratio, i0 = Math.floor(pos), i1 = Math.min(samples.length - 1, i0 + 1);
      data[i] = samples[i0] + (samples[i1] - samples[i0]) * (pos - i0);
    }
  }
  const buf = new ArrayBuffer(44 + data.length * 2);
  const v = new DataView(buf);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + data.length * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, target, true); v.setUint32(28, target * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, data.length * 2, true);
  for (let i = 0; i < data.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, data[i])) * 0x7fff, true);
  return new Blob([buf], { type: 'audio/wav' });
}
