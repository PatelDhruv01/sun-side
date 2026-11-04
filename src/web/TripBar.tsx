import { ArrowRight, Pencil, Repeat2, Share2, type LucideIcon } from 'lucide-react';
import type { Place } from '../services/geocode.ts';
import { CARD, Button, CountUp, stagger } from './ui.tsx';

/** One figure about the trip, e.g. "84 km by road"; numbers count up when they first show. */
export interface Fact {
  icon: LucideIcon;
  value: string;
  label: string;
  count?: { to: number; format: (n: number) => string };
}

interface Props {
  /** Start, via towns, end. */
  places: Place[];
  /** E.g. "Wed 4 Nov · 09:00 → 11:00 · Bus". */
  summary: string;
  facts: Fact[];
  editing: boolean;
  onEdit: () => void;
  onReturn: () => void;
  onShare: () => void;
}

/** The trip at the top of the results: where, when, a few figures, and what you can do next. */
export function TripBar({ places, summary, facts, editing, onEdit, onReturn, onShare }: Props) {
  const from = places[0];
  const to = places[places.length - 1];
  const vias = places.slice(1, -1);
  return (
    <div className={`${CARD} animate-rise p-2`}>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-3 pt-2 pb-3 sm:px-4">
        {/* at least 16rem wide, so on a phone the buttons move under the trip instead of squeezing it */}
        <div className="min-w-0 flex-[1_1_16rem]">
          <p className="flex flex-wrap items-center gap-x-2 text-lg font-semibold tracking-tight sm:text-xl">
            <span title={from.label}>{short(from)}</span>
            <ArrowRight aria-label="to" className="size-4 text-muted" />
            <span title={to.label}>{short(to)}</span>
          </p>
          <p className="mt-0.5 text-sm text-ink-2">
            {vias.length > 0 && `via ${vias.map(short).join(', ')} · `}
            {summary}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button icon={Pencil} onClick={onEdit} aria-expanded={editing}>
            {editing ? 'Close' : 'Edit'}
          </Button>
          <Button icon={Repeat2} onClick={onReturn}>
            Return trip
          </Button>
          <Button icon={Share2} onClick={onShare}>
            Share
          </Button>
        </div>
      </div>
      {facts.length > 0 && (
        <ul className={`grid grid-cols-2 gap-px overflow-hidden rounded-[1.1rem] bg-hairline ring-1 ring-hairline ${facts.length === 4 ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
          {facts.map(({ icon: Icon, value, label, count }, i) => (
            <li key={label} className="animate-rise bg-raised px-4 py-3" style={stagger(i + 1, 60)}>
              <p className="text-xl font-semibold tracking-tight tabular-nums">{count ? <CountUp to={count.to} format={count.format} /> : value}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-2">
                <Icon aria-hidden className="size-3.5 shrink-0 text-muted" />
                {label}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The first part of a place's name: "Ahmedabad" from "Ahmedabad, Gujarat, India". */
export const short = (place: Place) => place.label.split(',')[0];
