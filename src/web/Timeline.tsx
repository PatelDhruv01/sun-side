import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { ClockFormat } from '../app/explain.ts';
import type { RouteResult } from '../app/plan.ts';
import { timelineRows } from '../app/rows.ts';
import { compass } from '../engine/geo.ts';
import type { TimelineBin } from '../engine/types.ts';
import { weatherAt, type Weather } from '../engine/weather.ts';
import { useWidth } from './hooks.ts';

const Y_MAX = 700; // W/m²: a side window gets at most about 660 under a clear sky
const LANE = 64; // plot height of each lane
const LABEL = 20; // room above each lane for its name
const GAP = 14; // between the lanes
const AXIS = 22; // time labels underneath
const PAD_LEFT = 32; // y tick labels
const PAD_RIGHT = 10;
const HEIGHT = 2 * (LABEL + LANE) + GAP + AXIS;
const TIP_WIDTH = 208;

/** Small multiples: one lane per side window, on the same scale. */
const LANES = [
  { side: 'left', name: 'Left window', line: 'stroke-sun-left', area: 'fill-sun-left/10', dot: 'fill-sun-left', key: 'bg-sun-left' },
  { side: 'right', name: 'Right window', line: 'stroke-sun-right', area: 'fill-sun-right/10', dot: 'fill-sun-right', key: 'bg-sun-right' },
] as const;

