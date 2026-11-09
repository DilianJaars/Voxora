'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { deleteDoc, Doc, listDocs, saveDoc } from '@/lib/store';
import { pullDocs, removeRemote } from '@/lib/sync';
import { splitSentences } from '@/lib/text';
import { FREE_LIMITS } from '@/lib/plans';
import { useAccount } from '@/lib/useEntitlement';
import LimitBanner from '@/components/LimitBanner';

export default function Library() {
  const { ent, loading } = useAccount();
  const [docs, setDocs] = useState<Doc[] | null>(null);

  useEffect(() => {
    (async () => {
      const local = await listDocs();
      setDocs(local);
      // Merge in anything saved to the cloud from other devices
      const remote = await pullDocs();
      const have = new Set(local.map((d) => d.id));
      for (const r of remote) if (!have.has(r.id)) await saveDoc(r);
      if (remote.length) setDocs(await listDocs());
    })();
  }, [loading]);

  const remove = async (id: string) => { await deleteDoc(id); removeRemote(id); setDocs((d) => d && d.filter((x) => x.id !== id)); };
  const atLimit = !ent.premium && (docs?.length ?? 0) >= FREE_LIMITS.maxDocs;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-extrabold">Your library</h1>
        <Link href="/app" className="btn btn-primary">+ Add</Link>
      </div>
      {atLimit && <div className="mb-4"><LimitBanner message={`Free library holds ${FREE_LIMITS.maxDocs} documents. Older ones stay readable.`} /></div>}
      {docs === null ? <p className="text-zinc-400">Loading…</p> : docs.length === 0 ? (
        <div className="card text-center text-zinc-400">Nothing here yet. <Link href="/app" className="text-brand-soft underline">Add your first document</Link>.</div>
      ) : (
        <div className="space-y-3">
          {docs.map((d) => {
            const total = splitSentences(d.text).length || 1;
            const pct = Math.min(100, Math.round((d.position / total) * 100));
            return (
              <div key={d.id} className="card flex items-center justify-between gap-3">
                <Link href={`/read/${d.id}`} className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{d.title}</div>
                  <div className="text-xs text-zinc-400">{d.source.split(':')[0]} · {Math.round(d.text.split(/\s+/).length / 160)} min · {pct > 0 ? `${pct}% — resume` : 'not started'}</div>
                  <div className="mt-2 h-1 rounded bg-panel2"><div className="h-1 rounded bg-brand" style={{ width: `${pct}%` }} /></div>
                </Link>
                <button onClick={() => remove(d.id)} className="text-zinc-500 hover:text-red-400" aria-label="Delete">🗑</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
