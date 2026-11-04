import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { ClockFormat } from '../app/explain.ts';
import type { RouteResult } from '../app/plan.ts';
import type { Vehicle } from '../engine/timing.ts';
import type { Weather } from '../engine/weather.ts';
import type { Place } from '../services/geocode.ts';
import type { CandidateRoute } from '../services/routing.ts';
import { chartBins, Timeline } from './Timeline.tsx';
import { CARD } from './ui.tsx';

// MapLibre is most of the page's weight, so it only loads once there's a route to show.
const RouteMap = lazy(() => import('./RouteMap.tsx').then((module) => ({ default: module.RouteMap })));

interface Props {
  routes: CandidateRoute[];
  selected: number;
  /** Start, via towns, end. */
  places: Place[];
  clock: ClockFormat;
  onSelect: (index: number) => void;
  /** The chosen route at one departure, or null for the whole day. */
  result: RouteResult | null;
  weather: Weather | null;
  vehicle: Vehicle;
}

/**
 * The map and the timeline, sharing one moment of the trip: point at the chart (or play the
 * trip) and the vehicle shows on the map there, with the sun's direction.
 */
export function TripPanels({ routes, selected, places, clock, onSelect, result, weather, vehicle }: Props) {
  const [cursor, setCursor] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const latest = useRef(cursor); // where playback starts from
  latest.current = cursor;

  // A new answer starts with nothing pointed at.
  useEffect(() => {
    setCursor(null);
    setPlaying(false);
  }, [result]);

  // Playback runs through the trip in 6 to 16 seconds, from wherever the cursor is.
  useEffect(() => {
    if (!playing || !result) return;
    const count = chartBins(result.bins).length;
    const length = Math.min(16_000, Math.max(6_000, count * 70));
    const from = latest.current !== null && latest.current < count - 1 ? latest.current : 0;
    const begin = performance.now() - (from / Math.max(1, count - 1)) * length;
    let frame = 0;
    const tick = (now: number) => {
      const f = (now - begin) / length;
      if (f >= 1) {
        setCursor(count - 1);
        setPlaying(false);
        return;
      }
      setCursor(Math.max(0, Math.round(f * (count - 1))));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, result]);

  const point = (index: number | null) => {
    if (index === null && playing) return; // the pointer wandering off doesn't stop the playback
    setPlaying(false);
    setCursor(index);
  };

  return (
    <div className="space-y-4 lg:sticky lg:top-20">
      <Suspense
        fallback={
          <div className={`${CARD} p-3`}>
            <div className="skeleton h-72 lg:h-[30rem]" />
          </div>
        }
      >
        <RouteMap
          routes={routes}
          selected={selected}
          passes={result?.passes ?? null}
          places={places}
          clock={clock}
          onSelect={onSelect}
          cursor={result && cursor !== null ? (result.bins[cursor] ?? null) : null}
          vehicle={vehicle}
        />
      </Suspense>
      {result && (
        <Timeline result={result} clock={clock} weather={weather} cursor={cursor} onCursor={point} playing={playing} onPlay={() => setPlaying((p) => !p)} />
      )}
    </div>
  );
}
