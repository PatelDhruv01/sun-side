import { SUN_THRESHOLD } from './summary.ts';
import type { Side, TimelineBin } from './types.ts';

export type SeatSide = 'left' | 'right';

export interface ScoringOptions {
  /** Minutes for the body to shed about two-thirds of its sun heat once in shade (default 15). */
  coolDown?: number;
  /** How much unbroken sun matters: 1 = only the total counts, 2 = default, 3 = a lot. */
  continuity?: number;
  /** Look for a seat change (default true). It's the slow part, and checks that only need the side skip it. */
  seatSwitch?: boolean;
}

export interface SeatSwitch {
  from: SeatSide;
  to: SeatSide;
  /** When to move, ms since epoch (UTC). */
  at: number;
  /** Metres from the start of the trip at that moment. */
  distance: number;
  /** Share of the heat score saved compared with staying on the better side, 0..1. */
  saving: number;
}

export interface Decision {
  /** Where to sit, or 'either' when it makes little difference. */
  sit: SeatSide | 'either';
  /** For a side: 'clear' or 'slight'. For 'either': 'balanced' or 'little sun'. */
  confidence: 'clear' | 'slight' | 'balanced' | 'little sun';
  /** How much lower the better side's heat score is than the worse side's, 0..1. */
  margin: number;
  /** Heat score per face; lower is better. */
  heat: Record<Side, number>;
  /** Minutes of low sun through each side window: sun straight in your eyes. */
  glare: Record<SeatSide, number>;
  /** When the sides are balanced but one has clearly less glare. */
  lessGlare?: SeatSide;
  /** One seat change that cuts the heat a lot, for when seats can be changed. */
  switchSeats?: SeatSwitch;
  /** Rows to avoid when much of the sun comes through the windscreen or the rear window. */
  avoidRows?: 'front' | 'back';
}

/** Strong side sun, W/m²: under it the heat bucket fills to 1. Close to the clear-sky side-window peak (~660). */
export const FULL_SUN = 600;
/** Below this heat score there's nothing worth avoiding: about 13 minutes of strong sun. */
const LITTLE = 5;
/** Sides closer than this, as a share of the worse side, count as the same. */
const BALANCED = 0.15;
/** At this margin the better side is a clear winner: the other is at least twice as bad... */
const CLEAR = 0.5;
/** ...and worse by at least this much, about 20 minutes of strong sun, so tiny amounts stay "slight". */
const CLEAR_GAP = 10;
/** A seat change must save at least this share of the heat (and LITTLE in absolute terms). */
const SWITCH_SAVING = 0.25;
/** No seat change in the first or last minutes; that would just be picking a side. */
const SWITCH_EDGE = 10;
/** Sun lower than this, in degrees, shines straight into your eyes. */
const GLARE_BELOW = 15;
/** A glare difference, in minutes, worth mentioning when the sides are otherwise even. */
const GLARE_GAP = 10;
/** Windscreen or rear-window heat this large compared with the worse side earns a rows tip. */
const ROWS = 0.75;

interface Params {
  coolDown: number;
  continuity: number;
}

export const otherSide = (side: SeatSide): SeatSide => (side === 'left' ? 'right' : 'left');

/** Picks the side to sit on from the minute-by-minute sun on each window. */
export function decide(bins: TimelineBin[], options: ScoringOptions = {}): Decision {
  const params = resolve(options);
  const minutes = bins.map((b) => b.seconds / 60);
  const exposure = (face: Side) => bins.map((b) => b.faces[face] / FULL_SUN);
  const score = (series: number[]) => bucket((i) => series[i], minutes, params);
  const left = exposure('left');
  const right = exposure('right');
  const heat: Record<Side, number> = {
    left: score(left),
    right: score(right),
    front: score(exposure('front')),
    rear: score(exposure('rear')),
  };
  const glare = { left: glareMinutes(bins, 'left'), right: glareMinutes(bins, 'right') };
  const better: SeatSide = heat.left <= heat.right ? 'left' : 'right';
  const worse = otherSide(better);
  const margin = heat[worse] > 0 ? 1 - heat[better] / heat[worse] : 0;

  const clear = margin >= CLEAR && heat[worse] - heat[better] >= CLEAR_GAP;
  const decision: Decision = { sit: better, confidence: clear ? 'clear' : 'slight', margin, heat, glare };
  decision.avoidRows = rowsToAvoid(heat);
  if (heat[worse] < LITTLE) return { ...decision, sit: 'either', confidence: 'little sun' };
  if (margin < BALANCED) {
    decision.sit = 'either';
    decision.confidence = 'balanced';
    if (Math.abs(glare.left - glare.right) >= GLARE_GAP) decision.lessGlare = glare.left < glare.right ? 'left' : 'right';
  }
  if (options.seatSwitch !== false) decision.switchSeats = bestSwitch(bins, minutes, { left, right }, params, heat[better]);
  return decision;
}

