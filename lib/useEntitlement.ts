'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from './supabase';
import { computeEntitlement, Entitlement } from './plans';

export function useAccount() {
  const [state, setState] = useState<{ loading: boolean; email?: string; token?: string; ent: Entitlement; referralCode?: string }>({
    loading: true, ent: { premium: false, source: 'free' },
  });
  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) { setState({ loading: false, ent: { premium: false, source: 'free' } }); return; }
    const load = async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setState({ loading: false, ent: { premium: false, source: 'free' } }); return; }
      const { data: p } = await sb.from('profiles').select('premium_until,trial_ends_at,referral_bonus_until,referral_code').eq('id', session.user.id).maybeSingle();
      setState({ loading: false, email: session.user.email, token: session.access_token, ent: computeEntitlement(p), referralCode: p?.referral_code });
    };
    load();
    const { data: sub } = sb.auth.onAuthStateChange(() => load());
    return () => sub.subscription.unsubscribe();
  }, []);
  return state;
}
