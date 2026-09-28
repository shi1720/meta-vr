import { useEffect, useState } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { cloudEnabled, getSupabase } from './supabase';

export type AuthState =
  | { status: 'disabled' }
  | { status: 'loading' }
  | { status: 'signed-out'; client: SupabaseClient }
  | { status: 'signed-in'; client: SupabaseClient; session: Session };

/** Current Supabase session (or why there isn't one). */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>(cloudEnabled ? { status: 'loading' } : { status: 'disabled' });

  useEffect(() => {
    if (!cloudEnabled) return;
    let alive = true;
    let unsubscribe: (() => void) | undefined;
    void getSupabase().then(async (client) => {
      if (!client || !alive) return;
      const apply = (session: Session | null) => {
        if (!alive) return;
        setState(session ? { status: 'signed-in', client, session } : { status: 'signed-out', client });
      };
      const { data } = client.auth.onAuthStateChange((_event, session) => apply(session));
      unsubscribe = () => data.subscription.unsubscribe();
      const { data: current } = await client.auth.getSession();
      apply(current.session);
    });
    return () => {
      alive = false;
      unsubscribe?.();
    };
  }, []);

  return state;
}
