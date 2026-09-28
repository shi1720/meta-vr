/**
 * Account & cloud sync (optional).
 *
 * Signsprout is offline-first: everything works without an account. When a
 * Supabase project is configured (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY),
 * learners can save their garden by pairing the headset with a phone —
 * no typing in VR: the headset shows a 6-character code, the learner signs in
 * on their phone and enters it, and the headset receives a session.
 */

import { createClient } from '@supabase/supabase-js';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { mergeProgress, parseProgress } from '@signsprout/signkit';
import type { ProgressDoc } from '@signsprout/signkit';
import { onLocalChange, progress, store } from '../app/store.js';

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const WEB = (import.meta.env.VITE_WEB_URL as string | undefined) ?? 'signsprout.app/pair';

export interface AccountState {
  signedIn: boolean;
  email?: string;
  userId?: string;
  pairCode: string | null;
  pairStatus: string;
  lastSync?: number;
}

class Account {
  readonly available = !!(URL && KEY);
  readonly pairUrl = WEB.replace(/^https?:\/\//, '');
  state: AccountState = { signedIn: false, pairCode: null, pairStatus: '' };
  private sb: SupabaseClient | null = null;
  private pollTimer: ReturnType<typeof setInterval> | undefined;
  private pushTimer: ReturnType<typeof setTimeout> | undefined;
  private listeners = new Set<() => void>();

  async init(): Promise<void> {
    if (!this.available) return;
    this.sb = createClient(URL!, KEY!, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'signsprout.auth' } });
    const { data } = await this.sb.auth.getSession();
    this.setSession(data.session);
    this.sb.auth.onAuthStateChange((_e, session) => this.setSession(session));
    onLocalChange(() => this.schedulePush());
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }

  private setSession(session: Session | null): void {
    const was = this.state.signedIn;
    this.state.signedIn = !!session;
    this.state.email = session?.user.email ?? undefined;
    this.state.userId = session?.user.id;
    if (session && !was) void this.pull();
    this.emit();
  }

  /** Download the cloud copy, merge, and push the merged result. */
  async pull(): Promise<void> {
    if (!this.sb || !this.state.userId) return;
    const { data, error } = await this.sb.from('progress').select('doc').eq('user_id', this.state.userId).maybeSingle();
    if (error) {
      console.warn('[sync] pull failed', error.message);
      return;
    }
    if (data?.doc) store.mergeRemote(parseProgress(data.doc, Date.now()));
    await this.push();
  }

  private schedulePush(): void {
    if (!this.state.signedIn) return;
    clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => void this.push(), 1500);
  }

  async push(): Promise<void> {
    if (!this.sb || !this.state.userId) return;
    const doc: ProgressDoc = progress.peek();
    const { error } = await this.sb
      .from('progress')
      .upsert({ user_id: this.state.userId, doc, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) console.warn('[sync] push failed', error.message);
    else this.state.lastSync = Date.now();
  }

  /** Start device pairing: show a code and wait for the phone to approve it. */
  async startPairing(onUpdate: () => void): Promise<void> {
    if (!this.sb) return;
    this.stopPairing();
    this.state.pairCode = null;
    this.state.pairStatus = 'Getting a code…';
    onUpdate();
    const { data, error } = await this.sb.functions.invoke('pair', { body: { action: 'start' } });
    if (error || !data?.code) {
      this.state.pairStatus = 'Couldn’t reach the server. Your garden is still saved on this headset.';
      onUpdate();
      return;
    }
    const { code, secret } = data as { code: string; secret: string };
    this.state.pairCode = code;
    this.state.pairStatus = 'Waiting for your phone…';
    onUpdate();
    const started = Date.now();
    this.pollTimer = setInterval(async () => {
      if (Date.now() - started > 10 * 60 * 1000) {
        this.stopPairing();
        this.state.pairStatus = 'Code expired — tap New code.';
        onUpdate();
        return;
      }
      const res = await this.sb!.functions.invoke('pair', { body: { action: 'poll', code, secret } });
      const d = res.data as { status?: string; token_hash?: string; email?: string } | null;
      if (d?.status === 'approved' && d.token_hash) {
        this.stopPairing();
        const { error: vErr } = await this.sb!.auth.verifyOtp({ token_hash: d.token_hash, type: 'magiclink' });
        this.state.pairStatus = vErr ? `Sign-in failed: ${vErr.message}` : 'Paired! Syncing your garden…';
        onUpdate();
      }
    }, 2500);
  }

  stopPairing(): void {
    clearInterval(this.pollTimer);
    this.pollTimer = undefined;
  }

  async signOut(): Promise<void> {
    await this.sb?.auth.signOut();
    this.state = { signedIn: false, pairCode: null, pairStatus: '' };
    this.emit();
  }

  /** Access token for calling the coach function. */
  async token(): Promise<string | null> {
    const { data } = (await this.sb?.auth.getSession()) ?? { data: { session: null } };
    return data.session?.access_token ?? null;
  }

  get client(): SupabaseClient | null {
    return this.sb;
  }
}

export const account = new Account();
export { mergeProgress };
