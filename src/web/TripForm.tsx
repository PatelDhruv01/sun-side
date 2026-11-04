import { ArrowRight, ArrowUpDown, Bus, Car, CircleDot, LoaderCircle, MapPin, Plus, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { lerp } from '../engine/geo.ts';
import type { Vehicle } from '../engine/timing.ts';
import { emptyField, FIELD_INPUT, FIELD_LABEL, PlaceInput, type PlaceField } from './PlaceInput.tsx';
import { dateInput, timeInput } from './time.ts';
import { CARD } from './ui.tsx';

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

/** A ready-made trip to try. */
export interface Example {
  label: string;
  input: () => TripInput;
}

interface Props {
  value: TripInput;
  onChange: (value: TripInput) => void;
  onSubmit: () => void;
  busy: boolean;
  /** Quick-start trips under the button. */
  examples?: Example[];
  onExample?: (input: TripInput) => void;
}

const DAY = 86_400_000;

export function TripForm({ value, onChange, onSubmit, busy, examples, onExample }: Props) {
  const set = (patch: Partial<TripInput>) => onChange({ ...value, ...patch });
  const middle = value.from.place && value.to.place ? lerp(value.from.place.position, value.to.place.position, 0.5) : undefined;
  const ready =
    value.from.text.trim() !== '' && value.to.text.trim() !== '' && value.date !== '' && (value.when === 'day' || value.time !== '');
  // A bus has a ticket and a road of its own; in a car it's your road.
  const car = value.vehicle === 'car';
  const throughTown = car ? 'A town you’ll go through' : 'A town the bus goes through';
  const today = dateInput(Date.now());
  const tomorrow = dateInput(Date.now() + DAY);
  const now = () => {
    const soon = Math.ceil(Date.now() / 300_000) * 300_000; // the next five minutes
    set({ date: dateInput(soon), time: timeInput(soon) });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (ready && !busy) onSubmit();
      }}
      className={`${CARD} @container p-4 sm:p-6`}
    >
      {/* when and how, side by side once the form is wide enough */}
      <div className="grid gap-2 @md:grid-cols-[minmax(0,1fr)_minmax(0,11rem)]">
        <Segmented
          legend="When are you leaving?"
          hideLegend
          name="when"
          options={[
            { value: 'at', label: 'At a set time' },
            { value: 'day', label: 'Not sure yet' },
          ]}
          value={value.when}
          onChange={(when) => set({ when })}
        />
        <Segmented
          legend="Going by"
          hideLegend
          name="vehicle"
          options={[
            { value: 'bus', label: 'Bus', icon: Bus },
            { value: 'car', label: 'Car', icon: Car },
          ]}
          value={value.vehicle}
          onChange={(vehicle) => set({ vehicle })}
        />
      </div>

      <div className="mt-5 space-y-3">
        <PlaceInput label="From" icon={<CircleDot className="size-4" />} field={value.from} onChange={(from) => set({ from })} placeholder="e.g. Ahmedabad" />
        {value.vias.map((via, i) => (
          <PlaceInput
            key={i}
            label="Via"
            icon={<MapPin className="size-4" />}
            field={via}
            near={middle}
            placeholder={throughTown}
            onChange={(field) => set({ vias: value.vias.map((v, j) => (j === i ? field : v)) })}
            action={<LabelButton onClick={() => set({ vias: value.vias.filter((_, j) => j !== i) })}>Remove</LabelButton>}
          />
        ))}
        <PlaceInput
          label="To"
          icon={<MapPin className="size-4" />}
          field={value.to}
          onChange={(to) => set({ to })}
          placeholder="e.g. Himatnagar"
          action={
            <LabelButton icon={ArrowUpDown} onClick={() => set({ from: value.to, to: value.from, vias: [...value.vias].reverse() })}>
              Swap
            </LabelButton>
          }
        />
        <button
          type="button"
          onClick={() => set({ vias: [...value.vias, emptyField] })}
          className="inline-flex items-center gap-1.5 rounded-lg py-1 text-sm font-medium text-ink-2 hover:text-ink"
        >
          <Plus aria-hidden className="size-4" />
          Add {throughTown[0].toLowerCase() + throughTown.slice(1)}
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 @md:grid-cols-3">
        <Field
          id="trip-date"
          label="Date"
          action={
            <span className="flex gap-0.5">
              <LabelButton pressed={value.date === today} onClick={() => set({ date: today })}>
                Today
              </LabelButton>
              <LabelButton pressed={value.date === tomorrow} onClick={() => set({ date: tomorrow })}>
                Tomorrow
              </LabelButton>
            </span>
          }
        >
          <input id="trip-date" type="date" required value={value.date} onChange={(e) => set({ date: e.target.value })} className={FIELD_INPUT} />
        </Field>
        {value.when === 'at' ? (
          <>
            <Field id="trip-time" label="Leaves at" action={<LabelButton onClick={now}>Now</LabelButton>}>
              <input id="trip-time" type="time" required value={value.time} onChange={(e) => set({ time: e.target.value })} className={FIELD_INPUT} />
            </Field>
            <Field
              id="trip-arrive"
              label="Arrives at"
              hint={
                <>
                  <span className="@md:hidden">{car ? 'optional, if you know it' : 'optional, from your ticket'}</span>
                  <span className="hidden @md:inline">optional</span>
                </>
              }
              className="col-span-2 @md:col-span-1"
            >
              <input id="trip-arrive" type="time" value={value.arrive} onChange={(e) => set({ arrive: e.target.value })} className={FIELD_INPUT} />
            </Field>
          </>
        ) : (
          <Field id="trip-hours" label="Takes" hint="hours, optional" className="@md:col-span-2">
            <input
              id="trip-hours"
              type="number"
              inputMode="decimal"
              min="0.25"
              step="0.25"
              placeholder="e.g. 2.5"
              value={value.hours}
              onChange={(e) => set({ hours: e.target.value })}
              className={FIELD_INPUT}
            />
          </Field>
        )}
      </div>

      <button
        type="submit"
        disabled={!ready || busy}
        className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-ink text-base font-semibold text-surface shadow-sm transition-colors hover:bg-ink/85 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:outline-none disabled:opacity-50"
      >
        {busy ? (
          <>
            <LoaderCircle aria-hidden className="size-5 animate-spin" />
            Working it out…
          </>
        ) : (
          <>
            {value.when === 'day' ? 'Show the whole day' : 'Find the shady side'}
            <ArrowRight aria-hidden className="size-5" />
          </>
        )}
      </button>

      {examples && onExample && (
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-muted">Try</span>
          {examples.map((example) => (
            <button
              key={example.label}
              type="button"
              onClick={() => onExample(example.input())}
              className="rounded-full bg-ink/[0.045] px-3 py-1.5 text-xs font-medium text-ink-2 transition-colors hover:bg-ink/[0.09] hover:text-ink"
            >
              {example.label}
            </button>
          ))}
        </div>
      )}
    </form>
  );
}

