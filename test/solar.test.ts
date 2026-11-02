import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getPosition } from 'suncalc';
import { toDeg, toRad, wrap180 } from '../src/engine/geo.ts';
import { sunPosition } from '../src/engine/solar.ts';
import type { SunPosition } from '../src/engine/types.ts';

/** A clock time in India (IST, UTC+05:30) as ms since epoch. */
const ist = (local: string) => Date.parse(`${local}+05:30`);

/** Angle between two directions in the sky, degrees. */
function separation(a: SunPosition, b: SunPosition): number {
  const cos =
    Math.sin(toRad(a.elevation)) * Math.sin(toRad(b.elevation)) +
    Math.cos(toRad(a.elevation)) * Math.cos(toRad(b.elevation)) * Math.cos(toRad(a.azimuth - b.azimuth));
  return toDeg(Math.acos(Math.min(1, cos)));
}

/** The highest the sun gets on a given IST day, sampled every minute. */
function noonSun(date: string, lat: number, lon: number): SunPosition {
  let best = sunPosition(ist(`${date}T00:00`), lat, lon);
  for (let minute = 1; minute < 1440; minute++) {
    const p = sunPosition(ist(`${date}T00:00`) + minute * 60_000, lat, lon);
    if (p.elevation > best.elevation) best = p;
  }
  return best;
}

test('agrees with SunCalc, an independent implementation, across places and seasons', (t) => {
  const places = [[28.61, 77.21], [19.08, 72.88], [13.08, 80.27], [-33.87, 151.21], [51.51, -0.13], [64.15, -21.94], [0, 0]];
  let worst = 0;
  let checked = 0;
  for (const [lat, lon] of places) {
    for (let day = 0; day < 366; day += 5) {
      for (let minute = 0; minute < 1440; minute += 37) {
        const time = Date.UTC(2026, 0, 1 + day, 0, minute);
        const ref = getPosition(new Date(time), lat, lon);
        if (ref.altitude < 3) continue; // refraction formulas differ right at the horizon
        worst = Math.max(worst, separation(sunPosition(time, lat, lon), { azimuth: ref.azimuth, elevation: ref.altitude }));
        checked++;
      }
    }
  }
  t.diagnostic(`${checked} sun positions compared, worst difference ${worst.toFixed(4)}°`);
  assert.ok(worst < 0.05, `worst difference ${worst.toFixed(4)}°`);
});

test('Delhi on 21 December: the sun never gets above about 38°, and noon sun is due south', () => {
  const noon = noonSun('2026-12-21', 28.61, 77.21);
  assert.ok(Math.abs(noon.elevation - 38) < 0.5, `noon elevation ${noon.elevation.toFixed(2)}°`);
  assert.ok(Math.abs(noon.azimuth - 180) < 1, `noon azimuth ${noon.azimuth.toFixed(2)}°`);
});

test('Chennai on 15 May: the noon sun is slightly to the NORTH', () => {
  const noon = noonSun('2026-05-15', 13.08, 80.27);
  assert.ok(Math.abs(wrap180(noon.azimuth)) < 3, `noon azimuth ${noon.azimuth.toFixed(2)}°`);
  assert.ok(noon.elevation > 83 && noon.elevation < 86, `noon elevation ${noon.elevation.toFixed(2)}°`);
});

test('Mumbai: morning sun in the east, evening sun in the west, none at midnight', () => {
  const morning = sunPosition(ist('2026-11-05T08:00'), 19.08, 72.88);
  const evening = sunPosition(ist('2026-11-05T17:00'), 19.08, 72.88);
  assert.ok(morning.azimuth > 90 && morning.azimuth < 150, `08:00 azimuth ${morning.azimuth.toFixed(1)}°`);
  assert.ok(evening.azimuth > 210 && evening.azimuth < 270, `17:00 azimuth ${evening.azimuth.toFixed(1)}°`);
  assert.ok(sunPosition(ist('2026-11-05T00:00'), 19.08, 72.88).elevation < -40);
});
