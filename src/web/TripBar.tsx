import { ArrowRight, Pencil, Repeat2, Share2 } from 'lucide-react';
import type { Place } from '../services/geocode.ts';
import { CARD, Button } from './ui.tsx';

interface Props {
  /** Start, via towns, end. */
  places: Place[];
  /** E.g. "Wed 4 Nov · 09:00 → 11:00 · Bus". */
  summary: string;
  editing: boolean;
  onEdit: () => void;
  onReturn: () => void;
  onShare: () => void;
}

/** The trip in one line at the top of the results, with what you can do next. */
export function TripBar({ places, summary, editing, onEdit, onReturn, onShare }: Props) {
  const from = places[0];
  const to = places[places.length - 1];
  const vias = places.slice(1, -1);
  return (
    <div className={`${CARD} flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-4`}>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 text-lg font-semibold tracking-tight">
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
  );
}

/** The first part of a place's name: "Ahmedabad" from "Ahmedabad, Gujarat, India". */
export const short = (place: Place) => place.label.split(',')[0];
