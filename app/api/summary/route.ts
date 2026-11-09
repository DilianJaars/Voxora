import { NextResponse } from 'next/server';
import { extractiveSummary, llm } from '@/lib/ai';
import { requirePremium } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  const denied = await requirePremium(req);
  if (denied) return denied;
  const { text } = await req.json();
  const body = String(text || '').slice(0, 60000);
  try {
    const out = await llm(`Summarise the following document in a short, listenable summary (about 120-180 words, plain sentences, no markdown or bullet symbols) so someone can decide whether to listen to all of it:\n\n${body}`, 500);
    return NextResponse.json({ summary: out ?? extractiveSummary(body), ai: Boolean(out) });
  } catch (e: any) {
    return NextResponse.json({ summary: extractiveSummary(body), ai: false });
  }
}
