import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { PLAN } from '@/lib/plans';

export const runtime = 'nodejs';
export const maxDuration = 60;

async function sendEmail(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: process.env.EMAIL_FROM || 'Voxora <hello@voxora.app>', to, subject, html }),
  });
  return r.ok;
}

const wrap = (body: string) => `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;background:#0a0a0f;color:#eee;padding:28px;border-radius:16px">
<h2 style="color:#a78bfa;margin-top:0">Voxora</h2>${body}
<p><a href="${process.env.NEXT_PUBLIC_APP_URL || ''}/pricing" style="display:inline-block;background:#8b5cf6;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:600">Keep Premium – R${PLAN.monthlyZAR}/month</a></p>
<p style="color:#888;font-size:12px">Prefer to stay on the free plan? No action needed — you keep 30 minutes of listening a day and 5 natural voices.</p></div>`;

// Runs daily (see vercel.json). Sends reminders before the free trial ends, plus a "trial ended" note.
export async function GET(req: Request) {
  if (process.env.CRON_SECRET && req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('unauthorized', { status: 401 });
  }
  const admin = supabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Supabase not configured' }, { status: 501 });

  const now = Date.now();
  const day = 86400000;
  let sent = 0;

  const { data: rows } = await admin
    .from('profiles')
    .select('id,email,trial_ends_at,premium_until,trial_reminder_7d_sent,trial_reminder_1d_sent,trial_ended_notice_sent')
    .gt('trial_ends_at', new Date(now - 3 * day).toISOString())
    .lt('trial_ends_at', new Date(now + 8 * day).toISOString());

  for (const p of rows || []) {
    if (!p.email) continue;
    if (p.premium_until && new Date(p.premium_until).getTime() > now) continue; // already paying
    const left = new Date(p.trial_ends_at).getTime() - now;

    if (left > 0 && left <= 7 * day && !p.trial_reminder_7d_sent) {
      const d = Math.ceil(left / day);
      if (await sendEmail(p.email, `Your free Voxora Premium ends in ${d} days`, wrap(`<p>Your free ${PLAN.trialMonths}-month Premium trial ends in <b>${d} days</b>.</p><p>Keep unlimited listening, all 20+ voices, voice cloning, AI summaries and more for just R${PLAN.monthlyZAR}/month (or R${PLAN.yearlyZAR}/year).</p>`))) {
        await admin.from('profiles').update({ trial_reminder_7d_sent: true }).eq('id', p.id); sent++;
      }
    } else if (left > 0 && left <= 1 * day && !p.trial_reminder_1d_sent) {
      if (await sendEmail(p.email, 'Last day of your free Voxora Premium', wrap(`<p>Your free Premium trial ends <b>tomorrow</b>. Upgrade now to keep all your premium features without a break.</p>`))) {
        await admin.from('profiles').update({ trial_reminder_1d_sent: true }).eq('id', p.id); sent++;
      }
    } else if (left <= 0 && !p.trial_ended_notice_sent) {
      if (await sendEmail(p.email, 'Your Voxora free trial has ended', wrap(`<p>Your free trial has ended and you're now on the free plan. Your library is safe. Come back to Premium any time for R${PLAN.monthlyZAR}/month.</p>`))) {
        await admin.from('profiles').update({ trial_ended_notice_sent: true }).eq('id', p.id); sent++;
      }
    }
  }
  return NextResponse.json({ checked: rows?.length ?? 0, sent });
}
