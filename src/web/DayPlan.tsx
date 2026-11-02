import { bandLabel, bandTimes, duration, type ClockFormat } from '../app/explain.ts';
import type { DayPlan } from '../app/plan.ts';
import type { Decision } from '../engine/decide.ts';
import type { Vehicle } from '../engine/timing.ts';
import { dayLabel } from './time.ts';

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

/** "Not sure when I leave": where to sit for every departure across the day, as runs of times. */
export function DayPlanView({ plan, start, vehicle, hours, clock, notes, onPick }: Props) {
  const sides = new Set(plan.bands.flatMap((band) => (band.sit === 'either' ? [] : [band.sit])));
  const headline =
    sides.size === 0 ? 'Either side, whenever you leave' : sides.size === 1 ? `Sit on the ${[...sides][0]}, whenever the sun's up` : 'It depends when you leave';
  const basis = hours ? `a ${duration(hours * 60)} trip` : `a typical ${vehicle} trip, ${plan.stretch.scale}× free-flowing traffic`;

  return (
    <section aria-labelledby="day-plan" className="rounded-2xl bg-surface p-5 shadow-sm ring-1 ring-ink/5">
      <p className="text-sm text-ink-2">
        {dayLabel(start)} · {basis}
      </p>
      <h2 id="day-plan" className="mt-1 text-[1.75rem] leading-tight font-semibold tracking-tight sm:text-3xl">
        {headline}
      </h2>
      <p className="mt-1 text-sm text-ink-2">If you leave at… (pick a time for the full answer)</p>
      <ul className="mt-3 divide-y divide-hairline">
        {plan.bands.map((band) => (
          <li key={band.from}>
            <button
              type="button"
              onClick={() => onPick(band.from)}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm hover:bg-page focus-visible:ring-2 focus-visible:ring-ink-2 focus-visible:outline-none"
            >
              <Seats sit={band.sit} />
              <span className="w-28 shrink-0 text-ink tabular-nums">{bandTimes(band, clock)}</span>
              <span className={band.sit === 'either' ? 'text-ink-2' : 'font-medium text-ink'}>{capitalise(bandLabel(band))}</span>
              <span aria-hidden className="ml-auto text-muted">
                ›
              </span>
            </button>
          </li>
        ))}
      </ul>
      {notes.length > 0 && (
        <div className="mt-3 space-y-1 border-t border-hairline pt-3 text-sm text-ink-2">
          {notes.map((note) => (
            <p key={note}>{note}</p>
          ))}
        </div>
      )}
    </section>
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
