import { duration, verdictLabel } from '../app/explain.ts';
import type { RouteResult } from '../app/plan.ts';

interface Props {
  results: RouteResult[];
  selected: number;
  onSelect: (index: number) => void;
}

export function RouteList({ results, selected, onSelect }: Props) {
  return (
    <section aria-labelledby="routes" className="rounded-2xl bg-surface p-5 shadow-sm ring-1 ring-ink/5">
      <h3 id="routes" className="text-sm font-medium text-ink-2">
        {results.length} routes found
      </h3>
      <div role="radiogroup" aria-labelledby="routes" className="mt-2 space-y-1">
        {results.map((r, i) => (
          <label
            key={i}
            className={`flex cursor-pointer items-baseline justify-between gap-3 rounded-lg px-3 py-2 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ink-2 ${
              i === selected ? 'bg-page font-medium' : 'hover:bg-page'
            }`}
          >
            <input type="radio" name="route" checked={i === selected} onChange={() => onSelect(i)} className="sr-only" />
            <span className="min-w-0">
              {Math.round(r.route.distance / 1000)} km {r.route.label}
            </span>
            <span className="shrink-0 text-ink-2 tabular-nums">
              {duration(r.stats.minutes)} · {verdictLabel(r.decision.sit, r.decision.confidence)}
            </span>
          </label>
        ))}
      </div>
    </section>
  );
}
