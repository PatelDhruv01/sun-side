import { toRad } from './geo.ts';
import type { Faces, SunPosition } from './types.ts';

/** Relative optical air mass: how much atmosphere the sunlight crosses (Kasten & Young 1989). */
export function airMass(elevation: number): number {
  const zenith = 90 - elevation;
  return 1 / (Math.cos(toRad(zenith)) + 0.50572 * (96.07995 - zenith) ** -1.6364);
}

/** Direct sunlight on a surface facing the sun under a clear sky, W/m² (Meinel & Meinel 1976). */
export function clearSkyDni(elevation: number): number {
  if (elevation <= 0) return 0;
  return 1353 * 0.7 ** (airMass(elevation) ** 0.678);
}

/**
 * Splits direct sunlight (`dni`, W/m² on a surface facing the sun) onto the faces of a
 * vehicle heading `heading` degrees from north. Windows are treated as vertical, so a
 * high sun mostly lands on the roof.
 */
export function faceIrradiance(sun: SunPosition, heading: number, dni: number): Faces {
  if (sun.elevation <= 0 || dni <= 0) return { left: 0, right: 0, front: 0, rear: 0, roof: 0 };
  const relative = toRad(sun.azimuth - heading); // 0 = dead ahead, +90° = right-hand side
  const horizontal = dni * Math.cos(toRad(sun.elevation));
  const across = horizontal * Math.sin(relative);
  const along = horizontal * Math.cos(relative);
  return {
    left: Math.max(0, -across),
    right: Math.max(0, across),
    front: Math.max(0, along),
    rear: Math.max(0, -along),
    roof: dni * Math.sin(toRad(sun.elevation)),
  };
}
