import { useCallback, useMemo, useRef, useState } from 'react';
import { verdictLabel } from '../app/explain.ts';
import { planAt, planDay, prepareTrip, type DayPlan, type RouteResult, type TripContext } from '../app/plan.ts';
import { lerp } from '../engine/geo.ts';
import { SLOWER_THAN_OSRM, type Timing, type Vehicle } from '../engine/timing.ts';
import type { LonLat } from '../engine/types.ts';
import { searchPlaces, type Place } from '../services/geocode.ts';
import { DayPlanView } from './DayPlan.tsx';
import { browserFetch } from './fetch.ts';
import { emptyField, type PlaceField } from './PlaceInput.tsx';
import { RouteList, type RouteRow } from './RouteList.tsx';
import { RouteMap } from './RouteMap.tsx';
import { clockFormat, dateInput, fromInputs, nextQuarterHour, timeInput } from './time.ts';
import { Timeline } from './Timeline.tsx';
import { TripForm, type TripInput } from './TripForm.tsx';
import { Verdict } from './Verdict.tsx';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Not sure when yet: every departure across a day. */
interface DayView {
  kind: 'day';
  start: number;
  hours?: number;
  plan: DayPlan;
}

/** One departure time, on every route. */
interface AtView {
  kind: 'at';
  timing: Timing;
  results: RouteResult[];
  /** The whole-day view this time was picked from, if it was. */
  day?: DayView;
}

interface Trip {
  /** Start, via towns, end. */
  places: Place[];
  context: TripContext;
  pinned: boolean;
  vehicle: Vehicle;
  view: AtView | DayView;
}

type Status = { kind: 'idle' } | { kind: 'working'; message: string } | { kind: 'error'; message: string };

const NO_PLACES: Place[] = [];

function blankInput(): TripInput {
  const when = nextQuarterHour();
  return { from: emptyField, to: emptyField, vias: [], date: dateInput(when), when: 'at', time: timeInput(when), arrive: '', hours: '', vehicle: 'bus' };
}

/** The trip from the planning discussion, tomorrow morning. */
function exampleInput(): TripInput {
  const ahmedabad: Place = { label: 'Ahmedabad, Gujarat, India', position: [72.5801, 23.0215], kind: 'city', country: 'India' };
  const himatnagar: Place = { label: 'Himatnagar, Gujarat, India', position: [72.9588, 23.5971], kind: 'town', country: 'India' };
  return {
    from: { text: ahmedabad.label, place: ahmedabad },
    to: { text: himatnagar.label, place: himatnagar },
    vias: [],
    date: dateInput(Date.now() + DAY),
    when: 'at',
    time: '09:00',
    arrive: '11:00',
    hours: '',
    vehicle: 'bus',
  };
}

