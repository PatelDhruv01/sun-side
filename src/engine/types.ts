/** A point as [longitude, latitude] in degrees: the order GeoJSON and OSRM use. */
export type LonLat = [lon: number, lat: number];

/** A drivable route: the road polyline plus how long each piece of it takes. */
export interface Route {
  coords: LonLat[];
  /** Seconds to drive from coords[i] to coords[i + 1] (length = coords.length - 1). */
  segmentDurations: number[];
  /** Metres from coords[i] to coords[i + 1] (length = coords.length - 1). */
  segmentDistances: number[];
}

export interface SunPosition {
  /** Degrees clockwise from true north: 0 = N, 90 = E, 180 = S, 270 = W. */
  azimuth: number;
  /** Degrees above the horizon, refraction-corrected; negative means below it. */
  elevation: number;
}

/** Direct sunlight falling on each face of the vehicle, W/m². */
export interface Faces {
  left: number;
  right: number;
  front: number;
  rear: number;
  roof: number;
}

export type Side = 'left' | 'right' | 'front' | 'rear';

/** One route segment as the vehicle drives through it. */
export interface SegmentPass {
  /** The segment runs from coords[index] to coords[index + 1]. */
  index: number;
  /** When the vehicle enters the segment, ms since epoch (UTC). */
  start: number;
  /** Seconds spent on the segment, after any time scaling. */
  seconds: number;
  /** Compass heading along the segment, degrees from north. */
  heading: number;
  /** The sun seen from the middle of the segment, halfway through the pass. */
  sun: SunPosition;
  faces: Faces;
}

/** The trip summed into fixed time bins (one minute by default). */
export interface TimelineBin {
  /** Bin start, ms since epoch (UTC). */
  start: number;
  /** Seconds of travel in the bin; only the last bin can be shorter than the bin size. */
  seconds: number;
  /** Metres from the start of the trip, at the middle of the bin. */
  distance: number;
  /** Where the vehicle is at the middle of the bin. */
  position: LonLat;
  /** Time-weighted mean heading over the bin, degrees from north. */
  heading: number;
  /** The sun at the middle of the bin. */
  sun: SunPosition;
  /** Time-weighted mean direct sunlight on each face over the bin, W/m². */
  faces: Faces;
}
