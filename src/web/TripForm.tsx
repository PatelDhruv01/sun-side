import { lerp } from '../engine/geo.ts';
import type { Vehicle } from '../engine/timing.ts';
import { emptyField, PlaceInput, type PlaceField } from './PlaceInput.tsx';

export interface TripInput {
  from: PlaceField;
  to: PlaceField;
  vias: PlaceField[];
  date: string;
  /** 'at' leaves at `time`; 'day' isn't sure yet, so it works out the whole day. */
  when: 'at' | 'day';
  time: string;
  /** Arrival time from the ticket as HH:MM, or '' when not known. */
  arrive: string;
  /** For the whole day: how long the trip takes, in hours, or '' for a typical trip. */
  hours: string;
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

/** Two or more choices as one segmented control. */
function Segmented<T extends string>({ legend, name, options, value, onChange }: {
  legend: string;
  name: string;
  options: [T, string][];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className={LABEL}>{legend}</legend>
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-page p-1">
        {options.map(([option, label]) => (
          <label
            key={option}
            className={`cursor-pointer rounded-md py-2 text-center text-sm font-medium has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ink-2 ${
              value === option ? 'bg-surface text-ink shadow-sm' : 'text-ink-2'
            }`}
          >
            <input type="radio" name={name} value={option} checked={value === option} onChange={() => onChange(option)} className="sr-only" />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function TripForm({ value, onChange, onSubmit, onExample, busy }: Props) {
  const set = (patch: Partial<TripInput>) => onChange({ ...value, ...patch });
  const middle = value.from.place && value.to.place ? lerp(value.from.place.position, value.to.place.position, 0.5) : undefined;
  const ready =
    value.from.text.trim() !== '' && value.to.text.trim() !== '' && value.date !== '' && (value.when === 'day' || value.time !== '');

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

      <div className="mt-5">
        <Segmented
          legend="When"
          name="when"
          options={[
            ['at', 'At a set time'],
            ['day', 'Not sure yet'],
          ]}
          value={value.when}
          onChange={(when) => set({ when })}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="trip-date" className={LABEL}>
            Date
          </label>
          <input id="trip-date" type="date" required value={value.date} onChange={(e) => set({ date: e.target.value })} className={INPUT} />
        </div>
        {value.when === 'at' ? (
          <>
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
          </>
        ) : (
          <div>
            <label htmlFor="trip-hours" className={LABEL}>
              Takes, hours <span className="font-normal text-muted">optional</span>
            </label>
            <input
              id="trip-hours"
              type="number"
              inputMode="decimal"
              min="0.25"
              step="0.25"
              placeholder="e.g. 2.5"
              value={value.hours}
              onChange={(e) => set({ hours: e.target.value })}
              className={INPUT}
            />
          </div>
        )}
      </div>

      <div className="mt-5">
        <Segmented
          legend="Going by"
          name="vehicle"
          options={[
            ['bus', 'Bus'],
            ['car', 'Car'],
          ]}
          value={value.vehicle}
          onChange={(vehicle) => set({ vehicle })}
        />
      </div>

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
