/**
 * Read-only family view: GET ?token=... returns a privacy-preserving
 * summary of a learner's progress (no emails, no raw history).
 */
import { admin, corsHeaders, json } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const token = new URL(req.url).searchParams.get('token') ?? '';
  if (!/^[a-f0-9]{24}$/.test(token)) return json({ error: 'invalid link' }, 400);
  const sb = admin();
  const { data: share } = await sb.from('shares').select('user_id, revoked, label').eq('token', token).maybeSingle();
  if (!share || share.revoked) return json({ error: 'This link is no longer active.' }, 404);
  const [{ data: prog }, { data: profile }] = await Promise.all([
    sb.from('progress').select('doc, updated_at').eq('user_id', share.user_id).maybeSingle(),
    sb.from('profiles').select('display_name').eq('id', share.user_id).maybeSingle(),
  ]);
  const doc = (prog?.doc ?? {}) as { cards?: Record<string, { reps: number; mastery: number; last: number }>; days?: Record<string, { practiced: number; seconds: number }> };
  const cards = Object.values(doc.cards ?? {}).filter((c) => c.reps > 0);
  return json({
    name: profile?.display_name ?? 'A learner',
    label: share.label,
    learned: cards.length,
    blooming: cards.filter((c) => c.mastery >= 4).length,
    signs: cards
      .sort((a, b) => b.last - a.last)
      .slice(0, 60)
      .map((c) => ({ id: (c as unknown as { signId: string }).signId, mastery: c.mastery })),
    days: Object.entries(doc.days ?? {}).map(([date, d]) => ({ date, practiced: d.practiced, minutes: Math.round(d.seconds / 60) })),
    updatedAt: prog?.updated_at ?? null,
  });
});
