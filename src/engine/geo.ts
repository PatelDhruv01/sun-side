import type { LonLat } from './types.ts';

/** Mean Earth radius, metres. */
const EARTH_RADIUS = 6371008.8;

export const toRad = (deg: number) => (deg * Math.PI) / 180;
export const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** Wraps an angle into [0, 360). */
export function wrap360(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

/** Wraps an angle into [-180, 180). */
export function wrap180(angle: number): number {
  return wrap360(angle + 180) - 180;
}

/** Great-circle distance between two points, metres. */
export function distance([lon1, lat1]: LonLat, [lon2, lat2]: LonLat): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Initial compass bearing from a to b, degrees clockwise from north. */
export function bearing([lon1, lat1]: LonLat, [lon2, lat2]: LonLat): number {
  const p1 = toRad(lat1);
  const p2 = toRad(lat2);
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dLon);
  return wrap360(toDeg(Math.atan2(y, x)));
}

/** The point `metres` away from `start` along a compass bearing. */
export function destination([lon, lat]: LonLat, bearingDeg: number, metres: number): LonLat {
  const d = metres / EARTH_RADIUS;
  const b = toRad(bearingDeg);
  const p1 = toRad(lat);
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b));
  const l2 = toRad(lon) + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return [wrap180(toDeg(l2)), toDeg(p2)];
}

/** Straight-line interpolation; fine for the short segments a route is made of. */
export function lerp(a: LonLat, b: LonLat, t: number): LonLat {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

/** 16-point compass name for a bearing, e.g. 100 → "E". */
export function compass(bearingDeg: number): string {
  return COMPASS[Math.round(wrap360(bearingDeg) / 22.5) % 16];
}
