// The verdict in words, shared by the command line and the web page.
import { otherSide, type Decision, type SeatSide } from '../engine/decide.ts';
import { agreement, type Shifted } from '../engine/evaluate.ts';
import type { TripStats } from '../engine/summary.ts';
import type { Band } from '../engine/sweep.ts';
import type { TripWeather } from '../engine/weather.ts';

/** Shows a clock time (ms since epoch) the way the reader expects, e.g. "09:00" or "06:10 +1". */
export type ClockFormat = (time: number) => string;

/** A verdict spelled out: the headline, why, tips, and the heat scores. */
export interface Explanation {
  headline: string;
  reasons: string[];
  tips: Tip[];
  heat: string;
}

export interface Tip {
  /** What the tip is about, so a page can give it an icon or draw it. */
  kind: 'glare' | 'switch' | 'rows' | 'cool';
  text: string;
}

/** Below this, in °C all the way, some people would rather sit in the sun. */
const COOL = 18;

export function explain(d: Decision, stats: TripStats, clock: ClockFormat, weather?: TripWeather): Explanation {
  const reasons: string[] = [];
  const bothSides = () => `${capitalise(sunStory('left', stats, clock))}; ${sunStory('right', stats, clock)}.`;
  let headline: string;
  if (d.sit === 'either') {
    if (stats.daylightMinutes < 1) {
      headline = 'Either side: the whole trip is after dark.';
    } else if (d.confidence === 'little sun') {
      headline = 'Either side: not much sun reaches the side windows.';
      reasons.push(
        stats.daylightMinutes < stats.minutes / 4
          ? 'Most of the trip is in the dark.'
          : d.avoidRows
            ? 'The sun is mostly ahead of or behind you.'
            : 'The sun is weak or high overhead most of the way.',
      );
      if (stats.sides.left.sunMinutes >= 1 || stats.sides.right.sunMinutes >= 1) reasons.push(bothSides());
    } else {
      headline = 'Either side: both get about the same sun.';
      reasons.push(bothSides());
    }
  } else {
    const worse = otherSide(d.sit);
    headline = `Sit on the ${d.sit.toUpperCase()} side${d.confidence === 'slight' ? ' (only slightly better)' : ''}.`;
    reasons.push(`${capitalise(sunStory(worse, stats, clock))}; ${sunStory(d.sit, stats, clock)}.`);
    const chosen = stats.sides[d.sit];
    const rejected = stats.sides[worse];
    if (chosen.energy > rejected.energy) {
      reasons.push(
        chosen.longestMinutes < rejected.longestMinutes
          ? `The ${d.sit} side gets more sun in total, but in shorter bursts; a long unbroken stretch like the ${worse} side's is more tiring.`
          : `The ${d.sit} side gets more sun in total, but weaker; the ${worse} side's sun is more intense.`,
      );
    }
  }

  const tips: Tip[] = [];
  if (d.lessGlare) {
    const glary = otherSide(d.lessGlare);
    tips.push({
      kind: 'glare',
      text:
        `If anything, sit on the ${d.lessGlare.toUpperCase()}: the ${glary} side gets more low sun straight in your eyes ` +
        `(${duration(d.glare[glary])} vs ${duration(d.glare[d.lessGlare])}).`,
    });
  }
  if (d.switchSeats) {
    const s = d.switchSeats;
    tips.push({
      kind: 'switch',
      text:
        `If you can change seats: start on the ${s.from.toUpperCase()}, move to the ${s.to.toUpperCase()} at about ` +
        `${clock(s.at)} (km ${Math.round(s.distance / 1000)}). That cuts the sun you feel by ${Math.round(s.saving * 100)}%.`,
    });
  }
  if (d.avoidRows) {
    const where = d.avoidRows === 'front' ? 'windscreen, so avoid the front rows' : 'rear window, so avoid the back rows';
    tips.push({ kind: 'rows', text: `Tip: a lot of sun comes through the ${where}.` });
  }
  if (weather && d.sit !== 'either' && weather.maxTemperature < COOL) {
    tips.push({
      kind: 'cool',
      text: `It'll be cool, ${temperatures(weather)}: if you'd rather sit in the sun, take the ${otherSide(d.sit).toUpperCase()} side.`,
    });
  }
  return { headline, reasons, tips, heat: `Heat score (lower is better): left ${Math.round(d.heat.left)}, right ${Math.round(d.heat.right)}.` };
}

