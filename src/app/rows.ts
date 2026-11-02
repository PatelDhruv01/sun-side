// The minute-by-minute timeline grouped into rows, for printing or a table.
import { toDeg, toRad, wrap360 } from '../engine/geo.ts';
import type { Faces, SunPosition, TimelineBin } from '../engine/types.ts';

export interface TimelineRow {
  /** When the row starts, ms since epoch (UTC). */
  start: number;
  /** Metres from the start of the trip, at the row's first minute. */
  distance: number;
  /** Time-weighted mean heading, degrees from north. */
  heading: number;
  /** The sun in the row's middle minute. */
  sun: SunPosition;
  /** Time-weighted mean direct sun on each face, W/m². */
  faces: Faces;
}

/** The bins taken `every` at a time. */
export function timelineRows(bins: TimelineBin[], every: number): TimelineRow[] {
  const rows: TimelineRow[] = [];
  for (let i = 0; i < bins.length; i += every) {
    const group = bins.slice(i, i + every);
    rows.push({ start: group[0].start, distance: group[0].distance, sun: group[Math.floor(group.length / 2)].sun, ...average(group) });
  }
  return rows;
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
