import { roadName } from '../engine/alternatives.ts';
import { distance } from '../engine/geo.ts';
import type { LonLat } from '../engine/types.ts';
import { fetchJson as plainFetch, type FetchJson } from './http.ts';
import type { RoutedTrip } from './osrm.ts';

/**
 * FOSSGIS's public Valhalla server: free, no key, fair use. It often finds alternative routes
 * where OSRM finds one, but its times run very slow for Indian roads, so callers rescale them.
 */
const VALHALLA_URL = 'https://valhalla1.openstreetmap.de/route';

interface Maneuver {
  time: number;
  length: number;
  begin_shape_index: number;
  end_shape_index: number;
  street_names?: string[];
}

interface ValhallaTrip {
  summary: { length: number; time: number };
  legs: { shape: string; maneuvers: Maneuver[] }[];
}

interface ValhallaResponse {
  trip?: ValhallaTrip;
  alternates?: { trip: ValhallaTrip }[];
}

/** Car route(s) through the given points: Valhalla's best first, then its alternates. */
export async function fetchValhallaRoutes(
  points: LonLat[],
  options: { alternatives?: number; fetchJson?: FetchJson } = {},
): Promise<RoutedTrip[]> {
  const request = {
    locations: points.map(([lon, lat]) => ({ lon, lat })),
    costing: 'auto',
    alternates: options.alternatives ?? 0,
    units: 'kilometers',
    directions_type: 'maneuvers', // maneuver times and road names, without the spoken instructions
  };
  const url = `${VALHALLA_URL}?json=${encodeURIComponent(JSON.stringify(request))}`;
  const body = (await (options.fetchJson ?? plainFetch)(url)) as ValhallaResponse;
  if (!body.trip) throw new Error('Valhalla returned no route');
  return [body.trip, ...(body.alternates ?? []).map((a) => a.trip)].map(toRoute);
}

function toRoute(trip: ValhallaTrip): RoutedTrip {
  const coords: LonLat[] = [];
  const segmentDurations: number[] = [];
  const roads: Record<string, number> = {};
  for (const leg of trip.legs) {
    const shape = decodePolyline6(leg.shape);
    const lengths = shape.slice(1).map((p, i) => distance(shape[i], p));
    const durations = Array<number>(lengths.length).fill(0);
    for (const m of leg.maneuvers) {
      // Valhalla times whole maneuvers; share each one's time over its segments by length.
      const span = lengths.slice(m.begin_shape_index, m.end_shape_index);
      const total = span.reduce((a, b) => a + b, 0);
      for (let i = m.begin_shape_index; i < m.end_shape_index; i++) {
        durations[i] += total > 0 ? (m.time * lengths[i]) / total : m.time / span.length;
      }
      const name = m.street_names?.[0] && roadName(m.street_names[0]);
      if (name) roads[name] = (roads[name] ?? 0) + m.length;
    }
    coords.push(...(coords.length ? shape.slice(1) : shape)); // legs share their joining point
    segmentDurations.push(...durations);
  }
  return {
    coords,
    segmentDurations,
    segmentDistances: coords.slice(1).map((p, i) => distance(coords[i], p)),
    distance: trip.summary.length * 1000,
    duration: trip.summary.time,
    roads,
    engine: 'valhalla',
  };
}

/** Decodes Google's encoded-polyline format at the 6-decimal precision Valhalla uses. */
export function decodePolyline6(encoded: string): LonLat[] {
  const points: LonLat[] = [];
  let index = 0;
  const next = () => {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  let lat = 0;
  let lon = 0;
  while (index < encoded.length) {
    lat += next();
    lon += next();
    points.push([lon / 1e6, lat / 1e6]);
  }
  return points;
}
