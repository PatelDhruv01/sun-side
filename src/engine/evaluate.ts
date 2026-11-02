import { decide, type Decision, type ScoringOptions } from './decide.ts';
import { simulate, type TripOptions } from './simulate.ts';
import { summarise, type TripStats } from './summary.ts';
import type { Route, SegmentPass, TimelineBin } from './types.ts';

export interface Evaluation {
  passes: SegmentPass[];
  bins: TimelineBin[];
  stats: TripStats;
  decision: Decision;
}

export interface EvaluateOptions {
  /** Departure, ms since epoch (UTC). */
  departure: number;
  /** What to multiply the route's car times by. */
  timeScale: number;
  scoring?: ScoringOptions;
  /** Direct sunlight source; clear sky unless a forecast is given. */
  dni?: TripOptions['dni'];
}

/** Simulates a trip along one route and decides where to sit. */
export function evaluate(route: Route, { departure, timeScale, scoring, dni }: EvaluateOptions): Evaluation {
  const { passes, bins } = simulate(route, { departure, timeScale, dni });
  return { passes, bins, stats: summarise(bins), decision: decide(bins, scoring) };
}

export interface Shifted {
  /** Minutes later (negative: earlier) than planned. */
  shift: number;
  sit: Decision['sit'];
}

/** The verdict if the trip started a little earlier or later: buses rarely leave on the dot. */
export function shiftedVerdicts(route: Route, options: EvaluateOptions, shifts = [-30, 30, 60]): Shifted[] {
  const scoring = { ...options.scoring, seatSwitch: false };
  return shifts.map((shift) => ({
    shift,
    sit: evaluate(route, { ...options, scoring, departure: options.departure + shift * 60_000 }).decision.sit,
  }));
}

/** Whether several verdicts point the same way: 'mostly' when some only say "either", 'conflict' for left vs right. */
export function agreement(sits: Decision['sit'][]): 'agree' | 'mostly' | 'conflict' {
  if (new Set(sits.filter((sit) => sit !== 'either')).size > 1) return 'conflict';
  return new Set(sits).size === 1 ? 'agree' : 'mostly';
}
