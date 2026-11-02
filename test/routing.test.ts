import assert from 'node:assert/strict';
import { test } from 'node:test';
import { distance } from '../src/engine/geo.ts';
import { searchPlaces } from '../src/services/geocode.ts';
import { findRoutes } from '../src/services/routing.ts';
import { decodePolyline6, fetchValhallaRoutes } from '../src/services/valhalla.ts';
import { AHMEDABAD, encodePolyline6, line, osrmRoute, valhallaTrip } from './fakes.ts';

const minutes = (seconds: number[]) => seconds.reduce((a, b) => a + b, 0) / 60;

test('decodes the 6-decimal polylines Valhalla sends', () => {
  const coords = line(AHMEDABAD, [[45, 5]]);
  const back = decodePolyline6(encodePolyline6(coords));
  assert.equal(back.length, coords.length);
  assert.ok(back.every((p, i) => distance(p, coords[i]) < 0.2));
});

test('Valhalla: maneuver times are shared over their segments by length, and legs join up', async () => {
  const first = line(AHMEDABAD, [[0, 4]]); // 8 segments of 500 m
  const second = line(first.at(-1)!, [[0, 2]]); // 4 more
  const a = valhallaTrip(first, 60, [['NH48', 0, 4], ['SH41', 4, 8]]);
  const b = valhallaTrip(second, 30, [['SH41', 0, 4]]);
  const trip = { summary: { length: 6, time: a.summary.time + b.summary.time }, legs: [...a.legs, ...b.legs] };
  const [route] = await fetchValhallaRoutes([AHMEDABAD, second.at(-1)!], { fetchJson: async () => ({ trip }) });
  assert.equal(route.coords.length, first.length + second.length - 1);
  assert.equal(route.segmentDurations.length, route.coords.length - 1);
  assert.ok(Math.abs(route.segmentDurations[0] - 30) < 0.1, '500 m at 60 km/h is 30 s');
  assert.ok(Math.abs(route.segmentDurations.at(-1)! - 60) < 0.1, '500 m at 30 km/h is 60 s');
  assert.ok(Math.abs(route.roads.NH48 - 2) < 0.01 && Math.abs(route.roads.SH41 - 4) < 0.01);
});

test("adds Valhalla's different routes, timed to match OSRM and labelled by road", async () => {
  const main = line(AHMEDABAD, [[0, 20]]);
  const detour = line(AHMEDABAD, [[90, 6], [0, 20], [270, 6]]); // 6 km out east, 20 north, 6 back
  const fetchJson = async (url: string) => {
    if (url.includes('project-osrm')) return { code: 'Ok', routes: [osrmRoute(main, 60, 'NH48')] };
    // Valhalla finds the same main route (to be dropped) plus the detour, both at a slow 30 km/h
    const twin = valhallaTrip(main, 30, [['NH48', 0, 40]]);
    const other = valhallaTrip(detour, 30, [['SH41', 0, 12], ['NH48', 12, 52], ['SH41', 52, 64]]);
    return { trip: twin, alternates: [{ trip: other }] };
  };
  const { routes, notes } = await findRoutes([AHMEDABAD, main.at(-1)!], fetchJson);
  assert.deepEqual(routes.map((r) => r.engine), ['osrm', 'valhalla']);
  assert.deepEqual(routes.map((r) => r.label), ['via NH48', 'via SH41']);
  assert.ok(Math.abs(minutes(routes[0].segmentDurations) - 20) < 0.1, 'OSRM: 20 km at 60 km/h');
  assert.ok(Math.abs(minutes(routes[1].segmentDurations) - 32) < 0.2, 'detour rescaled to OSRM speed: 32 km in 32 min');
  assert.deepEqual(notes, []);
});

test('carries on with OSRM alone when Valhalla does not answer', async () => {
  const main = line(AHMEDABAD, [[0, 20]]);
  const fetchJson = async (url: string) => {
    if (url.includes('project-osrm')) return { code: 'Ok', routes: [osrmRoute(main, 60, 'NH48')] };
    throw new Error('connect timeout');
  };
  const { routes, notes } = await findRoutes([AHMEDABAD, main.at(-1)!], fetchJson);
  assert.equal(routes.length, 1);
  assert.match(notes[0], /Valhalla/);
});

test('with via points only OSRM is asked, since it routes through them', async () => {
  const main = line(AHMEDABAD, [[0, 20]]);
  const asked: string[] = [];
  const fetchJson = async (url: string) => {
    asked.push(new URL(url).host);
    return { code: 'Ok', routes: [osrmRoute(main, 60, 'NH48')] };
  };
  await findRoutes([AHMEDABAD, main[20], main.at(-1)!], fetchJson);
  assert.deepEqual(asked, ['router.project-osrm.org']);
});

test('place search falls back to Open-Meteo when Photon is unreachable, nearest first', async () => {
  const fetchJson = async (url: string) => {
    if (url.includes('photon')) throw new Error('connect timeout');
    return {
      results: [
        { name: 'Ahmedabad', latitude: 28.89, longitude: 79.0, admin2: 'Rampur', admin1: 'Uttar Pradesh', country: 'India' },
        { name: 'Ahmedabad', latitude: 23.026, longitude: 72.587, admin2: 'Ahmadabad', admin1: 'Gujarat', country: 'India' },
      ],
    };
  };
  const [best] = await searchPlaces('Ahmedabad', { near: [72.9, 23.3], fetchJson });
  assert.equal(best.label, 'Ahmedabad, Ahmadabad, Gujarat, India');
});

test('Photon results come with the kind of place', async () => {
  const fetchJson = async () => ({
    features: [
      { geometry: { coordinates: [72.97, 23.6] }, properties: { name: 'Himatnagar', osm_key: 'place', osm_value: 'town', state: 'Gujarat', country: 'India' } },
      { geometry: { coordinates: [72.59, 23.01] }, properties: { name: 'Geeta Mandir', osm_key: 'amenity', osm_value: 'bus_station', city: 'Ahmedabad', state: 'Gujarat', country: 'India' } },
    ],
  });
  const places = await searchPlaces('anything', { fetchJson });
  assert.deepEqual(places.map((p) => [p.label, p.kind]), [
    ['Himatnagar, Gujarat, India', 'town'],
    ['Geeta Mandir, Ahmedabad, Gujarat, India', 'bus station'],
  ]);
});
