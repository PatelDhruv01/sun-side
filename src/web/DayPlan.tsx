import { CalendarDays, ChevronRight, Info } from 'lucide-react';
import { bandLabel, bandTimes, type ClockFormat } from '../app/explain.ts';
import type { DayPlan } from '../app/plan.ts';
import type { Decision } from '../engine/decide.ts';
import type { DepartureVerdict } from '../engine/sweep.ts';
import type { Vehicle } from '../engine/timing.ts';
import { dayLabel, shortDuration } from './time.ts';
import { CARD, Pill } from './ui.tsx';

interface Props {
  plan: DayPlan;
  start: number;
  vehicle: Vehicle;
  hours?: number;
  clock: ClockFormat;
  notes: string[];
  /** Show the full answer for a departure time. */
  onPick: (departure: number) => void;
}

/** "Not sure when I leave": where to sit for every departure across the day. */
export function DayPlanView({ plan, start, vehicle, hours, clock, notes, onPick }: Props) {
  const sides = new Set(plan.bands.flatMap((band) => (band.sit === 'either' ? [] : [band.sit])));
  const headline =
    sides.size === 0 ? 'Either side, whenever you leave' : sides.size === 1 ? `Sit on the ${[...sides][0]}, whenever the sun's up` : 'It depends when you leave';
  const basis = hours ? `${shortDuration(hours * 60)} trip` : `typical ${vehicle} trip`;

  return (
    <section aria-labelledby="day-plan" className={`${CARD} animate-rise p-5 sm:p-6`}>
      <Pill icon={CalendarDays}>
        {dayLabel(start)} · {basis}
      </Pill>
      <h2 id="day-plan" className="mt-3 text-[2.1rem] leading-[1.05] font-semibold tracking-[-0.03em] sm:text-[2.6rem]">
        {headline}
      </h2>
      <p className="mt-2 text-ink-2">Every departure that day, half an hour apart. Pick a time for the full answer.</p>

      <DayStrip verdicts={plan.verdicts} clock={clock} onPick={onPick} />

      <ul className="mt-6 divide-y divide-hairline rounded-2xl ring-1 ring-hairline">
        {plan.bands.map((band) => (
          <li key={band.from}>
            <button
              type="button"
              onClick={() => onPick(band.from)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors first:rounded-t-2xl hover:bg-raised focus-visible:bg-raised focus-visible:outline-none"
            >
              <Seats sit={band.sit} />
              <span className="w-28 shrink-0 text-ink tabular-nums">{bandTimes(band, clock)}</span>
              <span className={band.sit === 'either' ? 'text-ink-2' : 'font-semibold text-ink'}>{capitalise(bandLabel(band))}</span>
              <ChevronRight aria-hidden className="ml-auto size-4 shrink-0 text-muted" />
            </button>
          </li>
        ))}
      </ul>

      {notes.length > 0 && (
        <div className="mt-4 space-y-2 text-sm text-ink-2">
          {notes.map((note) => (
            <p key={note} className="flex items-start gap-2.5">
              <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
              {note}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}

/** Where the sun will be on the trip, for each half hour you could leave: like the map's colours. */
function DayStrip({ verdicts, clock, onPick }: { verdicts: DepartureVerdict[]; clock: ClockFormat; onPick: (departure: number) => void }) {
  return (
    // The list below says the same in words and is what keyboards and screen readers use.
    <div className="mt-6" aria-hidden>
      <div className="flex h-12 gap-[2px]">
        {verdicts.map((v, i) => (
          // the cells fill in from midnight onwards; the wrapper keeps the faded ones faded
          <span key={v.departure} className="flex flex-1 animate-fade first:*:rounded-l-xl last:*:rounded-r-xl" style={{ animationDelay: `${150 + i * 14}ms` }}>
            <button
              type="button"
              tabIndex={-1}
              onClick={() => onPick(v.departure)}
              title={`${clock(v.departure)}: ${describe(v)}`}
              className={`flex-1 transition-[opacity,scale] duration-200 hover:scale-y-110 hover:opacity-70 ${fill(v)} ${v.confidence === 'slight' ? 'opacity-55' : ''}`}
            />
          </span>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-muted tabular-nums">
        {['00:00', '06:00', '12:00', '18:00', '24:00'].map((tick) => (
          <span key={tick}>{tick}</span>
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-2">
        <Key swatch="bg-sun-right">Sun on the right: sit left</Key>
        <Key swatch="bg-sun-left">Sun on the left: sit right</Key>
        <Key swatch="bg-weak">Little difference</Key>
        <Key swatch="bg-night">Dark</Key>
        <Key swatch="bg-ink-2 opacity-55">Faded: only slightly</Key>
      </ul>
    </div>
  );
}

function fill(v: DepartureVerdict): string {
  if (v.sit === 'left') return 'bg-sun-right';
  if (v.sit === 'right') return 'bg-sun-left';
  return v.daylight < 1 ? 'bg-night' : 'bg-weak';
}

function describe(v: DepartureVerdict): string {
  if (v.sit !== 'either') return `sit ${v.sit}${v.confidence === 'slight' ? ' (slightly)' : ''}`;
  return v.daylight < 1 ? 'either side, after dark' : 'either side';
}

function Key({ swatch, children }: { swatch: string; children: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <span className={`size-2.5 rounded-sm ${swatch}`} />
      {children}
    </li>
  );
}

/** Two seats side by side, the one to take filled in. */
function Seats({ sit }: { sit: Decision['sit'] }) {
  const seat = (side: 'left' | 'right', x: number) => (
    <rect x={x} y="3" width="7" height="10" rx="2" strokeWidth="1.5" className={sit === side ? 'fill-ink stroke-ink' : 'fill-none stroke-axis'} />
  );
  return (
    <svg viewBox="0 0 20 16" className="h-4 w-5 shrink-0" aria-hidden>
      {seat('left', 1.5)}
      {seat('right', 11.5)}
    </svg>
  );
}

const capitalise = (text: string) => text[0].toUpperCase() + text.slice(1);
