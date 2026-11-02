import { useMemo, useRef, useState } from 'react';
import { planTrip, type TripPlan } from '../app/plan.ts';
import { lerp } from '../engine/geo.ts';
import type { Timing } from '../engine/timing.ts';
import type { LonLat } from '../engine/types.ts';
import { searchPlaces, type Place } from '../services/geocode.ts';
import { browserFetch } from './fetch.ts';
import { emptyField, type PlaceField } from './PlaceInput.tsx';
import { RouteList } from './RouteList.tsx';
import { RouteMap } from './RouteMap.tsx';
import { clockFormat, dateInput, fromInputs, nextQuarterHour, timeInput } from './time.ts';
import { Timeline } from './Timeline.tsx';
import { TripForm, type TripInput } from './TripForm.tsx';
import { Verdict } from './Verdict.tsx';

interface Trip {
  /** Start, via towns, end. */
  places: Place[];
  timing: Timing;
  plan: TripPlan;
  pinned: boolean;
}

type Status = { kind: 'idle' } | { kind: 'working'; message: string } | { kind: 'error'; message: string };

const NO_PLACES: Place[] = [];

function blankInput(): TripInput {
  const when = nextQuarterHour();
  return { from: emptyField, to: emptyField, vias: [], date: dateInput(when), time: timeInput(when), arrive: '', vehicle: 'bus' };
}

/** The trip from the planning discussion, tomorrow morning. */
function exampleInput(): TripInput {
  const ahmedabad: Place = { label: 'Ahmedabad, Gujarat, India', position: [72.5801, 23.0215], kind: 'city', country: 'India' };
  const himatnagar: Place = { label: 'Himatnagar, Gujarat, India', position: [72.9588, 23.5971], kind: 'town', country: 'India' };
  return {
    from: { text: ahmedabad.label, place: ahmedabad },
    to: { text: himatnagar.label, place: himatnagar },
    vias: [],
    date: dateInput(Date.now() + 86_400_000),
    time: '09:00',
    arrive: '11:00',
    vehicle: 'bus',
  };
}

export function App() {
  const [input, setInput] = useState<TripInput>(blankInput);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [trip, setTrip] = useState<Trip | null>(null);
  const [selected, setSelected] = useState(0);
  const answer = useRef<HTMLDivElement>(null);
  const clock = useMemo(() => (trip ? clockFormat(trip.timing.departure) : null), [trip]);

  async function run(value: TripInput) {
    try {
      setStatus({ kind: 'working', message: 'Finding the places…' });
      const from = await resolve(value.from);
      const to = await resolve(value.to);
      const middle = lerp(from.position, to.position, 0.5);
      const vias: Place[] = [];
      for (const via of value.vias) if (via.text.trim()) vias.push(await resolve(via, middle));
      // Show what was actually used for anything typed but not picked from the suggestions.
      const field = (place: Place): PlaceField => ({ text: place.label, place });
      setInput((current) => ({ ...current, from: field(from), to: field(to), vias: vias.map(field) }));

      const departure = fromInputs(value.date, value.time);
      if (Number.isNaN(departure)) throw new Error('Please choose a date and a time.');
      let arrival = value.arrive ? fromInputs(value.date, value.arrive) : undefined;
      if (arrival !== undefined && arrival <= departure) arrival += 86_400_000; // arrives the next day
      const timing: Timing = { departure, vehicle: value.vehicle, arrival };

      setStatus({ kind: 'working', message: 'Finding routes and working out the sun…' });
      const plan = await planTrip([from, ...vias, to].map((p) => p.position), timing, {}, browserFetch);
      setTrip({ places: [from, ...vias, to], timing, plan, pinned: vias.length > 0 });
      setSelected(0);
      setStatus({ kind: 'idle' });
      // On a phone the answer is below the form, so bring it into view.
      if (window.matchMedia('(max-width: 1023px)').matches) {
        requestAnimationFrame(() => answer.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      }
    } catch (err) {
      setStatus({ kind: 'error', message: friendly(err) });
    }
  }

  const busy = status.kind === 'working';
  // The last answer stays in place while a new one loads or fails, dimmed so it isn't mistaken for it.
  const stale = busy || status.kind === 'error' ? 'opacity-50' : '';
  return (
    <div className="min-h-dvh">
      <header className="mx-auto max-w-6xl px-4 pt-6 pb-4 sm:pt-10">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Sun Side</h1>
        <p className="mt-1 max-w-2xl text-ink-2">
          Which side of the bus or car should you sit on to stay out of the sun? It follows your real route minute by minute, with the sun's
          direction and height.
        </p>
      </header>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-4 pb-10 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start lg:gap-6">
        <div className="space-y-4">
          <TripForm
            value={input}
            onChange={setInput}
            onSubmit={() => run(input)}
            onExample={() => {
              const example = exampleInput();
              setInput(example);
              void run(example);
            }}
            busy={busy}
          />
          {status.kind === 'working' && (
            <p role="status" className="px-1 text-sm text-ink-2">
              {status.message}
            </p>
          )}
          {status.kind === 'error' && (
            <p role="alert" className="flex gap-2 rounded-xl bg-surface px-4 py-3 text-sm ring-1 ring-critical/40">
              <span aria-hidden className="text-critical">
                ⚠
              </span>
              <span>{status.message}</span>
            </p>
          )}
          {trip && clock && (
            <div ref={answer} className={`scroll-mt-4 space-y-4 transition-opacity ${stale}`}>
              <Verdict results={trip.plan.results} selected={selected} timing={trip.timing} clock={clock} pinned={trip.pinned} notes={trip.plan.notes} />
              {trip.plan.results.length > 1 && <RouteList results={trip.plan.results} selected={selected} onSelect={setSelected} />}
            </div>
          )}
        </div>

        <div className={`space-y-4 transition-opacity lg:sticky lg:top-4 ${stale}`}>
          <RouteMap results={trip?.plan.results ?? null} selected={selected} places={trip?.places ?? NO_PLACES} clock={clock} onSelect={setSelected} />
          {trip && clock && <Timeline result={trip.plan.results[selected]} clock={clock} />}
        </div>
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-10 text-xs leading-relaxed text-muted">
        Assumes a clear sky; weather comes next. Map © OpenFreeMap, OpenMapTiles and OpenStreetMap contributors. Routes by OSRM and Valhalla on
        FOSSGIS's public servers, places by Photon and Open-Meteo, sun position from NOAA's equations. All free services: please go easy on them.
      </footer>
    </div>
  );
}

/** A typed place that wasn't picked from the suggestions: take the best match. */
async function resolve(field: PlaceField, near?: LonLat): Promise<Place> {
  if (field.place) return field.place;
  const text = field.text.trim();
  const [best] = await searchPlaces(text, { limit: 1, near, fetchJson: browserFetch });
  if (!best) throw new Error(`Couldn't find "${text}". Try adding the district or state.`);
  return best;
}

function friendly(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/failed to fetch|networkerror|timed out|aborted|load failed|\b(429|502|503|504)\b/i.test(message)) {
    return "Couldn't reach the free routing or place-search servers; they're sometimes busy. Please try again in a moment.";
  }
  return message;
}