/** A label line with an optional hint and a small control on the right, over one input. */
function Field({ id, label, hint, action, className = '', children }: {
  id: string;
  label: string;
  hint?: ReactNode;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <div className="flex items-end justify-between gap-2">
        <label htmlFor={id} className={FIELD_LABEL}>
          {label}
          {hint && <span className="font-normal text-muted"> · {hint}</span>}
        </label>
        {action}
      </div>
      {children}
    </div>
  );
}

function LabelButton({ onClick, pressed, icon: Icon, children }: { onClick: () => void; pressed?: boolean; icon?: LucideIcon; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={`mb-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium transition-colors ${
        pressed ? 'bg-ink text-surface' : 'text-ink-2 hover:bg-ink/[0.06] hover:text-ink'
      }`}
    >
      {Icon && <Icon aria-hidden className="size-3.5" />}
      {children}
    </button>
  );
}

/** Two or more choices as one segmented control. */
function Segmented<T extends string>({ legend, hideLegend, name, options, value, onChange }: {
  legend: string;
  hideLegend?: boolean;
  name: string;
  options: { value: T; label: string; icon?: LucideIcon }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className={hideLegend ? 'sr-only' : FIELD_LABEL}>{legend}</legend>
      <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-ink/[0.045] p-1">
        {options.map(({ value: option, label, icon: Icon }) => (
          <label
            key={option}
            className={`flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg text-sm font-medium transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand ${
              value === option ? 'bg-surface text-ink shadow-sm ring-1 ring-ink/5' : 'text-ink-2 hover:text-ink'
            }`}
          >
            <input type="radio" name={name} value={option} checked={value === option} onChange={() => onChange(option)} className="sr-only" />
            {Icon && <Icon aria-hidden className="size-4" />}
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
