import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decide, FULL_SUN, heatScore } from '../src/engine/decide.ts';
import { summarise } from '../src/engine/summary.ts';
import type { LonLat, TimelineBin } from '../src/engine/types.ts';

const T0 = Date.parse('2026-12-15T09:00+05:30');
const SUN = FULL_SUN; // strong side sun, W/m²

/** Per-minute W/m² built from [watts, minutes] runs. */
const runs = (...parts: [watts: number, minutes: number][]) =>
  parts.flatMap(([watts, minutes]) => Array<number>(minutes).fill(watts));

/** Sun in bursts: `on` minutes of sun, then `off` minutes of shade, until `total` sunny minutes. */
function bursts(on: number, off: number, total: number): number[] {
  const out: number[] = [];
  for (let done = 0; done < total; ) {
    const n = Math.min(on, total - done);
    out.push(...runs([SUN, n]));
    done += n;
    if (done < total) out.push(...runs([0, off]));
  }
  return out;
}

/** One-minute bins from per-minute W/m² on each window; shorter series are padded with shade. */
function trip(sun: { left?: number[]; right?: number[]; front?: number[]; elevation?: number[] }): TimelineBin[] {
  const n = Math.max(sun.left?.length ?? 0, sun.right?.length ?? 0, sun.front?.length ?? 0);
  return Array.from({ length: n }, (_, i) => ({
    start: T0 + i * 60_000,
    seconds: 60,
    distance: i * 1000,
    position: [72.6, 23.0] as LonLat,
    heading: 0,
    sun: { azimuth: 180, elevation: sun.elevation?.[i] ?? 30 },
    faces: { left: sun.left?.[i] ?? 0, right: sun.right?.[i] ?? 0, front: sun.front?.[i] ?? 0, rear: 0, roof: 0 },
  }));
}

// Your scenario: side A gets 60 minutes of unbroken sun, side B gets its sun in 10-minute bursts.
const unbroken60 = runs([0, 20], [SUN, 60]);

test('a bit more sun in short bursts beats one long unbroken stretch', () => {
  const bins = trip({ left: unbroken60, right: bursts(10, 10, 80) });
  assert.equal(decide(bins).sit, 'right');
  const { sides } = summarise(bins);
  assert.ok(sides.right.energy > sides.left.energy, 'the right really does get more sun in total');
});

test('but when the broken side gets far more sun, take the unbroken stretch', () => {
  assert.equal(decide(trip({ left: unbroken60, right: bursts(10, 10, 120) })).sit, 'left');
});

test('with continuity 1 only the total counts, so the side with less sun wins', () => {
  assert.equal(decide(trip({ left: unbroken60, right: bursts(10, 10, 80) }), { continuity: 1 }).sit, 'left');
});

test('the same sun on both sides: either, said honestly', () => {
  const d = decide(trip({ left: runs([SUN, 40], [0, 80]), right: runs([0, 80], [SUN, 40]) }));
  assert.equal(d.sit, 'either');
  assert.equal(d.confidence, 'balanced');
});

test('even sides, but one gets the sun low in your eyes: lean to the other', () => {
  const elevation = runs([8, 40], [40, 80]); // low morning sun, then high
  const d = decide(trip({ left: runs([SUN, 40], [0, 80]), right: runs([0, 80], [SUN, 40]), elevation }));
  assert.equal(d.sit, 'either');
  assert.equal(d.lessGlare, 'right');
});

test('hardly any sun: either, with no seat change and no rows tip', () => {
  const d = decide(trip({ left: runs([300, 5]), right: runs([0, 5], [200, 5]) }));
  assert.equal(d.sit, 'either');
  assert.equal(d.confidence, 'little sun');
  assert.equal(d.switchSeats, undefined);
  assert.equal(d.avoidRows, undefined);
});

test('all the sun on one side: sit on the other, clearly, with no pointless seat change', () => {
  const d = decide(trip({ right: runs([0, 10], [SUN, 60], [0, 10]) }));
  assert.equal(d.sit, 'left');
  assert.equal(d.confidence, 'clear');
  assert.equal(d.margin, 1);
  assert.equal(d.switchSeats, undefined);
});

test('a big ratio between tiny amounts of sun is only a slight preference', () => {
  const d = decide(trip({ left: runs([SUN, 18]) })); // 18 minutes of sun against none
  assert.equal(d.sit, 'right');
  assert.equal(d.confidence, 'slight');
});

test('morning sun on one side, afternoon sun on the other: change seats at the turn', () => {
  const d = decide(trip({ left: runs([SUN, 120], [0, 120]), right: runs([0, 120], [SUN, 120]) }));
  const change = d.switchSeats;
  assert.ok(change, 'expected a seat change');
  assert.equal(change.from, 'right');
  assert.equal(change.to, 'left');
  assert.equal((change.at - T0) / 60_000, 120);
  assert.ok(change.saving > 0.9, `saving ${change.saving}`);
});

test('lots of windscreen sun: avoid the front rows', () => {
  assert.equal(decide(trip({ front: runs([SUN, 90]), left: runs([200, 30]) })).avoidRows, 'front');
});

test('heat bucket: continuity 1 gives the total full-sun minutes, and bin size does not matter', () => {
  const ones = (n: number) => Array<number>(n).fill(1);
  assert.ok(Math.abs(heatScore(ones(60), ones(60), { continuity: 1 }) - 60) < 0.5);
  const minuteBins = heatScore(ones(60), ones(60));
  const quarterBins = heatScore(ones(240), Array<number>(240).fill(0.25));
  assert.ok(Math.abs(minuteBins - quarterBins) / quarterBins < 0.02, `${minuteBins.toFixed(2)} vs ${quarterBins.toFixed(2)}`);
});
