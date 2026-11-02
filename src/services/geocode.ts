import { distance } from '../engine/geo.ts';
import type { LonLat } from '../engine/types.ts';
import { fetchJson as plainFetch, type FetchJson } from './http.ts';

/** Komoot's public Photon geocoder (OpenStreetMap data): free, no key, fair use. Finds bus stands too. */
const PHOTON_URL = 'https://photon.komoot.io/api/';
/** Open-Meteo's geocoder (GeoNames data): free, no key, towns and cities only. The fallback when Photon is down. */
const OPEN_METEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';
/** With nothing better to go on, searches lean towards the middle of India. */
const INDIA: LonLat = [79, 22.5];

export interface Place {
  label: string;
  position: LonLat;
  /** What sort of place it is ("town", "bus station"), when known. */
  kind?: string;
  country?: string;
}

export interface SearchOptions {
  limit?: number;
  /** Prefer matches near this point, e.g. the middle of the trip when looking up a via town. */
  near?: LonLat;
  fetchJson?: FetchJson;
}

interface PhotonResponse {
  features: { geometry: { coordinates: LonLat }; properties: Record<string, string | undefined> }[];
}

interface OpenMeteoResponse {
  results?: { name: string; latitude: number; longitude: number; admin1?: string; admin2?: string; country?: string }[];
}

/** Places matching a name, best first: Photon's, or Open-Meteo's if Photon is unreachable or finds nothing. */
export async function searchPlaces(query: string, options: SearchOptions = {}): Promise<Place[]> {
  const fetchJson = options.fetchJson ?? plainFetch;
  try {
    const found = await photon(query, options, fetchJson);
    if (found.length) return found;
  } catch {
    // Photon's public server is sometimes unreachable; Open-Meteo still covers towns and cities.
  }
  return openMeteo(query, options, fetchJson);
}

async function photon(query: string, { limit = 5, near = INDIA }: SearchOptions, fetchJson: FetchJson): Promise<Place[]> {
  const params = new URLSearchParams({ q: query, limit: String(limit), lang: 'en', lon: String(near[0]), lat: String(near[1]) });
  const body = (await fetchJson(`${PHOTON_URL}?${params}`)) as PhotonResponse;
  return body.features.map(({ geometry, properties: p }) => ({
    label: [p.name, p.city !== p.name ? p.city : undefined, p.state, p.country].filter(Boolean).join(', '),
    position: geometry.coordinates,
    kind: p.osm_key === 'boundary' ? 'area' : p.osm_value?.replaceAll('_', ' '),
    country: p.country,
  }));
}

async function openMeteo(query: string, { limit = 5, near }: SearchOptions, fetchJson: FetchJson): Promise<Place[]> {
  const params = new URLSearchParams({ name: query, count: String(limit), language: 'en', format: 'json' });
  const body = (await fetchJson(`${OPEN_METEO_URL}?${params}`)) as OpenMeteoResponse;
  const places = (body.results ?? []).map((r) => ({
    label: [r.name, r.admin2 !== r.name ? r.admin2 : undefined, r.admin1, r.country].filter(Boolean).join(', '),
    position: [r.longitude, r.latitude] as LonLat,
    country: r.country,
  }));
  return near ? places.sort((a, b) => distance(a.position, near) - distance(b.position, near)) : places;
}
