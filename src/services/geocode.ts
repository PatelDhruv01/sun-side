import type { LonLat } from '../engine/types.ts';
import { fetchJson as plainFetch, type FetchJson } from './http.ts';

/** Komoot's public Photon geocoder (OpenStreetMap data): free, no key, fair use. */
const PHOTON_URL = 'https://photon.komoot.io/api/';

export interface Place {
  label: string;
  position: LonLat;
}

interface PhotonResponse {
  features: { geometry: { coordinates: LonLat }; properties: Record<string, string | undefined> }[];
}

/** The best match for a place name, e.g. "Swargate, Pune". */
export async function geocode(query: string, fetchJson: FetchJson = plainFetch): Promise<Place> {
  const url = `${PHOTON_URL}?${new URLSearchParams({ q: query, limit: '1', lang: 'en' })}`;
  const body = (await fetchJson(url)) as PhotonResponse;
  const hit = body.features[0];
  if (!hit) throw new Error(`No place found for "${query}"`);
  const { name, city, state, country } = hit.properties;
  const label = [name, city !== name ? city : undefined, state, country].filter(Boolean).join(', ');
  return { label, position: hit.geometry.coordinates };
}
