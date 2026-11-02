// Test bench for the engine: find the routes for a trip, then say where to sit and why.
//   npm run trip -- --from "Ahmedabad" --to "Himatnagar" --depart "2026-12-15 09:00"
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { otherSide, type Decision, type ScoringOptions, type SeatSide } from '../engine/decide.ts';
import { agreement, evaluate, shiftedVerdicts, type Evaluation, type Shifted } from '../engine/evaluate.ts';
import { compass, distance, lerp, toDeg, toRad, wrap360 } from '../engine/geo.ts';
import { SUN_THRESHOLD, type TripStats } from '../engine/summary.ts';
import { timeScale, type TimeScale, type Vehicle } from '../engine/timing.ts';
import type { Faces, LonLat, SegmentPass, Side, TimelineBin } from '../engine/types.ts';
import { searchPlaces, type Place } from '../services/geocode.ts';
import type { FetchJson } from '../services/http.ts';
import { findRoutes, type CandidateRoute } from '../services/routing.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const USER_AGENT = 'sun-side/0.1 (personal prototype)';

const USAGE = `Usage: npm run trip -- --from <place> --to <place> --depart <time> [options]

  --from, --to   a place name ("Swargate, Pune") or "lat,lon" as Google Maps shows it
  --via          a town the bus goes through, to pin the route (repeat for more)
  --depart       "YYYY-MM-DD HH:MM", "HH:MM" (today) or "now"
  --arrive       arrival time from your ticket; stretches the timeline to fit
  --vehicle      bus (default) or car: sets a typical trip time when --arrive isn't given
  --scale        or stretch by hand: 1.3 = 30% slower than the free-flowing car time
  --route        which of the routes found to show in detail (default 1, the quickest)
  --tz           UTC offset of the times you type (default +05:30, IST)
  --every        minutes per row of the printed timeline (default 10)
  --continuity   how much long unbroken sun matters: 1 = only the total, 2 = default, 3 = a lot
  --cool-down    minutes to cool off once out of the sun (default 15)
  --refresh      ignore cached lookups`;

interface Clock {
  offset: number; // minutes east of UTC
  departure: number;
}

/** A place someone typed, plus far-away matches worth a mention in case the wrong one was picked. */
interface Found {
  place: Place;
  others: Place[];
}

/** One candidate route, simulated and decided. */
interface Result extends Evaluation {
  route: CandidateRoute;
  stretch: TimeScale;
}

