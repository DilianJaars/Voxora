import { NextResponse } from 'next/server';
import { limited, tooMany } from '@/lib/ratelimit';
import { directDownloadUrl, extractFromBuffer, extractUrl, extractYoutube } from '@/lib/extract';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_BYTES = 50 * 1024 * 1024;

export async function POST(req: Request) {
  if (limited(req, 'extract', 20)) return tooMany();
  try {
    const ct = req.headers.get('content-type') || '';
    let result;
    if (ct.includes('multipart/form-data')) {
      const form = await req.formData();
      const file = form.get('file') as File | null;
      if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });
      if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File too large (50MB max)' }, { status: 413 });
      result = await extractFromBuffer(file.name, file.type, Buffer.from(await file.arrayBuffer()));
    } else {
      const { kind, value } = await req.json();
      if (kind === 'youtube') result = await extractYoutube(String(value));
      else if (kind === 'cloud') {
        const direct = directDownloadUrl(String(value));
        if (!direct) return NextResponse.json({ error: 'Paste a public Google Drive or Dropbox share link.' }, { status: 400 });
        const r = await fetch(direct, { redirect: 'follow' });
        if (!r.ok) return NextResponse.json({ error: 'Could not download that file. Is it shared with "anyone with the link"?' }, { status: 400 });
        const buf = Buffer.from(await r.arrayBuffer());
        const disp = r.headers.get('content-disposition') || '';
        const name = decodeURIComponent(disp.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i)?.[1] || (direct.includes('/export?format=txt') ? 'Google Doc.txt' : 'cloud-file.pdf'));
        result = await extractFromBuffer(name, r.headers.get('content-type') || '', buf);
      } else result = await extractUrl(String(value));
    }
    if (!result.text || result.text.length < 5) {
      return NextResponse.json({ error: 'No readable text found. If this is a scan, use Photo/OCR.' }, { status: 422 });
    }
    return NextResponse.json(result);
  } catch (e: any) {
    const msg = String(e?.message || e);
    return NextResponse.json({ error: /transcript/i.test(msg) ? 'No transcript is available for that video.' : msg }, { status: 500 });
  }
}
