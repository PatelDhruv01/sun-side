import { duration } from '../app/explain.ts';

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
    <section aria-labelledby="routes" className="rounded-2xl bg-surface p-5 shadow-sm ring-1 ring-ink/5">
      <h3 id="routes" className="text-sm font-medium text-ink-2">
        {rows.length} routes found
      </h3>
      <div role="radiogroup" aria-labelledby="routes" className="mt-2 space-y-1">
        {rows.map((row, i) => (
          <label
            key={i}
            className={`flex cursor-pointer items-baseline justify-between gap-3 rounded-lg px-3 py-2 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ink-2 ${
              i === selected ? 'bg-page font-medium' : 'hover:bg-page'
            }`}
          >
            <input type="radio" name="route" checked={i === selected} onChange={() => onSelect(i)} className="sr-only" />
            <span className="min-w-0">
              {Math.round(row.distance / 1000)} km {row.label}
            </span>
            <span className="shrink-0 text-ink-2 tabular-nums">
              {duration(row.minutes)}
              {row.verdict && ` · ${row.verdict}`}
            </span>
          </label>
        ))}
      </div>
    </section>
  );
}
