/**
 * Practice calendar: buckets the learner's daily log into a Monday-first
 * grid of the last N weeks, with a 0–4 intensity level relative to their
 * daily goal (default five minutes).
 */

export interface DayEntry {
  seconds?: number;
  minutes?: number;
  practiced?: number;
}

export interface CalendarCell {
  /** YYYY-MM-DD, local time. */
  date: string;
  minutes: number;
  practiced: number;
  level: 0 | 1 | 2 | 3 | 4;
  today: boolean;
  future: boolean;
}

export interface Calendar {
  /** weeks[w][d]: w oldest→newest, d Monday→Sunday. */
  weeks: CalendarCell[][];
  activeDays: number;
  totalMinutes: number;
}

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Monday = 0 … Sunday = 6. */
export function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

export function minutesOf(entry: DayEntry | undefined): number {
  if (!entry) return 0;
  if (typeof entry.minutes === 'number') return Math.max(0, entry.minutes);
  return Math.max(0, Math.round((entry.seconds ?? 0) / 60));
}

export function levelFor(minutes: number, practiced: number, goalMinutes = 5): CalendarCell['level'] {
  if (minutes <= 0 && practiced <= 0) return 0;
  const ratio = minutes / Math.max(1, goalMinutes);
  if (ratio < 0.5) return 1;
  if (ratio < 1) return 2;
  if (ratio < 2) return 3;
  return 4;
}

export function buildCalendar(
  days: Record<string, DayEntry>,
  now: Date | number,
  weeks = 5,
  goalMinutes = 5,
): Calendar {
  const today = new Date(typeof now === 'number' ? now : now.getTime());
  // Work at local noon so daylight-saving changes never skip or repeat a day.
  const anchor = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
  const start = new Date(
    anchor.getFullYear(),
    anchor.getMonth(),
    anchor.getDate() - mondayIndex(anchor) - (weeks - 1) * 7,
    12,
  );
  const todayKey = localDateKey(anchor);
  const grid: CalendarCell[][] = [];
  let activeDays = 0;
  let totalMinutes = 0;
  for (let w = 0; w < weeks; w++) {
    const row: CalendarCell[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + d, 12);
      const key = localDateKey(date);
      const future = date.getTime() > anchor.getTime();
      const entry = future ? undefined : days[key];
      const minutes = minutesOf(entry);
      const practiced = Math.max(0, entry?.practiced ?? 0);
      const level = levelFor(minutes, practiced, goalMinutes);
      if (level > 0) activeDays++;
      totalMinutes += minutes;
      row.push({ date: key, minutes, practiced, level, today: key === todayKey, future });
    }
    grid.push(row);
  }
  return { weeks: grid, activeDays, totalMinutes };
}

export function formatDay(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
