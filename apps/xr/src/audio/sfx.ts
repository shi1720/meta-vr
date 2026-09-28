/**
 * Sound: tiny synthesized cues (no audio files), a gentle ambient bed, and
 * optional spoken prompts. Every sound is paired with a visual cue, so the
 * experience is complete without audio. essential for Deaf and hard-of-
 * hearing learners, and for anyone practising with the sound off.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let ambientGain: GainNode | null = null;
let muted = false;
let unlocked = false;

function ac(): AudioContext | null {
  if (ctx) return ctx;
  if (!unlocked) return null;
  const Ctor = (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
  if (!Ctor) return null;
  ctx = new Ctor();
  master = ctx.createGain();
  master.gain.value = 0.55;
  master.connect(ctx.destination);
  return ctx;
}

/** Call from a user gesture (entering XR, first poke) to unlock audio. */
export function unlockAudio(): void {
  unlocked = true;
  const c = ac();
  if (c && c.state !== 'running') void c.resume();
}

export function setMuted(m: boolean): void {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.55;
}

function tone(freq: number, start: number, dur: number, gain: number, type: OscillatorType = 'sine', detune = 0): void {
  const c = ac();
  if (!c || !master || muted) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  o.detune.value = detune;
  const t0 = c.currentTime + start;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

/** A soft bell: fundamental + inharmonic partial. */
function bell(freq: number, start: number, gain = 0.18, dur = 1.2): void {
  tone(freq, start, dur, gain, 'sine');
  tone(freq * 2.76, start, dur * 0.5, gain * 0.25, 'sine');
  tone(freq * 5.4, start, dur * 0.25, gain * 0.08, 'sine');
}

export const sfx = {
  tick(): void {
    tone(1760, 0, 0.06, 0.05, 'triangle');
  },
  hover(): void {
    tone(1320, 0, 0.04, 0.02, 'sine');
  },
  step(): void {
    bell(784, 0, 0.1, 0.5);
    bell(1047, 0.08, 0.08, 0.6);
  },
  success(): void {
    // Rising major arpeggio: C6 E6 G6 C7
    bell(1047, 0, 0.16);
    bell(1319, 0.09, 0.14);
    bell(1568, 0.18, 0.13);
    bell(2093, 0.3, 0.12, 1.6);
  },
  sprout(): void {
    const c = ac();
    if (!c || !master || muted) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    const t0 = c.currentTime;
    o.frequency.setValueAtTime(420, t0);
    o.frequency.exponentialRampToValueAtTime(980, t0 + 0.18);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
    o.connect(g).connect(master);
    o.start(t0);
    o.stop(t0 + 0.35);
  },
  gentle(): void {
    // "not quite". soft, never punishing
    tone(523, 0, 0.18, 0.05, 'sine');
    tone(494, 0.12, 0.25, 0.04, 'sine');
  },
  complete(): void {
    [523, 659, 784, 1047, 1319].forEach((f, i) => bell(f, i * 0.11, 0.12, 1.8));
  },
};

// ---------------------------------------------------------------------------
// Ambient garden bed: warm pad + occasional birds.
// ---------------------------------------------------------------------------

let birdTimer: ReturnType<typeof setTimeout> | undefined;

let ambientOn = false;
let suspendTimer: ReturnType<typeof setTimeout> | undefined;

export function startAmbient(): void {
  const c = ac();
  if (!c || !master || ambientOn) return;
  ambientOn = true;
  clearTimeout(suspendTimer);
  if (c.state === 'suspended') void c.resume();
  if (ambientGain) {
    // Already built: fade back in (never stack a second set of oscillators).
    ambientGain.gain.cancelScheduledValues(c.currentTime);
    ambientGain.gain.setValueAtTime(Math.max(0.0001, ambientGain.gain.value), c.currentTime);
    ambientGain.gain.exponentialRampToValueAtTime(0.5, c.currentTime + 2);
    scheduleBirds();
    return;
  }
  ambientGain = c.createGain();
  ambientGain.gain.value = 0.0001;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 900;
  ambientGain.connect(master);
  filter.connect(ambientGain);
  for (const [f, d] of [
    [130.8, -6],
    [196, 5],
    [261.6, -3],
  ] as const) {
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    o.detune.value = d;
    const g = c.createGain();
    g.gain.value = 0.035;
    // slow swell
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.05 + Math.random() * 0.05;
    const lg = c.createGain();
    lg.gain.value = 0.015;
    lfo.connect(lg).connect(g.gain);
    o.connect(g).connect(filter);
    o.start();
    lfo.start();
  }
  ambientGain.gain.exponentialRampToValueAtTime(0.5, c.currentTime + 4);
  scheduleBirds();
}

function scheduleBirds(): void {
  clearTimeout(birdTimer);
  const chirp = () => {
    if (!muted && ctx && ctx.state === 'running') {
      const base = 2400 + Math.random() * 1400;
      for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) {
        tone(base + Math.random() * 300, i * 0.09, 0.07, 0.012, 'sine');
      }
    }
    birdTimer = setTimeout(chirp, 5000 + Math.random() * 9000);
  };
  birdTimer = setTimeout(chirp, 4000);
}

/** Fade the ambience out and, once silent, suspend audio (headset off or menu open). */
export function stopAmbient(): void {
  if (!ambientOn) return;
  ambientOn = false;
  clearTimeout(birdTimer);
  const c = ctx;
  if (!ambientGain || !c) return;
  ambientGain.gain.cancelScheduledValues(c.currentTime);
  ambientGain.gain.setValueAtTime(Math.max(0.0001, ambientGain.gain.value), c.currentTime);
  ambientGain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 1);
  suspendTimer = setTimeout(() => {
    if (!ambientOn && c.state === 'running') void c.suspend();
  }, 1200);
}

// ---------------------------------------------------------------------------
// Spoken prompts (optional; captions are always shown).
// ---------------------------------------------------------------------------

let voiceEnabled = false;
let voice: SpeechSynthesisVoice | null = null;

export function voiceAvailable(): boolean {
  return typeof speechSynthesis !== 'undefined';
}

export function setVoiceEnabled(on: boolean): void {
  voiceEnabled = on && voiceAvailable();
  if (!voiceEnabled && voiceAvailable()) speechSynthesis.cancel();
  if (voiceEnabled && !voice) {
    const pick = () => {
      const vs = speechSynthesis.getVoices();
      voice =
        vs.find((v) => /en[-_]US/i.test(v.lang) && /female|samantha|aria|jenny|google us/i.test(v.name)) ??
        vs.find((v) => /^en/i.test(v.lang)) ??
        null;
    };
    pick();
    speechSynthesis.addEventListener?.('voiceschanged', pick);
  }
}

export function say(text: string): void {
  if (!voiceEnabled || muted) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    u.rate = 1.0;
    u.pitch = 1.05;
    u.volume = 0.9;
    speechSynthesis.speak(u);
  } catch {
    /* no TTS on this device. captions cover it */
  }
}
