import { bearing, lerp, toDeg, toRad, wrap360 } from './geo.ts';
import { clearSkyDni, faceIrradiance } from './irradiance.ts';
import { sunPosition } from './solar.ts';
import type { Faces, LonLat, Route, SegmentPass, SunPosition, TimelineBin } from './types.ts';

export interface TripOptions {
  /** Departure time, ms since epoch (UTC). */
  departure: number;
  /** Stretches every segment's time: 1.3 means 30% slower than the routed car time. */
  timeScale?: number;
  /** Size of a timeline bin, seconds (default 60). */
  binSeconds?: number;
  /** Direct sunlight on a surface facing the sun, W/m². Clear sky by default; weather plugs in here. */
  dni?: (time: number, at: LonLat, sun: SunPosition) => number;
}

const FACES = ['left', 'right', 'front', 'rear', 'roof'] as const;

const clearSky = (_time: number, _at: LonLat, sun: SunPosition) => clearSkyDni(sun.elevation);

/** Simulates the whole trip: every segment as driven, plus the minute-by-minute timeline. */
export function simulate(route: Route, options: TripOptions): { passes: SegmentPass[]; bins: TimelineBin[] } {
  const passes = drive(route, options);
  return { passes, bins: timeline(route, passes, options.binSeconds ?? 60) };
}

/** Drives the route one segment at a time, working out the sun on each face of the vehicle. */
export function drive(route: Route, options: TripOptions): SegmentPass[] {
  const scale = options.timeScale ?? 1;
  const dniAt = options.dni ?? clearSky;
  const passes: SegmentPass[] = [];
  let clock = options.departure;
  let heading = 0;
  for (let i = 0; i < route.segmentDurations.length; i++) {
    const a = route.coords[i];
    const b = route.coords[i + 1];
    if (a[0] !== b[0] || a[1] !== b[1]) heading = bearing(a, b); // a zero-length segment keeps the last heading
    const seconds = route.segmentDurations[i] * scale;
    const mid = lerp(a, b, 0.5);
    const time = clock + (seconds * 1000) / 2;
    const sun = sunPosition(time, mid[1], mid[0]);
    passes.push({ index: i, start: clock, seconds, heading, sun, faces: faceIrradiance(sun, heading, dniAt(time, mid, sun)) });
    clock += seconds * 1000;
  }
  return passes;
}

/** Sums the passes into fixed time bins, splitting any pass that straddles a bin edge. */
export function timeline(route: Route, passes: SegmentPass[], binSeconds = 60): TimelineBin[] {
  if (passes.length === 0) return [];
  const departure = passes[0].start;
  const binMs = binSeconds * 1000;
  const last = passes[passes.length - 1];
  const count = Math.max(1, Math.ceil((last.start - departure + last.seconds * 1000) / binMs));
  const sums = Array.from({ length: count }, () => ({
    seconds: 0,
    x: 0, // heading as a vector, so 359° and 1° average to 0°, not 180°
    y: 0,
    faces: { left: 0, right: 0, front: 0, rear: 0, roof: 0 } as Faces,
  }));

  for (const pass of passes) {
    const x = Math.sin(toRad(pass.heading));
    const y = Math.cos(toRad(pass.heading));
    let from = pass.start - departure;
    const to = from + pass.seconds * 1000;
    while (from < to) {
      const k = Math.min(count - 1, Math.floor(from / binMs));
      // The last bin takes whatever is left, so float rounding at the very end can't stall the loop.
      const until = k === count - 1 ? to : Math.min(to, (k + 1) * binMs);
      const seconds = (until - from) / 1000;
      const sum = sums[k];
      sum.seconds += seconds;
      sum.x += x * seconds;
      sum.y += y * seconds;
      for (const face of FACES) sum.faces[face] += pass.faces[face] * seconds;
      from = until;
    }
  }

  const locate = locator(route, passes);
  return sums.map((sum, k) => {
    const start = departure + k * binMs;
    const middle = start + (sum.seconds * 1000) / 2;
    const { position, distance } = locate(middle);
    const faces = { ...sum.faces };
    for (const face of FACES) faces[face] = sum.seconds > 0 ? faces[face] / sum.seconds : 0;
    return {
      start,
      seconds: sum.seconds,
      distance,
      position,
      heading: wrap360(toDeg(Math.atan2(sum.x, sum.y))),
      sun: sunPosition(middle, position[1], position[0]),
      faces,
    };
  });
}

/** Where the vehicle is at a given time: its position and the distance travelled so far. */
function locator(route: Route, passes: SegmentPass[]) {
  const travelled = [0];
  for (const d of route.segmentDistances) travelled.push(travelled[travelled.length - 1] + d);
  return (time: number): { position: LonLat; distance: number } => {
    let lo = 0;
    let hi = passes.length - 1;
    while (lo < hi) {
      // the last pass that starts at or before `time`
      const mid = (lo + hi + 1) >> 1;
      if (passes[mid].start <= time) lo = mid;
      else hi = mid - 1;
    }
    const pass = passes[lo];
    const f = pass.seconds > 0 ? Math.min(1, Math.max(0, (time - pass.start) / (pass.seconds * 1000))) : 0;
    const i = pass.index;
    return { position: lerp(route.coords[i], route.coords[i + 1], f), distance: travelled[i] + f * route.segmentDistances[i] };
  };
}
