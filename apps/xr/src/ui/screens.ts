/**
 * Screen builders for the main panel, the coach bubble and the hands HUD.
 * Each returns a uikit tree (plus references to anything updated live).
 */

import type { UIKit } from '@iwsdk/core';
import { ALL_UNITS, getHandshape, getSign, MASTERY_LABELS, UNITS } from '@signsprout/signkit';
import type { Card, LearnerSettings, SessionPlan, SignDef, Unit } from '@signsprout/signkit';
import type { LessonView, SessionSummary } from '../lesson/lesson.js';
import {
  box,
  button,
  caption,
  card,
  chip,
  col,
  icon,
  palette,
  progressDots,
  row,
  stat,
  surface,
  text,
  title,
} from './kit.js';

export const PANEL_PX = 1100;

const gloss = (s: SignDef) => s.gloss.replace(/-/g, ' ');

// ---------------------------------------------------------------------------
// Home
// ---------------------------------------------------------------------------

export interface HomeCtx {
  greeting: string;
  streak: number;
  practicedToday: boolean;
  learned: number;
  minutesWeek: number;
  plan: SessionPlan;
  suggestion?: string;
  account: 'guest' | 'syncing' | 'synced';
  accountLabel: string;
}

export interface HomeActions {
  start(): void;
  garden(): void;
  library(): void;
  spell(): void;
  settings(): void;
  pair(): void;
  coach(): void;
}

export function homeScreen(c: HomeCtx, a: HomeActions): UIKit.Container {
  const reviews = c.plan.items.filter((i) => i.kind === 'review').length;
  const fresh = c.plan.items.length - reviews;
  const planLine = [reviews ? `${reviews} review${reviews > 1 ? 's' : ''}` : '', fresh ? `${fresh} new sign${fresh > 1 ? 's' : ''}` : '']
    .filter(Boolean)
    .join(' · ');
  const preview = row(
    { gap: 10, flexWrap: 'wrap' },
    ...c.plan.items.slice(0, 5).map((i) => chip(gloss(getSign(i.signId)), i.kind === 'new' ? palette.sproutDeep : palette.inkLine)),
  );
  return surface(
    PANEL_PX,
    row(
      { justifyContent: 'space-between' },
      row({ gap: 14 }, icon('sprout', { width: 48, height: 48, color: palette.sprout }), text('Signsprout', { fontSize: 34, fontWeight: 'bold' })),
      button({ icon: c.account === 'guest' ? 'phone' : 'check', label: c.accountLabel, size: 'sm', variant: 'ghost', onClick: a.pair }),
    ),
    title(c.greeting),
    row(
      { gap: 16 },
      stat('flame', `${c.streak}`, c.streak === 1 ? 'day streak' : 'day streak', palette.coral),
      stat('leaf', `${c.learned}`, 'signs learned', palette.sprout),
      stat('clock', `${c.minutesWeek}`, 'min this week', palette.honey),
    ),
    card(
      { backgroundColor: palette.inkSoft, borderWidth: 3, borderColor: palette.sprout },
      row(
        { justifyContent: 'space-between' },
        col(
          { gap: 6, flexShrink: 1 },
          text(c.practicedToday ? 'Keep growing' : 'Today’s practice', { fontSize: 38, fontWeight: 'bold' }),
          caption(`${planLine || 'Free practice'}  ·  about ${c.plan.minutes} min`, { fontSize: 26 }),
        ),
        button({ label: 'Start', icon: 'play', variant: 'primary', size: 'lg', onClick: a.start, id: 'start' }),
      ),
      preview,
    ),
    c.suggestion
      ? row(
          {
            gap: 14,
            padding: 20,
            borderRadius: 28,
            backgroundColor: '#2A2350',
            onClick: a.coach,
            hover: { backgroundColor: '#3A3170' },
          },
          icon('sparkles', { color: palette.lilac }),
          text(c.suggestion, { fontSize: 26, color: '#E3DEFF', flexShrink: 1 }),
        )
      : null,
    row(
      { gap: 14 },
      button({ label: 'Garden', icon: 'flower', onClick: a.garden, grow: true }),
      button({ label: 'All signs', icon: 'book', onClick: a.library, grow: true }),
    ),
    row(
      { gap: 14 },
      button({ label: 'Spell a name', icon: 'hand', onClick: a.spell, grow: true }),
      button({ label: 'Settings', icon: 'settings', onClick: a.settings, grow: true }),
    ),
  );
}

