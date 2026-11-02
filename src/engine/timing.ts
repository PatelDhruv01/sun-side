export type Vehicle = 'bus' | 'car';

/**
 * How much longer real trips take than OSRM's free-flowing car time. Rough factors from
 * typical Indian journeys (Mumbai–Pune buses take about 3 h against OSRM's 2 h); a ticket's
 * arrival time beats them.
 */
export const SLOWER_THAN_OSRM: Record<Vehicle, number> = { car: 1.25, bus: 1.5 };

export interface Timing {
  /** Departure, ms since epoch (UTC). */
  departure: number;
  vehicle: Vehicle;
  /** Arrival time from the ticket, ms since epoch (UTC). */
  arrival?: number;
  /** A hand-picked stretch instead. */
  scale?: number;
}

export interface TimeScale {
  /** What to multiply the route's car times by. */
  scale: number;
  basis: 'ticket' | 'given' | 'typical';
}

/** The stretch for a route whose car time is `routeSeconds`, and where it comes from. */
export function timeScale(routeSeconds: number, timing: Timing): TimeScale {
  if (timing.arrival !== undefined) return { scale: (timing.arrival - timing.departure) / 1000 / routeSeconds, basis: 'ticket' };
  if (timing.scale !== undefined) return { scale: timing.scale, basis: 'given' };
  return { scale: SLOWER_THAN_OSRM[timing.vehicle], basis: 'typical' };
}
