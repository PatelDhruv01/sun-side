import type { Side, TimelineBin } from './types.ts';

/** Direct sun on a window that counts as "sun", W/m²: the WMO sunshine threshold, applied to the window. */
export const SUN_THRESHOLD = 120;

export interface SideStats {
  /** Minutes with at least SUN_THRESHOLD of direct sun on this face. */
  sunMinutes: number;
  /** The longest unbroken run of such minutes. */
  longestMinutes: number;
  /** When that run started, ms since epoch (UTC); undefined if the face never got sun. */
  longestStart?: number;
  /** Direct solar energy that fell on each square metre of this face over the trip, Wh/m². */
  energy: number;
}

export interface TripStats {
  minutes: number;
  daylightMinutes: number;
  sides: Record<Side, SideStats>;
}

const SIDES: Side[] = ['left', 'right', 'front', 'rear'];

/** Raw per-side totals. Deciding which side is better is Step 2's job, not this. */
export function summarise(bins: TimelineBin[]): TripStats {
  return {
    minutes: bins.reduce((m, b) => m + b.seconds / 60, 0),
    daylightMinutes: bins.reduce((m, b) => m + (b.sun.elevation > 0 ? b.seconds / 60 : 0), 0),
    sides: Object.fromEntries(SIDES.map((side) => [side, sideStats(bins, side)])) as Record<Side, SideStats>,
  };
}

function sideStats(bins: TimelineBin[], side: Side): SideStats {
  const stats: SideStats = { sunMinutes: 0, longestMinutes: 0, energy: 0 };
  let run = 0;
  let runStart = 0;
  for (const bin of bins) {
    const value = bin.faces[side];
    stats.energy += (value * bin.seconds) / 3600;
    if (value < SUN_THRESHOLD) {
      run = 0;
      continue;
    }
    if (run === 0) runStart = bin.start;
    run += bin.seconds / 60;
    stats.sunMinutes += bin.seconds / 60;
    if (run > stats.longestMinutes) {
      stats.longestMinutes = run;
      stats.longestStart = runStart;
    }
  }
  return stats;
}
