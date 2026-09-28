/**
 * Optional voice commands, for moments when your hands are busy signing (or
 * holding a baby): "again", "slower", "show me", "skip", "pause", "continue".
 *
 * Uses the browser's speech recognition where it exists; the setting is
 * hidden where it doesn't. Off by default. Only short command words are
 * matched; nothing is stored.
 */

export type VoiceCommand = 'again' | 'slower' | 'show' | 'skip' | 'ready' | 'pause' | 'resume' | 'continue' | 'home' | 'left' | 'right';

const PHRASES: [RegExp, VoiceCommand][] = [
  [/\b(again|repeat|one more time|show again)\b/, 'again'],
  [/\b(slower|slow down|too fast)\b/, 'slower'],
  [/\b(show me|help|hint)\b/, 'show'],
  [/\b(skip|next sign)\b/, 'skip'],
  [/\b(i'?m ready|ready)\b/, 'ready'],
  [/\b(pause|wait|stop)\b/, 'pause'],
  [/\b(resume|keep going|carry on)\b/, 'resume'],
  [/\b(continue|next|let'?s begin|begin|start|okay|ok)\b/, 'continue'],
  [/\b(home|main menu)\b/, 'home'],
  [/\bleft( hand)?\b/, 'left'],
  [/\bright( hand)?\b/, 'right'],
];

/** Map a transcript to a command (exported for tests). */
export function parseCommand(transcript: string): VoiceCommand | null {
  const t = transcript.toLowerCase().trim();
  for (const [re, cmd] of PHRASES) if (re.test(t)) return cmd;
  return null;
}

type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

function recognitionCtor(): (new () => Recognition) | null {
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const voiceSupported = (): boolean => typeof window !== 'undefined' && !!recognitionCtor();

export class VoiceCommands {
  private rec: Recognition | null = null;
  private wanted = false;
  constructor(private onCommand: (cmd: VoiceCommand, heard: string) => void) {}

  setEnabled(on: boolean): void {
    this.wanted = on;
    if (on) this.start();
    else this.rec?.stop();
  }

  private start(): void {
    const Ctor = recognitionCtor();
    if (!Ctor || this.rec) return;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = 'en-US';
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (!r.isFinal) continue;
        const heard = r[0].transcript;
        const cmd = parseCommand(heard);
        if (cmd) this.onCommand(cmd, heard.trim());
      }
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') this.wanted = false;
    };
    // Recognition stops after silence; keep listening while enabled.
    rec.onend = () => {
      this.rec = null;
      if (this.wanted) setTimeout(() => this.wanted && this.start(), 400);
    };
    this.rec = rec;
    try {
      rec.start();
    } catch {
      this.rec = null;
    }
  }
}
