import assert from 'node:assert/strict';
import { test } from 'node:test';
import { weatherSentence } from '../src/app/explain.ts';
import { decide } from '../src/engine/decide.ts';
import { clearSkyDni } from '../src/engine/irradiance.ts';
import { simulate } from '../src/engine/simulate.ts';
import { sunPosition } from '../src/engine/solar.ts';
import { bands, sweep } from '../src/engine/sweep.ts';
import { cellKey, forecastDni, tripWeather } from '../src/engine/weather.ts';
import { fetchWeather } from '../src/services/weather.ts';
import { AHMEDABAD, forecast, ist, road } from './fakes.ts';

const northRoad = road(AHMEDABAD, [[0, 60]]); // an hour due north
const day = ist('2026-12-15T00:00') - (ist('2026-12-15T00:00') % 3_600_000); // on the UTC hour
const hourOf = (time: number) => new Date(time + 5.5 * 3_600_000).getUTCHours(); // hour of the day in IST

test('a clear forecast leaves the clear-sky sun as it is', () => {
  const dni = forecastDni(forecast(northRoad.coords, day, 48));
  for (const local of ['08:00', '09:40', '12:15', '16:50']) {
    const time = ist(`2026-12-15T${local}`);
    const sun = sunPosition(time, AHMEDABAD[1], AHMEDABAD[0]);
    assert.ok(Math.abs(dni(time, AHMEDABAD, sun) - clearSkyDni(sun.elevation)) < 1e-6, local);
  }
});

test('an overcast morning dims the sun then, and only then', () => {
  const sky = (time: number) => (hourOf(time) >= 8 && hourOf(time) <= 12 ? 0 : 1);
  const dni = forecastDni(forecast(northRoad.coords, day, 48, sky));
  const at = (local: string) => {
    const time = ist(`2026-12-15T${local}`);
    return dni(time, AHMEDABAD, sunPosition(time, AHMEDABAD[1], AHMEDABAD[0]));
  };
  assert.equal(at('10:00'), 0);
  assert.ok(at('15:00') > 500, `afternoon ${at('15:00')}`);
});

test('a cloudy morning changes the verdict: no sun left to avoid', () => {
  const departure = ist('2026-12-15T09:00');
  const clear = decide(simulate(northRoad, { departure }).bins);
  assert.equal(clear.sit, 'left');
  const overcast = forecast(northRoad.coords, day, 48, (t) => (hourOf(t) >= 8 && hourOf(t) <= 12 ? 0 : 1));
  const { bins } = simulate(northRoad, { departure, dni: forecastDni(overcast) });
  const cloudy = decide(bins);
  assert.equal(cloudy.sit, 'either');
  assert.equal(cloudy.confidence, 'little sun');
  const summary = tripWeather(overcast, bins)!;
  assert.equal(Math.round(summary.cloud), 100);
  assert.match(weatherSentence(summary), /mostly cloudy/);
});

test('the day sweep sees the cloud too', () => {
  const overcast = forecast(northRoad.coords, day, 72, (t) => (hourOf(t) >= 8 && hourOf(t) <= 12 ? 0 : 1));
  const verdicts = sweep(northRoad, { first: ist('2026-12-15T06:00'), last: ist('2026-12-15T17:00'), timeScale: 1, dni: forecastDni(overcast) });
  const runs = bands(verdicts);
  const at = (local: string) => runs.find((b) => b.from <= ist(`2026-12-15T${local}`) && ist(`2026-12-15T${local}`) <= b.to)!;
  assert.equal(at('09:30').sit, 'either');
  assert.equal(at('15:30').sit, 'right');
});

test('fetchWeather asks for each square once, however many routes cross it, and reads hours as UTC', async () => {
  const far = road([AHMEDABAD[0], AHMEDABAD[1] + 1.2], [[0, 10]]).coords; // a route further north
  const hourly = (dni: (number | null)[]) => ({
    time: ['2026-12-15T00:00', '2026-12-15T01:00', '2026-12-15T02:00'],
    direct_normal_irradiance_instant: dni,
    cloud_cover: [10, null, 30],
    temperature_2m: [20, 21, 22],
  });
  const asked: URLSearchParams[] = [];
  // Answers with one point per place asked for; the first gets a gap to fill.
  const fetchJson = async (url: string) => {
    const params = new URL(url).searchParams;
    asked.push(params);
    const count = params.get('latitude')!.split(',').length;
    return Array.from({ length: count }, (_, i) => ({ hourly: hourly(i === 0 ? [0, 100, null] : [5, 6, 7]) }));
  };
  const points = (i: number) => asked[i].get('latitude')!.split(',').length;
  const weather = await fetchWeather([northRoad.coords], day, day + 3_600_000, fetchJson);
  await fetchWeather([northRoad.coords, northRoad.coords], day, day + 3_600_000, fetchJson);
  await fetchWeather([northRoad.coords, far], day, day + 3_600_000, fetchJson);
  assert.equal(points(1), points(0), 'the same route twice adds no points');
  assert.ok(points(2) > points(0), 'another route adds its squares');
  assert.equal(asked[0].get('timezone'), 'GMT');
  assert.match(asked[0].get('hourly')!, /direct_normal_irradiance_instant/);
  assert.equal(weather.times[1], Date.UTC(2026, 11, 15, 1));
  const home = weather.cells.get(cellKey(AHMEDABAD))!;
  assert.deepEqual(home.dni, [0, 100, 100], 'a gap takes the value before it');
  assert.deepEqual(home.cloud, [10, 10, 30]);
});

test('one forecast point comes back as a plain object, not a list', async () => {
  const hourly = { time: ['2026-12-15T00:00'], direct_normal_irradiance_instant: [0], cloud_cover: [0], temperature_2m: [18] };
  const weather = await fetchWeather([[AHMEDABAD]], day, day, async () => ({ hourly }));
  assert.equal(weather.cells.size, 1);
});
