import mammoth from 'mammoth';
import JSZip from 'jszip';

export type Extracted = { title: string; text: string; source: string };

const clean = (t: string) =>
  t.replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();

export async function extractPdf(buf: Buffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: false });
  const pages = (Array.isArray(text) ? text : [text]) as string[];
  // Re-flow hard-wrapped lines inside paragraphs while keeping page breaks as paragraph breaks
  return clean(pages.map((p) => p.replace(/(\S)\n(?=\S)/g, '$1 ')).join('\n\n'));
}

export async function extractDocx(buf: Buffer): Promise<string> {
  const { value } = await mammoth.extractRawText({ buffer: buf });
  return clean(value);
}

const stripHtml = (html: string) =>
  html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<\/(p|div|h[1-6]|li|br|tr)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&rsquo;/g, "'");

export async function extractEpub(buf: Buffer): Promise<{ text: string; title?: string }> {
  const zip = await JSZip.loadAsync(buf);
  const container = await zip.file('META-INF/container.xml')?.async('string');
  const opfPath = container?.match(/full-path="([^"]+)"/)?.[1];
  if (!opfPath) throw new Error('Invalid EPUB');
  const opf = await zip.file(opfPath)!.async('string');
  const base = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
  const manifest: Record<string, string> = {};
  for (const m of opf.matchAll(/<item\b[^>]*>/g)) {
    const id = m[0].match(/\bid="([^"]+)"/)?.[1];
    const href = m[0].match(/\bhref="([^"]+)"/)?.[1];
    if (id && href) manifest[id] = href;
  }
  const spine = [...opf.matchAll(/<itemref\b[^>]*idref="([^"]+)"/g)].map((m) => manifest[m[1]]).filter(Boolean);
  const parts: string[] = [];
  for (const href of spine) {
    const f = zip.file(decodeURIComponent(base + href));
    if (!f) continue;
    const html = await f.async('string');
    const heading = html.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i)?.[1];
    const body = stripHtml(html);
    parts.push((heading ? `# ${stripHtml(heading).trim()}\n\n` : '') + body.replace(/^\s*#?\s*/, ''));
  }
  const title = opf.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i)?.[1];
  return { text: clean(parts.join('\n\n')), title: title && stripHtml(title).trim() };
}

export async function extractFromBuffer(name: string, mime: string, buf: Buffer): Promise<Extracted> {
  const lower = name.toLowerCase();
  const title = name.replace(/\.[^.]+$/, '');
  if (lower.endsWith('.pdf') || mime === 'application/pdf') return { title, text: await extractPdf(buf), source: `file:${name}` };
  if (lower.endsWith('.docx')) return { title, text: await extractDocx(buf), source: `file:${name}` };
  if (lower.endsWith('.epub')) {
    const r = await extractEpub(buf);
    return { title: r.title || title, text: r.text, source: `file:${name}` };
  }
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return { title, text: clean(stripHtml(buf.toString('utf8'))), source: `file:${name}` };
  return { title, text: clean(buf.toString('utf8')), source: `file:${name}` };
}

// Article text via Jina Reader (free, no key needed; JINA_API_KEY optional for higher limits)
export async function extractUrl(url: string): Promise<Extracted> {
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  const headers: Record<string, string> = { Accept: 'text/plain', 'X-Return-Format': 'text' };
  if (process.env.JINA_API_KEY) headers.Authorization = `Bearer ${process.env.JINA_API_KEY}`;
  const r = await fetch('https://r.jina.ai/' + url, { headers });
  if (!r.ok) throw new Error(`Could not read that page (${r.status})`);
  const raw = await r.text();
  const title = raw.match(/^Title:\s*(.+)$/m)?.[1]?.trim() || new URL(url).hostname;
  const body = raw.replace(/^(Title|URL Source|Published Time|Markdown Content|Warning):.*$/gm, '').replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  return { title, text: clean(body), source: `url:${url}` };
}

export async function extractYoutube(url: string): Promise<Extracted> {
  const { YoutubeTranscript } = await import('youtube-transcript');
  const items = await YoutubeTranscript.fetchTranscript(url);
  const text = items.map((i: { text: string }) => i.text.replace(/&amp;#39;|&#39;/g, "'").replace(/&amp;/g, '&')).join(' ');
  // Transcripts have no punctuation; group into readable paragraphs
  const words = text.split(/\s+/);
  const paras: string[] = [];
  for (let i = 0; i < words.length; i += 70) paras.push(words.slice(i, i + 70).join(' ') + '.');
  let title = 'YouTube video';
  try {
    const o = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
    if (o.ok) title = (await o.json()).title || title;
  } catch {}
  return { title, text: paras.join('\n\n'), source: `youtube:${url}` };
}

// Public Google Drive / Dropbox share links -> direct download (no OAuth needed for "anyone with the link")
export function directDownloadUrl(link: string): string | null {
  const g = link.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=download&)?id=)([\w-]+)/) || link.match(/docs\.google\.com\/document\/d\/([\w-]+)/);
  if (g) {
    if (/docs\.google\.com\/document/.test(link)) return `https://docs.google.com/document/d/${g[1]}/export?format=txt`;
    return `https://drive.google.com/uc?export=download&id=${g[1]}`;
  }
  if (/dropbox\.com/.test(link)) return link.replace(/[?&]dl=0/, '').replace(/\?.*$/, '') + '?dl=1';
  return null;
}
