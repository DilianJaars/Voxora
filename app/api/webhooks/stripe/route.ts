import { NextResponse } from 'next/server';
import { grantPremium } from '@/lib/entitle';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const key = process.env.STRIPE_SECRET_KEY, secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!key || !secret) return new NextResponse('not configured', { status: 501 });
  const Stripe = (await import('stripe')).default;
  const stripe = new Stripe(key);
  let evt;
  try {
    evt = stripe.webhooks.constructEvent(await req.text(), req.headers.get('stripe-signature') || '', secret);
  } catch {
    return new NextResponse('bad signature', { status: 400 });
  }
  // First payment and every renewal extend premium
  if (evt.type === 'invoice.paid') {
    const inv: any = evt.data.object;
    const userId = inv.subscription_details?.metadata?.user_id || inv.lines?.data?.[0]?.metadata?.user_id;
    const interval = inv.lines?.data?.[0]?.price?.recurring?.interval;
    if (userId) await grantPremium(userId, interval === 'year' ? 12 : 1, 'stripe');
  }
  return NextResponse.json({ received: true });
}
