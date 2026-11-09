'use client';
import { supabaseBrowser } from './supabase';
import type { Doc } from './store';

// Best-effort cloud sync of a document for signed-in users (RLS restricts rows to the owner).
export async function syncDoc(d: Doc) {
  const sb = supabaseBrowser();
  if (!sb) return;
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  await sb.from('documents').upsert({
    id: d.id, user_id: session.user.id, title: d.title, source: d.source, text: d.text, position: d.position,
    summary: d.summary ?? null, notes: d.notes ?? null, updated_at: new Date(d.updatedAt).toISOString(),
  });
}

export async function pullDocs(): Promise<Doc[]> {
  const sb = supabaseBrowser();
  if (!sb) return [];
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return [];
  const { data } = await sb.from('documents').select('*').order('updated_at', { ascending: false });
  return (data || []).map((r: any) => ({
    id: r.id, title: r.title, source: r.source || '', text: r.text, position: r.position,
    createdAt: new Date(r.created_at).getTime(), updatedAt: new Date(r.updated_at).getTime(), summary: r.summary, notes: r.notes,
  }));
}

export async function removeRemote(id: string) {
  await supabaseBrowser()?.from('documents').delete().eq('id', id);
}
