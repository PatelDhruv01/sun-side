// Step 1 test bench: simulate one trip and print the sun on each side of the vehicle.
//   npm run trip -- --from "Mumbai" --to "Pune" --depart "2026-11-05 07:00"
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { compass, toDeg, toRad, wrap360 } from '../engine/geo.ts';
import { simulate } from '../engine/simulate.ts';
import { SUN_THRESHOLD, summarise, type TripStats } from '../engine/summary.ts';
import type { Faces, LonLat, SegmentPass, Side, TimelineBin } from '../engine/types.ts';
import { geocode, type Place } from '../services/geocode.ts';
import type { FetchJson } from '../services/http.ts';
import { fetchRoutes, type RoutedTrip } from '../services/osrm.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const USER_AGENT = 'sun-side/0.1 (personal prototype)';

const USAGE = `Usage: npm run trip -- --from <place> --to <place> --depart <time> [options]

  --from, --to   a place name ("Swargate, Pune") or "lat,lon" as Google Maps shows it
  --depart       "YYYY-MM-DD HH:MM", "HH:MM" (today) or "now"
  --arrive       arrival time from your ticket; stretches the timeline to fit
  --scale        or stretch it by hand: 1.3 = 30% slower than a car
  --tz           UTC offset of the times you type (default +05:30, IST)
  --every        minutes per row of the printed timeline (default 10)
  --refresh      ignore cached route and place lookups`;

interface Clock {
  offset: number; // minutes east of UTC
  departure: number;
}

async function main() {
  const { values } = parseArgs({
    options: {
      from: { type: 'string' },
      to: { type: 'string' },
      depart: { type: 'string' },
      arrive: { type: 'string' },
      scale: { type: 'string' },
      tz: { type: 'string', default: '+05:30' },
      every: { type: 'string', default: '10' },
      refresh: { type: 'boolean', default: false },
    },
  });
  if (!values.from || !values.to || !values.depart) {
    console.log(USAGE);
    process.exitCode = 1;
    return;
  }

  const offset = parseOffset(values.tz);
  const fetchJson = cachedFetch(values.refresh);
  const from = await resolvePlace(values.from, fetchJson);
  const to = await resolvePlace(values.to, fetchJson);
  const [route] = await fetchRoutes([from.position, to.position], { fetchJson });

  const departure = parseTime(values.depart, offset);
  const carSeconds = route.segmentDurations.reduce((a, b) => a + b, 0);
  let timeScale = values.scale ? Number(values.scale) : 1;
  if (values.arrive) timeScale = (parseTime(values.arrive, offset, departure) - departure) / 1000 / carSeconds;
  if (!(timeScale > 0)) throw new Error('The time scale must be a positive number.');

  const { passes, bins } = simulate(route, { departure, timeScale });
  const stats = summarise(bins);
  const clock: Clock = { offset, departure };

  printHeader(from, to, route, carSeconds, timeScale, Boolean(values.arrive), stats, clock);
  printSides(stats, clock);
  printTimeline(bins, Math.max(1, Number(values.every) || 10), clock);
  const files = await writeOutputs(from, to, route, passes, bins, clock);
  console.log(`\nFull 1-minute data: ${files[0]}`);
  console.log(`Map: ${files[1]}  (drop it on https://geojson.io to see the route coloured by sunny side)`);
  console.log('Map data © OpenStreetMap contributors (ODbL) · routing: OSRM · place search: Photon');
}

// ---------- input ----------