// ---------------------------------------------------------------------------
// Lesson card
// ---------------------------------------------------------------------------

export interface LessonActions {
  replay(): void;
  slow(): void;
  skip(): void;
  ready(): void;
  hint(): void;
  home(): void;
}

export interface LessonRefs {
  root: UIKit.Container;
  instruction: UIKit.Text;
  hint: UIKit.Text;
  hintBox: UIKit.Container;
  status: UIKit.Text;
}

const STEP_LABEL = { watch: 'Watch', together: 'Together', try: 'Your turn', celebrate: 'Done' } as const;

export function lessonCard(v: LessonView, a: LessonActions): LessonRefs {
  const steps: (keyof typeof STEP_LABEL)[] = v.item.kind === 'new' ? ['watch', 'together', 'try'] : ['try'];
  const cur = steps.indexOf(v.step === 'celebrate' ? 'try' : v.step);
  const stepRow = row(
    { gap: 10 },
    ...steps.map((s, i) =>
      chip(
        STEP_LABEL[s],
        i < cur || v.step === 'celebrate' ? palette.sproutDeep : i === cur ? palette.honey : palette.inkLine,
        i === cur && v.step !== 'celebrate' ? palette.ink : palette.paper,
        i < cur || v.step === 'celebrate' ? 'check' : s === 'watch' ? 'eye' : 'hand',
      ),
    ),
  );
  const instruction = text(v.instruction, { fontSize: 34, fontWeight: 'bold', color: palette.paper });
  const hint = text(v.hint ?? '', { fontSize: 30, color: palette.ink, fontWeight: 'bold' });
  const hintBox = row(
    { gap: 14, padding: 22, borderRadius: 28, backgroundColor: palette.honey, display: v.hint ? 'flex' : 'none' },
    icon('info', { color: palette.ink }),
    hint,
  );
  const status = caption('', { fontSize: 24 });
  const isReview = v.item.kind === 'review';
  const showGloss = !(isReview && v.step === 'try');
  const sign = v.sign;
  const hs = getHandshape(sign.dominant.start.shape);

  const controls =
    v.step === 'watch'
      ? row(
          { gap: 14 },
          button({ label: 'I’m ready', icon: 'hand', variant: 'primary', onClick: a.ready, grow: true }),
          button({ icon: 'replay', label: 'Again', onClick: a.replay }),
          button({ icon: v.slow ? 'rabbit' : 'turtle', label: v.slow ? 'Normal' : 'Slower', onClick: a.slow }),
        )
      : row(
          { gap: 14 },
          isReview && v.step === 'try'
            ? button({ icon: 'eye', label: 'Show me', onClick: a.hint, grow: true })
            : button({ icon: 'replay', label: 'Show again', onClick: a.replay, grow: true }),
          button({ icon: v.slow ? 'rabbit' : 'turtle', label: v.slow ? 'Normal' : 'Slower', onClick: a.slow }),
          button({ icon: 'skip', label: 'Skip', onClick: a.skip, variant: 'ghost' }),
        );

  const root = surface(
    PANEL_PX,
    row(
      { justifyContent: 'space-between' },
      progressDots(v.total, v.index, v.index),
      button({ icon: 'home', size: 'sm', variant: 'ghost', label: 'Pause', onClick: a.home }),
    ),
    col(
      { gap: 6 },
      caption(isReview ? 'Review' : 'New sign', { color: v.unitColor, fontWeight: 'bold', fontSize: 26 }),
      showGloss
        ? title(gloss(sign), { fontSize: 84 })
        : title(`“${sign.english}”`, { fontSize: 72 }),
      showGloss ? caption(`means “${sign.english}”`, { fontSize: 28 }) : caption('Can you remember the sign?', { fontSize: 28 }),
    ),
    stepRow,
    v.step === 'celebrate'
      ? card(
          { backgroundColor: palette.sproutDeep, alignItems: 'center' },
          row({ gap: 14 }, icon('sprout', { width: 56, height: 56, color: palette.paper }), text('Planted in your garden!', { fontSize: 40, fontWeight: 'bold' })),
          row({ gap: 8 }, ...[0, 1, 2].map((i) => icon('star', { width: 44, height: 44, color: i < Math.round(v.quality * 3) ? palette.honey : '#3E6B5A' }))),
        )
      : col(
          { gap: 16 },
          instruction,
          showGloss ? text(sign.howTo, { fontSize: 28, color: palette.muted }) : null,
          showGloss
            ? row({ gap: 10, flexWrap: 'wrap' }, chip(`${hs.label} hand`, palette.inkLine, palette.paper, 'hand'), sign.hint ? chip(sign.hint, '#2A2350', '#E3DEFF', 'sparkles') : null)
            : null,
          hintBox,
          status,
        ),
    v.step === 'celebrate' ? null : controls,
    sign.nonManual && showGloss && v.step !== 'celebrate'
      ? caption(`Face: ${sign.nonManual}`, { fontSize: 22 })
      : null,
  );
  return { root, instruction, hint, hintBox, status };
}

