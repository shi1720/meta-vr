/**
 * A tiny declarative layer over @pmndrs/uikit (IWSDK's spatial UI) with the
 * Signsprout look: warm ink panels, big friendly targets (≥ 64 px ≈ 3.8 cm,
 * comfortably pokeable), and icon + text on every action.
 */

import { UIKit } from '@iwsdk/core';
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronRight,
  Clock,
  Contrast,
  Eye,
  Flame,
  Flower,
  Hand,
  Heart,
  House,
  Info,
  Leaf,
  Link,
  Pause,
  Play,
  Rabbit,
  Repeat,
  RotateCcw,
  Settings,
  SkipForward,
  Smartphone,
  Sparkles,
  Sprout,
  Star,
  Sun,
  Turtle,
  Volume2,
  VolumeX,
  X,
  Glasses,
  Users,
  Accessibility,
  Timer,
  MessageCircle,
  Keyboard,
  Trophy,
} from '@pmndrs/uikit-lucide';
import { COLORS, HIGH_CONTRAST } from '../app/theme.js';
import { sfx } from '../audio/sfx.js';

export const ICONS = {
  back: ArrowLeft,
  book: BookOpen,
  check: Check,
  chevron: ChevronRight,
  clock: Clock,
  contrast: Contrast,
  eye: Eye,
  flame: Flame,
  flower: Flower,
  hand: Hand,
  heart: Heart,
  home: House,
  info: Info,
  leaf: Leaf,
  link: Link,
  pause: Pause,
  play: Play,
  rabbit: Rabbit,
  repeat: Repeat,
  replay: RotateCcw,
  settings: Settings,
  skip: SkipForward,
  phone: Smartphone,
  sparkles: Sparkles,
  sprout: Sprout,
  star: Star,
  sun: Sun,
  turtle: Turtle,
  sound: Volume2,
  mute: VolumeX,
  close: X,
  glasses: Glasses,
  users: Users,
  access: Accessibility,
  timer: Timer,
  chat: MessageCircle,
  keyboard: Keyboard,
  trophy: Trophy,
} as const;
export type IconName = keyof typeof ICONS;

type AnyProps = Record<string, unknown>;
export type El = UIKit.Container | UIKit.Text | UIKit.Component;

/** Palette in effect (switches for high-contrast mode). */
export const palette = { ...COLORS } as Record<keyof typeof COLORS, string>;
export function setHighContrast(on: boolean): void {
  Object.assign(palette, COLORS, on ? HIGH_CONTRAST : {});
}

export function box(props: AnyProps = {}, ...children: (El | null | undefined | false)[]): UIKit.Container {
  const c = new UIKit.Container(props as never);
  for (const ch of children) if (ch) c.add(ch as never);
  return c;
}

export function row(props: AnyProps = {}, ...children: (El | null | undefined | false)[]): UIKit.Container {
  return box({ flexDirection: 'row', alignItems: 'center', gap: 16, ...props }, ...children);
}

export function col(props: AnyProps = {}, ...children: (El | null | undefined | false)[]): UIKit.Container {
  return box({ flexDirection: 'column', gap: 16, ...props }, ...children);
}

/** The bundled MSDF font lacks typographic punctuation: map to ASCII. */
export function plain(t: string): string {
  return t
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2014/g, ' - ')
    .replace(/\u2013/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00B7/g, '|')
    .replace(/\s+-\s+-/g, ' -');
}

export function text(t: string, props: AnyProps = {}): UIKit.Text {
  return new UIKit.Text({ text: plain(t), fontSize: 30, color: palette.paper, lineHeight: '140%', ...props } as never);
}

/** Update a Text element's content (sanitised). */
export function setText(el: UIKit.Text, t: string): void {
  el.setProperties({ text: plain(t) } as never);
}

export function title(t: string, props: AnyProps = {}): UIKit.Text {
  return text(t, { fontSize: 56, fontWeight: 'bold', lineHeight: '115%', ...props });
}

export function caption(t: string, props: AnyProps = {}): UIKit.Text {
  return text(t, { fontSize: 24, color: palette.muted, ...props });
}

export function icon(name: IconName, props: AnyProps = {}): UIKit.Component {
  const Ctor = ICONS[name] as unknown as new (p: AnyProps) => UIKit.Component;
  return new Ctor({ width: 36, height: 36, color: palette.paper, ...props });
}

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft';

export interface ButtonOpts {
  label?: string;
  icon?: IconName;
  variant?: ButtonVariant;
  onClick?: () => void;
  size?: 'lg' | 'md' | 'sm';
  grow?: boolean;
  selected?: boolean;
  id?: string;
  width?: number | string;
}

/** Click handlers by button id (used by the demo autopilot and tests). */
export const buttonRegistry = new Map<string, () => void>();
const lastClick = new Map<string, number>();

