/**
 * Signsprout design tokens, shared by 3D scene, spatial UI and feedback.
 */

export const COLORS = {
  ink: '#16232B',
  inkSoft: '#22343F',
  inkLine: '#2F4452',
  paper: '#FFF8EE',
  paperDim: '#E9DFD0',
  muted: '#A9B8BF',
  sprout: '#3DBE8B',
  sproutDeep: '#1E8C63',
  coral: '#FF7A59',
  honey: '#FFC857',
  lilac: '#8E7DFF',
  sky: '#7FB4E6',
  ghost: '#7FF2E1',
  ghostRim: '#D2FFF8',
  good: '#3DBE8B',
  close: '#FFC857',
  fix: '#FF6B6B',
} as const;

export const HIGH_CONTRAST = {
  ink: '#000000',
  inkSoft: '#111111',
  inkLine: '#FFFFFF',
  paper: '#FFFFFF',
  muted: '#FFFF66',
  sprout: '#00FF88',
  coral: '#FF5555',
  honey: '#FFFF00',
} as const;

export const hex = (c: string): number => parseInt(c.replace('#', ''), 16);

/** UI authoring scale: panels are authored in "px"; 1000px wide = 0.6 m. */
export const PX = 0.0006;
