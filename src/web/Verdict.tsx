import { useMemo } from 'react';
import { departureSummary, explain, routesSummary, weatherSentence, type ClockFormat } from '../app/explain.ts';
import { departureShifts, type RouteResult, type TripContext } from '../app/plan.ts';
import { otherSide } from '../engine/decide.ts';
import type { Timing } from '../engine/timing.ts';
import { tripWeather } from '../engine/weather.ts';
import { SeatDiagram } from './SeatDiagram.tsx';
import { dayLabel } from './time.ts';

/** How the page tells you to pin or pick a route. */
const HINTS = { pin: 'add a town it goes through', pick: 'pick the one your bus takes below' };

interface Props {
  context: TripContext;
  results: RouteResult[];
  selected: number;
  timing: Timing;
  clock: ClockFormat;
  pinned: boolean;
  /** When this departure was picked from the whole-day view, the way back to it. */
  onBackToDay?: () => void;
}

export function Verdict({ context, results, selected, timing, clock, pinned, onBackToDay }: Props) {
  const result = results[selected];
  const { decision, stats, stretch } = result;
  const weather = useMemo(() => (context.weather ? tripWeather(context.weather, result.bins) : undefined), [context, result]);
  const { headline, reasons, tips, heat } = explain(decision, stats, clock, weather);
  const shifts = useMemo(() => departureShifts(context, result, timing), [context, result, timing]);
  const either = decision.sit === 'either';
  const end = timing.departure + stats.minutes * 60_000;
  const basis =
    stretch.basis === 'ticket'
      ? "Times are fitted to your ticket's arrival time."
      : `Times assume a typical ${timing.vehicle} trip, ${stretch.scale}× free-flowing traffic; add your arrival time for a closer answer.`;

  return (
    <section aria-labelledby="verdict" className="rounded-2xl bg-surface p-5 shadow-sm ring-1 ring-ink/5">
      {onBackToDay && (
        <button type="button" onClick={onBackToDay} className="mb-3 text-sm text-ink-2 underline decoration-axis underline-offset-4 hover:text-ink">
          ← The whole day
        </button>
      )}
      <div className="flex items-center gap-4">
        <SeatDiagram sit={decision.sit} sunny={either ? undefined : otherSide(decision.sit as 'left' | 'right')} />
        <div className="min-w-0">
          <p className="text-sm text-ink-2">
            {dayLabel(timing.departure)}, {clock(timing.departure)} → {clock(end)}
          </p>
          <h2 id="verdict" className="mt-1 text-[1.75rem] leading-tight font-semibold tracking-tight sm:text-4xl">
            {either ? 'Either side' : `Sit on the ${decision.sit}`}
          </h2>
          {decision.confidence === 'slight' && <p className="mt-1 text-sm text-ink-2">only slightly better</p>}
        </div>
      </div>

      <div className="mt-4 space-y-2 leading-relaxed">
        {/* For "either", the headline's second half says why; a side is already said above. */}
        {either && <p className="font-medium">{capitalise(headline.replace(/^Either side: /, ''))}</p>}
        {reasons.map((reason) => (
          <p key={reason} className="text-ink-2">
            {reason}
          </p>
        ))}
      </div>

      {tips.length > 0 && (
        <ul className="mt-4 space-y-2">
          {tips.map((tip) => (
            <li key={tip} className="rounded-lg bg-page px-3 py-2.5 text-sm leading-relaxed">
              {tip}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 space-y-1.5 border-t border-hairline pt-3 text-sm text-ink-2">
        {weather && <p>{weatherSentence(weather)}</p>}
        <p>{routesSummary(results.map((r) => r.decision.sit), pinned, HINTS)}</p>
        <p>{departureSummary(decision.sit, shifts)}</p>
        {context.notes.map((note) => (
          <p key={note}>{note}</p>
        ))}
        <p className="text-xs text-muted">
          {basis} {heat}
        </p>
      </div>
    </section>
  );
}

const capitalise = (text: string) => text[0].toUpperCase() + text.slice(1);
