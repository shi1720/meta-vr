/**
 * Export the sign catalog (ids, glosses, meanings, units) for the backend
 * coach and the web dictionary. Run: npx tsx tools/export-catalog.ts
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { ALL_SIGNS, ALL_UNITS, unitOf } from '../packages/signkit/src/index.js';

const catalog = ALL_SIGNS.map((s) => ({
  id: s.id,
  gloss: s.gloss,
  english: s.english,
  category: s.category,
  unit: unitOf(s.id)?.id ?? null,
  difficulty: s.difficulty,
  howTo: s.howTo,
}));
const units = ALL_UNITS.map((u) => ({ id: u.id, title: u.title, subtitle: u.subtitle, why: u.why, signs: u.signs, color: u.color }));
mkdirSync('supabase/functions/_shared', { recursive: true });
writeFileSync('supabase/functions/_shared/catalog.json', JSON.stringify({ signs: catalog, units }, null, 1));
console.log(`exported ${catalog.length} signs, ${units.length} units`);
