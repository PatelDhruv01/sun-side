import assert from 'node:assert/strict';
import { test } from 'node:test';
import { overlap, resample, roadName, routeLabels, sameRoute } from '../src/engine/alternatives.ts';
import { destination, distance } from '../src/engine/geo.ts';
import { AHMEDABAD, line } from './fakes.ts';

test('resample puts a point every step along the line, ending at its last point', () => {
  const coords = line(AHMEDABAD, [[30, 10]], 1000);
  const points = resample(coords, 250);
  assert.ok(Math.abs(points.length - 41) <= 1, `${points.length} points`);
  const gaps = points.slice(1).map((p, i) => distance(points[i], p));
  assert.ok(gaps.every((gap) => Math.abs(gap - 250) < 1), 'evenly spaced');
  assert.ok(distance(points.at(-1)!, coords.at(-1)!) < 1);
});

test('overlap: a route against itself, a parallel road 3 km away, and one sharing half the way', () => {
  const north = line(AHMEDABAD, [[0, 20]]);
  assert.equal(overlap(north, north), 1);
  assert.equal(overlap(north, line(destination(AHMEDABAD, 90, 3000), [[0, 20]])), 0);
  const turnsEast = line(AHMEDABAD, [[0, 10], [90, 10]]);
  const share = overlap(turnsEast, north);
  assert.ok(share > 0.45 && share < 0.6, `share ${share.toFixed(2)}`);
  assert.ok(sameRoute(north, north));
  assert.ok(!sameRoute(north, turnsEast));
});

test('different streets out of town are the same route; a long different stretch is not', () => {
  const main = line(AHMEDABAD, [[0, 40]]);
  const otherExit = line(AHMEDABAD, [[90, 3], [0, 3], [270, 3], [0, 37]]); // leaves town on a street 3 km east
  assert.ok(sameRoute(main, otherExit));
  const coast = line(AHMEDABAD, [[0, 100], [270, 10], [0, 40], [90, 10], [0, 100]]); // 40 km on a road 10 km west
  const highway = line(AHMEDABAD, [[0, 240]]);
  assert.ok(overlap(coast, highway) > 0.75, 'mostly shared');
  assert.ok(!sameRoute(coast, highway));
});

test('route labels name the roads that set each route apart', () => {
  // the real Ahmedabad → Himatnagar routes, km per road
  const labels = routeLabels([{ NH48: 64, 'Airport Road': 10 }, { NH48: 48, NH147: 19, SH41: 11 }]);
  assert.deepEqual(labels, ['via NH48, Airport Road', 'via NH147, SH41']);
});

test('road numbers get one spelling, whichever engine named them', () => {
  assert.deepEqual(['NE-4', 'NE4', 'nh 48', 'SH-41A', 'Airport Road'].map(roadName), ['NE4', 'NE4', 'NH48', 'SH41A', 'Airport Road']);
});

test('a route that differs only on unnamed roads is labelled by its main road, or by number', () => {
  assert.deepEqual(routeLabels([{ NH48: 64 }, { NH48: 64 }]), ['via NH48', 'via NH48']);
  assert.deepEqual(routeLabels([{}]), ['route 1']);
});