/** Fetches JSON once and keeps it in cache/, so re-runs are instant and the free servers aren't hit again. */
function cachedFetch(refresh: boolean): FetchJson {
  let lastRequest = 0;
  return async (url) => {
    const file = path.join(ROOT, 'cache', `${createHash('sha1').update(url).digest('hex')}.json`);
    if (!refresh) {
      try {
        return JSON.parse(await readFile(file, 'utf8'));
      } catch {
        // not cached yet
      }
    }
    const wait = lastRequest + 1100 - Date.now(); // fair use: at most about one request a second
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastRequest = Date.now();
    const get = () => fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    const res = await get().catch(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2000)); // one retry for a flaky connection
      return get();
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} from ${new URL(url).host}`);
    const body = await res.json();
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(body));
    return body;
  };
}

const LAT_LON = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/;

async function resolvePlace(input: string, fetchJson: FetchJson): Promise<Place> {
  const match = LAT_LON.exec(input);
  if (match) return { label: `${match[1]}, ${match[2]}`, position: [Number(match[2]), Number(match[1])] };
  return geocode(input, fetchJson);
}

function parseOffset(tz: string): number {
  const match = /^([+-])(\d{1,2}):?(\d{2})$/.exec(tz);
  if (!match) throw new Error(`Can't read --tz "${tz}"; expected something like +05:30.`);
  return (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3]));
}

/** Reads a local time. With `after`, a bare "HH:MM" earlier than it means the next day (overnight trips). */
function parseTime(input: string, offset: number, after?: number): number {
  if (input === 'now') return Date.now();
  const offsetMs = offset * 60_000;
  const full = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})$/.exec(input);
  if (full) {
    const [, y, mo, d, h, mi] = full.map(Number);
    return Date.UTC(y, mo - 1, d, h, mi) - offsetMs;
  }
  const time = /^(\d{1,2}):(\d{2})$/.exec(input);
  if (time) {
    const day = new Date((after ?? Date.now()) + offsetMs); // that local calendar day
    let t = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), Number(time[1]), Number(time[2])) - offsetMs;
    if (after !== undefined && t <= after) t += 86_400_000;
    return t;
  }
  throw new Error(`Can't read the time "${input}". Use "YYYY-MM-DD HH:MM", "HH:MM" or "now".`);
}

// ---------- printing ----------

const SIDES: Side[] = ['left', 'right', 'front', 'rear'];
const BAR_FULL = 700; // W/m² for a full bar; the clear-sky side-window peak is about 660

function printHeader(from: Place, to: Place, route: RoutedTrip, carSeconds: number, timeScale: number,
  fromArrival: boolean, stats: TripStats, clock: Clock) {
  const end = clock.departure + stats.minutes * 60_000;
  const timing =
    timeScale === 1 ? 'car time' : `${timeScale.toFixed(2)}× car time${fromArrival ? ' (fitted to your arrival time)' : ''}`;
  console.log(`From  ${from.label}`);
  console.log(`To    ${to.label}`);
  console.log(`Road  ${(route.distance / 1000).toFixed(0)} km, ${hm(carSeconds / 60)} by car; timeline uses ${timing}`);
  console.log(`When  ${dayName(clock.departure, clock.offset)}, ${hhmm(clock.departure, clock)} → ${hhmm(end, clock)} ${zone(clock.offset)}` +
    `: ${hm(stats.minutes)} on the road, ${hm(stats.daylightMinutes)} of it in daylight`);
}

function printSides(stats: TripStats, clock: Clock) {
  console.log(`\nDirect sun on each side (clear sky; "sun" = at least ${SUN_THRESHOLD} W/m² on that window)`);
  console.log('          sun time   longest unbroken      energy per m² of window');
  for (const side of SIDES) {
    const s = stats.sides[side];
    const stretch = s.longestStart === undefined ? '-' : `${hm(s.longestMinutes)} from ${hhmm(s.longestStart, clock)}`;
    const label = side[0].toUpperCase() + side.slice(1);
    console.log(`  ${label.padEnd(6)}  ${hm(s.sunMinutes).padStart(7)}    ${stretch.padEnd(20)}  ${(s.energy / 1000).toFixed(2)} kWh`);
  }
  console.log(`\n${rawComparison(stats)}`);
}

