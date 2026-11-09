import { NextResponse } from 'next/server';
import { llm } from '@/lib/ai';
import { LANGUAGES } from '@/lib/voices';
import { requirePremium } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(req: Request) {
  const denied = await requirePremium(req);
  if (denied) return denied;
  const { text, to } = await req.json();
  const lang = LANGUAGES[to];
  if (!lang) return NextResponse.json({ error: 'Unsupported language' }, { status: 400 });
  const src = String(text || '').slice(0, 20000);
  try {
    const out = await llm(`Translate the following text into ${lang.label}. Keep paragraph breaks. Output only the translation.\n\n${src}`, 6000);
    if (!out) return NextResponse.json({ error: 'Translation needs ANTHROPIC_API_KEY on the server.' }, { status: 501 });
    return NextResponse.json({ text: out.trim(), language: to });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
