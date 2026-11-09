'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAccount } from '@/lib/useEntitlement';
import { supabaseBrowser } from '@/lib/supabase';
import { Bars } from './Icons';

export function Logo() {
  return (
    <span className="flex items-center gap-2.5 text-[1.35rem] font-bold tracking-tight">
      <Bars className="text-mark !h-5" />
      Voxora
    </span>
  );
}

export default function Nav() {
  const acct = useAccount();
  const [install, setInstall] = useState<any>(null);
  useEffect(() => {
    const on = (e: Event) => { e.preventDefault(); setInstall(e); };
    window.addEventListener('beforeinstallprompt', on);
    return () => window.removeEventListener('beforeinstallprompt', on);
  }, []);
  const link = 'rounded-md px-2.5 py-2 text-sm text-mute transition-colors hover:text-fg';
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-ink/85 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
        <Link href="/" aria-label="Voxora home"><Logo /></Link>
        <div className="flex items-center gap-1">
          <Link href="/app" className={link}>Listen</Link>
          <Link href="/library" className={link}>Library</Link>
          {acct.email && <Link href="/dashboard" className={link}>Dashboard</Link>}
          <Link href="/pricing" className={`${link} hidden sm:block`}>Pricing</Link>
          <Link href="/settings" className={`${link} hidden sm:block`}>Settings</Link>
          {install && <button className={`${link} hidden md:block`} onClick={async () => { install.prompt(); await install.userChoice; setInstall(null); }}>Install app</button>}
          {acct.email ? (
            <button className="btn btn-quiet ml-2 !py-1.5" onClick={() => supabaseBrowser()?.auth.signOut()}>Sign out</button>
          ) : (
            <Link href="/login" className="btn btn-primary ml-2 !py-1.5">Sign up</Link>
          )}
        </div>
      </nav>
    </header>
  );
}
