// The whole trip pipeline, shared by the command line and the web page:
// routes through the places, then where to sit on each, and how sure that is.
import type { ScoringOptions } from '../engine/decide.ts';
import { evaluate, shiftedVerdicts, type Evaluation, type Shifted } from '../engine/evaluate.ts';
import { timeScale, type TimeScale, type Timing } from '../engine/timing.ts';
import type { LonLat } from '../engine/types.ts';
import type { FetchJson } from '../services/http.ts';
import { findRoutes, type CandidateRoute } from '../services/routing.ts';

/** One candidate route, simulated and decided. */
export interface RouteResult extends Evaluation {
  route: CandidateRoute;
  stretch: TimeScale;
}

export interface TripPlan {
  results: RouteResult[];
  /** Things worth telling the reader, e.g. a service that didn't answer. */
  notes: string[];
}

/** Finds the routes through the points (start, via towns, end) and works out where to sit on each. */
export async function planTrip(points: LonLat[], timing: Timing, scoring: ScoringOptions = {}, fetchJson?: FetchJson): Promise<TripPlan> {
  const { routes, notes } = await findRoutes(points, fetchJson);
  const results = routes.map((route) => {
    const stretch = timeScale(route.segmentDurations.reduce((a, b) => a + b, 0), timing);
    return { route, stretch, ...evaluate(route, timing.departure, stretch.scale, scoring) };
  });
  return { results, notes };
}

/** The verdict on one route if the bus left a little early or late. */
export function departureShifts(result: RouteResult, timing: Timing, scoring: ScoringOptions = {}): Shifted[] {
  return shiftedVerdicts(result.route, timing.departure, result.stretch.scale, scoring);
}
