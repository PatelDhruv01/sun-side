import { Armchair, ArrowLeft, Check, CircleCheck, Clock, CloudSun, Eye, Gauge, Info, Moon, Repeat2, Route, Scale, Thermometer, type LucideIcon } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { departureSummary, explain, routesSummary, weatherSentence, type ClockFormat, type Tip } from '../app/explain.ts';
import { departureShifts, type RouteResult, type TripContext } from '../app/plan.ts';
import { otherSide, type Decision, type SeatSide, type SeatSwitch } from '../engine/decide.ts';
import type { TripStats } from '../engine/summary.ts';
import type { Timing } from '../engine/timing.ts';
import { tripWeather } from '../engine/weather.ts';
import { BusSeatMap } from './BusSeatMap.tsx';
import { dayLabel, shortDuration } from './time.ts';
import { CARD, CountUp, Pill, stagger } from './ui.tsx';

/** How the page tells you to pin or pick a route. */
const HINTS = { pin: 'add a town it goes through', pick: 'pick the one your bus takes below' };

const TIP_ICONS: Record<Tip['kind'], LucideIcon> = { glare: Eye, switch: Repeat2, rows: Armchair, cool: Thermometer };

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
  const confidence = confidenceOf(decision, stats);
  const basis =
    stretch.basis === 'ticket'
      ? "Times are fitted to your ticket's arrival time."
      : `Times assume a typical ${timing.vehicle} trip, ${stretch.scale}× free-flowing traffic; add your arrival time for a closer answer.`;

  return (
    <section aria-labelledby="verdict" className={`${CARD} animate-rise overflow-hidden`}>
      <div className="p-5 sm:p-6">
        {onBackToDay && (
          <button
            type="button"
            onClick={onBackToDay}
            className="mb-4 inline-flex items-center gap-1.5 rounded-lg text-sm font-medium text-ink-2 hover:text-ink"
          >
            <ArrowLeft aria-hidden className="size-4" />
            The whole day
          </button>
        )}

        <div className="animate-pop" style={stagger(1)}>
          <Pill tone={confidence.tone} icon={confidence.icon}>
            {confidence.label}
          </Pill>
        </div>
        <h2 id="verdict" className="mt-3 animate-rise text-[2.25rem] leading-[1.05] font-semibold tracking-[-0.03em] sm:text-[2.75rem]" style={stagger(1)}>
          {either ? 'Either side' : `Sit on the ${decision.sit}`}
        </h2>
        <p className="mt-2 animate-rise text-sm text-ink-2" style={stagger(2)}>
          {dayLabel(timing.departure)} · {clock(timing.departure)} → {clock(end)} · {shortDuration(stats.minutes)}
        </p>

        <div className="mt-5 grid animate-rise grid-cols-[auto_minmax(0,1fr)] items-center gap-4" style={stagger(3)}>
          <BusSeatMap
            sit={decision.sit}
            sunny={either ? undefined : otherSide(decision.sit as SeatSide)}
            avoidRows={decision.avoidRows}
            className="h-auto w-28 sm:w-32"
          />
          <div className="grid content-center gap-2">
            <SideTile side="left" stats={stats} best={decision.sit === 'left'} />
            <SideTile side="right" stats={stats} best={decision.sit === 'right'} />
          </div>
        </div>

        <div className="mt-5 animate-rise space-y-2 leading-relaxed" style={stagger(4)}>
          {/* For "either", the headline's second half says why; a side is already said above. */}
          {either && <p className="font-medium">{capitalise(headline.replace(/^Either side: /, ''))}</p>}
          {reasons.map((reason) => (
            <p key={reason} className="text-[15px] text-ink-2">
              {reason}
            </p>
          ))}
          {weather && (
            <p className="flex items-start gap-2 pt-1 text-sm text-ink-2">
              <CloudSun aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
              {weatherSentence(weather)}
            </p>
          )}
        </div>
      </div>

      {decision.switchSeats && <SeatChange change={decision.switchSeats} start={timing.departure} end={end} clock={clock} />}

      {tips.some((tip) => tip.kind !== 'switch') && (
        <ul className="space-y-2 px-5 pb-5 sm:px-6">
          {tips
            .filter((tip) => tip.kind !== 'switch') // drawn above instead
            .map((tip, i) => {
              const Icon = TIP_ICONS[tip.kind];
              return (
                <li key={tip.text} className="flex animate-rise gap-3 rounded-2xl bg-raised p-3.5 text-sm leading-relaxed ring-1 ring-hairline" style={stagger(5 + i)}>
                  <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-brand" />
                  <span>{capitalise(tip.text.replace(/^Tip: /, ''))}</span>
                </li>
              );
            })}
        </ul>
      )}

      <div className="space-y-2 border-t border-hairline bg-raised/60 px-5 py-4 text-sm text-ink-2 sm:px-6">
        <CheckLine icon={Route}>{routesSummary(results.map((r) => r.decision.sit), pinned, HINTS)}</CheckLine>
        <CheckLine icon={Clock}>{departureSummary(decision.sit, shifts)}</CheckLine>
        {context.notes.map((note) => (
          <CheckLine key={note} icon={Info}>
            {note}
          </CheckLine>
        ))}
        <p className="pt-1 text-xs leading-relaxed text-muted">
          {basis} {heat}
        </p>
      </div>
    </section>
  );
}