/** Direct sun on each side window over the trip, with a crosshair and a table view. */
export function Timeline({ result, clock, weather }: { result: RouteResult; clock: ClockFormat; weather: Weather | null }) {
  const box = useRef<HTMLDivElement>(null);
  const width = useWidth(box);
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const { decision } = result;
  // A last fragment of a few seconds would draw as a full-height spike; the table still has it.
  const tail = result.bins[result.bins.length - 1];
  const bins = result.bins.length > 1 && tail.seconds < 20 ? result.bins.slice(0, -1) : result.bins;
  const start = bins[0].start;
  const last = bins[bins.length - 1];
  const end = last.start + last.seconds * 1000;
  const plotWidth = Math.max(1, width - PAD_LEFT - PAD_RIGHT);

  const x = (time: number) => PAD_LEFT + ((time - start) / (end - start)) * plotWidth;
  const middle = (bin: TimelineBin) => bin.start + bin.seconds * 500;
  const top = (lane: number) => lane * (LABEL + LANE + GAP) + LABEL;
  const y = (lane: number, value: number) => top(lane) + LANE - (Math.min(value, Y_MAX) / Y_MAX) * LANE;
  const plotTop = LABEL;
  const plotBottom = top(1) + LANE;

  const binAt = (clientX: number, element: Element) => {
    const time = start + ((clientX - element.getBoundingClientRect().left - PAD_LEFT) / plotWidth) * (end - start);
    return Math.max(0, Math.min(bins.length - 1, Math.floor((time - start) / 60_000))); // one-minute bins
  };
  const onPointer = (e: PointerEvent<SVGSVGElement>) => setHover(binAt(e.clientX, e.currentTarget));
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 10 : 1;
    const moves: Record<string, (h: number) => number> = {
      ArrowRight: (h) => h + step,
      ArrowLeft: (h) => h - step,
      Home: () => 0,
      End: () => bins.length - 1,
    };
    if (e.key === 'Escape') setHover(null);
    if (!moves[e.key]) return;
    e.preventDefault();
    setHover((h) => Math.max(0, Math.min(bins.length - 1, moves[e.key](h ?? -1))));
  };

  const shown = hover === null ? null : bins[hover];
  const sky = shown && weather ? weatherAt(weather, shown.position, middle(shown)) : undefined;
  const crossX = shown ? x(middle(shown)) : 0;
  const tipLeft = crossX + 12 + TIP_WIDTH <= width ? crossX + 12 : Math.max(0, crossX - 12 - TIP_WIDTH);

  return (
    <section aria-labelledby="timeline" className="rounded-2xl bg-surface p-5 shadow-sm ring-1 ring-ink/5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id="timeline" className="text-sm font-medium text-ink-2">
          Direct sun on each side window, W/m²
        </h3>
        <button
          type="button"
          onClick={() => setAsTable((t) => !t)}
          className="shrink-0 text-xs text-ink-2 underline decoration-axis underline-offset-4 hover:text-ink"
        >
          {asTable ? 'Show the chart' : 'Show as a table'}
        </button>
      </div>

      {asTable && <TimelineTable result={result} clock={clock} />}

      <div
        ref={box}
        tabIndex={0}
        onKeyDown={onKey}
        onBlur={() => setHover(null)}
        aria-label="Sun timeline. Use the left and right arrow keys to read each minute."
        className={`relative mt-3 rounded outline-none focus-visible:ring-2 focus-visible:ring-ink-2 ${asTable ? 'hidden' : ''}`}
        style={{ height: HEIGHT }}
      >
        {width > 0 && (
          // absolutely placed, so the drawn width never holds the layout open when the page narrows
          <svg
            width={width}
            height={HEIGHT}
            className="absolute inset-0 touch-pan-y select-none"
            onPointerMove={onPointer}
            onPointerDown={onPointer}
            onPointerLeave={() => setHover(null)}
            aria-hidden
          >
            {nightRanges(bins).map(([from, to]) => (
              <rect key={from} x={x(from)} y={plotTop} width={Math.max(1, x(to) - x(from))} height={plotBottom - plotTop} className="fill-hairline" />
            ))}

            {LANES.map((lane, k) => {
              const points = bins.map((b) => `${x(middle(b)).toFixed(1)},${y(k, b.faces[lane.side]).toFixed(1)}`).join('L');
              const base = top(k) + LANE;
              return (
                <g key={lane.side}>
                  <line x1={PAD_LEFT} x2={PAD_LEFT + 12} y1={top(k) - 8} y2={top(k) - 8} strokeWidth="2" strokeLinecap="round" className={lane.line} />
                  <text x={PAD_LEFT + 18} y={top(k) - 4} className="fill-ink-2 text-xs">
                    {lane.name}
                  </text>
                  <line x1={PAD_LEFT} x2={PAD_LEFT + plotWidth} y1={y(k, 600)} y2={y(k, 600)} className="stroke-hairline" />
                  <text x={PAD_LEFT - 6} y={y(k, 600) + 3} textAnchor="end" className="fill-muted text-[10px] tabular-nums">
                    600
                  </text>
                  <text x={PAD_LEFT - 6} y={base + 3} textAnchor="end" className="fill-muted text-[10px] tabular-nums">
                    0
                  </text>
                  <path d={`M${x(middle(bins[0])).toFixed(1)},${base}L${points}L${x(middle(last)).toFixed(1)},${base}Z`} className={lane.area} />
                  <path d={`M${points}`} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" className={`fill-none ${lane.line}`} />
                  <line x1={PAD_LEFT} x2={PAD_LEFT + plotWidth} y1={base} y2={base} className="stroke-axis" />
                </g>
              );
            })}

            {decision.switchSeats && (
              <g>
                <line x1={x(decision.switchSeats.at)} x2={x(decision.switchSeats.at)} y1={plotTop - 6} y2={plotBottom} className="stroke-ink-2" />
                {/* above the lanes, on whichever side of the line has more room */}
                <text
                  x={x(decision.switchSeats.at) + (x(decision.switchSeats.at) < width / 2 ? 4 : -4)}
                  y={plotTop - 8}
                  textAnchor={x(decision.switchSeats.at) < width / 2 ? 'start' : 'end'}
                  className="fill-ink-2 text-[10px]"
                >
                  change seats
                </text>
              </g>
            )}

            {timeTicks(start, end, plotWidth).map((tick) => {
              // labels at the very ends lean inwards, so they aren't cut off
              const at = x(tick);
              const anchor = at > PAD_LEFT + plotWidth - 18 ? 'end' : at < PAD_LEFT + 18 ? 'start' : 'middle';
              return (
                <text key={tick} x={at} y={HEIGHT - 6} textAnchor={anchor} className="fill-muted text-[10px] tabular-nums">
                  {clock(tick)}
                </text>
              );
            })}

            {shown && (
              <g>
                <line x1={crossX} x2={crossX} y1={plotTop} y2={plotBottom} className="stroke-ink-2" />
                {LANES.map((lane, k) => (
                  <circle key={lane.side} cx={crossX} cy={y(k, shown.faces[lane.side])} r="4" strokeWidth="2" className={`${lane.dot} stroke-surface`} />
                ))}
              </g>
            )}
          </svg>
        )}

        {shown && (
          <div className="pointer-events-none absolute top-0 z-10 rounded-lg bg-surface px-3 py-2 text-xs shadow-lg ring-1 ring-ink/10" style={{ left: tipLeft, width: TIP_WIDTH }}>
            <p className="font-medium text-ink">
              {clock(shown.start)} · km {Math.round(shown.distance / 1000)}
            </p>
            {LANES.map((lane) => (
              <p key={lane.side} className="mt-1 flex items-center gap-2">
                <span aria-hidden className={`h-0.5 w-3 shrink-0 rounded-full ${lane.key}`} />
                <span className="font-semibold text-ink tabular-nums">{Math.round(shown.faces[lane.side])} W/m²</span>
                <span className="text-ink-2">{lane.name}</span>
              </p>
            ))}
            <p className="mt-1 text-ink-2">
              {shown.sun.elevation > 0 ? `Sun ${compass(shown.sun.azimuth)}, ${Math.round(shown.sun.elevation)}° high` : 'Sun below the horizon'} · road heads{' '}
              {compass(shown.heading)}
            </p>
            {sky && (
              <p className="mt-0.5 text-ink-2">
                Cloud {Math.round(sky.cloud)}% · {Math.round(sky.temperature)} °C
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/** The same numbers as rows, for reading without the chart. */
function TimelineTable({ result, clock }: { result: RouteResult; clock: ClockFormat }) {
  const minutes = result.stats.minutes;
  const every = minutes <= 240 ? 10 : minutes <= 480 ? 15 : 30;
  return (
    <div className="mt-3 max-h-96 overflow-auto">
      <table className="w-full text-left text-xs">
        <caption className="sr-only">Direct sun on each side window, every {every} minutes</caption>
        <thead className="sticky top-0 bg-surface text-ink-2">
          <tr>
            <th className="py-1.5 pr-3 font-medium">Time</th>
            <th className="py-1.5 pr-3 font-medium">km</th>
            <th className="py-1.5 pr-3 font-medium">Road</th>
            <th className="py-1.5 pr-3 font-medium">Sun</th>
            <th className="py-1.5 pr-3 text-right font-medium">Left W/m²</th>
            <th className="py-1.5 text-right font-medium">Right W/m²</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {timelineRows(result.bins, every).map((row) => (
            <tr key={row.start} className="border-t border-hairline">
              <td className="py-1.5 pr-3">{clock(row.start)}</td>
              <td className="py-1.5 pr-3">{Math.round(row.distance / 1000)}</td>
              <td className="py-1.5 pr-3">{compass(row.heading)}</td>
              <td className="py-1.5 pr-3">{row.sun.elevation > 0 ? `${compass(row.sun.azimuth)} ${Math.round(row.sun.elevation)}°` : 'set'}</td>
              <td className="py-1.5 pr-3 text-right">{Math.round(row.faces.left)}</td>
              <td className="py-1.5 text-right">{Math.round(row.faces.right)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Stretches of the trip with the sun below the horizon, as [from, to] times. */
function nightRanges(bins: TimelineBin[]): [number, number][] {
  const ranges: [number, number][] = [];
  for (const bin of bins) {
    if (bin.sun.elevation > 0) continue;
    const range = ranges.at(-1);
    const binEnd = bin.start + bin.seconds * 1000;
    if (range && range[1] === bin.start) range[1] = binEnd;
    else ranges.push([bin.start, binEnd]);
  }
  return ranges;
}

/** Clock times for the x axis, on round minutes, at least 72 px apart. */
function timeTicks(start: number, end: number, plotWidth: number): number[] {
  const minutes = (end - start) / 60_000;
  const step = [15, 30, 60, 120, 180, 240, 360, 720].find((s) => plotWidth / (minutes / s) >= 72) ?? 720;
  const first = new Date(start);
  first.setSeconds(0, 0);
  const skip = (step - ((first.getHours() * 60 + first.getMinutes()) % step)) % step;
  const ticks: number[] = [];
  for (let t = first.getTime() + skip * 60_000; t <= end; t += step * 60_000) if (t >= start) ticks.push(t);
  return ticks;
}