function rawComparison({ sides: { left, right } }: TripStats): string {
  const leftMore = left.energy >= right.energy;
  const [more, less] = leftMore ? [left, right] : [right, left];
  if (more.energy < 50) return 'Raw comparison: hardly any direct sun on either side.';
  const share =
    less.energy < 1
      ? 'all of the side sun'
      : more.energy > 10 * less.energy
        ? 'almost all of the side sun'
        : `${(more.energy / less.energy).toFixed(1)}× the sun energy of the ${leftMore ? 'right' : 'left'}`;
  return `Raw comparison: the ${leftMore ? 'LEFT' : 'RIGHT'} side gets ${share}.\n(Raw totals only; the real decision rules come in Step 2.)`;
}

function printTimeline(bins: TimelineBin[], every: number, clock: Clock) {
  console.log(`\nTimeline, ${every} min per row (bars = direct sun on that window; a full bar is ${BAR_FULL} W/m²)`);
  console.log(' Time      km   Road        Sun (direction / height)   Left window       Right window      Front / rear');
  for (let i = 0; i < bins.length; i += every) {
    const group = bins.slice(i, i + every);
    const { heading, faces } = average(group);
    const sun = group[Math.floor(group.length / 2)].sun;
    const sky = sun.elevation > 0 ? `${compass(sun.azimuth).padEnd(3)} ${num(sun.azimuth, 3)}° / ${num(sun.elevation, 2)}° high` : 'below the horizon';
    console.log(
      ` ${hhmm(group[0].start, clock).padEnd(8)} ${num(group[0].distance / 1000, 4)}   ${compass(heading).padEnd(3)} ${num(heading, 3)}°    ` +
        `${sky.padEnd(25)}  ${bar(faces.left)}  ${bar(faces.right)}  ${ends(faces)}`,
    );
  }
}

/** Time-weighted average of several bins (heading averaged as a vector). */
function average(group: TimelineBin[]): { heading: number; faces: Faces } {
  const faces: Faces = { left: 0, right: 0, front: 0, rear: 0, roof: 0 };
  const keys = Object.keys(faces) as (keyof Faces)[];
  let seconds = 0;
  let x = 0;
  let y = 0;
  for (const bin of group) {
    seconds += bin.seconds;
    x += Math.sin(toRad(bin.heading)) * bin.seconds;
    y += Math.cos(toRad(bin.heading)) * bin.seconds;
    for (const key of keys) faces[key] += bin.faces[key] * bin.seconds;
  }
  for (const key of keys) faces[key] /= seconds || 1;
  return { heading: wrap360(toDeg(Math.atan2(x, y))), faces };
}

function bar(value: number): string {
  if (value < 1) return '·'.padEnd(14);
  const blocks = '█'.repeat(Math.min(10, Math.round((value / BAR_FULL) * 10))) || '▏';
  return `${blocks.padEnd(10)} ${num(value, 3)}`;
}

function ends({ front, rear }: Faces): string {
  if (Math.max(front, rear) < 1) return '';
  return front >= rear ? `front ${num(front, 3)}` : `rear  ${num(rear, 3)}`;
}

const num = (value: number, width: number) => String(Math.round(value)).padStart(width);

function hm(minutes: number): string {
  const m = Math.round(minutes);
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

/** Local "HH:MM", with "+1" once the trip has run past midnight. */
function hhmm(time: number, { offset, departure }: Clock): string {
  const local = time + offset * 60_000;
  const days = Math.floor(local / 86_400_000) - Math.floor((departure + offset * 60_000) / 86_400_000);
  return new Date(local).toISOString().slice(11, 16) + (days > 0 ? ` +${days}` : '');
}

function dayName(time: number, offset: number): string {
  const d = new Date(time + offset * 60_000);
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()];
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()];
  return `${weekday} ${d.getUTCDate()} ${month} ${d.getUTCFullYear()}`;
}