// ---------------------------------------------------------------------------
// Session summary
// ---------------------------------------------------------------------------

export function summaryScreen(
  s: SessionSummary,
  streak: number,
  nextDue: string,
  a: { more(): void; home(): void; garden(): void },
): UIKit.Container {
  const mins = Math.max(1, Math.round(s.seconds / 60));
  return surface(
    PANEL_PX,
    row({ gap: 16 }, icon('trophy', { width: 64, height: 64, color: palette.honey }), title('Session complete!')),
    text(`${s.practiced.length} signs in ${mins} min${s.perfect ? ` · ${s.perfect} perfect` : ''}`, { fontSize: 34, color: palette.muted }),
    s.learned.length
      ? card(
          {},
          text('New in your garden', { fontSize: 30, fontWeight: 'bold' }),
          row({ gap: 10, flexWrap: 'wrap' }, ...s.learned.map((id) => chip(gloss(getSign(id)), palette.sproutDeep, palette.paper, 'sprout'))),
        )
      : null,
    row(
      { gap: 16 },
      stat('flame', `${streak}`, 'day streak', palette.coral),
      stat('clock', nextDue, 'next practice', palette.honey),
    ),
    row(
      { gap: 14 },
      button({ label: 'Keep going', icon: 'play', variant: 'primary', onClick: a.more, grow: true }),
      button({ label: 'Garden', icon: 'flower', onClick: a.garden }),
      button({ label: 'Home', icon: 'home', onClick: a.home }),
    ),
  );
}

// ---------------------------------------------------------------------------
// Library
// ---------------------------------------------------------------------------

export function libraryScreen(
  progress: { unit: Unit; learned: number; total: number }[],
  a: { unit(u: Unit): void; back(): void },
): UIKit.Container {
  const list = col({ gap: 12 });
  for (const p of progress) {
    list.add(
      row(
        {
          padding: 20,
          borderRadius: 28,
          backgroundColor: palette.inkSoft,
          hover: { backgroundColor: '#2C4250' },
          onClick: () => a.unit(p.unit),
          justifyContent: 'space-between',
        },
        row(
          { gap: 16, flexShrink: 1 },
          box({ width: 22, height: 64, borderRadius: 11, backgroundColor: p.unit.color }),
          col({ gap: 2, flexShrink: 1 }, text(p.unit.title, { fontSize: 32, fontWeight: 'bold' }), caption(p.unit.subtitle, { fontSize: 24 })),
        ),
        row({ gap: 10 }, text(`${p.learned}/${p.total}`, { fontSize: 28, color: palette.muted }), icon('chevron', { color: palette.muted })),
      ) as never,
    );
  }
  return surface(
    PANEL_PX,
    row({ gap: 14 }, button({ icon: 'back', size: 'sm', variant: 'ghost', onClick: a.back }), title('All signs', { fontSize: 48 })),
    list,
  );
}

