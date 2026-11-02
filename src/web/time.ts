// Times on the page are in the reader's own time zone.
import type { ClockFormat } from '../app/explain.ts';

const pad = (n: number) => String(n).padStart(2, '0');

/** YYYY-MM-DD, for <input type="date">. */
export function dateInput(time: number): string {
  const d = new Date(time);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** HH:MM, for <input type="time">. */
export function timeInput(time: number): string {
  const d = new Date(time);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** The next quarter hour after `now`. */
export function nextQuarterHour(now = Date.now()): number {
  const quarter = 15 * 60_000;
  return Math.ceil(now / quarter) * quarter;
}

/** Date and time inputs to ms since epoch. */
export const fromInputs = (date: string, time: string) => new Date(`${date}T${time}`).getTime();

/** Clock times on a trip, e.g. "09:00", with "+1" once it's past midnight of the departure day. */
export function clockFormat(departure: number): ClockFormat {
  const format = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const firstDay = startOfDay(departure);
  return (time) => {
    const days = Math.round((startOfDay(time) - firstDay) / 86_400_000);
    return format.format(time) + (days > 0 ? ` +${days}` : '');
  };
}

/** A length of time for reading at a glance: "16 min", "2 h", "1 h 14 min". */
export function shortDuration(minutes: number): string {
  const m = Math.round(minutes);
  if (m < 60) return `${m} min`;
  return m % 60 === 0 ? `${m / 60} h` : `${Math.floor(m / 60)} h ${m % 60} min`;
}

/** E.g. "Tue 15 Dec". */
export const dayLabel = (time: number) => new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' }).format(time);

function startOfDay(time: number): number {
  const d = new Date(time);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
