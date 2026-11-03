import { ArrowRight, Bus, Car, History } from 'lucide-react';
import type { RecentTrip } from './recent.ts';

interface Props {
  trips: RecentTrip[];
  onOpen: (trip: RecentTrip) => void;
  onClear: () => void;
}

/** The last few trips from this browser, one tap to see them again. */
export function RecentTrips({ trips, onOpen, onClear }: Props) {
  if (trips.length === 0) return null;
  return (
    <section aria-labelledby="recent" className="animate-rise">
      <div className="flex items-center justify-between px-1">
        <h2 id="recent" className="flex items-center gap-1.5 text-xs font-medium text-muted">
          <History aria-hidden className="size-3.5" />
          Your recent trips
        </h2>
        <button type="button" onClick={onClear} className="rounded-md px-1.5 py-0.5 text-xs text-muted transition-colors hover:bg-ink/[0.05] hover:text-ink">
          Clear
        </button>
      </div>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
        {trips.map((trip) => {
          const Icon = trip.vehicle === 'car' ? Car : Bus;
          return (
            <li key={trip.query}>
              <button
                type="button"
                onClick={() => onOpen(trip)}
                className="group flex w-full items-center gap-3 rounded-2xl bg-surface px-3 py-2.5 text-left shadow-sm ring-1 ring-hairline transition-[box-shadow,scale] duration-200 hover:shadow-md hover:ring-axis focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none active:scale-[0.98]"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-ink">
                  <Icon aria-hidden className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {trip.from} → {trip.to}
                  </span>
                  <span className="block truncate text-xs text-ink-2">{trip.when}</span>
                </span>
                <ArrowRight aria-hidden className="size-4 shrink-0 text-muted transition-[translate,color] group-hover:translate-x-0.5 group-hover:text-ink" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