export function unitScreen(
  unit: Unit,
  cards: Record<string, Card>,
  a: { practice(ids: string[]): void; one(id: string): void; back(): void },
): UIKit.Container {
  const grid = row({ gap: 12, flexWrap: 'wrap' });
  for (const id of unit.signs) {
    const s = getSign(id);
    const c = cards[id];
    const learned = (c?.reps ?? 0) > 0;
    grid.add(
      col(
        {
          width: 238,
          padding: 16,
          gap: 4,
          borderRadius: 24,
          backgroundColor: learned ? '#1F3A33' : palette.inkSoft,
          borderWidth: 3,
          borderColor: learned ? palette.sproutDeep : palette.inkLine,
          hover: { backgroundColor: '#2C4250' },
          onClick: () => a.one(id),
        },
        text(gloss(s), { fontSize: 26, fontWeight: 'bold' }),
        caption(learned ? MASTERY_LABELS[c!.mastery] : 'Not yet', { fontSize: 20 }),
      ) as never,
    );
  }
  return surface(
    PANEL_PX,
    row({ gap: 14 }, button({ icon: 'back', size: 'sm', variant: 'ghost', onClick: a.back }), title(unit.title, { fontSize: 48 })),
    caption(unit.why, { fontSize: 26 }),
    grid,
    button({ label: `Practise ${unit.title.toLowerCase()}`, icon: 'play', variant: 'primary', onClick: () => a.practice(unit.signs) }),
  );
}

// ---------------------------------------------------------------------------
// Garden
// ---------------------------------------------------------------------------

