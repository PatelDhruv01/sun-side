// Shared test helpers: synthetic roads, and fake OSRM/Valhalla answers built from them.
import { destination, distance } from '../src/engine/geo.ts';
import type { LonLat, Route } from '../src/engine/types.ts';

export const MUMBAI: LonLat = [72.88, 19.08];
export const AHMEDABAD: LonLat = [72.57, 23.02];

/** A clock time in India (IST, UTC+05:30) as ms since epoch. */
export const ist = (local: string) => Date.parse(`${local}+05:30`);

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

/** A polyline of straight legs ([bearing, km] pairs) with a vertex every `step` metres. */
export function line(start: LonLat, legs: [bearing: number, km: number][], step = 500): LonLat[] {
  const coords: LonLat[] = [start];
  for (const [bearing, km] of legs) {
    for (let i = 0; i < Math.round((km * 1000) / step); i++) coords.push(destination(coords[coords.length - 1], bearing, step));
  }
  return coords;
}

/** A drivable road made of straight legs at a steady speed, with a vertex every 250 m. */
export function road(start: LonLat, legs: [bearing: number, km: number][], kmh = 60): Route {
  const coords = line(start, legs, 250);
  const segmentDistances = coords.slice(1).map((c, i) => distance(coords[i], c));
  return { coords, segmentDistances, segmentDurations: segmentDistances.map((m) => m / (kmh / 3.6)) };
}

/** OSRM's JSON for one route along `coords` at `kmh`, all on one named road. */
export function osrmRoute(coords: LonLat[], kmh: number, roadName: string) {
  const distances = coords.slice(1).map((p, i) => distance(coords[i], p));
  const durations = distances.map((m) => m / (kmh / 3.6));
  return {
    distance: sum(distances),
    duration: sum(durations),
    geometry: { coordinates: coords },
    legs: [{ annotation: { duration: durations, distance: distances }, steps: [{ name: roadName, distance: sum(distances) }] }],
  };
}

/** Valhalla's JSON for a trip along `coords` at `kmh`: one maneuver per [road, first, last] segment span. */
export function valhallaTrip(coords: LonLat[], kmh: number, spans: [road: string, first: number, last: number][]) {
  const lengths = coords.slice(1).map((p, i) => distance(coords[i], p));
  const maneuvers = spans.map(([name, first, last]) => {
    const metres = sum(lengths.slice(first, last));
    return { time: metres / (kmh / 3.6), length: metres / 1000, begin_shape_index: first, end_shape_index: last, street_names: [name] };
  });
  const end = coords.length - 1;
  maneuvers.push({ time: 0, length: 0, begin_shape_index: end, end_shape_index: end, street_names: [] }); // "you have arrived"
  const metres = sum(lengths);
  return { summary: { length: metres / 1000, time: metres / (kmh / 3.6) }, legs: [{ shape: encodePolyline6(coords), maneuvers }] };
}

/** Google's encoded-polyline format at 6 decimals, as Valhalla sends it. */
export function encodePolyline6(points: LonLat[]): string {
  let out = '';
  const put = (value: number) => {
    let v = value < 0 ? ~(value << 1) : value << 1;
    while (v >= 0x20) {
      out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    out += String.fromCharCode(v + 63);
  };
  let lat = 0;
  let lon = 0;
  for (const [x, y] of points) {
    const nextLat = Math.round(y * 1e6);
    const nextLon = Math.round(x * 1e6);
    put(nextLat - lat);
    put(nextLon - lon);
    lat = nextLat;
    lon = nextLon;
  }
  return out;
}
