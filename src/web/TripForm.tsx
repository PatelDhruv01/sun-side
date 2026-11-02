import { lerp } from '../engine/geo.ts';
import type { Vehicle } from '../engine/timing.ts';
import { emptyField, PlaceInput, type PlaceField } from './PlaceInput.tsx';

export interface TripInput {
  from: PlaceField;
  to: PlaceField;
  vias: PlaceField[];
  date: string;
  time: string;
  /** Arrival time from the ticket as HH:MM, or '' when not known. */
  arrive: string;
  vehicle: Vehicle;
}

interface Props {
  value: TripInput;
  onChange: (value: TripInput) => void;
  onSubmit: () => void;
  onExample: () => void;
  busy: boolean;
}

const LABEL = 'mb-1 block text-sm font-medium text-ink-2';
const INPUT = 'w-full rounded-lg border border-hairline bg-page px-3 py-2.5 text-base outline-none focus:border-ink-2';
const LINK = 'underline decoration-axis underline-offset-4 hover:text-ink';

export function TripForm({ value, onChange, onSubmit, onExample, busy }: Props) {
  const set = (patch: Partial<TripInput>) => onChange({ ...value, ...patch });
  const middle = value.from.place && value.to.place ? lerp(value.from.place.position, value.to.place.position, 0.5) : undefined;
  const ready = value.from.text.trim() !== '' && value.to.text.trim() !== '' && value.date !== '' && value.time !== '';

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (ready && !busy) onSubmit();
      }}
      className="rounded-2xl bg-surface p-5 shadow-sm ring-1 ring-ink/5"
    >
      <div className="space-y-3">
        <PlaceInput label="From" field={value.from} onChange={(from) => set({ from })} placeholder="e.g. Ahmedabad" />
        {value.vias.map((via, i) => (
          <div key={i} className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <PlaceInput
                label="Via"
                field={via}
                near={middle}
                placeholder="a town the bus goes through"
                onChange={(field) => set({ vias: value.vias.map((v, j) => (j === i ? field : v)) })}
              />
            </div>
            <button
              type="button"
              aria-label="Remove this town"
              onClick={() => set({ vias: value.vias.filter((_, j) => j !== i) })}
              className="mb-0.5 rounded-lg px-3 py-2.5 text-ink-2 hover:bg-page hover:text-ink"
            >
              ✕
            </button>
          </div>
        ))}
        <PlaceInput label="To" field={value.to} onChange={(to) => set({ to })} placeholder="e.g. Himatnagar" />
        <button type="button" onClick={() => set({ vias: [...value.vias, emptyField] })} className={`text-sm font-medium text-ink-2 ${LINK}`}>
          + Add a town the bus goes through
        </button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="trip-date" className={LABEL}>
            Date
          </label>
          <input id="trip-date" type="date" required value={value.date} onChange={(e) => set({ date: e.target.value })} className={INPUT} />
        </div>
        <div>
          <label htmlFor="trip-time" className={LABEL}>
            Leaves at
          </label>
          <input id="trip-time" type="time" required value={value.time} onChange={(e) => set({ time: e.target.value })} className={INPUT} />
        </div>
        <div className="col-span-2">
          <label htmlFor="trip-arrive" className={LABEL}>
            Arrives at <span className="font-normal text-muted">optional, from your ticket</span>
          </label>
          <input id="trip-arrive" type="time" value={value.arrive} onChange={(e) => set({ arrive: e.target.value })} className={INPUT} />
        </div>
      </div>

      <fieldset className="mt-5">
        <legend className={LABEL}>Going by</legend>
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-page p-1">
          {(['bus', 'car'] as const).map((vehicle) => (
            <label
              key={vehicle}
              className={`cursor-pointer rounded-md py-2 text-center text-sm font-medium has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ink-2 ${
                value.vehicle === vehicle ? 'bg-surface text-ink shadow-sm' : 'text-ink-2'
              }`}
            >
              <input
                type="radio"
                name="vehicle"
                value={vehicle}
                checked={value.vehicle === vehicle}
                onChange={() => set({ vehicle })}
                className="sr-only"
              />
              {vehicle === 'bus' ? 'Bus' : 'Car'}
            </label>
          ))}
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={!ready || busy}
        className="mt-6 w-full rounded-xl bg-ink px-4 py-3 text-base font-semibold text-surface transition-opacity disabled:opacity-50"
      >
        {busy ? 'Working it out…' : 'Find the shady side'}
      </button>
      <p className="mt-3 text-center text-sm text-ink-2">
        or{' '}
        <button type="button" onClick={onExample} className={LINK}>
          try Ahmedabad → Himatnagar
        </button>
      </p>
    </form>
  );
}
