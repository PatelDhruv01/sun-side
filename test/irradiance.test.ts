import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clearSkyDni, faceIrradiance } from '../src/engine/irradiance.ts';

const DNI = 800;
const sunAt = (azimuth: number, elevation = 20) => ({ azimuth, elevation });

/** Which side window the sun comes through. */
function litSide(heading: number, sunAzimuth: number): 'left' | 'right' | 'neither' {
  const faces = faceIrradiance(sunAt(sunAzimuth), heading, DNI);
  assert.ok(faces.left < 1e-9 || faces.right < 1e-9, 'both sides lit at once');
  return faces.right > 1 ? 'right' : faces.left > 1 ? 'left' : 'neither';
}

test('hand-checkable cases: which window the sun comes through', () => {
  assert.equal(litSide(0, 90), 'right'); // heading north, sun in the east
  assert.equal(litSide(0, 270), 'left'); // heading north, sun in the west
  assert.equal(litSide(90, 180), 'right'); // heading east, sun in the south
  assert.equal(litSide(270, 180), 'left'); // heading west, sun in the south
  assert.equal(litSide(180, 90), 'left'); // heading south, sun in the east
  assert.equal(litSide(180, 270), 'right'); // heading south, sun in the west
  assert.equal(litSide(350, 80), 'right'); // wrap-around: heading just west of north, sun in the east
});

test('sun dead ahead lights only the windscreen; dead behind, only the rear window', () => {
  const ahead = faceIrradiance(sunAt(45), 45, DNI);
  assert.ok(ahead.front > 700 && ahead.rear === 0 && ahead.left < 1e-9 && ahead.right < 1e-9);
  const behind = faceIrradiance(sunAt(225), 45, DNI);
  assert.ok(behind.rear > 700 && behind.front === 0 && behind.left < 1e-9 && behind.right < 1e-9);
});

test('no sun below the horizon', () => {
  assert.deepEqual(faceIrradiance(sunAt(90, -1), 0, DNI), { left: 0, right: 0, front: 0, rear: 0, roof: 0 });
  assert.equal(clearSkyDni(-2), 0);
});

test('a side window gets the most sun when the sun is ~30° high, little when it is overhead', () => {
  const side = (elevation: number) => faceIrradiance(sunAt(90, elevation), 0, clearSkyDni(elevation)).right;
  let peak = 1;
  for (let e = 1; e < 90; e++) if (side(e) > side(peak)) peak = e;
  assert.ok(peak >= 28 && peak <= 35, `peak at ${peak}°`);
  assert.ok(side(80) < side(30) / 3);
  // the figures quoted in the planning discussion
  assert.ok(Math.abs(side(30) - 663) < 5, `30°: ${side(30).toFixed(0)}`);
  assert.ok(Math.abs(side(60) - 457) < 5, `60°: ${side(60).toFixed(0)}`);
});
