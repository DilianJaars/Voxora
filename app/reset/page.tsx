'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';

// Opened from the reset link in the email. Supabase signs the person in briefly so they can choose a new password.
export default function Reset() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => data.session && setReady(true));
    const { data: sub } = sb.auth.onAuthStateChange((e) => { if (e === 'PASSWORD_RECOVERY' || e === 'SIGNED_IN') setReady(true); });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg('');
    const { error } = await supabaseBrowser()!.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setMsg(error.message);
    router.push('/dashboard');
  }

  return (
    <div className="mx-auto max-w-md px-5 py-14 sm:py-20">
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Choose a new password</h1>
      {!ready ? (
        <p className="mt-4 text-mute">Open this page from the link in your reset email. If the link has expired, ask for a new one on the sign in page.</p>
      ) : (
        <form onSubmit={save} className="mt-8 space-y-4">
          <label className="block text-sm">New password<input className="input mt-1.5" type="password" minLength={8} required autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
          <p className="text-xs text-mute">Use at least 8 characters.</p>
          <button disabled={busy || pw.length < 8} className="btn btn-primary w-full !py-3">{busy ? 'Saving' : 'Save password'}</button>
          {msg && <p role="alert" className="text-sm text-danger">{msg}</p>}
        </form>
      )}
    </div>
  );
}
