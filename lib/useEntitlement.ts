'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from './supabase';
import { computeEntitlement, Entitlement } from './plans';

export function useAccount() {
  const [state, setState] = useState<{ loading: boolean; email?: string; token?: string; ent: Entitlement; referralCode?: string; user?: { id: string; email?: string; createdAt?: string; lastSignIn?: string }; profile?: any }>({
    loading: true, ent: { premium: false, source: 'free' },
  });
  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) { setState({ loading: false, ent: { premium: false, source: 'free' } }); return; }
    const load = async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setState({ loading: false, ent: { premium: false, source: 'free' } }); return; }
      let { data: p } = await sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
      if (!p) { // first sign-in without a profile yet: create it (this starts the free trial), then read it again
        await sb.rpc('ensure_profile');
        ({ data: p } = await sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle());
      }
      setState({ loading: false, email: session.user.email, token: session.access_token, ent: computeEntitlement(p), referralCode: p?.referral_code, profile: p, user: { id: session.user.id, email: session.user.email, createdAt: session.user.created_at, lastSignIn: session.user.last_sign_in_at } });
    };
    load();
    const { data: sub } = sb.auth.onAuthStateChange(() => load());
    return () => sub.subscription.unsubscribe();
  }, []);
  return state;
}
