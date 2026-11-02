// Forecast weather along a route, and how it dims the sun.
import { clearSkyDni } from './irradiance.ts';
import { sunPosition } from './solar.ts';
import type { LonLat, SunPosition, TimelineBin } from './types.ts';

/** Forecasts are kept per 0.5° square (about 55 km), so a whole route needs only a few points. */
export const CELL = 0.5;

export interface WeatherCell {
  /** The forecast point: the middle of the square. */
  position: LonLat;
  /** Hourly forecasts, one per entry in Weather.times. Direct sunlight facing the sun, W/m². */
  dni: number[];
  /** Cloud cover, %. */
  cloud: number[];
  /** Air temperature, °C. */
  temperature: number[];
}

export interface Weather {
  /** The forecast hours, ms since epoch (UTC), an hour apart. */
  times: number[];
  /** Forecasts by square; see cellKey. */
  cells: Map<string, WeatherCell>;
}

/** The forecast square a point falls in. */
export const cellKey = ([lon, lat]: LonLat) => `${Math.round(lat / CELL)},${Math.round(lon / CELL)}`;

/** The middle of the forecast square a point falls in. */
export const cellCentre = ([lon, lat]: LonLat): LonLat => [Math.round(lon / CELL) * CELL, Math.round(lat / CELL) * CELL];

const clearnessCache = new WeakMap<Weather, Map<string, number[]>>();

/**
 * Direct sunlight under the forecast sky. Each hour the forecast says how much of the clear-sky
 * sun gets through (clouds and haze); that share scales our own minute-by-minute clear-sky
 * value, which follows the sun's height far more finely than hourly forecasts can.
 */
export function forecastDni(weather: Weather): (time: number, at: LonLat, sun: SunPosition) => number {
  let clearness = clearnessCache.get(weather);
  if (!clearness) {
    clearness = new Map([...weather.cells].map(([key, cell]) => [key, clearnessSeries(weather.times, cell)]));
    clearnessCache.set(weather, clearness);
  }
  const series = clearness;
  return (time, at, sun) => {
    const clear = clearSkyDni(sun.elevation);
    const share = series.get(cellKey(at));
    return share && clear > 0 ? clear * interpolate(weather.times, share, time) : clear;
  };
}

/** Cloud cover and temperature at a place and time, if the forecast covers it. */
export function weatherAt(weather: Weather, at: LonLat, time: number): { cloud: number; temperature: number } | undefined {
  const cell = weather.cells.get(cellKey(at));
  if (!cell) return undefined;
  return { cloud: interpolate(weather.times, cell.cloud, time), temperature: interpolate(weather.times, cell.temperature, time) };
}

export interface TripWeather {
  /** Mean cloud cover while the sun is up, %. */
  cloud: number;
  /** Mean share of the clear-sky sun that gets through while it's up, 0..1.3. */
  clearness: number;
  minTemperature: number;
  maxTemperature: number;
}

/** The forecast over a simulated trip, or undefined if it covers none of it. */
export function tripWeather(weather: Weather, bins: TimelineBin[]): TripWeather | undefined {
  const dni = forecastDni(weather);
  let daylight = 0;
  let cloud = 0;
  let clearness = 0;
  let minTemperature = Infinity;
  let maxTemperature = -Infinity;
  for (const bin of bins) {
    const middle = bin.start + bin.seconds * 500;
    const here = weatherAt(weather, bin.position, middle);
    if (!here) continue;
    minTemperature = Math.min(minTemperature, here.temperature);
    maxTemperature = Math.max(maxTemperature, here.temperature);
    const clear = clearSkyDni(bin.sun.elevation);
    if (clear <= 0) continue;
    daylight += bin.seconds;
    cloud += here.cloud * bin.seconds;
    clearness += (dni(middle, bin.position, bin.sun) / clear) * bin.seconds;
  }
  if (minTemperature === Infinity) return undefined;
  return { cloud: daylight ? cloud / daylight : 0, clearness: daylight ? clearness / daylight : 1, minTemperature, maxTemperature };
}

/**
 * For each hour, the share of the clear-sky sun the forecast lets through (capped at 1.3).
 * Hours with the sun too low to tell borrow the nearest hour that can.
 */
function clearnessSeries(times: number[], cell: WeatherCell): number[] {
  const share = times.map((time, i) => {
    const sun = sunPosition(time, cell.position[1], cell.position[0]);
    const clear = clearSkyDni(sun.elevation);
    return sun.elevation > 3 && clear > 20 ? Math.min(1.3, Math.max(0, cell.dni[i] / clear)) : NaN;
  });
  const known = share.flatMap((value, i) => (Number.isNaN(value) ? [] : [i]));
  if (known.length === 0) return share.map(() => 1);
  return share.map((value, i) => {
    if (!Number.isNaN(value)) return value;
    const nearest = known.reduce((best, j) => (Math.abs(j - i) < Math.abs(best - i) ? j : best));
    return share[nearest];
  });
}

/** Linear interpolation in an hourly series; outside it, the nearest end. */
function interpolate(times: number[], values: number[], time: number): number {
  if (time <= times[0]) return values[0];
  const last = times.length - 1;
  if (time >= times[last]) return values[last];
  const i = Math.floor((time - times[0]) / 3_600_000);
  const f = (time - times[i]) / (times[i + 1] - times[i]);
  return values[i] + (values[i + 1] - values[i]) * f;
}
