import { Route } from 'lucide-react';
import { duration } from '../app/explain.ts';
import { CARD } from './ui.tsx';

export interface RouteRow {
  /** Metres. */
  distance: number;
  label: string;
  minutes: number;
  /** The verdict on this route, when there is one departure time to judge. */
  verdict?: string;
}

interface Props {
  rows: RouteRow[];
  selected: number;
  onSelect: (index: number) => void;
}

export function RouteList({ rows, selected, onSelect }: Props) {
  return (
    <section aria-labelledby="routes" className={`${CARD} p-5 sm:p-6`}>
      <h3 id="routes" className="flex items-center gap-2 text-sm font-semibold">
        <Route aria-hidden className="size-4 text-muted" />
        {rows.length} routes found
      </h3>
      <div role="radiogroup" aria-labelledby="routes" className="mt-3 space-y-1.5">
        {rows.map((row, i) => (
          <label
            key={i}
            className={`flex cursor-pointer items-center justify-between gap-3 rounded-2xl px-3.5 py-3 text-sm ring-1 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand ${
              i === selected ? 'bg-raised font-medium ring-ink/20' : 'ring-hairline hover:bg-raised'
            }`}
          >
            <input type="radio" name="route" checked={i === selected} onChange={() => onSelect(i)} className="sr-only" />
            <span className={`size-4 shrink-0 rounded-full ring-1 ${i === selected ? 'bg-ink ring-ink ring-offset-2 ring-offset-raised' : 'ring-axis'}`} />
            <span className="min-w-0 flex-1">
              {Math.round(row.distance / 1000)} km {row.label}
            </span>
            <span className="shrink-0 text-right text-ink-2 tabular-nums">
              {duration(row.minutes)}
              {row.verdict && <span className="block text-xs">{row.verdict}</span>}
            </span>
          </label>
        ))}
      </div>
    </section>
  );
}