/** Fire a registered button, ignoring it if it was clicked for real just now. */
export function clickRegistered(id: string): boolean {
  const fn = buttonRegistry.get(id);
  if (!fn) return false;
  if (performance.now() - (lastClick.get(id) ?? -1e9) < 1200) return true;
  fn();
  return true;
}

export function button(o: ButtonOpts): UIKit.Container {
  const variant = o.variant ?? 'secondary';
  const size = o.size ?? 'md';
  const pad = size === 'lg' ? { paddingX: 44, paddingY: 30 } : size === 'md' ? { paddingX: 30, paddingY: 22 } : { paddingX: 20, paddingY: 14 };
  const fs = size === 'lg' ? 38 : size === 'md' ? 30 : 24;
  const bg =
    variant === 'primary'
      ? palette.sprout
      : variant === 'danger'
        ? palette.coral
        : variant === 'soft'
          ? palette.inkLine
          : variant === 'ghost'
            ? palette.ink
            : palette.inkSoft;
  const hover =
    variant === 'primary' ? '#5BD8A4' : variant === 'danger' ? '#FF9A80' : variant === 'ghost' ? palette.inkSoft : '#3A5566';
  const fg = variant === 'primary' || variant === 'danger' ? palette.ink : palette.paper;
  const b = box({
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    borderRadius: size === 'sm' ? 24 : 36,
    backgroundColor: o.selected ? palette.lilac : bg,
    borderWidth: variant === 'ghost' ? 3 : 0,
    borderColor: palette.inkLine,
    minHeight: size === 'lg' ? 104 : size === 'md' ? 80 : 60,
    flexGrow: o.grow ? 1 : 0,
    width: o.width,
    hover: { backgroundColor: o.selected ? '#A99CFF' : hover },
    active: { transformScaleX: 0.97, transformScaleY: 0.97 },
    onClick: () => {
      if (o.id) {
        const t = performance.now();
        if (t - (lastClick.get(o.id) ?? -1e9) < 400) return;
        lastClick.set(o.id, t);
      }
      sfx.tick();
      o.onClick?.();
    },
    onPointerEnter: () => sfx.hover(),
    ...pad,
    ...(o.id ? { id: o.id } : {}),
  });
  if (o.id)
    buttonRegistry.set(o.id, () => {
      lastClick.set(o.id!, performance.now());
      sfx.tick();
      o.onClick?.();
    });
  if (o.icon) b.add(icon(o.icon, { width: fs + 6, height: fs + 6, color: fg }) as never);
  if (o.label) b.add(text(o.label, { fontSize: fs, fontWeight: 'bold', color: fg, lineHeight: '110%' }) as never);
  return b;
}

export function chip(label: string, color: string = palette.inkLine, fg: string = palette.paper, ic?: IconName): UIKit.Container {
  return row(
    { gap: 10, paddingX: 20, paddingY: 10, borderRadius: 999, backgroundColor: color },
    ic ? icon(ic, { width: 26, height: 26, color: fg }) : null,
    text(label, { fontSize: 24, fontWeight: 'bold', color: fg }),
  );
}

export function stat(ic: IconName, value: string, label: string, color: string): UIKit.Container {
  return col(
    { gap: 6, alignItems: 'center', flexGrow: 1, paddingY: 18, borderRadius: 28, backgroundColor: palette.inkSoft },
    row({ gap: 10 }, icon(ic, { width: 34, height: 34, color }), text(value, { fontSize: 40, fontWeight: 'bold' })),
    caption(label, { fontSize: 22 }),
  );
}

export function card(props: AnyProps = {}, ...children: (El | null | undefined | false)[]): UIKit.Container {
  return col({ padding: 28, borderRadius: 36, backgroundColor: palette.inkSoft, gap: 14, ...props }, ...children);
}

/** A panel root with the Signsprout surface. */
export function surface(width: number, ...children: (El | null | undefined | false)[]): UIKit.Container {
  return col(
    {
      width,
      padding: 44,
      gap: 24,
      borderRadius: 64,
      backgroundColor: palette.ink,
      borderWidth: 4,
      borderColor: palette.inkLine,
    },
    ...children,
  );
}

export function progressDots(total: number, done: number, current: number): UIKit.Container {
  const r = row({ gap: 10 });
  for (let i = 0; i < total; i++) {
    r.add(
      box({
        width: i === current ? 44 : 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: i < done ? palette.sprout : i === current ? palette.honey : palette.inkLine,
      }) as never,
    );
  }
  return r;
}

/** Remove and dispose all children of a container. */
export function clear(c: UIKit.Container): void {
  const kids = [...c.children];
  for (const k of kids) {
    c.remove(k);
    (k as unknown as { dispose?: () => void }).dispose?.();
  }
}
