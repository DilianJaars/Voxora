'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseBrowser, supabaseEnabled } from '@/lib/supabase';
import { PLAN } from '@/lib/plans';

function Form() {
  const router = useRouter();
  const sp = useSearchParams();
  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [ref, setRef] = useState(sp.get('ref') || '');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const sb = supabaseBrowser();
    if (!sb) return;
    setBusy(true); setMsg('');
    const res = mode === 'signup'
      ? await sb.auth.signUp({ email, password, options: { data: { ref: ref.trim().toLowerCase() } } })
      : await sb.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (res.error) return setMsg(res.error.message);
    if (mode === 'signup' && !res.data.session) return setMsg('Check your email to confirm your account, then sign in.');
    router.push('/dashboard');
  }

  async function forgot() {
    const sb = supabaseBrowser();
    if (!sb || !email) return setMsg('Type your email above first, then choose Forgot password.');
    setBusy(true); setMsg('');
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/reset` });
    setBusy(false);
    setMsg(error ? error.message : 'If that email has an account, a reset link is on its way.');
  }

  if (!supabaseEnabled) return <p className="border-l-2 border-mark bg-panel px-4 py-3 text-sm text-mute">Accounts are not switched on yet. You can still use Voxora without one.</p>;

  const seg = (on: boolean) => `flex-1 rounded-md py-2 text-sm transition-colors ${on ? 'bg-mark font-semibold text-onmark' : 'text-mute hover:text-fg'}`;
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex rounded-lg border border-line p-1">
        <button type="button" onClick={() => setMode('signup')} className={seg(mode === 'signup')}>Create account</button>
        <button type="button" onClick={() => setMode('signin')} className={seg(mode === 'signin')}>Sign in</button>
      </div>
      <label className="block text-sm">Email<input className="input mt-1.5" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label className="block text-sm">Password<input className="input mt-1.5" type="password" required minLength={6} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      {mode === 'signup' && <label className="block text-sm">Referral code, if you have one<input className="input mt-1.5" value={ref} onChange={(e) => setRef(e.target.value)} /></label>}
      {mode === 'signin' && <button type="button" onClick={forgot} className="btn-text">Forgot password?</button>}
      <button disabled={busy} className="btn btn-primary w-full !py-3">{busy ? 'One moment' : mode === 'signup' ? 'Create account' : 'Sign in'}</button>
      {msg && <p role="alert" className="text-sm text-mute">{msg}</p>}
    </form>
  );
}

export default function Login() {
  return (
    <div className="mx-auto max-w-md px-5 py-14 sm:py-20">
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Create your account</h1>
      <p className="mb-8 mt-3 text-mute">Then start {PLAN.trialMonths} months of Premium free from your dashboard. No card needed, and you choose how to pay later.</p>
      <Suspense><Form /></Suspense>
    </div>
  );
}
