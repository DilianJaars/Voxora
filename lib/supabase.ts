import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseEnabled = Boolean(url && anon);
let browser: SupabaseClient | null = null;
export function supabaseBrowser(): SupabaseClient | null {
  if (!supabaseEnabled) return null;
  if (!browser) browser = createClient(url!, anon!);
  return browser;
}
