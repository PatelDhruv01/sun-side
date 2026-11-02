import { resample } from '../engine/alternatives.ts';
import type { LonLat } from '../engine/types.ts';
import { cellCentre, cellKey, type Weather, type WeatherCell } from '../engine/weather.ts';
import { fetchJson as plainFetch, type FetchJson } from './http.ts';

/** Open-Meteo's forecast API: free, no key, non-commercial use. */
const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';

/** How many days ahead Open-Meteo forecasts reliably reach; trips further out assume a clear sky. */
export const FORECAST_DAYS = 14;

interface ForecastPoint {
  hourly: {
    time: string[];
    direct_normal_irradiance_instant: (number | null)[];
    cloud_cover: (number | null)[];
    temperature_2m: (number | null)[];
  };
}

/** Hourly forecasts for every square the routes pass through, covering `from` to `to` (ms since epoch). */
export async function fetchWeather(routes: LonLat[][], from: number, to: number, fetchJson: FetchJson = plainFetch): Promise<Weather> {
  // One forecast point per square, however many routes cross it.
  const centres = new Map<string, LonLat>();
  for (const coords of routes) for (const point of resample(coords, 10_000)) centres.set(cellKey(point), cellCentre(point));
  const keys = [...centres.keys()];
  const params = new URLSearchParams({
    latitude: keys.map((key) => centres.get(key)![1].toFixed(2)).join(','),
    longitude: keys.map((key) => centres.get(key)![0].toFixed(2)).join(','),
    hourly: 'direct_normal_irradiance_instant,cloud_cover,temperature_2m',
    timezone: 'GMT',
    start_date: utcDay(from),
    end_date: utcDay(to),
  });
  const body = await fetchJson(`${OPEN_METEO_URL}?${params}`);
  const points = (Array.isArray(body) ? body : [body]) as ForecastPoint[]; // one place comes back on its own
  if (points.length !== keys.length || !points[0]?.hourly) throw new Error('Open-Meteo returned an unexpected forecast');
  const cells = new Map<string, WeatherCell>(
    keys.map((key, i) => {
      const hourly = points[i].hourly;
      return [
        key,
        {
          position: centres.get(key)!,
          dni: filled(hourly.direct_normal_irradiance_instant),
          cloud: filled(hourly.cloud_cover),
          temperature: filled(hourly.temperature_2m),
        },
      ];
    }),
  );
  return { times: points[0].hourly.time.map((time) => Date.parse(`${time}Z`)), cells };
}

const utcDay = (time: number) => new Date(time).toISOString().slice(0, 10);

/** Gaps in a forecast (nulls) take the last value before them, or the first one after. */
function filled(values: (number | null)[]): number[] {
  const first = values.find((v) => v !== null) ?? 0;
  let last = first;
  return values.map((v) => (v === null ? last : (last = v)));
}
