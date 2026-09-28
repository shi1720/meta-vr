/**
 * Headset pairing codes: 6 characters from an alphabet without look-alikes
 * (no 0/O, no 1/I), matching supabase/functions/pair.
 */

export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;

const ALLOWED = new Set(CODE_ALPHABET.split(''));

/** Uppercase and keep only characters that can appear in a code. */
export function normalizeCode(input: string, max = CODE_LENGTH): string {
  let out = '';
  for (const ch of input.toUpperCase()) {
    if (ALLOWED.has(ch)) out += ch;
    if (out.length >= max) break;
  }
  return out;
}

export function isCompleteCode(code: string): boolean {
  return code.length === CODE_LENGTH && normalizeCode(code) === code;
}

/** Characters the user typed that can never be part of a code (for a gentle hint). */
export function hasLookalikes(input: string): boolean {
  return /[01OI]/i.test(input);
}

/**
 * Apply raw input (a keystroke, autofill or a whole pasted code) typed into
 * box `index`. Returns the new characters and which box to focus next.
 */
export function fillCode(
  chars: readonly string[],
  index: number,
  raw: string,
  length = CODE_LENGTH,
): { chars: string[]; focus: number } {
  const next = Array.from({ length }, (_, i) => chars[i] ?? '');
  const clean = normalizeCode(raw, length);
  if (!clean) {
    return { chars: next, focus: index };
  }
  // A full-length paste always fills from the first box.
  const start = clean.length >= length ? 0 : index;
  let i = start;
  for (const ch of clean) {
    if (i >= length) break;
    next[i++] = ch;
  }
  return { chars: next, focus: Math.min(i, length - 1) };
}

/** Backspace in box `index`: clear it, or step back and clear the previous box. */
export function backspaceCode(chars: readonly string[], index: number): { chars: string[]; focus: number } {
  const next = [...chars];
  if (next[index]) {
    next[index] = '';
    return { chars: next, focus: index };
  }
  const prev = Math.max(0, index - 1);
  next[prev] = '';
  return { chars: next, focus: prev };
}
