import { distance, lerp } from './geo.ts';
import type { LonLat } from './types.ts';

/** Points every `step` metres along a polyline, plus its last point. */
export function resample(coords: LonLat[], step: number): LonLat[] {
  if (coords.length === 0) return [];
  const out: LonLat[] = [coords[0]];
  let carry = 0; // metres from the last emitted point to the end of the current segment
  for (let i = 1; i < coords.length; i++) {
    const length = distance(coords[i - 1], coords[i]);
    let at = step - carry;
    for (; at <= length; at += step) out.push(lerp(coords[i - 1], coords[i], at / length));
    carry = length - (at - step);
  }
  if (carry > 1e-6) out.push(coords[coords.length - 1]);
  return out;
}

/** Share of route `a` (0..1) that runs within `tolerance` metres of route `b`. */
export function overlap(a: LonLat[], b: LonLat[], tolerance = 1000): number {
  // Bucket b's points on a grid about `tolerance` across, so each check only looks at nearby cells.
  const size = tolerance / 111_000; // degrees: `tolerance` metres of latitude
  const cellOf = ([lon, lat]: LonLat) => [Math.floor(lon / size), Math.floor(lat / size)];
  const cells = new Map<string, LonLat[]>();
  for (const p of resample(b, tolerance / 4)) {
    const key = cellOf(p).join();
    const cell = cells.get(key);
    if (cell) cell.push(p);
    else cells.set(key, [p]);
  }
  const near = (p: LonLat) => {
    const [x, y] = cellOf(p);
    // A degree of longitude is shorter than one of latitude, so look two cells either side (fine up to 60°).
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const q of cells.get(`${x + dx},${y + dy}`) ?? []) if (distance(p, q) <= tolerance) return true;
      }
    }
    return false;
  };
  const samples = resample(a, tolerance / 4);
  return samples.length ? samples.filter(near).length / samples.length : 0;
}

/**
 * Two routes count as the same when each stays within 1 km of the other for all but 15 km, and
 * at least 80%, of its length: different streets out of a city don't make a real alternative.
 */
export function sameRoute(a: LonLat[], b: LonLat[]): boolean {
  const close = (x: LonLat[], y: LonLat[]) => {
    const share = overlap(x, y);
    return share >= 0.8 && (1 - share) * length(x) <= 15_000;
  };
  return close(a, b) && close(b, a);
}

const length = (coords: LonLat[]) => coords.slice(1).reduce((metres, p, i) => metres + distance(coords[i], p), 0);

/** One spelling per road number, so "NH-48", "NH 48" and "nh48" all become "NH48"; other names pass through. */
export function roadName(name: string): string {
  const ref = /^([a-z]{1,4})[\s-]*(\d+[a-z]?)$/i.exec(name.trim());
  return ref ? `${ref[1]}${ref[2]}`.toUpperCase() : name.trim();
}

/**
 * Short labels like "via NH147, SH41": for each route, the named roads it uses at least
 * `minKm` more than any other route does, or else simply its main roads.
 */
export function routeLabels(roads: Record<string, number>[], minKm = 3): string[] {
  return roads.map((mine, i) => {
    const elsewhere = (name: string) => Math.max(0, ...roads.filter((_, j) => j !== i).map((r) => r[name] ?? 0));
    const byKm = Object.entries(mine).sort((x, y) => y[1] - x[1]);
    const distinctive = byKm.filter(([name, km]) => km - elsewhere(name) >= minKm);
    const names = (distinctive.length ? distinctive : byKm).slice(0, 2).map(([name]) => name);
    return names.length ? `via ${names.join(', ')}` : `route ${i + 1}`;
  });
}
