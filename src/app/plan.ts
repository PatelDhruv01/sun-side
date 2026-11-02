// The whole trip pipeline, shared by the command line and the web page: routes and weather
// for the places, then where to sit on each route, at one departure time or across a day.
import type { ScoringOptions } from '../engine/decide.ts';
import { evaluate, shiftedVerdicts, type Evaluation, type Shifted } from '../engine/evaluate.ts';
import { bands, sweep, type Band, type DepartureVerdict } from '../engine/sweep.ts';
import { timeScale, type TimeScale, type Timing, type Vehicle } from '../engine/timing.ts';
import type { LonLat } from '../engine/types.ts';
import { forecastDni, type Weather } from '../engine/weather.ts';
import type { FetchJson } from '../services/http.ts';
import { findRoutes, type CandidateRoute } from '../services/routing.ts';
import { fetchWeather, FORECAST_DAYS } from '../services/weather.ts';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Everything fetched for a trip: the candidate routes and, when the date is near enough, the forecast. */
export interface TripContext {
  routes: CandidateRoute[];
  weather: Weather | null;
  /** Things worth telling the reader, e.g. a service that didn't answer. */
  notes: string[];
}

export interface PrepareOptions {
  /** Fetch the forecast (default true). */
  weather?: boolean;
  fetchJson?: FetchJson;
  /** The current time, for knowing how far ahead the forecast reaches. */
  now?: number;
}

/**
 * Finds the routes through the points (start, via towns, end), then the forecast for departures
 * between `departures.from` and `departures.to` (and trips of up to a day and a half after).
 */
export async function prepareTrip(points: LonLat[], departures: { from: number; to: number }, options: PrepareOptions = {}): Promise<TripContext> {
  const { routes, notes } = await findRoutes(points, options.fetchJson);
  let weather: Weather | null = null;
  if (options.weather !== false) {
    const horizon = (options.now ?? Date.now()) + FORECAST_DAYS * DAY;
    if (departures.from > horizon) {
      notes.push(`There's no weather forecast this far ahead (about ${FORECAST_DAYS} days at most), so this assumes a clear sky.`);
    } else {
      try {
        const to = Math.min(departures.to + 36 * HOUR, horizon);
        weather = await fetchWeather(routes.map((r) => r.coords), departures.from - HOUR, to, options.fetchJson);
      } catch {
        notes.push("The weather forecast didn't load, so this assumes a clear sky.");
      }
    }
  }
  return { routes, weather, notes };
}

/** One candidate route, simulated and decided. */
export interface RouteResult extends Evaluation {
  route: CandidateRoute;
  stretch: TimeScale;
}

/** Where to sit on every route, leaving at one time. */
export function planAt(context: TripContext, timing: Timing, scoring: ScoringOptions = {}): RouteResult[] {
  const dni = context.weather ? forecastDni(context.weather) : undefined;
  return context.routes.map((route) => {
    const stretch = timeScale(total(route.segmentDurations), timing);
    return { route, stretch, ...evaluate(route, { departure: timing.departure, timeScale: stretch.scale, scoring, dni }) };
  });
}

/** The verdict on one route if the bus left a little early or late. */
export function departureShifts(context: TripContext, result: RouteResult, timing: Timing, scoring: ScoringOptions = {}): Shifted[] {
  const dni = context.weather ? forecastDni(context.weather) : undefined;
  return shiftedVerdicts(result.route, { departure: timing.departure, timeScale: result.stretch.scale, scoring, dni });
}

export interface DayPlan {
  verdicts: DepartureVerdict[];
  bands: Band[];
  stretch: TimeScale;
}

/** Where to sit on one route for every departure across a day, half an hour apart. */
export function planDay(
  context: TripContext,
  routeIndex: number,
  day: { start: number; vehicle: Vehicle; hours?: number },
  scoring: ScoringOptions = {},
): DayPlan {
  const route = context.routes[routeIndex];
  const arrival = day.hours ? day.start + day.hours * HOUR : undefined; // the same trip length at any time of day
  const stretch = timeScale(total(route.segmentDurations), { departure: day.start, vehicle: day.vehicle, arrival });
  const dni = context.weather ? forecastDni(context.weather) : undefined;
  const verdicts = sweep(route, { first: day.start, last: day.start + DAY - HOUR / 2, timeScale: stretch.scale, dni, scoring });
  return { verdicts, bands: bands(verdicts), stretch };
}

/** The usual one-departure shortcut: prepare, then plan at that time. */
export async function planTrip(
  points: LonLat[],
  timing: Timing,
  scoring: ScoringOptions = {},
  options: PrepareOptions = {},
): Promise<{ context: TripContext; results: RouteResult[] }> {
  const context = await prepareTrip(points, { from: timing.departure, to: timing.departure }, options);
  return { context, results: planAt(context, timing, scoring) };
}

const total = (values: number[]) => values.reduce((a, b) => a + b, 0);
