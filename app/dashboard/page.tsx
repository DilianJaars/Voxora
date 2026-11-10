'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { supabaseBrowser, supabaseEnabled } from '@/lib/supabase';
import { useAccount } from '@/lib/useEntitlement';
import { FREE_LIMITS, PLAN } from '@/lib/plans';
import { getSettings, listDocs, setSettings } from '@/lib/store';
import { syncMyVoices } from '@/lib/myvoices';
import { fmtTime } from '@/lib/text';
import { Icon } from '@/components/Icons';

type Usage = { day: string; listen_seconds: number; downloads: number; imports: number };
type Payment = { id: string; provider: string; amount_cents: number | null; currency: string; months: number; created_at: string };

type MyVoice = { id: string; name: string; provider_voice_id: string; sample_path: string | null; quality: any; key_source: string; created_at: string };
const DAY = 86400000;
const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : 'Not set');
const money = (c: number | null, cur: string) => (c == null ? 'Not recorded' : `${cur === 'ZAR' ? 'R' : cur + ' '}${(c / 100).toFixed(2)}`);
const PROVIDERS: Record<string, string> = { payfast: 'PayFast', yoco: 'Yoco', stripe: 'Stripe' };

function Section({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <section className="border-t border-line py-8">
      <h2 className="text-xl font-bold tracking-tight">{title}</h2>
      {note && <p className="mt-1 text-sm text-mute">{note}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Meter({ label, value, max, text }: { label: string; value: number; max: number | null; text: string }) {
  const pct = max ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm"><span>{label}</span><span className="tabular-nums text-mute">{text}</span></div>
      <div className="mt-2 h-1.5 rounded bg-line"><div className={`h-1.5 rounded ${max && value >= max ? 'bg-danger' : 'bg-mark'}`} style={{ width: `${max ? pct : 100}%`, opacity: max ? 1 : 0.35 }} /></div>
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const acct = useAccount();
  const [usage, setUsage] = useState<Usage[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [docCount, setDocCount] = useState(0);
  const [voices, setVoices] = useState(0);
  const [ref, setRef] = useState<{ code?: string; friends?: number }>({});
  const [myVoices, setMyVoices] = useState<MyVoice[]>([]);
  const [cfg, setCfg] = useState<{ available: boolean; maxVoices: number; capChars: number; usedChars: number } | null>(null);
  const [goal, setGoal] = useState(20);
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState<{ k: 'ok' | 'err'; t: string } | null>(null);
  const [busy, setBusy] = useState('');

  useEffect(() => setGoal(getSettings().goalMin), []);
  useEffect(() => { if (!acct.loading && supabaseEnabled && !acct.email) router.replace('/login'); }, [acct.loading, acct.email, router]);

  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb || !acct.user) return;
    const since = new Date(Date.now() - 29 * DAY).toISOString().slice(0, 10);
    sb.from('usage_daily').select('day,listen_seconds,downloads,imports').gte('day', since).order('day').then(({ data }) => setUsage((data as Usage[]) || []));
    sb.from('payments').select('*').order('created_at', { ascending: false }).then(({ data }) => setPayments((data as Payment[]) || []));
    sb.from('cloned_voices').select('id', { count: 'exact', head: true }).then(({ count }) => setVoices(count || 0));
    loadVoices();
    fetch('/api/voice-clone', { headers: { authorization: `Bearer ${acct.token}` } }).then((r) => r.json()).then(setCfg).catch(() => {});
    listDocs().then((d) => setDocCount(d.length));
    fetch('/api/referral', { headers: { authorization: `Bearer ${acct.token}` } }).then((r) => r.json()).then(setRef).catch(() => {});
  }, [acct.user, acct.token]);

  const today = new Date().toISOString().slice(0, 10);
  const todayRow = usage.find((u) => u.day === today);
  const premium = acct.ent.premium;

  // 30-day chart + streak
  const series = useMemo(() => {
    const byDay = new Map(usage.map((u) => [u.day, u]));
    return Array.from({ length: 30 }, (_, i) => {
      const d = new Date(Date.now() - (29 - i) * DAY).toISOString().slice(0, 10);
      return { day: d, min: Math.round(((byDay.get(d)?.listen_seconds || 0) / 60) * 10) / 10 };
    });
  }, [usage]);
  const streak = useMemo(() => {
    let n = 0, i = series.length - 1;
    if (series[i].min === 0) i--; // today not started yet does not break a streak
    for (; i >= 0 && series[i].min > 0; i--) n++;
    return n;
  }, [series]);
  const maxMin = Math.max(5, ...series.map((s) => s.min));
  const totalSeconds = usage.reduce((a, u) => a + u.listen_seconds, 0);
  const activeDays = series.filter((s) => s.min > 0).length;

  // membership
  const p = acct.profile;
  const monthsPaid = payments.reduce((a, x) => a + x.months, 0);
  const spent = payments.reduce<Record<string, number>>((a, x) => { if (x.amount_cents) a[x.currency] = (a[x.currency] || 0) + x.amount_cents; return a; }, {});
  const now = Date.now();
  const t = (v?: string | null) => (v ? new Date(v).getTime() : 0);
  const statusLabel = { paid: 'Premium', trial: 'Free trial', referral: 'Referral bonus', free: 'Free plan' }[acct.ent.source];
  const end = t(acct.ent.endsAt);
  const start = acct.ent.source === 'trial' ? t(p?.created_at) : acct.ent.source === 'paid' ? t(payments[0]?.created_at) || end - 30 * DAY : now;
  const progress = end > start ? Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100)) : 0;
  const coverage = [
    { name: 'Free trial', until: p?.trial_ends_at },
    { name: 'Referral bonus', until: p?.referral_bonus_until },
    { name: 'Paid Premium', until: p?.premium_until },
  ];

  function loadVoices() {
    supabaseBrowser()?.from('cloned_voices').select('id,name,provider_voice_id,sample_path,quality,key_source,created_at').order('created_at', { ascending: false })
      .then(({ data }) => setMyVoices((data as MyVoice[]) || []));
  }
  async function playSample(path: string) {
    const { data } = await supabaseBrowser()!.storage.from('voice-samples').createSignedUrl(path, 300);
    if (data?.signedUrl) new Audio(data.signedUrl).play();
  }
  async function previewVoice(v: MyVoice) {
    const r = await fetch('/api/tts', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${acct.token}` }, body: JSON.stringify({ text: 'This is my own voice, reading to me.', preview: true, elevenVoiceId: v.provider_voice_id, elevenKey: getSettings().elevenKey }) });
    if (!r.ok) return setMsg({ k: 'err', t: (await r.json().catch(() => ({}))).error || 'Could not play the voice.' });
    new Audio(URL.createObjectURL(await r.blob())).play();
  }
  async function removeVoice(v: MyVoice) {
    const r = await fetch(`/api/voice-clone?id=${v.id}`, { method: 'DELETE', headers: { authorization: `Bearer ${acct.token}` } });
    if (!r.ok) return setMsg({ k: 'err', t: 'Could not delete that voice.' });
    if (getSettings().voice === 'custom:' + v.provider_voice_id) setSettings({ voice: 'jenny' });
    loadVoices(); syncMyVoices();
  }
  async function api(path: string, init?: RequestInit) {
    return fetch(path, { ...init, headers: { ...(init?.headers || {}), authorization: `Bearer ${acct.token}` } });
  }
  async function changePassword(e: React.FormEvent) {
    e.preventDefault(); setMsg(null); setBusy('pw');
    const { error } = await supabaseBrowser()!.auth.updateUser({ password: pw });
    setBusy(''); setPw('');
    setMsg(error ? { k: 'err', t: error.message } : { k: 'ok', t: 'Password changed.' });
  }
  async function signOutEverywhere() {
    setBusy('out');
    await supabaseBrowser()!.auth.signOut({ scope: 'global' });
    router.push('/');
  }
  async function exportData() {
    setBusy('export'); setMsg(null);
    const r = await api('/api/account/export');
    setBusy('');
    if (!r.ok) return setMsg({ k: 'err', t: (await r.json().catch(() => ({}))).error || 'Could not export your data.' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(await r.blob()); a.download = 'voxora-my-data.json'; a.click();
  }
  async function deleteAccount() {
    setBusy('delete'); setMsg(null);
    const r = await api('/api/account/delete', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirm }) });
    if (!r.ok) { setBusy(''); return setMsg({ k: 'err', t: (await r.json().catch(() => ({}))).error || 'Could not delete the account.' }); }
    await supabaseBrowser()!.auth.signOut();
    router.push('/');
  }

  if (!supabaseEnabled) return <div className="mx-auto max-w-xl px-5 py-20"><h1 className="text-3xl font-extrabold tracking-tight">Dashboard</h1><p className="mt-3 text-mute">Accounts are not switched on yet, so there is no dashboard to show.</p></div>;
  if (acct.loading || !acct.email) return <div className="grid min-h-[50vh] place-items-center text-mute">Loading</div>;

  return (
    <div className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">Your dashboard</h1>
      <p className="mt-2 text-mute">{acct.email}. Member since {fmtDate(acct.user?.createdAt)}.</p>

      {/* Membership */}
      <section className="mt-10 rounded-2xl border border-line bg-panel p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <div className="text-sm text-mute">Membership</div>
            <div className="mt-1 text-3xl font-extrabold tracking-tight">{statusLabel}</div>
            {premium ? <p className="mt-1 text-mute">{acct.ent.source === 'paid' ? 'Renews or ends' : 'Ends'} on {fmtDate(acct.ent.endsAt)}</p> : <p className="mt-1 text-mute">Upgrade for R{PLAN.monthlyZAR} a month.</p>}
          </div>
          <div className="text-right">
            <div className="text-6xl font-extrabold leading-none tracking-tight tabular-nums">{premium ? acct.ent.daysLeft : 0}</div>
            <div className="mt-1 text-sm text-mute">days of Premium left</div>
          </div>
        </div>
        {premium && <div className="mt-6 h-1.5 rounded bg-line"><div className="h-1.5 rounded bg-mark" style={{ width: `${progress}%` }} /></div>}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/pricing" className="btn btn-primary">{acct.ent.source === 'paid' ? 'Extend Premium' : 'Upgrade to Premium'}</Link>
          <Link href="/settings" className="btn btn-quiet">Voice and engine settings</Link>
        </div>
        <dl className="mt-8 grid gap-x-8 gap-y-4 text-sm sm:grid-cols-3">
          <div><dt className="text-mute">Months paid</dt><dd className="mt-0.5 text-lg font-semibold tabular-nums">{monthsPaid}</dd></div>
          <div><dt className="text-mute">Total paid</dt><dd className="mt-0.5 text-lg font-semibold tabular-nums">{Object.keys(spent).length ? Object.entries(spent).map(([c, v]) => money(v, c)).join(', ') : 'R0.00'}</dd></div>
          <div><dt className="text-mute">Cloned voices</dt><dd className="mt-0.5 text-lg font-semibold tabular-nums">{voices}</dd></div>
        </dl>
        <ul className="mt-8 divide-y divide-line border-y border-line text-sm">
          {coverage.map((c) => {
            const live = t(c.until) > now;
            return (
              <li key={c.name} className="flex items-center justify-between py-3">
                <span>{c.name}</span>
                <span className={live ? 'text-fg' : 'text-mute'}>{c.until ? (live ? `Active until ${fmtDate(c.until)}` : `Ended ${fmtDate(c.until)}`) : 'None'}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <Section title="Today" note={premium ? 'Premium has no daily limits.' : 'Free plan limits reset every day at midnight UTC (2:00 in South Africa).'}>
        <div className="grid gap-6 sm:grid-cols-3">
          <Meter label="Listening" value={(todayRow?.listen_seconds || 0)} max={premium ? null : FREE_LIMITS.listenSecondsPerDay} text={`${Math.floor((todayRow?.listen_seconds || 0) / 60)} min${premium ? '' : ` of ${FREE_LIMITS.listenSecondsPerDay / 60}`}`} />
          <Meter label="MP3 downloads" value={todayRow?.downloads || 0} max={premium ? null : FREE_LIMITS.downloadsPerDay} text={`${todayRow?.downloads || 0}${premium ? '' : ` of ${FREE_LIMITS.downloadsPerDay}`}`} />
          <Meter label="Web, YouTube and photo imports" value={todayRow?.imports || 0} max={premium ? null : FREE_LIMITS.importsPerDay} text={`${todayRow?.imports || 0}${premium ? '' : ` of ${FREE_LIMITS.importsPerDay}`}`} />
        </div>
      </Section>

      <Section title="Listening">
        <div className="grid gap-6 sm:grid-cols-4">
          <div><div className="text-3xl font-extrabold tabular-nums">{streak}</div><div className="text-sm text-mute">day streak</div></div>
          <div><div className="text-3xl font-extrabold tabular-nums">{fmtTime(totalSeconds)}</div><div className="text-sm text-mute">listened in 30 days</div></div>
          <div><div className="text-3xl font-extrabold tabular-nums">{activeDays}</div><div className="text-sm text-mute">active days of 30</div></div>
          <div><div className="text-3xl font-extrabold tabular-nums">{docCount}</div><div className="text-sm text-mute">documents</div></div>
        </div>

        <svg viewBox="0 0 300 70" className="mt-8 w-full" role="img" aria-label="Minutes listened each day for the last 30 days" preserveAspectRatio="none">
          {series.map((s, i) => {
            const h = s.min ? Math.max(2, (s.min / maxMin) * 64) : 1;
            return <rect key={s.day} x={i * 10 + 1} width={8} y={68 - h} height={h} rx={1.5} className={s.min ? 'fill-mark' : 'fill-line'}><title>{`${s.day}: ${s.min} min`}</title></rect>;
          })}
        </svg>
        <div className="mt-1 flex justify-between text-xs text-mute"><span>30 days ago</span><span>Today</span></div>

        <div className="mt-8 flex flex-wrap items-end gap-6">
          <div className="min-w-[220px] flex-1"><Meter label="Daily goal" value={Math.floor((todayRow?.listen_seconds || 0) / 60)} max={goal} text={`${Math.floor((todayRow?.listen_seconds || 0) / 60)} of ${goal} min`} /></div>
          <label className="text-sm">Goal
            <select className="input mt-1.5 !w-auto" value={goal} onChange={(e) => { setGoal(+e.target.value); setSettings({ goalMin: +e.target.value }); }}>
              {[10, 20, 30, 45, 60, 90].map((m) => <option key={m} value={m}>{m} minutes a day</option>)}
            </select>
          </label>
        </div>
      </Section>

      <Section title="My voices" note="Voices made from your own recordings. They are saved to your account, so only you can see and use them, on any device.">
        {myVoices.length === 0 ? (
          <p className="text-sm text-mute">You have not made a voice yet. <Link href="/voice" className="text-mark underline underline-offset-4">Record a short script</Link> and your books and articles can be read in your own voice.</p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {myVoices.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-4">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{v.name}</div>
                  <div className="text-sm text-mute">Made {fmtDate(v.created_at)}{v.quality?.verdict ? `, recording quality: ${v.quality.verdict === 'good' ? 'good' : v.quality.verdict === 'ok' ? 'usable' : 'low'}` : ''}</div>
                </div>
                <button className="btn btn-quiet !py-1.5" onClick={() => previewVoice(v)}>Hear it</button>
                {v.sample_path && <button className="btn btn-quiet !py-1.5" onClick={() => playSample(v.sample_path!)}>My recording</button>}
                <button className="btn btn-primary !py-1.5" onClick={() => { setSettings({ voice: 'custom:' + v.provider_voice_id }); router.push('/app'); }}>Use for reading</button>
                <button className="p-2 text-mute transition-colors hover:text-danger" onClick={() => removeVoice(v)} aria-label={`Delete ${v.name}`}><Icon name="trash" size={18} /></button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <Link href="/voice" className="btn btn-quiet"><Icon name="mic" size={16} />Record a new voice</Link>
          {cfg?.available && <span className="text-sm text-mute">Own-voice reading this month: {Math.round(cfg.usedChars / 1000)}k of {Math.round(cfg.capChars / 1000)}k characters. Up to {cfg.maxVoices} voices.</span>}
        </div>
      </Section>

      <Section title="Referrals" note="When a friend joins with your link they get 2 months free and you get 1 more month of Premium.">
        <div className="flex gap-2"><input readOnly className="input" value={ref.code ? `${typeof location !== 'undefined' ? location.origin : ''}/login?ref=${ref.code}` : ''} aria-label="Your referral link" /><button className="btn btn-quiet" onClick={() => ref.code && navigator.clipboard.writeText(`${location.origin}/login?ref=${ref.code}`)}>Copy link</button></div>
        <p className="mt-3 text-sm text-mute">Friends who joined: {ref.friends ?? 0}. Months earned: {ref.friends ?? 0}.</p>
      </Section>

      <Section title="Payments" note="Receipts for every payment that unlocked Premium on this account.">
        {payments.length === 0 ? <p className="text-sm text-mute">No payments yet. Your trial does not need one.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-mute"><tr><th className="pb-2 font-normal">Date</th><th className="pb-2 font-normal">Paid with</th><th className="pb-2 font-normal">Covers</th><th className="pb-2 text-right font-normal">Amount</th></tr></thead>
              <tbody className="divide-y divide-line border-t border-line">
                {payments.map((x) => (
                  <tr key={x.id}><td className="py-3">{fmtDate(x.created_at)}</td><td>{PROVIDERS[x.provider] || x.provider}</td><td>{x.months} month{x.months === 1 ? '' : 's'}</td><td className="text-right tabular-nums">{money(x.amount_cents, x.currency)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Security and privacy">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div><dt className="text-mute">Email</dt><dd className="mt-0.5">{acct.email}</dd></div>
          <div><dt className="text-mute">Last sign in</dt><dd className="mt-0.5">{acct.user?.lastSignIn ? new Date(acct.user.lastSignIn).toLocaleString() : 'Unknown'}</dd></div>
        </dl>
        <ul className="mt-5 space-y-2 text-sm text-mute">
          <li className="flex gap-2"><Icon name="lock" size={15} className="mt-0.5 shrink-0 text-mark" />Your documents, usage and payment records can only be read by you. The database enforces this, not just the app.</li>
          <li className="flex gap-2"><Icon name="lock" size={15} className="mt-0.5 shrink-0 text-mark" />Card details go straight to PayFast, Yoco or Stripe. Voxora never sees or stores them.</li>
          <li className="flex gap-2"><Icon name="lock" size={15} className="mt-0.5 shrink-0 text-mark" />Premium is only ever switched on by a verified payment notice from the payment provider, never by the browser.</li>
        </ul>

        <form onSubmit={changePassword} className="mt-8 flex flex-wrap items-end gap-3">
          <label className="min-w-[220px] flex-1 text-sm">New password<input className="input mt-1.5" type="password" minLength={8} required autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
          <button disabled={busy === 'pw' || pw.length < 8} className="btn btn-quiet">Change password</button>
        </form>
        <p className="mt-1.5 text-xs text-mute">Use at least 8 characters.</p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button onClick={signOutEverywhere} disabled={busy === 'out'} className="btn btn-quiet">Sign out of all devices</button>
          <button onClick={exportData} disabled={busy === 'export'} className="btn btn-quiet"><Icon name="download" size={16} />Download my data</button>
        </div>
        {msg && <p role="status" className={`mt-4 text-sm ${msg.k === 'err' ? 'text-danger' : 'text-ok'}`}>{msg.t}</p>}

        <div className="mt-10 border-l-2 border-danger pl-5">
          <h3 className="font-semibold">Delete account</h3>
          <p className="mt-1 text-sm text-mute">This permanently removes your account, library, usage history and cloned voices. It cannot be undone. If you pay by subscription through Stripe, cancel it there too.</p>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="min-w-[200px] text-sm">Type DELETE to confirm<input className="input mt-1.5" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" /></label>
            <button onClick={deleteAccount} disabled={confirm !== 'DELETE' || busy === 'delete'} className="btn border border-danger text-danger hover:bg-danger/10">Delete my account</button>
          </div>
        </div>
      </Section>
    </div>
  );
}
