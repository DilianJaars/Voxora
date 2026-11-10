'use client';
import { supabaseBrowser } from './supabase';
import { setSettings } from './store';

// A signed-in person's own cloned voices live in their account (not the browser), so every device sees them.
export async function syncMyVoices() {
  const sb = supabaseBrowser();
  if (!sb) return [];
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return [];
  const { data } = await sb.from('cloned_voices').select('name,provider_voice_id').order('created_at', { ascending: false });
  const voices = (data || []).map((v: any) => ({ id: v.provider_voice_id as string, name: v.name as string, provider: 'elevenlabs' as const }));
  setSettings({ customVoices: voices });
  return voices;
}
