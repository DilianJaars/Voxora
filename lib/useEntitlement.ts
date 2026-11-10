'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from './supabase';
import { computeEntitlement, Entitlement } from './plans';

const FREE: Entitlement = { premium: false, source: 'free' };
type Account = {
  loading: boolean;               // true until we know whether someone is signed in and what their membership is
  email?: string;
  token?: string;
  ent: Entitlement;
  profileOk: boolean;             // false when signed in but the membership record could not be read
  trialAvailable: boolean;        // signed in and has not started the free Premium period yet
  referralCode?: string;
  user?: { id: string; email?: string; createdAt?: string; lastSignIn?: string };
  profile?: any;
};

export function useAccount() {
  const [state, setState] = useState<Account>({ loading: true, ent: FREE, profileOk: true, trialAvailable: false });

  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) { setState({ loading: false, ent: FREE, profileOk: true, trialAvailable: false }); return; }
    let alive = true;

    const load = async () => {
      try {
        const { data: { session } } = await sb.auth.getSession();
        if (!alive) return;
        if (!session) { setState({ loading: false, ent: FREE, profileOk: true, trialAvailable: false }); return; }

        // Signed in: make that known straight away, then fetch the membership.
        const user = { id: session.user.id, email: session.user.email, createdAt: session.user.created_at, lastSignIn: session.user.last_sign_in_at };
        setState((s) => ({ ...s, email: session.user.email, token: session.access_token, user }));

        const read = () => sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
        let { data: p } = await read();
        if (!p) { // no membership record yet: create it (this starts the free trial), then read it again
          await sb.rpc('ensure_profile');
          ({ data: p } = await read());
        }
        if (!alive) return;
        setState((s) => ({ ...s, loading: false, ent: computeEntitlement(p), profile: p, referralCode: p?.referral_code, profileOk: Boolean(p), trialAvailable: Boolean(p) && !p.trial_ends_at }));
      } catch {
        if (alive) setState((s) => ({ ...s, loading: false, profileOk: false }));
      }
    };

    load();
    const { data: sub } = sb.auth.onAuthStateChange(() => { load(); });
    const onMembership = () => { load(); };
    window.addEventListener('voxora:membership', onMembership);
    return () => { alive = false; sub.subscription.unsubscribe(); window.removeEventListener('voxora:membership', onMembership); };
  }, []);

  return state;
}
