// Cutting a route into stretches by where the sun falls, for maps.
import { SUN_THRESHOLD } from '../engine/summary.ts';
import type { LonLat, Route, SegmentPass } from '../engine/types.ts';

export type SunCategory = 'sun on left' | 'sun on right' | 'sun ahead or behind' | 'weak sun' | 'night';

/**
 * Colours on a light background: categorical slots 1-3 for left, right and ahead/behind
 * (checked for colour-blind separation), greys for no strong sun. The web page swaps in
 * its dark-mode steps.
 */
export const CATEGORY_COLOURS: Record<SunCategory, string> = {
  'sun on left': '#2a78d6',
  'sun on right': '#eb6834',
  'sun ahead or behind': '#1baf7a',
  'weak sun': '#c3c2b7',
  night: '#52514e',
};

export function category({ sun, faces }: SegmentPass): SunCategory {
  if (sun.elevation <= 0) return 'night';
  if (Math.max(faces.left, faces.right) >= SUN_THRESHOLD) return faces.left > faces.right ? 'sun on left' : 'sun on right';
  if (Math.max(faces.front, faces.rear) >= SUN_THRESHOLD) return 'sun ahead or behind';
  return 'weak sun';
}

export interface Stretch {
  category: SunCategory;
  coords: LonLat[];
  /** When the vehicle enters and leaves the stretch, ms since epoch (UTC). */
  from: number;
  to: number;
}

/** The route cut into stretches, a new one each time the sunny side changes. */
export function stretches(route: Route, passes: SegmentPass[]): Stretch[] {
  const out: Stretch[] = [];
  for (const pass of passes) {
    const cat = category(pass);
    let stretch = out.at(-1);
    if (!stretch || stretch.category !== cat) {
      stretch = { category: cat, coords: [route.coords[pass.index]], from: pass.start, to: pass.start };
      out.push(stretch);
    }
    stretch.coords.push(route.coords[pass.index + 1]);
    stretch.to = pass.start + pass.seconds * 1000;
  }
  return out;
}
