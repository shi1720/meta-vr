import { describe, expect, it } from 'vitest';
import { CODE_ALPHABET, backspaceCode, fillCode, hasLookalikes, isCompleteCode, normalizeCode } from './code';

describe('normalizeCode', () => {
  it('uppercases and keeps only code characters', () => {
    expect(normalizeCode('ab c-2d')).toBe('ABC2D');
    expect(normalizeCode('  x7y8z9  ')).toBe('X7Y8Z9');
  });

  it('drops look-alike characters that codes never use', () => {
    expect(normalizeCode('O0I1ab')).toBe('AB');
    expect(hasLookalikes('b0')).toBe(true);
    expect(hasLookalikes('b8')).toBe(false);
  });

  it('caps the length at six', () => {
    expect(normalizeCode('ABCDEFGHJK')).toBe('ABCDEF');
  });

  it('matches the pair function alphabet', () => {
    expect(CODE_ALPHABET).toHaveLength(32);
    expect(new Set(CODE_ALPHABET).size).toBe(32);
    expect(CODE_ALPHABET).not.toMatch(/[01OI]/);
  });
});

describe('isCompleteCode', () => {
  it('accepts exactly six valid characters', () => {
    expect(isCompleteCode('K7M2QX')).toBe(true);
    expect(isCompleteCode('K7M2Q')).toBe(false);
    expect(isCompleteCode('K7M2Q0')).toBe(false);
    expect(isCompleteCode('k7m2qx')).toBe(false);
  });
});

describe('fillCode', () => {
  const empty = ['', '', '', '', '', ''];

  it('types one character and advances', () => {
    expect(fillCode(empty, 0, 'k')).toEqual({ chars: ['K', '', '', '', '', ''], focus: 1 });
  });

  it('distributes a partial paste from the current box', () => {
    const r = fillCode(['A', 'B', '', '', '', ''], 2, 'cd');
    expect(r.chars.join('')).toBe('ABCD');
    expect(r.focus).toBe(4);
  });

  it('a full-length paste fills from the first box, whatever box it lands in', () => {
    const r = fillCode(empty, 3, ' k7m-2qx ');
    expect(r.chars.join('')).toBe('K7M2QX');
    expect(r.focus).toBe(5);
  });

  it('ignores input with no valid characters', () => {
    expect(fillCode(empty, 2, '0')).toEqual({ chars: empty, focus: 2 });
  });

  it('never overflows the last box', () => {
    const r = fillCode(['A', 'B', 'C', 'D', 'E', ''], 5, 'FG');
    expect(r.chars.join('')).toBe('ABCDEF');
    expect(r.focus).toBe(5);
  });
});

describe('backspaceCode', () => {
  it('clears the current box when it has a character', () => {
    expect(backspaceCode(['A', 'B', 'C', '', '', ''], 2)).toEqual({ chars: ['A', 'B', '', '', '', ''], focus: 2 });
  });

  it('steps back and clears the previous box when empty', () => {
    expect(backspaceCode(['A', 'B', '', '', '', ''], 2)).toEqual({ chars: ['A', '', '', '', '', ''], focus: 1 });
  });

  it('stays on the first box', () => {
    expect(backspaceCode(['', '', '', '', '', ''], 0).focus).toBe(0);
  });
});