async function main() {
  const { values } = parseArgs({
    options: {
      from: { type: 'string' },
      to: { type: 'string' },
      via: { type: 'string', multiple: true },
      depart: { type: 'string' },
      arrive: { type: 'string' },
      vehicle: { type: 'string', default: 'bus' },
      scale: { type: 'string' },
      route: { type: 'string', default: '1' },
      tz: { type: 'string', default: '+05:30' },
      every: { type: 'string', default: '10' },
      continuity: { type: 'string', default: '2' },
      'cool-down': { type: 'string', default: '15' },
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
  const from = await findPlace(values.from, fetchJson);
  const to = await findPlace(values.to, fetchJson);
  const middle = lerp(from.place.position, to.place.position, 0.5);
  const vias: Found[] = [];
  for (const via of values.via ?? []) vias.push(await findPlace(via, fetchJson, middle));
  const { routes, notes } = await findRoutes([from, ...vias, to].map((f) => f.place.position), fetchJson);

  const pick = Number(values.route) - 1;
  if (!Number.isInteger(pick) || pick < 0 || pick >= routes.length) {
    throw new Error(`--route must be a number from 1 to ${routes.length}.`);
  }
  const departure = parseTime(values.depart, offset);
  const timing = {
    departure,
    vehicle: parseVehicle(values.vehicle),
    arrival: values.arrive ? parseTime(values.arrive, offset, departure) : undefined,
    scale: values.scale ? Number(values.scale) : undefined,
  };
  if (timing.scale !== undefined && !(timing.scale > 0)) throw new Error('--scale must be a positive number.');
  const scoring = readScoring(values.continuity, values['cool-down']);
  const results: Result[] = routes.map((route) => {
    const stretch = timeScale(total(route.segmentDurations), timing);
    return { route, stretch, ...evaluate(route, departure, stretch.scale, scoring) };
  });
  const chosen = results[pick];
  const clock: Clock = { offset, departure };

  printPlaces(from, vias, to);
  printTrip(chosen, pick, results.length, timing.vehicle, clock);
  printVerdict(chosen.decision, chosen.stats, clock);
  printChecks(results, pick, shiftedVerdicts(chosen.route, departure, chosen.stretch.scale, scoring), notes, vias.length > 0);
  printSides(chosen.stats, chosen.decision, clock);
  printTimeline(chosen.bins, Math.max(1, Number(values.every) || 10), clock);
  const files = await writeOutputs(from.place, to.place, results, pick, clock);
  console.log(`\nFull 1-minute data: ${files[0]}`);
  console.log(`Map: ${files[1]}  (drop it on https://geojson.io to see the route coloured by sunny side)`);
  console.log('Map data © OpenStreetMap contributors (ODbL) · routing: OSRM, Valhalla · places: Photon, Open-Meteo');
}

const total = (values: number[]) => values.reduce((a, b) => a + b, 0);

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
    const get = () => fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(20_000) });
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

async function findPlace(input: string, fetchJson: FetchJson, near?: LonLat): Promise<Found> {
  const match = LAT_LON.exec(input);
  if (match) return { place: { label: `${match[1]}, ${match[2]}`, position: [Number(match[2]), Number(match[1])] }, others: [] };
  const [place, ...rest] = await searchPlaces(input, { limit: 3, near, fetchJson });
  if (!place) throw new Error(`No place found for "${input}".`);
  // Another town of the same name elsewhere in the country is worth a mention; a road named after it isn't.
  const others = rest.filter(
    (p) =>
      p.label !== place.label &&
      p.country === place.country &&
      (p.kind === undefined || SETTLEMENTS.has(p.kind)) &&
      distance(p.position, place.position) > 20_000,
  );
  return { place, others };
}

const SETTLEMENTS = new Set(['city', 'town', 'village', 'hamlet', 'suburb', 'locality', 'neighbourhood']);

function parseVehicle(input: string): Vehicle {
  if (input === 'bus' || input === 'car') return input;
  throw new Error(`--vehicle must be bus or car, not "${input}".`);
}

function readScoring(continuity: string, coolDown: string): ScoringOptions {
  const options = { continuity: Number(continuity), coolDown: Number(coolDown) };
  if (!(options.continuity >= 1)) throw new Error('--continuity must be 1 or more.');
  if (!(options.coolDown > 0)) throw new Error('--cool-down must be more than 0 minutes.');
  return options;
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

function printPlaces(from: Found, vias: Found[], to: Found) {
  const show = (title: string, { place, others }: Found) => {
    console.log(`${title.padEnd(6)}${place.label}${place.kind ? ` (${place.kind})` : ''}`);
    if (others.length) console.log(`      also found: ${others.map((p) => p.label).join('; ')}. Add detail if the first isn't right.`);
  };
  show('From', from);
  for (const via of vias) show('Via', via);
  show('To', to);
}

function printTrip({ route, stretch, stats }: Result, pick: number, count: number, vehicle: Vehicle, clock: Clock) {
  const which = count > 1 ? `, route ${pick + 1} of ${count}` : '';
  console.log(`Road  ${(route.distance / 1000).toFixed(0)} km ${route.label}${which}; ${hm(total(route.segmentDurations) / 60)} in free-flowing traffic`);
  const basis =
    stretch.basis === 'ticket'
      ? 'fitted to your arrival time'
      : stretch.basis === 'given'
        ? `${stretch.scale}× the free-flowing time`
        : `a typical ${vehicle} trip, ${stretch.scale}× the free-flowing time; give --arrive from your ticket to be exact`;
  const end = clock.departure + stats.minutes * 60_000;
  console.log(`When  ${dayName(clock.departure, clock.offset)}, ${hhmm(clock.departure, clock)} → ${hhmm(end, clock)} ${zone(clock.offset)} (${basis})`);
  console.log(`      ${hm(stats.minutes)} on the road, ${hm(stats.daylightMinutes)} of it in daylight`);
}

/** Does the answer hold on the other routes, and if the bus leaves a little early or late? */
function printChecks(results: Result[], pick: number, shifts: Shifted[], notes: string[], pinned: boolean) {
  console.log('');
  if (results.length > 1) {
    console.log('Routes found, with the verdict for each:');
    results.forEach((r, i) => {
      const name = `${(r.route.distance / 1000).toFixed(0)} km ${r.route.label}`;
      const mark = i === pick ? '   ← shown here' : '';
      console.log(`  ${i + 1}. ${name.padEnd(40)} ${hm(r.stats.minutes)}   ${verdictLabel(r.decision.sit, r.decision.confidence)}${mark}`);
    });
    const verdicts = agreement(results.map((r) => r.decision.sit));
    console.log(
      verdicts === 'agree'
        ? '  All routes agree.'
        : verdicts === 'mostly'
          ? '  The routes broadly agree; on some it hardly matters.'
          : '  The routes DISAGREE: show the one your bus takes with --route, or pin it with --via.',
    );
  } else {
    console.log(pinned ? 'Route pinned through your via towns.' : 'Only one route found. If your bus goes another way, pin it with --via.');
  }
  const when = (shift: number) => `${Math.abs(shift) >= 60 ? `${Math.abs(shift) / 60} h` : `${Math.abs(shift)} min`} ${shift < 0 ? 'early' : 'late'}`;
  const sit = results[pick].decision.sit;
  const flips = shifts.filter((s) => s.sit !== sit);
  if (!flips.length) {
    console.log(`Leaving ${list(shifts.map((s) => when(s.shift)))} gives the same answer.`);
  } else {
    const lead = sit === 'either' ? 'This departure is near the changeover' : 'Careful';
    console.log(`${lead}: ${flips.map((s) => `leaving ${when(s.shift)} means ${verdictLabel(s.sit)}`).join('; ')}.`);
  }
  for (const note of notes) console.log(`Note: ${note}`);
}

const verdictLabel = (sit: Decision['sit'], confidence?: Decision['confidence']) =>
  sit === 'either' ? 'either side' : `sit ${sit.toUpperCase()}${confidence === 'slight' ? ' (slightly)' : ''}`;

/** "a, b or c". */
const list = (items: string[]) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} or ${items.at(-1)}` : items.join(''));

function printVerdict(d: Decision, stats: TripStats, clock: Clock) {
  const lines: string[] = [];
  if (d.sit === 'either') {
    if (stats.daylightMinutes < 1) {
      lines.push('Either side: the whole trip is after dark.');
    } else if (d.confidence === 'little sun') {
      lines.push('Either side: not much sun reaches the side windows.');
      lines.push(
        stats.daylightMinutes < stats.minutes / 4
          ? 'Most of the trip is in the dark.'
          : d.avoidRows
            ? 'The sun is mostly ahead of or behind you.'
            : 'The sun is weak or high overhead most of the way.',
      );
      if (stats.sides.left.sunMinutes >= 1 || stats.sides.right.sunMinutes >= 1) {
        lines.push(`${capitalise(sunStory('left', stats, clock))}; ${sunStory('right', stats, clock)}.`);
      }
    } else {
      lines.push('Either side: both get about the same sun.');
      lines.push(`${capitalise(sunStory('left', stats, clock))}; ${sunStory('right', stats, clock)}.`);
    }
  } else {
    const worse = otherSide(d.sit);
    lines.push(`Sit on the ${d.sit.toUpperCase()} side${d.confidence === 'slight' ? ' (only slightly better)' : ''}.`);
    lines.push(`${capitalise(sunStory(worse, stats, clock))}; ${sunStory(d.sit, stats, clock)}.`);
    const chosen = stats.sides[d.sit];
    const rejected = stats.sides[worse];
    if (chosen.energy > rejected.energy) {
      lines.push(
        chosen.longestMinutes < rejected.longestMinutes
          ? `The ${d.sit} side gets more sun in total, but in shorter bursts; a long unbroken stretch like the ${worse} side's is more tiring.`
          : `The ${d.sit} side gets more sun in total, but weaker; the ${worse} side's sun is more intense.`,
      );
    }
  }
  if (d.lessGlare) {
    const glary = otherSide(d.lessGlare);
    lines.push(
      `If anything, sit on the ${d.lessGlare.toUpperCase()}: the ${glary} side gets more low sun straight in your eyes ` +
        `(${hm(d.glare[glary])} vs ${hm(d.glare[d.lessGlare])}).`,
    );
  }
  if (d.switchSeats) {
    const s = d.switchSeats;
    lines.push(
      `If you can change seats: start on the ${s.from.toUpperCase()}, move to the ${s.to.toUpperCase()} at about ` +
        `${hhmm(s.at, clock)} (km ${Math.round(s.distance / 1000)}). That cuts the sun you feel by ${Math.round(s.saving * 100)}%.`,
    );
  }
  if (d.avoidRows) {
    lines.push(`Tip: a lot of sun comes through the ${d.avoidRows === 'front' ? 'windscreen, so avoid the front rows' : 'rear window, so avoid the back rows'}.`);
  }
  lines.push(`Heat score (lower is better): left ${Math.round(d.heat.left)}, right ${Math.round(d.heat.right)}.`);

  console.log(`\nVERDICT  ${lines[0]}`);
  for (const line of lines.slice(1)) console.log(`         ${line}`);
}

