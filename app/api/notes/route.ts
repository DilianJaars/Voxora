import { NextResponse } from 'next/server';
import { extractiveSummary, llm } from '@/lib/ai';
import { requirePremium } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const maxDuration = 60;

// AI Notes: key points + highlights from the part of the document the person has listened to.
export async function POST(req: Request) {
  const denied = await requirePremium(req);
  if (denied) return denied;
  const { text } = await req.json();
  const body = String(text || '').slice(0, 60000);
  try {
    const out = await llm(`From the text below, write study notes: 5-8 key points as short lines starting with "- ", then a line "Highlights:" followed by 3 of the most important sentences quoted exactly.\n\n${body}`, 800);
    if (out) return NextResponse.json({ notes: out, ai: true });
  } catch {}
  const pts = extractiveSummary(body, 6).split(/(?<=[.!?])\s+/).map((s) => `- ${s}`).join('\n');
  return NextResponse.json({ notes: `Key points:\n${pts}`, ai: false });
}