/**
 * The "heat bucket": sun on a window fills it, shade lets it drain over `coolDown` minutes.
 * The score adds up how full it is, raised to `continuity`, so one long unbroken stretch
 * counts for more than the same sun in short bursts. With continuity 1 it is simply the
 * total sun, in minutes of full sun. `exposure` is per bin, 1 = FULL_SUN.
 */
export function heatScore(exposure: number[], minutes: number[], options: ScoringOptions = {}): number {
  return bucket((i) => exposure[i], minutes, resolve(options));
}

function resolve(options: ScoringOptions): Params {
  return { coolDown: options.coolDown ?? 15, continuity: options.continuity ?? 2 };
}

function bucket(exposureAt: (i: number) => number, minutes: number[], { coolDown, continuity }: Params): number {
  let level = 0; // 0 = cool; steady full sun settles at 1
  let score = 0;
  const step = (exposure: number, dt: number) => {
    const keep = Math.exp(-dt / coolDown);
    const next = level * keep + exposure * (1 - keep); // exact for steady sun over the step
    score += ((level + next) / 2) ** continuity * dt;
    level = next;
  };
  for (let i = 0; i < minutes.length; i++) step(exposureAt(i), minutes[i]);
  // The bucket keeps draining after arrival: heat soaked up near the end still counts.
  for (let t = 0; t < 5 * coolDown && level > 1e-4; t++) step(0, 1);
  return score;
}

const glareMinutes = (bins: TimelineBin[], side: SeatSide) =>
  bins.reduce((m, b) => m + (b.faces[side] >= SUN_THRESHOLD && b.sun.elevation < GLARE_BELOW ? b.seconds / 60 : 0), 0);

function rowsToAvoid(heat: Record<Side, number>): Decision['avoidRows'] {
  const end = heat.front >= heat.rear ? 'front' : 'rear';
  if (heat[end] < LITTLE || heat[end] < ROWS * Math.max(heat.left, heat.right)) return undefined;
  return end === 'front' ? 'front' : 'back';
}

/** The single seat change that leaves the least heat, if it beats staying put by enough. */
function bestSwitch(
  bins: TimelineBin[],
  minutes: number[],
  exposure: Record<SeatSide, number[]>,
  params: Params,
  stay: number,
): SeatSwitch | undefined {
  const total = minutes.reduce((a, b) => a + b, 0);
  let best: { score: number; at: number; from: SeatSide } | undefined;
  let elapsed = 0; // minutes from the start to the beginning of bin k
  for (let k = 0; k < bins.length; k++) {
    if (elapsed >= SWITCH_EDGE && total - elapsed >= SWITCH_EDGE) {
      for (const from of ['left', 'right'] as const) {
        const before = exposure[from];
        const after = exposure[otherSide(from)];
        const score = bucket((i) => (i < k ? before[i] : after[i]), minutes, params);
        if (!best || score < best.score) best = { score, at: k, from };
      }
    }
    elapsed += minutes[k];
  }
  if (!best || stay - best.score < LITTLE || best.score > (1 - SWITCH_SAVING) * stay) return undefined;
  const bin = bins[best.at];
  return { from: best.from, to: otherSide(best.from), at: bin.start, distance: bin.distance, saving: 1 - best.score / stay };
}
