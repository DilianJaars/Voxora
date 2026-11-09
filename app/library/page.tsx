'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { deleteDoc, Doc, listDocs, saveDoc } from '@/lib/store';
import { pullDocs, removeRemote } from '@/lib/sync';
import { splitSentences } from '@/lib/text';
import { FREE_LIMITS } from '@/lib/plans';
import { useAccount } from '@/lib/useEntitlement';
import LimitBanner from '@/components/LimitBanner';
import { Icon } from '@/components/Icons';

const KIND: Record<string, string> = { paste: 'Pasted text', file: 'File', url: 'Web article', youtube: 'YouTube', ocr: 'Photo' };

export default function Library() {
  const { ent, loading } = useAccount();
  const [docs, setDocs] = useState<Doc[] | null>(null);

  useEffect(() => {
    (async () => {
      const local = await listDocs();
      setDocs(local);
      const remote = await pullDocs();
      const have = new Set(local.map((d) => d.id));
      for (const r of remote) if (!have.has(r.id)) await saveDoc(r);
      if (remote.length) setDocs(await listDocs());
    })();
  }, [loading]);

  const remove = async (id: string) => { await deleteDoc(id); removeRemote(id); setDocs((d) => d && d.filter((x) => x.id !== id)); };
  const atLimit = !ent.premium && (docs?.length ?? 0) >= FREE_LIMITS.maxDocs;

  return (
    <div className="mx-auto max-w-2xl px-5 py-12 sm:py-16">
      <div className="mb-8 flex items-end justify-between gap-4">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Library</h1>
        <Link href="/app" className="btn btn-primary"><Icon name="plus" size={16} />Add</Link>
      </div>
      {atLimit && <div className="mb-6"><LimitBanner message={`Your free library holds ${FREE_LIMITS.maxDocs} documents. Delete one to add more.`} /></div>}
      {docs === null ? <p className="text-mute">Loading</p> : docs.length === 0 ? (
        <p className="border-y border-line py-10 text-mute">Nothing saved yet. <Link href="/app" className="text-mark underline underline-offset-4">Add your first document</Link> and it will wait here, with your place kept.</p>
      ) : (
        <ul>
          {docs.map((d) => {
            const total = splitSentences(d.text).length || 1;
            const pct = Math.min(100, Math.round((d.position / total) * 100));
            const mins = Math.max(1, Math.round(d.text.split(/\s+/).length / 160));
            return (
              <li key={d.id} className="flex items-center gap-4 border-t border-line py-4 last:border-b">
                <Link href={`/read/${d.id}`} className="min-w-0 flex-1">
                  <div className="truncate text-lg font-semibold">{d.title}</div>
                  <div className="mt-0.5 text-sm text-mute">{KIND[d.source.split(':')[0]] || 'Document'}, {mins} min, {pct > 0 ? `${pct}% read` : 'not started'}</div>
                  <div className="mt-2.5 h-[3px] rounded bg-line"><div className="h-[3px] rounded bg-mark" style={{ width: `${pct}%` }} /></div>
                </Link>
                <button onClick={() => remove(d.id)} className="p-2 text-mute transition-colors hover:text-danger" aria-label={`Delete ${d.title}`}><Icon name="trash" size={18} /></button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
