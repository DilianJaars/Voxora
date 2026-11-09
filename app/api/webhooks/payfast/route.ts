import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { grantPremium } from '@/lib/entitle';

export const runtime = 'nodejs';

// PayFast ITN: verify signature, then unlock premium instantly.
export async function POST(req: Request) {
  const raw = await req.text();
  const params = new URLSearchParams(raw);
  const data: [string, string][] = [];
  let sig = '';
  params.forEach((v, k) => (k === 'signature' ? (sig = v) : data.push([k, v])));
  const qs = data.map(([k, v]) => `${k}=${encodeURIComponent(v.trim()).replace(/%20/g, '+')}`).join('&');
  const pass = process.env.PAYFAST_PASSPHRASE;
  const expected = crypto.createHash('md5').update(pass ? `${qs}&passphrase=${encodeURIComponent(pass.trim()).replace(/%20/g, '+')}` : qs).digest('hex');
  if (expected !== sig) return new NextResponse('bad signature', { status: 400 });

  // Confirm with PayFast server
  const host = process.env.PAYFAST_SANDBOX === 'false' ? 'www.payfast.co.za' : 'sandbox.payfast.co.za';
  const v = await fetch(`https://${host}/eng/query/validate`, { method: 'POST', body: qs, headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  if ((await v.text()).trim() !== 'VALID') return new NextResponse('invalid', { status: 400 });

  if (params.get('payment_status') === 'COMPLETE') {
    const [userId, months] = (params.get('m_payment_id') || '').split(':');
    if (userId) await grantPremium(userId, Number(months) || 1, 'payfast', { ref: params.get('pf_payment_id') || undefined, amountCents: Math.round(parseFloat(params.get('amount_gross') || '0') * 100), currency: 'ZAR' });
  }
  return new NextResponse('ok');
}
