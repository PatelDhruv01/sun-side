// "Not sure when I leave": the verdict for every departure across a day.
import { decide, type Decision, type ScoringOptions } from './decide.ts';
import { simulate, type TripOptions } from './simulate.ts';
import type { Route } from './types.ts';

export interface DepartureVerdict {
  /** Departure, ms since epoch (UTC). */
  departure: number;
  sit: Decision['sit'];
  confidence: Decision['confidence'];
  /** Minutes of the trip with the sun up. */
  daylight: number;
}

/** A run of departures that share a verdict. */
export interface Band {
  /** The first and last departure in the run, ms since epoch (UTC). */
  from: number;
  to: number;
  sit: Decision['sit'];
  /** Why it says "either": the trip is all after dark, there's little sun, or the sides are even. */
  reason?: 'dark' | 'little sun' | 'balanced';
  /** Every departure in the run is only slightly better on that side. */
  slight: boolean;
}

export interface SweepOptions {
  /** The first and last departure, ms since epoch (UTC). */
  first: number;
  last: number;
  /** Minutes between departures (default 30). */
  step?: number;
  /** What to multiply the route's car times by. */
  timeScale: number;
  dni?: TripOptions['dni'];
  scoring?: ScoringOptions;
}

/** The verdict for each departure from `first` to `last`. */
export function sweep(route: Route, { first, last, step = 30, timeScale, dni, scoring }: SweepOptions): DepartureVerdict[] {
  const verdicts: DepartureVerdict[] = [];
  for (let departure = first; departure <= last; departure += step * 60_000) {
    const { bins } = simulate(route, { departure, timeScale, dni });
    const { sit, confidence } = decide(bins, { ...scoring, seatSwitch: false });
    const daylight = bins.reduce((minutes, b) => minutes + (b.sun.elevation > 0 ? b.seconds / 60 : 0), 0);
    verdicts.push({ departure, sit, confidence, daylight });
  }
  return verdicts;
}

/** Neighbouring departures with the same verdict (and the same reason for an "either") joined into runs. */
export function bands(verdicts: DepartureVerdict[]): Band[] {
  const runs: Band[] = [];
  for (const v of verdicts) {
    const reason = v.sit !== 'either' ? undefined : v.daylight < 1 ? 'dark' : v.confidence === 'little sun' ? 'little sun' : 'balanced';
    const run = runs.at(-1);
    if (run && run.sit === v.sit && run.reason === reason) {
      run.to = v.departure;
      run.slight &&= v.confidence === 'slight';
    } else {
      runs.push({ from: v.departure, to: v.departure, sit: v.sit, reason, slight: v.confidence === 'slight' });
    }
  }
  return runs;
}
