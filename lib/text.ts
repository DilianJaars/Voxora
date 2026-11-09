// Split text into sentences, keeping paragraph boundaries and char offsets.
export type Sentence = { text: string; start: number; end: number; para: number };

export function splitSentences(text: string): Sentence[] {
  const out: Sentence[] = [];
  const paras = text.split(/\n{2,}/);
  let cursor = 0;
  paras.forEach((p, pi) => {
    const idx = text.indexOf(p, cursor);
    const base = idx < 0 ? cursor : idx;
    const re = /[^.!?…\n]+(?:[.!?…]+["')\]]*|\n|$)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(p))) {
      const raw = m[0];
      const t = raw.trim();
      if (t.length > 0) {
        const lead = raw.length - raw.trimStart().length;
        out.push({ text: t.replace(/\s+/g, ' '), start: base + m.index + lead, end: base + m.index + lead + t.length, para: pi });
      }
    }
    cursor = base + p.length;
  });
  return out;
}

// Rough listening-time estimate (seconds) at 1x: ~160 wpm
export const estimateSeconds = (text: string, speed = 1) =>
  Math.round(((text.trim().split(/\s+/).length || 0) / 160) * 60 / speed);

// Chapters: markdown headings, "Chapter N", or ~every 4000 words
export type Chapter = { title: string; sentenceIndex: number };
export function detectChapters(sentences: Sentence[]): Chapter[] {
  const ch: Chapter[] = [];
  sentences.forEach((s, i) => {
    const m = /^(#{1,3}\s+.+|chapter\s+[\dIVXLC]+.*|part\s+[\dIVXLC]+.*)$/i.exec(s.text);
    if (m && s.text.length < 90) ch.push({ title: s.text.replace(/^#+\s*/, ''), sentenceIndex: i });
  });
  if (ch.length >= 2) return ch;
  const out: Chapter[] = [];
  let words = 0;
  let n = 1;
  sentences.forEach((s, i) => {
    if (i === 0 || words > 1200) {
      out.push({ title: `Section ${n++}`, sentenceIndex: i });
      words = 0;
    }
    words += s.text.split(/\s+/).length;
  });
  return out;
}

// Group sentences into TTS chunks (<= maxChars) so requests are efficient but highlighting stays sentence-level.
export function chunkSentences(sentences: Sentence[], from = 0, maxChars = 700): { from: number; to: number; text: string }[] {
  const chunks: { from: number; to: number; text: string }[] = [];
  let cur: Sentence[] = [];
  let len = 0;
  let startIdx = from;
  for (let i = from; i < sentences.length; i++) {
    const s = sentences[i];
    if (len + s.text.length > maxChars && cur.length) {
      chunks.push({ from: startIdx, to: i - 1, text: cur.map((x) => x.text).join(' ') });
      cur = [];
      len = 0;
      startIdx = i;
    }
    cur.push(s);
    len += s.text.length + 1;
  }
  if (cur.length) chunks.push({ from: startIdx, to: sentences.length - 1, text: cur.map((x) => x.text).join(' ') });
  return chunks;
}

// Turn plain text into expressive SSML-ish content for Edge TTS:
// natural pauses on punctuation, longer breaks between paragraphs, no markup leakage.
export function toExpressiveSSML(text: string, compact = false): string {
  const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const out = esc
    .replace(/\s*\n{2,}\s*/g, ' <break time="650ms"/> ')
    .replace(/\s*\n\s*/g, ' <break time="250ms"/> ')
    .replace(/(\.\.\.|…)/g, '$1 <break time="450ms"/>')
    .replace(/\s[—–]\s/g, ' <break time="280ms"/> ')
    .replace(/([:;])\s/g, '$1 <break time="220ms"/> ')
    .replace(/([!?])(\s|$)/g, '$1 <break time="380ms"/> ')
    .replace(/(\.)(\s+)(?=[A-Z"“])/g, '$1 <break time="320ms"/> ')
    .replace(/,\s/g, ', <break time="140ms"/> ');
  // Smart Speed (premium): trim pauses instead of speeding up the voice
  return compact ? out.replace(/time="(\d+)ms"/g, (_, n) => `time="${Math.round(Number(n) * 0.35)}ms"`) : out;
}

export const fmtTime = (s: number) => {
  s = Math.max(0, Math.round(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
};
