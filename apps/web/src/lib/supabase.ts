/**
 * Optional cloud sync (Supabase). When VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
 * are missing, the site still works: landing, dictionary and demo need no
 * backend, and account pages show a friendly "not enabled" state.
 *
 * supabase-js is loaded on demand so the landing page never pays for it.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

const URL = import.meta.env.VITE_SUPABASE_URL?.trim();
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const cloudEnabled = Boolean(URL && KEY);

let clientPromise: Promise<SupabaseClient> | null = null;

export function getSupabase(): Promise<SupabaseClient | null> {
  if (!cloudEnabled) return Promise.resolve(null);
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(URL!, KEY!, {
      auth: {
        // PKCE puts ?code= in the query string, which coexists with hash routes.
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'signsprout.web.auth',
      },
    }),
  );
  return clientPromise;
}

export const OFFLINE_MESSAGE = 'We couldn’t reach Signsprout. Check your connection and try again.';

/** A request that never reached the server (offline, DNS, CORS, blocked). */
export function isNetworkError(error: unknown): boolean {
  const name = (error as { name?: string })?.name ?? '';
  const msg = (error as { message?: string })?.message ?? String(error ?? '');
  return (
    name === 'FunctionsFetchError' ||
    /failed to fetch|failed to send a request|networkerror|load failed|network request failed/i.test(msg)
  );
}

/** Best-effort human message from a supabase-js / functions error. */
export async function errorMessage(error: unknown, fallback: string): Promise<string> {
  if (!error) return fallback;
  if (isNetworkError(error)) return OFFLINE_MESSAGE;
  const ctx = (error as { context?: unknown }).context;
  if (ctx instanceof Response) {
    try {
      const body = (await ctx.clone().json()) as { error?: string; message?: string };
      if (body?.error) return body.error;
      if (body?.message) return body.message;
    } catch {
      /* not JSON */
    }
  }
  const msg = (error as { message?: string }).message;
  if (msg && !/^(FunctionsHttpError|Edge Function returned)/.test(msg)) return msg;
  return fallback;
}

export interface ShareRow {
  token: string;
  label: string | null;
  created_at: string;
  revoked: boolean;
}

export interface CoachPlan {
  message: string;
  signIds: string[];
  source: 'claude' | 'rules';
}

export interface ShareSummary {
  name: string;
  label: string | null;
  learned: number;
  blooming: number;
  signs: { id: string; mastery: number }[];
  days: { date: string; practiced: number; minutes: number }[];
  updatedAt: string | null;
}