function confidenceOf(d: Decision, stats: TripStats): { tone: 'good' | 'neutral' | 'quiet'; icon: LucideIcon; label: string } {
  if (d.confidence === 'clear') return { tone: 'good', icon: CircleCheck, label: 'Clear winner' };
  if (d.confidence === 'slight') return { tone: 'neutral', icon: Gauge, label: 'Slight edge' };
  if (d.confidence === 'balanced') return { tone: 'quiet', icon: Scale, label: 'About even' };
  return stats.daylightMinutes < 1 ? { tone: 'quiet', icon: Moon, label: 'After dark' } : { tone: 'quiet', icon: CloudSun, label: 'Little sun either way' };
}

/** Sun time through one side's windows, with a bar for its share of the trip. */
function SideTile({ side, stats, best }: { side: SeatSide; stats: TripStats; best: boolean }) {
  const { sunMinutes } = stats.sides[side];
  const share = stats.minutes > 0 ? Math.min(1, sunMinutes / stats.minutes) : 0;
  return (
    <div className="rounded-2xl bg-raised px-3.5 py-3 ring-1 ring-hairline">
      <p className="flex items-center gap-1.5 text-xs font-medium text-ink-2">
        <span aria-hidden className={`h-0.5 w-3 rounded-full ${side === 'left' ? 'bg-sun-left' : 'bg-sun-right'}`} />
        {side === 'left' ? 'Left' : 'Right'} windows
        {best && <Check aria-label="the side to sit on" className="size-3.5 text-good" strokeWidth={3} />}
      </p>
      <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
        <span className="text-xl font-semibold tracking-tight whitespace-nowrap tabular-nums">
          {sunMinutes < 1 ? 'No sun' : <CountUp to={sunMinutes} format={(n) => shortDuration(Math.max(1, Math.round(n)))} />}
        </span>
        {sunMinutes >= 1 && <span className="text-xs text-muted">of direct sun</span>}
      </p>
      <div className="mt-2 h-1.5 rounded-full bg-hairline">
        <div
          className={`h-full origin-left animate-grow rounded-full ${side === 'left' ? 'bg-sun-left' : 'bg-sun-right'}`}
          style={{ width: `${share * 100}%`, animationDelay: '250ms' }}
        />
      </div>
    </div>
  );
}

/** "Start on the right, move left at 13:16", drawn as the trip with the move marked on it. */
function SeatChange({ change, start, end, clock }: { change: SeatSwitch; start: number; end: number; clock: ClockFormat }) {
  const at = Math.min(0.85, Math.max(0.15, (change.at - start) / (end - start)));
  return (
    <div className="mx-5 mb-5 rounded-2xl bg-raised p-4 ring-1 ring-hairline sm:mx-6">
      <p className="flex items-center gap-2 text-sm font-medium">
        <Repeat2 aria-hidden className="size-4 text-brand" />
        Can you change seats? Even better:
      </p>
      <div className="mt-3 flex h-10 gap-[2px] overflow-hidden rounded-xl text-xs font-semibold text-surface">
        <div className="flex items-center justify-center bg-ink" style={{ width: `${at * 100}%` }}>
          Sit {change.from}
        </div>
        <div className="flex flex-1 items-center justify-center bg-ink-2">Sit {change.to}</div>
      </div>
      <div className="relative mt-1.5 h-4 text-[11px] text-muted tabular-nums">
        <span className="absolute left-0">{clock(start)}</span>
        <span className="absolute -translate-x-1/2 font-medium text-ink-2" style={{ left: `${at * 100}%` }}>
          {clock(change.at)}
        </span>
        <span className="absolute right-0">{clock(end)}</span>
      </div>
      <p className="mt-2 text-sm text-ink-2">
        Move at about {clock(change.at)}, near km {Math.round(change.distance / 1000)}: that cuts the sun you feel by{' '}
        <span className="font-semibold text-ink">{Math.round(change.saving * 100)}%</span>.
      </p>
    </div>
  );
}

function CheckLine({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <p className="flex items-start gap-2.5">
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
      <span>{children}</span>
    </p>
  );
}

const capitalise = (text: string) => text[0].toUpperCase() + text.slice(1);
