'use client';
import { supabaseBrowser } from './supabase';

// Starts the one-time free Premium period. No card and no payment gateway: payment is added later, before it ends.
export async function startFreePremium(): Promise<{ ok: boolean; error?: string; endsAt?: string }> {
  const sb = supabaseBrowser();
  if (!sb) return { ok: false, error: 'Accounts are not switched on yet.' };
  const { data, error } = await sb.rpc('start_trial');
  if (error) {
    return { ok: false, error: /trial_already_used/.test(error.message) ? 'You have already used your free Premium period.' : 'Could not start free Premium. Try again in a moment.' };
  }
  window.dispatchEvent(new Event('voxora:membership')); // every part of the page refreshes the membership
  return { ok: true, endsAt: data as string };
}