export function App() {
  const [input, setInput] = useState<TripInput>(blankInput);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [trip, setTrip] = useState<Trip | null>(null);
  const [selected, setSelected] = useState(0);
  const answer = useRef<HTMLDivElement>(null);
  const view = trip?.view;
  const clock = useMemo(() => (view ? clockFormat(view.kind === 'at' ? view.timing.departure : view.start) : null), [view]);

  /** On a phone the answer is below the form, so bring it into view. */
  const showAnswer = () => {
    if (window.matchMedia('(max-width: 1023px)').matches) {
      requestAnimationFrame(() => answer.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  };

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
      const places = [from, ...vias, to];
      const points = places.map((p) => p.position);
      const base = { places, pinned: vias.length > 0, vehicle: value.vehicle };

      if (value.when === 'day') {
        const start = fromInputs(value.date, '00:00');
        if (Number.isNaN(start)) throw new Error('Please choose a date.');
        const hours = value.hours.trim() ? Number(value.hours) : undefined;
        if (hours !== undefined && !(hours > 0)) throw new Error('The trip length should be a number of hours, like 2.5.');
        setStatus({ kind: 'working', message: 'Finding routes and the forecast…' });
        const context = await prepareTrip(points, { from: start, to: start + DAY }, { fetchJson: browserFetch });
        setStatus({ kind: 'working', message: 'Working out every departure that day…' });
        await nextFrame(); // let that show before the sums take over
        const plan = planDay(context, 0, { start, vehicle: value.vehicle, hours });
        setTrip({ ...base, context, view: { kind: 'day', start, hours, plan } });
      } else {
        const departure = fromInputs(value.date, value.time);
        if (Number.isNaN(departure)) throw new Error('Please choose a date and a time.');
        let arrival = value.arrive ? fromInputs(value.date, value.arrive) : undefined;
        if (arrival !== undefined && arrival <= departure) arrival += DAY; // arrives the next day
        const timing: Timing = { departure, vehicle: value.vehicle, arrival };
        setStatus({ kind: 'working', message: 'Finding routes and the forecast…' });
        const context = await prepareTrip(points, { from: departure, to: departure }, { fetchJson: browserFetch });
        setTrip({ ...base, context, view: { kind: 'at', timing, results: planAt(context, timing) } });
      }
      setSelected(0);
      setStatus({ kind: 'idle' });
      showAnswer();
    } catch (err) {
      setStatus({ kind: 'error', message: friendly(err) });
    }
  }

  /** From the whole day to one departure: the routes and forecast are already here. */
  function pickDeparture(departure: number) {
    if (!trip || trip.view.kind !== 'day') return;
    const day = trip.view;
    const arrival = day.hours ? departure + day.hours * HOUR : undefined;
    const timing: Timing = { departure, vehicle: trip.vehicle, arrival };
    setTrip({ ...trip, view: { kind: 'at', timing, results: planAt(trip.context, timing), day } });
    setInput((current) => ({ ...current, when: 'at', date: dateInput(departure), time: timeInput(departure), arrive: arrival ? timeInput(arrival) : '' }));
    showAnswer();
  }

  function backToDay() {
    if (!trip || trip.view.kind !== 'at' || !trip.view.day) return;
    const { start, hours } = trip.view.day;
    const plan = planDay(trip.context, selected, { start, vehicle: trip.vehicle, hours });
    setTrip({ ...trip, view: { kind: 'day', start, hours, plan } });
    setInput((current) => ({ ...current, when: 'day', date: dateInput(start), hours: hours ? String(hours) : '' }));
  }

  function selectRoute(index: number) {
    setSelected(index);
    if (trip?.view.kind === 'day') {
      const { start, hours } = trip.view;
      setTrip({ ...trip, view: { kind: 'day', start, hours, plan: planDay(trip.context, index, { start, vehicle: trip.vehicle, hours }) } });
    }
  }
  // The map keeps one handler; it always reaches the latest selectRoute.
  const latestSelect = useRef(selectRoute);
  latestSelect.current = selectRoute;
  const onMapSelect = useCallback((index: number) => latestSelect.current(index), []);

  const rows: RouteRow[] | null =
    trip && trip.context.routes.length > 1
      ? trip.context.routes.map((route, i) => {
          if (trip.view.kind === 'at') {
            const { stats, decision } = trip.view.results[i];
            return { distance: route.distance, label: route.label, minutes: stats.minutes, verdict: verdictLabel(decision.sit, decision.confidence) };
          }
          const seconds = route.segmentDurations.reduce((a, b) => a + b, 0);
          const minutes = trip.view.hours ? trip.view.hours * 60 : (seconds * SLOWER_THAN_OSRM[trip.vehicle]) / 60;
          return { distance: route.distance, label: route.label, minutes };
        })
      : null;

  const busy = status.kind === 'working';
  // The last answer stays in place while a new one loads or fails, dimmed so it isn't mistaken for it.
  const stale = busy || status.kind === 'error' ? 'opacity-50' : '';
  return (
    <div className="min-h-dvh">
      <header className="mx-auto max-w-6xl px-4 pt-6 pb-4 sm:pt-10">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Sun Side</h1>
        <p className="mt-1 max-w-2xl text-ink-2">
          Which side of the bus or car should you sit on to stay out of the sun? It follows your real route minute by minute, with the sun's
          direction and height, and the weather forecast.
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
              {trip.view.kind === 'day' ? (
                <DayPlanView
                  plan={trip.view.plan}
                  start={trip.view.start}
                  vehicle={trip.vehicle}
                  hours={trip.view.hours}
                  clock={clock}
                  notes={trip.context.notes}
                  onPick={pickDeparture}
                />
              ) : (
                <Verdict
                  context={trip.context}
                  results={trip.view.results}
                  selected={selected}
                  timing={trip.view.timing}
                  clock={clock}
                  pinned={trip.pinned}
                  onBackToDay={trip.view.day ? backToDay : undefined}
                />
              )}
              {rows && <RouteList rows={rows} selected={selected} onSelect={selectRoute} />}
            </div>
          )}
        </div>

        <div className={`space-y-4 transition-opacity lg:sticky lg:top-4 ${stale}`}>
          <RouteMap
            routes={trip?.context.routes ?? null}
            selected={selected}
            passes={trip?.view.kind === 'at' ? trip.view.results[selected].passes : null}
            places={trip?.places ?? NO_PLACES}
            clock={clock}
            onSelect={onMapSelect}
          />
          {trip?.view.kind === 'at' && clock && <Timeline result={trip.view.results[selected]} clock={clock} weather={trip.context.weather} />}
        </div>
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-10 text-xs leading-relaxed text-muted">
        Uses Open-Meteo's forecast for dates up to about two weeks ahead, and a clear sky beyond that. Map © OpenFreeMap, OpenMapTiles and
        OpenStreetMap contributors. Routes by OSRM and Valhalla on FOSSGIS's public servers, places by Photon and Open-Meteo, sun position from
        NOAA's equations. All free services: please go easy on them.
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

/** Resolves after the browser has painted, so a status message shows before heavy work starts. */
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve)));

function friendly(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/failed to fetch|networkerror|timed out|aborted|load failed|\b(429|502|503|504)\b/i.test(message)) {
    return "Couldn't reach the free routing or place-search servers; they're sometimes busy. Please try again in a moment.";
  }
  return message;
}
