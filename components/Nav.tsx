'use client';
import Link from 'next/link';
import { useAccount } from '@/lib/useEntitlement';
import { supabaseBrowser } from '@/lib/supabase';

export function Logo() {
  return (
    <span className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
      <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand text-white">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
      </span>
      Voxora
    </span>
  );
}

export default function Nav() {
  const acct = useAccount();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/"><Logo /></Link>
        <div className="flex items-center gap-1 text-sm sm:gap-3">
          <Link href="/app" className="rounded-full px-3 py-2 text-zinc-300 hover:text-white">Listen</Link>
          <Link href="/library" className="rounded-full px-3 py-2 text-zinc-300 hover:text-white">Library</Link>
          <Link href="/pricing" className="hidden rounded-full px-3 py-2 text-zinc-300 hover:text-white sm:block">Pricing</Link>
          <Link href="/settings" className="hidden rounded-full px-3 py-2 text-zinc-300 hover:text-white sm:block">Settings</Link>
          {acct.email ? (
            <button className="btn btn-ghost !py-1.5" onClick={() => supabaseBrowser()?.auth.signOut()}>Sign out</button>
          ) : (
            <Link href="/login" className="btn btn-primary !py-1.5">Start free</Link>
          )}
        </div>
      </nav>
    </header>
  );
}