export function gardenScreen(
  counts: { total: number; blooming: number; thirsty: string[] },
  selected: SignDef | null,
  a: { water(): void; back(): void; replay(id: string): void },
): UIKit.Container {
  return surface(
    PANEL_PX,
    row({ gap: 14 }, button({ icon: 'back', size: 'sm', variant: 'ghost', onClick: a.back }), title('Your garden', { fontSize: 48 })),
    text(
      counts.total
        ? `${counts.total} plants · ${counts.blooming} in bloom`
        : 'Your garden is waiting for its first seed.',
      { fontSize: 32, color: palette.muted },
    ),
    caption('Every sign you learn grows a plant. Practise to help it bloom — plants droop a little when they miss you.', { fontSize: 26 }),
    selected
      ? card(
          { borderWidth: 3, borderColor: palette.honey },
          row({ gap: 12 }, icon('flower', { color: palette.honey }), text(gloss(selected), { fontSize: 40, fontWeight: 'bold' })),
          caption(`“${selected.english}” — ${selected.howTo}`, { fontSize: 24 }),
          button({ label: 'Practise this sign', icon: 'play', variant: 'primary', onClick: () => a.replay(selected.id) }),
        )
      : caption('Tip: point at a plant and pinch (or poke it) to see its sign again.', { fontSize: 24, color: palette.honey }),
    counts.thirsty.length
      ? card(
          {},
          text('Thirsty plants', { fontSize: 30, fontWeight: 'bold' }),
          row({ gap: 10, flexWrap: 'wrap' }, ...counts.thirsty.slice(0, 8).map((id) => chip(gloss(getSign(id)), '#5A4A2A', palette.honey, 'leaf'))),
          button({ label: 'Water them (review)', icon: 'sprout', variant: 'primary', onClick: a.water }),
        )
      : null,
  );
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export function settingsScreen(
  s: LearnerSettings,
  a: {
    set(patch: Partial<LearnerSettings>): void;
    recenter(): void;
    reset(): void;
    back(): void;
    about(): void;
  },
): UIKit.Container {
  const seg = <T extends string | number | boolean>(label: string, current: T, options: [T, string][], key: keyof LearnerSettings) =>
    col(
      { gap: 10 },
      caption(label, { fontSize: 24 }),
      row(
        { gap: 10 },
        ...options.map(([val, lab]) =>
          button({ label: lab, size: 'sm', selected: current === val, grow: true, onClick: () => a.set({ [key]: val } as Partial<LearnerSettings>) }),
        ),
      ),
    );
  return surface(
    PANEL_PX,
    row({ gap: 14 }, button({ icon: 'back', size: 'sm', variant: 'ghost', onClick: a.back }), title('Settings', { fontSize: 48 })),
    seg('I sign with my…', s.dominantHand, [['right', 'Right hand'], ['left', 'Left hand']], 'dominantHand'),
    seg('Feedback', s.strictness, [['gentle', 'Gentle'], ['standard', 'Standard'], ['strict', 'Strict']], 'strictness'),
    seg('How far my fingers fold', s.flexRange, [[0.7, 'Limited'], [0.85, 'Most of the way'], [1, 'Fully']], 'flexRange'),
    seg('Guide speed', s.ghostSpeed, [[0.6, 'Slow'], [0.8, 'Relaxed'], [1, 'Natural']], 'ghostSpeed'),
    row(
      { gap: 10 },
      button({ label: s.voice ? 'Voice on' : 'Voice off', icon: s.voice ? 'sound' : 'mute', size: 'sm', grow: true, selected: s.voice, onClick: () => a.set({ voice: !s.voice }) }),
      button({ label: 'High contrast', icon: 'contrast', size: 'sm', grow: true, selected: s.highContrast, onClick: () => a.set({ highContrast: !s.highContrast }) }),
      button({ label: 'Calm motion', icon: 'access', size: 'sm', grow: true, selected: s.reducedMotion, onClick: () => a.set({ reducedMotion: !s.reducedMotion }) }),
    ),
    seg('Sprout faces me as a…', s.mirrorTeacher, [[true, 'Mirror (easier to copy)'], [false, 'Signer (as others see it)']], 'mirrorTeacher'),
    row(
      { gap: 10 },
      button({ label: s.passthrough ? 'See my room: on' : 'See my room: off', icon: 'glasses', size: 'sm', grow: true, selected: s.passthrough, onClick: () => a.set({ passthrough: !s.passthrough }) }),
      button({ label: 'Recenter', icon: 'repeat', size: 'sm', grow: true, onClick: a.recenter }),
    ),
    row(
      { gap: 10 },
      button({ label: 'About & credits', icon: 'info', size: 'sm', grow: true, onClick: a.about }),
      button({ label: 'Reset progress', icon: 'close', size: 'sm', variant: 'ghost', onClick: a.reset }),
    ),
  );
}

export function aboutScreen(a: { back(): void }): UIKit.Container {
  return surface(
    PANEL_PX,
    row({ gap: 14 }, button({ icon: 'back', size: 'sm', variant: 'ghost', onClick: a.back }), title('About Signsprout', { fontSize: 48 })),
    text('Signsprout teaches American Sign Language (ASL) with your own two hands. Glowing guide hands show each sign from your own point of view, and live feedback tells you what to adjust.', { fontSize: 28 }),
    caption('Signs are the standard dictionary forms, cross-checked against Handspeak (by Deaf signer Jolanta Lapiak) and Lifeprint / ASL University (Dr. Bill Vicars). Regional and family variants exist — learn from the Deaf people in your life too.', { fontSize: 24 }),
    caption('Hand tracking can’t see facial expressions, which are part of ASL grammar. We remind you when they matter, but we don’t score them.', { fontSize: 24 }),
    caption('Made by Shivam Gupta. Built with Meta’s Immersive Web SDK.', { fontSize: 24, color: palette.sprout }),
  );
}

// ---------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------

export function welcomeScreen(a: { next(): void; demo?: () => void }): UIKit.Container {
  return surface(
    PANEL_PX,
    row({ gap: 16 }, icon('sprout', { width: 72, height: 72, color: palette.sprout }), title('Welcome to Signsprout', { fontSize: 60 })),
    text('Learn sign language with your own two hands — five minutes a day.', { fontSize: 34 }),
    card(
      {},
      row({ gap: 14 }, icon('eye', { color: palette.ghost }), text('Watch Sprout sign a word', { fontSize: 30 })),
      row({ gap: 14 }, icon('hand', { color: palette.ghost }), text('Put your hands inside the glowing hands', { fontSize: 30 })),
      row({ gap: 14 }, icon('sprout', { color: palette.ghost }), text('Sign it yourself — and watch your garden grow', { fontSize: 30 })),
    ),
    button({ label: 'Let’s begin', icon: 'play', variant: 'primary', size: 'lg', onClick: a.next, id: 'begin' }),
    caption('No account needed. You can save your garden later.', { fontSize: 22 }),
  );
}

export function handsScreen(seen: { left: boolean; right: boolean }, a: { next(): void }): UIKit.Container {
  const both = seen.left && seen.right;
  return surface(
    PANEL_PX,
    title(both ? 'I can see both hands!' : 'Show me your hands', { fontSize: 56 }),
    text(
      both
        ? 'Your hands are the controllers here — no buttons needed. Poke buttons with a fingertip, or point and pinch.'
        : 'Put your controllers down and hold both hands up in front of you.',
      { fontSize: 30 },
    ),
    row(
      { gap: 16 },
      chip(seen.left ? 'Left hand: ready' : 'Left hand…', seen.left ? palette.sproutDeep : palette.inkLine, palette.paper, 'hand'),
      chip(seen.right ? 'Right hand: ready' : 'Right hand…', seen.right ? palette.sproutDeep : palette.inkLine, palette.paper, 'hand'),
    ),
    both ? button({ label: 'Continue', icon: 'chevron', variant: 'primary', size: 'lg', onClick: a.next, id: 'continue' }) : null,
  );
}

export function handedScreen(a: { pick(h: 'right' | 'left'): void }): UIKit.Container {
  return surface(
    PANEL_PX,
    title('Which hand do you write with?', { fontSize: 52 }),
    text('That’s your main signing hand. Left-handed? Every sign flips to match you.', { fontSize: 30 }),
    row(
      { gap: 16 },
      button({ label: 'Left', icon: 'hand', size: 'lg', grow: true, onClick: () => a.pick('left'), id: 'left' }),
      button({ label: 'Right', icon: 'hand', size: 'lg', grow: true, variant: 'primary', onClick: () => a.pick('right'), id: 'right' }),
    ),
  );
}

export function calibrateScreen(done: boolean, a: { skip(): void }): UIKit.Container {
  return surface(
    PANEL_PX,
    title(done ? 'Perfect — thank you!' : 'Touch your chin', { fontSize: 56 }),
    text(
      done
        ? 'Now I know where your face is, so I can guide your hands to the right spot.'
        : 'Many signs happen near your face. Touch your chin with your index finger and hold it there for a moment.',
      { fontSize: 30 },
    ),
    done ? null : button({ label: 'Skip', icon: 'skip', variant: 'ghost', onClick: a.skip }),
  );
}

// ---------------------------------------------------------------------------
// Account pairing
// ---------------------------------------------------------------------------

export function pairScreen(
  st: { code: string | null; url: string; status: string; signedInAs?: string; available: boolean },
  a: { back(): void; signOut(): void; refresh(): void },
): UIKit.Container {
  if (st.signedInAs) {
    return surface(
      PANEL_PX,
      row({ gap: 14 }, button({ icon: 'back', size: 'sm', variant: 'ghost', onClick: a.back }), title('Your account', { fontSize: 48 })),
      row({ gap: 14 }, icon('check', { color: palette.sprout, width: 48, height: 48 }), text(`Signed in as ${st.signedInAs}`, { fontSize: 32 })),
      caption('Your garden syncs automatically between this headset, your phone and the family dashboard.', { fontSize: 26 }),
      button({ label: 'Sign out', icon: 'close', variant: 'ghost', onClick: a.signOut }),
    );
  }
  return surface(
    PANEL_PX,
    row({ gap: 14 }, button({ icon: 'back', size: 'sm', variant: 'ghost', onClick: a.back }), title('Save your garden', { fontSize: 48 })),
    st.available
      ? col(
          { gap: 18 },
          text('On your phone or computer, open', { fontSize: 30 }),
          text(st.url, { fontSize: 40, fontWeight: 'bold', color: palette.sprout }),
          text('and enter this code:', { fontSize: 30 }),
          row(
            { gap: 12, justifyContent: 'center' },
            ...(st.code ?? '······').split('').map((ch) =>
              box(
                { width: 110, height: 140, borderRadius: 24, backgroundColor: palette.inkSoft, alignItems: 'center', justifyContent: 'center' },
                text(ch, { fontSize: 80, fontWeight: 'bold', color: palette.honey }),
              ),
            ),
          ),
          caption(st.status, { fontSize: 24 }),
          button({ label: 'New code', icon: 'repeat', size: 'sm', variant: 'ghost', onClick: a.refresh }),
        )
      : col(
          { gap: 14 },
          text('Cloud sync isn’t configured on this build. Your garden is saved on this headset.', { fontSize: 30 }),
          caption('Everything works offline; progress is stored locally.', { fontSize: 24 }),
        ),
  );
}

// ---------------------------------------------------------------------------
// Fingerspelling
// ---------------------------------------------------------------------------

export function spellScreen(
  word: string,
  index: number,
  options: string[],
  a: { pick(w: string): void; back(): void; skipLetter(): void },
): UIKit.Container {
  const letters = row({ gap: 10, flexWrap: 'wrap' });
  word.split('').forEach((ch, i) =>
    letters.add(
      box(
        {
          width: 96,
          height: 120,
          borderRadius: 22,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: i < index ? palette.sproutDeep : i === index ? palette.honey : palette.inkSoft,
        },
        text(ch, { fontSize: 64, fontWeight: 'bold', color: i === index ? palette.ink : palette.paper }),
      ) as never,
    ),
  );
  return surface(
    PANEL_PX,
    row({ gap: 14 }, button({ icon: 'back', size: 'sm', variant: 'ghost', onClick: a.back }), title('Spell a name', { fontSize: 48 })),
    word ? letters : null,
    word
      ? caption(index < word.length ? `Fingerspell “${word[index]}” — hold it steady` : 'You spelled it!', { fontSize: 28 })
      : caption('Pick a word to fingerspell, letter by letter:', { fontSize: 28 }),
    row({ gap: 12, flexWrap: 'wrap' }, ...options.map((w) => button({ label: w, size: 'sm', onClick: () => a.pick(w) }))),
    word && index < word.length ? button({ label: 'Skip letter', icon: 'skip', size: 'sm', variant: 'ghost', onClick: a.skipLetter }) : null,
  );
}

// ---------------------------------------------------------------------------
// Coach bubble & HUD
// ---------------------------------------------------------------------------

export function coachBubble(msg: string): { root: UIKit.Container; label: UIKit.Text } {
  const label = text(msg, { fontSize: 34, color: palette.ink, fontWeight: 'bold', textAlign: 'center' });
  const root = col(
    { width: 900, padding: 30, borderRadius: 48, backgroundColor: palette.paper, alignItems: 'center', gap: 8 },
    label,
  );
  return { root, label };
}

export function hudCaption(): { root: UIKit.Container; label: UIKit.Text; sub: UIKit.Text; box: UIKit.Container } {
  const label = text('', { fontSize: 40, fontWeight: 'bold', color: palette.paper, textAlign: 'center' });
  const sub = text('', { fontSize: 32, color: palette.ink, fontWeight: 'bold', textAlign: 'center' });
  const subBox = box({ paddingX: 24, paddingY: 12, borderRadius: 28, backgroundColor: palette.honey, display: 'none' }, sub);
  const root = col(
    { width: 1000, padding: 26, borderRadius: 40, backgroundColor: palette.ink, alignItems: 'center', gap: 12, opacity: 0.92 },
    label,
    subBox,
  );
  return { root, label, sub, box: subBox };
}

export { UNITS, ALL_UNITS };
