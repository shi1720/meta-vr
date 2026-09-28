import { describe, expect, it } from 'vitest';
import { buildCalendar, levelFor, localDateKey, minutesOf, mondayIndex } from './calendar';

// Thursday 17 September 2026, mid-afternoon local time.
const NOW = new Date(2026, 8, 17, 15, 30);

describe('calendar helpers', () => {
  it('formats local date keys', () => {
    expect(localDateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it('indexes weekdays from Monday', () => {
    expect(mondayIndex(new Date(2026, 8, 14))).toBe(0); // Monday
    expect(mondayIndex(new Date(2026, 8, 20))).toBe(6); // Sunday
  });

  it('reads minutes or seconds', () => {
    expect(minutesOf({ seconds: 330 })).toBe(6);
    expect(minutesOf({ minutes: 4 })).toBe(4);
    expect(minutesOf(undefined)).toBe(0);
  });

  it('buckets intensity relative to the daily goal', () => {
    expect(levelFor(0, 0, 5)).toBe(0);
    expect(levelFor(0, 2, 5)).toBe(1); // practised, time not recorded
    expect(levelFor(2, 3, 5)).toBe(1);
    expect(levelFor(4, 3, 5)).toBe(2);
    expect(levelFor(5, 3, 5)).toBe(3);
    expect(levelFor(12, 9, 5)).toBe(4);
  });
});

describe('buildCalendar', () => {
  const days = {
    '2026-09-17': { seconds: 360, practiced: 6 }, // today
    '2026-09-15': { seconds: 120, practiced: 2 },
    '2026-08-18': { seconds: 900, practiced: 9 }, // first Tuesday in range
    '2026-08-17': { seconds: 600, practiced: 5 }, // first Monday in range
    '2026-08-16': { seconds: 600, practiced: 5 }, // just before the range
    '2026-09-18': { seconds: 600, practiced: 5 }, // tomorrow (ignored)
  };
  const cal = buildCalendar(days, NOW, 5, 5);

  it('makes five Monday-first weeks ending with the current week', () => {
    expect(cal.weeks).toHaveLength(5);
    for (const w of cal.weeks) expect(w).toHaveLength(7);
    expect(cal.weeks[0][0].date).toBe('2026-08-17');
    expect(cal.weeks[4][0].date).toBe('2026-09-14');
    expect(cal.weeks[4][6].date).toBe('2026-09-20');
  });

  it('marks today and the future', () => {
    const today = cal.weeks[4][3];
    expect(today.date).toBe('2026-09-17');
    expect(today.today).toBe(true);
    expect(today.level).toBe(3);
    expect(cal.weeks[4][2].future).toBe(false);
    expect(cal.weeks[4][4].future).toBe(true);
    expect(cal.weeks[4][4].level).toBe(0);
  });

  it('counts only days inside the window', () => {
    expect(cal.activeDays).toBe(4);
    expect(cal.totalMinutes).toBe(6 + 2 + 15 + 10);
  });

  it('keeps days unique and consecutive across month boundaries', () => {
    const dates = cal.weeks.flat().map((c) => c.date);
    expect(new Set(dates).size).toBe(35);
    for (let i = 1; i < dates.length; i++) {
      const [y0, m0, d0] = dates[i - 1].split('-').map(Number);
      const [y1, m1, d1] = dates[i].split('-').map(Number);
      const diff = (new Date(y1, m1 - 1, d1, 12).getTime() - new Date(y0, m0 - 1, d0, 12).getTime()) / 86400000;
      expect(Math.round(diff)).toBe(1);
    }
  });
});
