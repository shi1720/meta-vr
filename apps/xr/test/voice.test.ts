import { describe, expect, it } from 'vitest';
import { parseCommand } from '../src/app/voice.js';

describe('voice commands', () => {
  it('maps short phrases to commands', () => {
    expect(parseCommand('again')).toBe('again');
    expect(parseCommand('Show me')).toBe('show');
    expect(parseCommand('slow down please')).toBe('slower');
    expect(parseCommand('skip')).toBe('skip');
    expect(parseCommand("I'm ready")).toBe('ready');
    expect(parseCommand('pause')).toBe('pause');
    expect(parseCommand("let's begin")).toBe('continue');
    expect(parseCommand('right hand')).toBe('right');
  });
  it('ignores unrelated speech', () => {
    expect(parseCommand('what a lovely garden')).toBeNull();
  });
});
