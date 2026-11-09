import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { userFromRequest } from '@/lib/supabaseAdmin';
import { PLAN } from '@/lib/plans';

export const runtime = 'nodejs';

const APP = () => process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// PayFast signature: urlencoded fields in order + passphrase, md5
function payfastSignature(data: Record<string, string>, passphrase?: string) {
  const qs = Object.entries(data).filter(([, v]) => v !== '').map(([k, v]) => `${k}=${encodeURIComponent(v.trim()).replace(/%20/g, '+')}`).join('&');
  return crypto.createHash('md5').update(passphrase ? `${qs}&passphrase=${encodeURIComponent(passphrase.trim()).replace(/%20/g, '+')}` : qs).digest('hex');
}

// POST { plan: 'monthly'|'yearly', provider: 'payfast'|'yoco'|'stripe' }
export async function POST(req: Request) {
  const u = await userFromRequest(req);
  if (!u) return NextResponse.json({ error: 'Please sign in first so we can unlock Premium on your account.' }, { status: 401 });
  const { plan = 'monthly', provider = 'payfast' } = await req.json();
  const yearly = plan === 'yearly';
  const zar = yearly ? PLAN.yearlyZAR : PLAN.monthlyZAR;
  const months = yearly ? 12 : 1;

  try {
    if (provider === 'stripe') {
      const key = process.env.STRIPE_SECRET_KEY;
      const price = yearly ? process.env.STRIPE_PRICE_YEARLY : process.env.STRIPE_PRICE_MONTHLY;
      if (!key || !price) return NextResponse.json({ error: 'Stripe is not configured yet.' }, { status: 501 });
      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(key);
      const s = await stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [{ price, quantity: 1 }],
        customer_email: u.email,
        client_reference_id: u.id,
        metadata: { user_id: u.id },
        subscription_data: { metadata: { user_id: u.id } },
        success_url: `${APP()}/checkout/success`,
        cancel_url: `${APP()}/pricing`,
      });
      return NextResponse.json({ url: s.url });
    }

    if (provider === 'yoco') {
      const key = process.env.YOCO_SECRET_KEY;
      if (!key) return NextResponse.json({ error: 'Yoco is not configured yet.' }, { status: 501 });
      const r = await fetch('https://payments.yoco.com/api/checkouts', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          amount: zar * 100, currency: 'ZAR',
          successUrl: `${APP()}/checkout/success`, cancelUrl: `${APP()}/pricing`, failureUrl: `${APP()}/pricing`,
          metadata: { user_id: u.id, months: String(months) },
        }),
      });
      const j = await r.json();
      if (!r.ok) return NextResponse.json({ error: j?.message || 'Yoco error' }, { status: 502 });
      return NextResponse.json({ url: j.redirectUrl });
    }

    // PayFast (default for South Africa; also supports SnapScan / EFT / cards)
    const id = process.env.PAYFAST_MERCHANT_ID, mkey = process.env.PAYFAST_MERCHANT_KEY;
    if (!id || !mkey) return NextResponse.json({ error: 'PayFast is not configured yet.' }, { status: 501 });
    const fields: Record<string, string> = {
      merchant_id: id, merchant_key: mkey,
      return_url: `${APP()}/checkout/success`, cancel_url: `${APP()}/pricing`, notify_url: `${APP()}/api/webhooks/payfast`,
      email_address: u.email || '',
      m_payment_id: `${u.id}:${months}`,
      amount: zar.toFixed(2),
      item_name: `Voxora Premium (${yearly ? 'yearly' : 'monthly'})`,
    };
    const signature = payfastSignature(fields, process.env.PAYFAST_PASSPHRASE);
    const host = process.env.PAYFAST_SANDBOX === 'false' ? 'www.payfast.co.za' : 'sandbox.payfast.co.za';
    return NextResponse.json({ form: { action: `https://${host}/eng/process`, fields: { ...fields, signature } } });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
