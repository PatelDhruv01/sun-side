import assert from 'node:assert/strict';
import { test } from 'node:test';
import { agreement, shiftedVerdicts } from '../src/engine/evaluate.ts';
import { SLOWER_THAN_OSRM, timeScale } from '../src/engine/timing.ts';
import { ist, MUMBAI, road } from './fakes.ts';

test('timing: a ticket beats a hand-picked stretch, which beats the typical one', () => {
  const departure = ist('2026-12-15T09:00');
  const twoHoursLater = departure + 2 * 3_600_000;
  assert.deepEqual(timeScale(3600, { departure, vehicle: 'bus', arrival: twoHoursLater, scale: 3 }), { scale: 2, basis: 'ticket' });
  assert.deepEqual(timeScale(3600, { departure, vehicle: 'bus', scale: 3 }), { scale: 3, basis: 'given' });
  assert.deepEqual(timeScale(3600, { departure, vehicle: 'car' }), { scale: SLOWER_THAN_OSRM.car, basis: 'typical' });
  assert.ok(SLOWER_THAN_OSRM.bus > SLOWER_THAN_OSRM.car);
});

test('agreement between the verdicts for several routes', () => {
  assert.equal(agreement(['left', 'left']), 'agree');
  assert.equal(agreement(['left', 'either']), 'mostly');
  assert.equal(agreement(['left', 'right', 'left']), 'conflict');
});

test('the answer can flip if the bus leaves earlier or later', () => {
  // three hours due north: in the morning the sun is on the right, in the afternoon on the left
  const route = road(MUMBAI, [[0, 180]]);
  const shifts = shiftedVerdicts(route, ist('2026-11-05T11:00'), 1, {}, [-120, 120]);
  assert.deepEqual(shifts, [
    { shift: -120, sit: 'left' },
    { shift: 120, sit: 'right' },
  ]);
});
