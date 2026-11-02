import { routeLabels, sameRoute } from '../engine/alternatives.ts';
import type { LonLat } from '../engine/types.ts';
import type { FetchJson } from './http.ts';
import { fetchRoutes, type RoutedTrip } from './osrm.ts';
import { fetchValhallaRoutes } from './valhalla.ts';

export interface CandidateRoute extends RoutedTrip {
  /** E.g. "via NH147, SH41". */
  label: string;
}

/**
 * The sensible driving routes through the points: OSRM's quickest first (every other route's
 * timing leans on it), then the rest, quickest first. Valhalla adds alternatives when there are
 * no via points; neither engine offers alternatives past a plain A→B.
 */
export async function findRoutes(points: LonLat[], fetchJson?: FetchJson): Promise<{ routes: CandidateRoute[]; notes: string[] }> {
  const direct = points.length === 2;
  const routes = await fetchRoutes(points, { alternatives: direct ? 3 : 0, fetchJson });
  const notes: string[] = [];
  if (direct) {
    try {
      const extra = await fetchValhallaRoutes(points, { alternatives: 2, fetchJson });
      // Valhalla's times run slow for India: rescale them by how its time for OSRM's main route
      // (or else its own best) compares with OSRM's, which keeps its view of which route is slower.
      const twin = extra.find((r) => sameRoute(r.coords, routes[0].coords)) ?? extra[0];
      const factor = total(routes[0].segmentDurations) / total(twin.segmentDurations);
      for (const route of extra) {
        if (!routes.some((kept) => sameRoute(kept.coords, route.coords))) routes.push(rescaled(route, factor));
      }
    } catch {
      notes.push('Valhalla, which finds the alternative routes, did not answer; showing OSRM routes only.');
    }
  }
  const [main, ...rest] = routes;
  const ordered = [main, ...rest.sort((a, b) => total(a.segmentDurations) - total(b.segmentDurations))];
  const labels = routeLabels(ordered.map((r) => r.roads));
  return { routes: ordered.map((r, i) => ({ ...r, label: labels[i] })), notes };
}

const total = (values: number[]) => values.reduce((a, b) => a + b, 0);

function rescaled(route: RoutedTrip, factor: number): RoutedTrip {
  return { ...route, segmentDurations: route.segmentDurations.map((s) => s * factor), duration: route.duration * factor };
}
