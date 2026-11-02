import assert from 'node:assert/strict';
import { test } from 'node:test';
import { simulate } from '../src/engine/simulate.ts';
import { summarise } from '../src/engine/summary.ts';
import type { Route } from '../src/engine/types.ts';
import { ist, MUMBAI, road } from './fakes.ts';

const trip = (route: Route, depart: string, timeScale?: number) => simulate(route, { departure: ist(depart), timeScale });

test('due north at 8 AM: the morning sun is on the right, never the left', () => {
  const { sides } = summarise(trip(road(MUMBAI, [[0, 120]]), '2026-11-05T08:00').bins);
  assert.ok(sides.right.sunMinutes >= 115, `right: ${sides.right.sunMinutes} min`);
  assert.equal(sides.left.energy, 0);
});

test('due south at 8 AM: the same sun is now on the left', () => {
  const { sides } = summarise(trip(road(MUMBAI, [[180, 120]]), '2026-11-05T08:00').bins);
  assert.ok(sides.left.sunMinutes >= 115, `left: ${sides.left.sunMinutes} min`);
  assert.equal(sides.right.energy, 0);
});

test('due north at 4 PM: the afternoon sun is on the left', () => {
  const { sides } = summarise(trip(road(MUMBAI, [[0, 120]]), '2026-11-05T16:00').bins);
  assert.ok(sides.left.sunMinutes >= 90, `left: ${sides.left.sunMinutes} min`);
  assert.equal(sides.right.energy, 0);
});

test('a night trip gets no sun at all', () => {
  const { sides, daylightMinutes } = summarise(trip(road(MUMBAI, [[0, 120]]), '2026-11-05T21:00').bins);
  assert.equal(daylightMinutes, 0);
  for (const side of Object.values(sides)) assert.equal(side.energy, 0);
});

test('a zig-zag road shares the sun between both sides', () => {
  const legs = Array.from({ length: 60 }, (_, i): [number, number] => [i % 2 ? 180 : 0, 1]);
  const { sides } = summarise(trip(road(MUMBAI, legs), '2026-11-05T08:00').bins);
  const ratio = sides.left.energy / sides.right.energy;
  assert.ok(ratio > 0.9 && ratio < 1.1, `left/right energy ${ratio.toFixed(2)}`);
});

test('the timeline covers the whole trip, stretched by timeScale', () => {
  const { bins } = trip(road(MUMBAI, [[45, 100]]), '2026-11-05T08:00', 1.5);
  const minutes = bins.reduce((m, b) => m + b.seconds / 60, 0);
  assert.ok(Math.abs(minutes - 150) < 0.01, `${minutes} min`);
  assert.ok(bins.every((b) => Math.abs(b.heading - 45) < 1));
  assert.ok(Math.abs(bins.at(-1)!.distance - 100_000) < 1000);
});

test('segments that straddle minute edges are split without losing time', () => {
  // 37-second segments never line up with the 60-second bins
  const route: Route = { ...road(MUMBAI, [[90, 30]]), segmentDurations: Array(120).fill(37) };
  const { bins } = simulate(route, { departure: ist('2026-11-05T09:00') });
  const seconds = bins.reduce((s, b) => s + b.seconds, 0);
  assert.ok(Math.abs(seconds - 120 * 37) < 1e-6, `${seconds} s`);
  assert.equal(bins.length, Math.ceil((120 * 37) / 60));
});
