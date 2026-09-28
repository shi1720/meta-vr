import { useEffect, useRef } from 'react';
import type { ClipboardEvent, KeyboardEvent } from 'react';
import { CODE_LENGTH, backspaceCode, fillCode, normalizeCode } from '../../lib/code';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
  describedBy?: string;
}

/**
 * Six big boxes for the headset code: auto-uppercase, auto-advance,
 * backspace steps back, arrow keys move, and pasting a whole code works
 * from any box.
 */
export function CodeInput({ value, onChange, onComplete, disabled, invalid, autoFocus, describedBy }: Props) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const chars = Array.from({ length: CODE_LENGTH }, (_, i) => value[i] ?? '');

  useEffect(() => {
    // Only on mount: focus the first empty box.
    if (autoFocus) refs.current[Math.min(value.length, CODE_LENGTH - 1)]?.focus();
  }, []);

  const commit = (next: string[], focus: number) => {
    const code = next.join('');
    onChange(code);
    // Move focus right away so fast typing never lands in the previous box.
    const el = refs.current[focus];
    if (el && el !== document.activeElement) el.focus();
    if (next.every(Boolean)) onComplete?.(code);
  };

  const onInput = (i: number, raw: string) => {
    if (!raw) {
      const next = [...chars];
      next[i] = '';
      onChange(next.join(''));
      return;
    }
    // Typing into a box that already holds a character (caret before or after it).
    let start = i;
    let incoming = raw;
    if (chars[i] && raw.length === 2) {
      if (raw[0].toUpperCase() === chars[i]) {
        incoming = raw.slice(1);
        start = Math.min(i + 1, CODE_LENGTH - 1);
      } else if (raw[1].toUpperCase() === chars[i]) {
        incoming = raw[0];
      }
    }
    if (!normalizeCode(incoming)) return; // e.g. "0" or "O", which codes never use
    const { chars: next, focus } = fillCode(chars, start, incoming);
    commit(next, focus);
  };

  const onKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const { chars: next, focus } = backspaceCode(chars, i);
      onChange(next.join(''));
      refs.current[focus]?.focus();
    } else if (e.key === 'ArrowLeft' && i > 0) {
      e.preventDefault();
      refs.current[i - 1]?.focus();
    } else if (e.key === 'ArrowRight' && i < CODE_LENGTH - 1) {
      e.preventDefault();
      refs.current[i + 1]?.focus();
    }
  };

  const onPaste = (i: number, e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const { chars: next, focus } = fillCode(chars, i, e.clipboardData.getData('text'));
    commit(next, focus);
  };

  return (
    <div
      className={`code-input ${invalid ? 'invalid' : ''}`}
      role="group"
      aria-label="Headset code"
      aria-describedby={describedBy}
    >
      {chars.map((c, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className={`code-box ${c ? 'filled' : ''}`}
          value={c}
          onChange={(e) => onInput(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={(e) => onPaste(i, e)}
          onFocus={(e) => e.target.select()}
          disabled={disabled}
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label={`Character ${i + 1} of ${CODE_LENGTH}`}
          aria-invalid={invalid || undefined}
        />
      ))}
    </div>
  );
}
