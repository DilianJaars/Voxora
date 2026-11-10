import type { SupabaseClient } from '@supabase/supabase-js';

// Cloned voices are billed to the site owner's ElevenLabs account, so each person gets a monthly allowance.
export const cloneCap = () => Number(process.env.CLONE_MONTHLY_CHARS) || 150000;
export const maxVoices = () => Number(process.env.MAX_CLONED_VOICES) || 5;

const monthStart = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
};

export async function monthCloneChars(admin: SupabaseClient, userId: string): Promise<number> {
  const { data } = await admin.from('usage_daily').select('voice_chars').eq('user_id', userId).gte('day', monthStart());
  return (data || []).reduce((a: number, r: any) => a + (r.voice_chars || 0), 0);
}

export async function addCloneChars(admin: SupabaseClient, userId: string, n: number) {
  const day = new Date().toISOString().slice(0, 10);
  const { data } = await admin.from('usage_daily').select('voice_chars').eq('user_id', userId).eq('day', day).maybeSingle();
  if (data) await admin.from('usage_daily').update({ voice_chars: (data.voice_chars || 0) + n }).eq('user_id', userId).eq('day', day);
  else await admin.from('usage_daily').insert({ user_id: userId, day, voice_chars: n });
}