/** The forecast along the trip in a sentence, e.g. "Forecast: clear skies, 24–31 °C." */
export function weatherSentence(weather: TripWeather): string {
  const cloud = Math.round(weather.cloud);
  const sky =
    cloud >= 60
      ? `mostly cloudy (${cloud}% cover), so there's less sun to dodge`
      : cloud >= 20
        ? `some cloud (${cloud}% cover on average)`
        : weather.clearness < 0.7
          ? 'clear but hazy, which takes the edge off the sun'
          : 'clear skies';
  return `Forecast: ${sky}, ${temperatures(weather)}.`;
}

const temperatures = ({ minTemperature, maxTemperature }: TripWeather) => {
  const [low, high] = [Math.round(minTemperature), Math.round(maxTemperature)];
  return low === high ? `about ${low} °C` : `${low}–${high} °C`;
};

/** A run of departures in words: "sit LEFT", "either side: after dark", and so on. */
export function bandLabel(band: Band): string {
  if (band.sit !== 'either') return `sit ${band.sit.toUpperCase()}${band.slight ? ' (slightly)' : ''}`;
  if (band.reason === 'dark') return 'either side: after dark';
  return band.reason === 'little sun' ? 'either side: little sun' : 'either side: about even';
}

/** A run's departure times, e.g. "07:00–12:30", or one time for a single departure. */
export const bandTimes = (band: Band, clock: ClockFormat) => (band.from === band.to ? clock(band.from) : `${clock(band.from)}–${clock(band.to)}`);

/** E.g. "the right side gets sun for 1h 01m (all in one unbroken stretch from 09:00)". */
export function sunStory(side: SeatSide, stats: TripStats, clock: ClockFormat): string {
  const s = stats.sides[side];
  if (s.longestStart === undefined || s.sunMinutes < 1) return `the ${side} side gets almost no direct sun`;
  const stretch = s.longestMinutes >= s.sunMinutes - 0.5 ? 'all in one unbroken stretch' : `longest unbroken stretch ${duration(s.longestMinutes)}`;
  return `the ${side} side gets sun for ${duration(s.sunMinutes)} (${stretch} from ${clock(s.longestStart)})`;
}

/** Minutes as "1h 05m". */
export function duration(minutes: number): string {
  const m = Math.round(minutes);
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

/** The short form for lists: "sit LEFT", "sit RIGHT (slightly)", "either side". */
export const verdictLabel = (sit: Decision['sit'], confidence?: Decision['confidence']) =>
  sit === 'either' ? 'either side' : `sit ${sit.toUpperCase()}${confidence === 'slight' ? ' (slightly)' : ''}`;

/** How the reader can pin a route or pick one, in the words of the interface they're using. */
export interface RouteHints {
  pin: string;
  pick: string;
}

/** Whether the routes found agree, in a sentence. `pinned` means the reader fixed the route with via towns. */
export function routesSummary(sits: Decision['sit'][], pinned: boolean, hints: RouteHints): string {
  if (sits.length <= 1) return pinned ? 'Route pinned through your via towns.' : `Only one route found. If your bus goes another way, ${hints.pin}.`;
  const verdicts = agreement(sits);
  if (verdicts === 'agree') return 'All routes agree.';
  if (verdicts === 'mostly') return 'The routes broadly agree; on some it hardly matters.';
  return `The routes DISAGREE: ${hints.pick}, or ${hints.pin}.`;
}

/** Whether leaving a little early or late changes the answer, in a sentence. */
export function departureSummary(sit: Decision['sit'], shifts: Shifted[]): string {
  const when = (shift: number) => `${Math.abs(shift) >= 60 ? `${Math.abs(shift) / 60} h` : `${Math.abs(shift)} min`} ${shift < 0 ? 'early' : 'late'}`;
  const flips = shifts.filter((s) => s.sit !== sit);
  if (!flips.length) return `Leaving ${list(shifts.map((s) => when(s.shift)))} gives the same answer.`;
  const lead = sit === 'either' ? 'This departure is near the changeover' : 'Careful';
  return `${lead}: ${flips.map((s) => `leaving ${when(s.shift)} means ${verdictLabel(s.sit)}`).join('; ')}.`;
}

const capitalise = (text: string) => text[0].toUpperCase() + text.slice(1);

/** "a, b or c". */
const list = (items: string[]) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} or ${items.at(-1)}` : items.join(''));
