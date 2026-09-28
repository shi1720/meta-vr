/**
 * Device pairing: sign a headset in without typing in VR.
 *
 *  1. Headset: {action:'start'}           -> { code, secret }   (shows the code)
 *  2. Phone (signed in): {action:'approve', code}   -> { ok }
 *  3. Headset polls: {action:'poll', code, secret}  -> { status, token_hash? }
 *     and exchanges token_hash for a session with auth.verifyOtp().
 *
 * The secret never leaves the headset; codes expire after 10 minutes and can
 * be used once.
 */
import { admin, corsHeaders, json, sha256, userFrom } from '../_shared/http.ts';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I

function randomCode(n = 6): string {
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('');
}

function randomSecret(): string {
  return [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const sb = admin();
  let body: { action?: string; code?: string; secret?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid JSON' }, 400);
  }
  if (!body || typeof body !== 'object' || (body.code !== undefined && typeof body.code !== 'string') || (body.secret !== undefined && typeof body.secret !== 'string')) return json({ error: 'invalid request' }, 400);
  const code = (body.code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

  switch (body.action) {
    case 'start': {
      await sb.rpc('expire_pairings');
      for (let attempt = 0; attempt < 5; attempt++) {
        const newCode = randomCode();
        const secret = randomSecret();
        const { error } = await sb.from('pairings').insert({ code: newCode, secret_hash: await sha256(secret) });
        if (!error) return json({ code: newCode, secret, expiresInSeconds: 600 });
      }
      return json({ error: 'could not allocate a code' }, 503);
    }

    case 'approve': {
      const user = await userFrom(req, sb);
      if (!user?.email) return json({ error: 'sign in first' }, 401);
      const { data: row } = await sb.from('pairings').select('*').eq('code', code).maybeSingle();
      if (!row || row.status !== 'pending' || new Date(row.expires_at) < new Date()) {
        return json({ error: 'That code has expired or was already used. Ask the headset for a new one.' }, 404);
      }
      // Mint a one-time sign-in token for this user; the headset redeems it.
      const { data: link, error } = await sb.auth.admin.generateLink({ type: 'magiclink', email: user.email });
      if (error || !link?.properties?.hashed_token) return json({ error: 'could not create a sign-in token' }, 500);
      const { data: approved, error: saveError } = await sb
        .from('pairings')
        .update({ status: 'approved', user_id: user.id, token_hash: link.properties.hashed_token })
        .eq('code', code)
        .eq('status', 'pending').select('code').maybeSingle();
      if (saveError) return json({ error: 'Could not approve the code. Please try again.' }, 503);
      if (!approved) return json({ error: 'That code was already approved.' }, 409);
      return json({ ok: true });
    }

    case 'poll': {
      if (!body.secret) return json({ error: 'missing secret' }, 400);
      const { data: row } = await sb.from('pairings').select('*').eq('code', code).maybeSingle();
      if (!row || row.secret_hash !== (await sha256(body.secret))) return json({ status: 'unknown' }, 404);
      if (new Date(row.expires_at) < new Date()) return json({ status: 'expired' });
      if (row.status === 'approved' && row.token_hash) {
        const { data: consumed, error } = await sb.from('pairings').update({ status: 'consumed', token_hash: null }).eq('code', code).eq('status', 'approved').select('code').maybeSingle();
        if (error) return json({ error: 'Please retry.' }, 503);
        if (!consumed) return json({ status: 'consumed' });
        return json({ status: 'approved', token_hash: row.token_hash });
      }
      return json({ status: row.status });
    }

    default:
      return json({ error: 'unknown action' }, 400);
  }
});