/** E.g. "the right side gets sun for 1h 01m (all in one unbroken stretch from 09:00)". */
function sunStory(side: SeatSide, stats: TripStats, clock: Clock): string {
  const s = stats.sides[side];
  if (s.longestStart === undefined || s.sunMinutes < 1) return `the ${side} side gets almost no direct sun`;
  const stretch = s.longestMinutes >= s.sunMinutes - 0.5 ? 'all in one unbroken stretch' : `longest unbroken stretch ${hm(s.longestMinutes)}`;
  return `the ${side} side gets sun for ${hm(s.sunMinutes)} (${stretch} from ${hhmm(s.longestStart, clock)})`;
}

const capitalise = (text: string) => text[0].toUpperCase() + text.slice(1);

function printSides(stats: TripStats, decision: Decision, clock: Clock) {
  console.log(`\nDirect sun on each side (clear sky; "sun" = at least ${SUN_THRESHOLD} W/m² on that window)`);
  console.log('          sun time   longest unbroken      energy per m²   heat score');
  for (const side of SIDES) {
    const s = stats.sides[side];
    const stretch =
      s.longestStart === undefined || s.sunMinutes < 1 ? '-' : `${hm(s.longestMinutes)} from ${hhmm(s.longestStart, clock)}`;
    const label = side[0].toUpperCase() + side.slice(1);
    console.log(
      `  ${label.padEnd(6)}  ${hm(s.sunMinutes).padStart(7)}    ${stretch.padEnd(20)}  ${(s.energy / 1000).toFixed(2)} kWh      ${num(decision.heat[side], 4)}`,
    );
  }
  console.log('  (heat score: minutes of strong sun, weighted up for long unbroken stretches)');
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

async function writeOutputs(from: Place, to: Place, results: Result[], pick: number, clock: Clock): Promise<string[]> {
  const stamp = new Date(clock.departure + clock.offset * 60_000).toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
  const name = `${slug(from.label)}-to-${slug(to.label)}-${stamp}`;
  const dir = path.join(ROOT, 'out');
  await mkdir(dir, { recursive: true });
  const csvFile = path.join(dir, `${name}.csv`);
  const mapFile = path.join(dir, `${name}.geojson`);
  await writeFile(csvFile, toCsv(results[pick].bins, clock));
  await writeFile(mapFile, JSON.stringify(toGeoJson(from, to, results, pick, clock)));
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

/** The chosen route as coloured stretches (one per change of sunny side), the other routes in grey, and markers. */
function toGeoJson(from: Place, to: Place, results: Result[], pick: number, clock: Clock) {
  const { route, passes } = results[pick];
  const others = results
    .filter((_, i) => i !== pick)
    .map((r) => ({
      type: 'Feature',
      properties: {
        route: r.route.label,
        verdict: verdictLabel(r.decision.sit, r.decision.confidence),
        stroke: '#868e96',
        'stroke-width': 3,
        'stroke-opacity': 0.6,
      },
      geometry: { type: 'LineString', coordinates: r.route.coords },
    }));
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
      ...others,
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