function zone(offset: number): string {
  if (offset === 330) return 'IST';
  const abs = Math.abs(offset);
  return `UTC${offset < 0 ? '-' : '+'}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

// ---------- files ----------

async function writeOutputs(from: Place, to: Place, route: RoutedTrip, passes: SegmentPass[], bins: TimelineBin[],
  clock: Clock): Promise<string[]> {
  const stamp = new Date(clock.departure + clock.offset * 60_000).toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
  const name = `${slug(from.label)}-to-${slug(to.label)}-${stamp}`;
  const dir = path.join(ROOT, 'out');
  await mkdir(dir, { recursive: true });
  const csvFile = path.join(dir, `${name}.csv`);
  const mapFile = path.join(dir, `${name}.geojson`);
  await writeFile(csvFile, toCsv(bins, clock));
  await writeFile(mapFile, JSON.stringify(toGeoJson(from, to, route, passes, clock)));
  return [csvFile, mapFile].map((file) => path.relative(ROOT, file).replaceAll('\\', '/'));
}

const slug = (label: string) =>
  label.split(',')[0].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'place';

function toCsv(bins: TimelineBin[], clock: Clock): string {
  const header = 'local_time,minute,km,lat,lon,heading,sun_azimuth,sun_elevation,left,right,front,rear,roof';
  const rows = bins.map((b, i) =>
    [
      new Date(b.start + clock.offset * 60_000).toISOString().slice(0, 16).replace('T', ' '),
      i,
      (b.distance / 1000).toFixed(2),
      b.position[1].toFixed(5),
      b.position[0].toFixed(5),
      b.heading.toFixed(0),
      b.sun.azimuth.toFixed(1),
      b.sun.elevation.toFixed(1),
      ...(['left', 'right', 'front', 'rear', 'roof'] as const).map((face) => b.faces[face].toFixed(0)),
    ].join(','),
  );
  return `${[header, ...rows].join('\n')}\n`;
}

// Colours use the simplestyle-spec properties that geojson.io understands.
const COLOURS = {
  'sun on left': '#e8590c',
  'sun on right': '#1971c2',
  'sun ahead or behind': '#f2c200',
  'weak sun': '#adb5bd',
  night: '#343a40',
} as const;
type Category = keyof typeof COLOURS;

function category({ sun, faces }: SegmentPass): Category {
  if (sun.elevation <= 0) return 'night';
  if (Math.max(faces.left, faces.right) >= SUN_THRESHOLD) return faces.left > faces.right ? 'sun on left' : 'sun on right';
  if (Math.max(faces.front, faces.rear) >= SUN_THRESHOLD) return 'sun ahead or behind';
  return 'weak sun';
}

/** The route as coloured stretches (one per change of sunny side) plus start and end markers. */
function toGeoJson(from: Place, to: Place, route: RoutedTrip, passes: SegmentPass[], clock: Clock) {
  const stretches: { category: Category; coords: LonLat[]; from: number; to: number }[] = [];
  for (const pass of passes) {
    const cat = category(pass);
    let stretch = stretches.at(-1);
    if (!stretch || stretch.category !== cat) {
      stretch = { category: cat, coords: [route.coords[pass.index]], from: pass.start, to: pass.start };
      stretches.push(stretch);
    }
    stretch.coords.push(route.coords[pass.index + 1]);
    stretch.to = pass.start + pass.seconds * 1000;
  }
  const marker = (place: Place, role: string, colour: string) => ({
    type: 'Feature',
    properties: { name: place.label, role, 'marker-color': colour },
    geometry: { type: 'Point', coordinates: place.position },
  });
  return {
    type: 'FeatureCollection',
    features: [
      ...stretches.map((s) => ({
        type: 'Feature',
        properties: { category: s.category, from: hhmm(s.from, clock), to: hhmm(s.to, clock), stroke: COLOURS[s.category], 'stroke-width': 5 },
        geometry: { type: 'LineString', coordinates: s.coords },
      })),
      marker(from, 'start', '#2f9e44'),
      marker(to, 'end', '#c92a2a'),
    ],
  };
}

main().catch((err: unknown) => {
  const cause = err instanceof Error && err.cause instanceof Error ? ` (${err.cause.message})` : '';
  console.error(err instanceof Error ? `${err.message}${cause}` : err);
  process.exitCode = 1;
});
