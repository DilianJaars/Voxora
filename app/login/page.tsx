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
    router.push('/app');
  }

  if (!supabaseEnabled) return <p className="card text-sm text-zinc-400">Accounts are not configured yet. Set the Supabase keys in <code>.env.local</code> (see README). You can still use Voxora without an account.</p>;

  return (
    <form onSubmit={submit} className="card space-y-3">
      <div className="flex rounded-full border border-line p-1 text-sm">
        {(['signup', 'signin'] as const).map((m) => (
          <button type="button" key={m} onClick={() => setMode(m)} className={`flex-1 rounded-full py-2 ${mode === m ? 'bg-brand text-white' : 'text-zinc-400'}`}>{m === 'signup' ? 'Create account' : 'Sign in'}</button>
        ))}
      </div>
      <input className="input" type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input className="input" type="password" required minLength={6} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
      {mode === 'signup' && <input className="input" placeholder="Referral code (optional)" value={ref} onChange={(e) => setRef(e.target.value)} />}
      <button disabled={busy} className="btn btn-primary w-full">{busy ? '…' : mode === 'signup' ? `Start ${PLAN.trialMonths} months free` : 'Sign in'}</button>
      {msg && <p className="text-sm text-amber-300">{msg}</p>}
    </form>
  );
}

export default function Login() {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="mb-2 text-3xl font-extrabold">Welcome to Voxora</h1>
      <p className="mb-6 text-zinc-400">New accounts get {PLAN.trialMonths} months of Premium free. We'll remind you before it ends.</p>
      <Suspense><Form /></Suspense>
    </div>
  );
}
