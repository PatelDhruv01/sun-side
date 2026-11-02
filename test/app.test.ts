import assert from 'node:assert/strict';
import { test } from 'node:test';
import { departureSummary, explain, routesSummary } from '../src/app/explain.ts';
import { departureShifts, planTrip } from '../src/app/plan.ts';
import { timelineRows } from '../src/app/rows.ts';
import { stretches } from '../src/app/stretches.ts';
import { decide } from '../src/engine/decide.ts';
import { simulate } from '../src/engine/simulate.ts';
import { summarise } from '../src/engine/summary.ts';
import { SLOWER_THAN_OSRM } from '../src/engine/timing.ts';
import { AHMEDABAD, ist, line, osrmRoute, road } from './fakes.ts';

const HINTS = { pin: 'pin it', pick: 'pick it' };
const clock = (time: number) => new Date(time).toISOString().slice(11, 16);
const northRoad = road(AHMEDABAD, [[0, 60]]);

test('planTrip: routes, timing and a verdict for each, carrying on without Valhalla', async () => {
  const main = line(AHMEDABAD, [[0, 60]]); // due north
  const fetchJson = async (url: string) => {
    if (url.includes('project-osrm')) return { code: 'Ok', routes: [osrmRoute(main, 60, 'NH48')] };
    throw new Error('connect timeout');
  };
  const timing = { departure: ist('2026-12-15T09:00'), vehicle: 'bus' as const };
  const { results, notes } = await planTrip([AHMEDABAD, main.at(-1)!], timing, {}, fetchJson);
  assert.equal(results.length, 1);
  assert.deepEqual(results[0].stretch, { scale: SLOWER_THAN_OSRM.bus, basis: 'typical' });
  assert.ok(Math.abs(results[0].stats.minutes - 60 * SLOWER_THAN_OSRM.bus) < 0.5);
  assert.equal(results[0].decision.sit, 'left', 'heading north in the morning puts the sun on the right');
  assert.match(notes[0], /Valhalla/);
  assert.equal(departureShifts(results[0], timing).length, 3);
});

test('explain: the headline for a side, and for a trip after dark', () => {
  const morning = simulate(northRoad, { departure: ist('2026-12-15T09:00') }).bins;
  assert.equal(explain(decide(morning), summarise(morning), clock).headline, 'Sit on the LEFT side.');
  const night = simulate(northRoad, { departure: ist('2026-12-15T21:00') }).bins;
  assert.equal(explain(decide(night), summarise(night), clock).headline, 'Either side: the whole trip is after dark.');
});

test('the route and departure summaries in words', () => {
  assert.equal(routesSummary(['left'], false, HINTS), 'Only one route found. If your bus goes another way, pin it.');
  assert.equal(routesSummary(['left'], true, HINTS), 'Route pinned through your via towns.');
  assert.equal(routesSummary(['left', 'right'], false, HINTS), 'The routes DISAGREE: pick it, or pin it.');
  assert.equal(
    departureSummary('left', [{ shift: -30, sit: 'left' }, { shift: 60, sit: 'left' }]),
    'Leaving 30 min early or 1 h late gives the same answer.',
  );
  assert.equal(departureSummary('either', [{ shift: 30, sit: 'right' }]), 'This departure is near the changeover: leaving 30 min late means sit RIGHT.');
});

test('stretches follow the sunny side, and rows cover the whole trip', () => {
  const night = simulate(northRoad, { departure: ist('2026-12-15T21:00') });
  const dark = stretches(northRoad, night.passes);
  assert.equal(dark.length, 1);
  assert.equal(dark[0].category, 'night');
  assert.equal(dark[0].coords.length, northRoad.coords.length);
  const morning = simulate(northRoad, { departure: ist('2026-12-15T09:00') });
  assert.ok(stretches(northRoad, morning.passes).every((s) => s.category === 'sun on right'));
  const rows = timelineRows(morning.bins, 10);
  assert.equal(rows.length, Math.ceil(morning.bins.length / 10));
  assert.equal(rows[0].start, morning.bins[0].start);
});
