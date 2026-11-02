import { toDeg, toRad, wrap360 } from './geo.ts';
import type { SunPosition } from './types.ts';

/**
 * Where the sun is in the sky, from NOAA's solar calculator equations (after Meeus,
 * "Astronomical Algorithms"). Good to about 0.01° for 1901-2099; we need ~1° at most.
 */
export function sunPosition(time: number, lat: number, lon: number): SunPosition {
  const julianDay = time / 86_400_000 + 2_440_587.5;
  const t = (julianDay - 2_451_545) / 36_525; // Julian centuries since J2000

  const meanLong = wrap360(280.46646 + t * (36000.76983 + t * 0.0003032));
  const meanAnomaly = toRad(357.52911 + t * (35999.05029 - 0.0001537 * t));
  const eccentricity = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const center =
    Math.sin(meanAnomaly) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(2 * meanAnomaly) * (0.019993 - 0.000101 * t) +
    Math.sin(3 * meanAnomaly) * 0.000289;
  const omega = toRad(125.04 - 1934.136 * t);
  const apparentLong = toRad(meanLong + center - 0.00569 - 0.00478 * Math.sin(omega));
  const meanObliquity = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const obliquity = toRad(meanObliquity + 0.00256 * Math.cos(omega));
  const declination = Math.asin(Math.sin(obliquity) * Math.sin(apparentLong));

  // Equation of time: how far sundial time runs ahead of clock time, minutes.
  const y = Math.tan(obliquity / 2) ** 2;
  const l0 = toRad(meanLong);
  const equationOfTime =
    4 *
    toDeg(
      y * Math.sin(2 * l0) -
        2 * eccentricity * Math.sin(meanAnomaly) +
        4 * eccentricity * y * Math.sin(meanAnomaly) * Math.cos(2 * l0) -
        0.5 * y * y * Math.sin(4 * l0) -
        1.25 * eccentricity * eccentricity * Math.sin(2 * meanAnomaly),
    );

  const solarMinutes = wrapDay(time / 60_000 + equationOfTime + 4 * lon);
  const hourAngle = toRad(solarMinutes / 4 - 180); // 0 at local solar noon, negative in the morning

  const phi = toRad(lat);
  const cosZenith =
    Math.sin(phi) * Math.sin(declination) + Math.cos(phi) * Math.cos(declination) * Math.cos(hourAngle);
  const elevation = 90 - toDeg(Math.acos(Math.min(1, Math.max(-1, cosZenith))));
  const azimuth = wrap360(
    toDeg(Math.atan2(Math.sin(hourAngle), Math.cos(hourAngle) * Math.sin(phi) - Math.tan(declination) * Math.cos(phi))) +
      180,
  );
  return { azimuth, elevation: elevation + refraction(elevation) };
}

/** Minutes wrapped into one day, [0, 1440). */
const wrapDay = (minutes: number) => ((minutes % 1440) + 1440) % 1440;

/** How much the air lifts the sun's apparent height (NOAA's fit), degrees. Matters only near the horizon. */
function refraction(elevation: number): number {
  if (elevation > 85) return 0;
  const tanE = Math.tan(toRad(elevation));
  let arcsec: number;
  if (elevation > 5) arcsec = 58.1 / tanE - 0.07 / tanE ** 3 + 0.000086 / tanE ** 5;
  else if (elevation > -0.575) arcsec = 1735 + elevation * (-518.2 + elevation * (103.4 + elevation * (-12.79 + elevation * 0.711)));
  else arcsec = -20.772 / tanE;
  return arcsec / 3600;
}
