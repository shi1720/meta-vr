import { useMemo } from 'react';
import { WEEKDAYS, buildCalendar, formatDay } from '../../lib/calendar';
import type { DayEntry } from '../../lib/calendar';

const LEVEL_TEXT = ['No practice', 'A little practice', 'Almost at goal', 'Goal reached', 'Well past goal'];

/** A five-week practice heatmap, Monday-first, one sequential (green) ramp. */
export function PracticeCalendar({
  days,
  goal = 5,
  now = Date.now(),
}: {
  days: Record<string, DayEntry>;
  goal?: number;
  now?: number;
}) {
  const cal = useMemo(() => buildCalendar(days, now, 5, goal), [days, now, goal]);
  return (
    <div className="calendar">
      <table className="cal-table">
        <caption className="sr-only">
          Practice over the last five weeks: {cal.activeDays} days practised, {cal.totalMinutes} minutes in total.
        </caption>
        <thead>
          <tr>
            {WEEKDAYS.map((d) => (
              <th key={d} scope="col">
                <span aria-hidden="true">{d.slice(0, 1)}</span>
                <span className="sr-only">{d}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cal.weeks.map((week) => (
            <tr key={week[0].date}>
              {week.map((c) => {
                const text = c.future
                  ? `${formatDay(c.date)}: upcoming`
                  : `${formatDay(c.date)}: ${c.minutes} min${c.practiced ? `, ${c.practiced} signs practised` : ''}. ${LEVEL_TEXT[c.level]}`;
                return (
                  <td key={c.date}>
                    <span
                      className={`cal-cell l${c.level} ${c.today ? 'today' : ''} ${c.future ? 'future' : ''}`}
                      data-tip={c.future ? undefined : `${formatDay(c.date)} · ${c.minutes} min`}
                    >
                      <span className="sr-only">{text}</span>
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="cal-legend" aria-hidden="true">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((l) => (
          <span key={l} className={`cal-cell mini l${l}`} />
        ))}
        <span>More</span>
        <span className="cal-goal">Goal: {goal} min a day</span>
      </div>
    </div>
  );
}
