// The last few trips, kept in this browser only, to open again in one tap.

export interface RecentTrip {
  /** The trip's address query, as tripQuery makes it. */
  query: string;
  from: string;
  to: string;
  /** E.g. "Wed 4 Nov · 09:00" or "Wed 4 Nov · whole day". */
  when: string;
  vehicle: 'bus' | 'car';
}

const KEY = 'recent-trips';
const KEEP = 4;

const isTrip = (value: unknown): value is RecentTrip =>
  typeof value === 'object' && value !== null && ['query', 'from', 'to', 'when'].every((key) => typeof (value as Record<string, unknown>)[key] === 'string');

export function loadRecent(): RecentTrip[] {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(list) ? list.filter(isTrip).slice(0, KEEP) : [];
  } catch {
    return []; // storage blocked or garbled: start afresh
  }
}

/** Put a trip first (replacing an older one between the same places), and return the new list. */
export function remember(trip: RecentTrip): RecentTrip[] {
  const list = [trip, ...loadRecent().filter((t) => t.from !== trip.from || t.to !== trip.to)].slice(0, KEEP);
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // not kept for next time, but still shown on this visit
  }
  return list;
}

export function forgetRecent(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nothing was kept
  }
}
