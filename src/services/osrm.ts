import type { LonLat, Route } from '../engine/types.ts';
import { fetchJson as plainFetch, type FetchJson } from './http.ts';

/** FOSSGIS's public OSRM server: free, no key, fair use only (at most 1 request/second, non-commercial). */
const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving';

export interface RoutedTrip extends Route {
  /** Total length, metres. */
  distance: number;
  /** OSRM's own total for a car, seconds. */
  duration: number;
}

interface OsrmResponse {
  code: string;
  message?: string;
  routes: {
    distance: number;
    duration: number;
    geometry: { coordinates: LonLat[] };
    legs: { annotation: { duration: number[]; distance: number[] } }[];
  }[];
}

/** Car route(s) through the given points, with the time for every segment of the road. */
export async function fetchRoutes(
  points: LonLat[],
  options: { alternatives?: number; fetchJson?: FetchJson } = {},
): Promise<RoutedTrip[]> {
  const path = points.map(([lon, lat]) => `${lon.toFixed(6)},${lat.toFixed(6)}`).join(';');
  const query = new URLSearchParams({
    overview: 'full', // per-segment annotations only line up with the full geometry
    geometries: 'geojson',
    annotations: 'duration,distance',
    alternatives: String(options.alternatives ?? false),
    steps: 'false',
  });
  const body = (await (options.fetchJson ?? plainFetch)(`${OSRM_URL}/${path}?${query}`)) as OsrmResponse;
  if (body.code !== 'Ok') throw new Error(`OSRM could not find a route: ${body.code} ${body.message ?? ''}`);
  return body.routes.map((r) => {
    const coords = r.geometry.coordinates;
    const segmentDurations = r.legs.flatMap((leg) => leg.annotation.duration);
    const segmentDistances = r.legs.flatMap((leg) => leg.annotation.distance);
    if (segmentDurations.length !== coords.length - 1) {
      throw new Error(`OSRM gave ${segmentDurations.length} segment times for ${coords.length - 1} segments`);
    }
    return { coords, segmentDurations, segmentDistances, distance: r.distance, duration: r.duration };
  });
}
