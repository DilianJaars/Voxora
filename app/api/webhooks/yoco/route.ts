import { NextResponse } from 'next/server';
import { grantPremium } from '@/lib/entitle';

export const runtime = 'nodejs';

// Yoco webhook (payment.succeeded). Configure the webhook URL in your Yoco dashboard.
// For production also verify the webhook signature headers per Yoco docs.
export async function POST(req: Request) {
  const evt = await req.json();
  if (evt?.type === 'payment.succeeded') {
    const m = evt.payload?.metadata || {};
    if (m.user_id) await grantPremium(m.user_id, Number(m.months) || 1, 'yoco');
  }
  return NextResponse.json({ ok: true });
}
