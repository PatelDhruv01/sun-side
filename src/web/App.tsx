import { TriangleAlert } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { verdictLabel } from '../app/explain.ts';
import { planAt, planDay, prepareTrip, type DayPlan, type RouteResult, type TripContext } from '../app/plan.ts';
import { lerp } from '../engine/geo.ts';
import { SLOWER_THAN_OSRM, type Timing, type Vehicle } from '../engine/timing.ts';
import type { LonLat } from '../engine/types.ts';
import { searchPlaces, type Place } from '../services/geocode.ts';
import { DayPlanView } from './DayPlan.tsx';
import { browserFetch } from './fetch.ts';
import { Footer } from './Footer.tsx';
import { Header } from './Header.tsx';
import { Landing } from './Landing.tsx';
import { emptyField, type PlaceField } from './PlaceInput.tsx';
import { Progress, ResultsSkeleton } from './Progress.tsx';
import { RouteList, type RouteRow } from './RouteList.tsx';
import { clockFormat, dateInput, dayLabel, fromInputs, nextQuarterHour, timeInput } from './time.ts';
import { Timeline } from './Timeline.tsx';
import { Toast } from './Toast.tsx';
import { short, TripBar } from './TripBar.tsx';
import { TripForm, type Example, type TripInput } from './TripForm.tsx';
import { Button, CARD } from './ui.tsx';
import { readTripQuery, tripQuery } from './url.ts';
import { Verdict } from './Verdict.tsx';

// MapLibre is most of the page's weight, so it only loads once there's a route to show.
const RouteMap = lazy(() => import('./RouteMap.tsx').then((module) => ({ default: module.RouteMap })));

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

/** While working, `step` is the Progress step under way. */
type Status = { kind: 'idle' } | { kind: 'working'; step: number } | { kind: 'error'; message: string };

/** How a trip's address goes into the browser's history. */
type History = 'push' | 'replace' | 'none';

const NO_PLACES: Place[] = [];

const place = (label: string, lon: number, lat: number): Place => ({ label, position: [lon, lat], country: 'India' });
const AHMEDABAD = place('Ahmedabad, Gujarat, India', 72.5801, 23.0215);
const HIMATNAGAR = place('Himatnagar, Gujarat, India', 72.9588, 23.5971);
const MUMBAI = place('Mumbai, Maharashtra, India', 72.8777, 19.076);
const PANAJI = place('Panaji, Goa, India', 73.8278, 15.4909);
const DELHI = place('Delhi, India', 77.209, 28.6139);
const JAIPUR = place('Jaipur, Rajasthan, India', 75.7873, 26.9124);

const field = (p: Place): PlaceField => ({ text: p.label, place: p });

function blankInput(): TripInput {
  const when = nextQuarterHour();
  return { from: emptyField, to: emptyField, vias: [], date: dateInput(when), when: 'at', time: timeInput(when), arrive: '', hours: '', vehicle: 'bus' };
}

/** A ready-made trip, tomorrow. */
const example = (from: Place, to: Place, rest: Partial<TripInput>) => (): TripInput => ({
  ...blankInput(),
  from: field(from),
  to: field(to),
  date: dateInput(Date.now() + DAY),
  ...rest,
});

const EXAMPLES: Example[] = [
  { label: 'Ahmedabad → Himatnagar', input: example(AHMEDABAD, HIMATNAGAR, { time: '09:00', arrive: '11:00' }) },
  { label: 'Mumbai → Goa, all day', input: example(MUMBAI, PANAJI, { when: 'day', hours: '11' }) },
  { label: 'Delhi → Jaipur by car', input: example(DELHI, JAIPUR, { time: '14:00', vehicle: 'car' }) },
];

export function App() {
  const [input, setInput] = useState<TripInput>(blankInput);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [trip, setTrip] = useState<Trip | null>(null);
  const [selected, setSelected] = useState(0);
  const [editing, setEditing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const latestRun = useRef(0); // overlapping searches: only the newest one lands
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const view = trip?.view;
  const clock = useMemo(() => (view ? clockFormat(view.kind === 'at' ? view.timing.departure : view.start) : null), [view]);

  const notify = (message: string) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  };

  async function run(value: TripInput, { history = 'push', route = 0 }: { history?: History; route?: number } = {}) {
    const id = ++latestRun.current;
    const current = () => id === latestRun.current;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    try {
      setStatus({ kind: 'working', step: 0 });
      const from = await resolve(value.from);
      const to = await resolve(value.to);
      const middle = lerp(from.position, to.position, 0.5);
      const vias: Place[] = [];
      for (const via of value.vias) if (via.text.trim()) vias.push(await resolve(via, middle));
      if (!current()) return;
      // Show what was actually used for anything typed but not picked from the suggestions.
      const resolved: TripInput = { ...value, from: field(from), to: field(to), vias: vias.map(field) };
      setInput(resolved);
      const places = [from, ...vias, to];
      const points = places.map((p) => p.position);

      let next: Trip;
      let pick: number;
      if (value.when === 'day') {
        const start = fromInputs(value.date, '00:00');
        if (Number.isNaN(start)) throw new Error('Please choose a date.');
        const hours = value.hours.trim() ? Number(value.hours) : undefined;
        if (hours !== undefined && !(hours > 0)) throw new Error('The trip length should be a number of hours, like 2.5.');
        setStatus({ kind: 'working', step: 1 });
        const context = await prepareTrip(points, { from: start, to: start + DAY }, { fetchJson: browserFetch });
        if (!current()) return;
        setStatus({ kind: 'working', step: 2 });
        await nextFrame(); // let the step show before the sums take over
        pick = Math.min(route, context.routes.length - 1);
        next = { places, context, pinned: vias.length > 0, vehicle: value.vehicle, view: { kind: 'day', start, hours, plan: planDay(context, pick, { start, vehicle: value.vehicle, hours }) } };
      } else {
        const departure = fromInputs(value.date, value.time);
        if (Number.isNaN(departure)) throw new Error('Please choose a date and a time.');
        let arrival = value.arrive ? fromInputs(value.date, value.arrive) : undefined;
        if (arrival !== undefined && arrival <= departure) arrival += DAY; // arrives the next day
        const timing: Timing = { departure, vehicle: value.vehicle, arrival };
        setStatus({ kind: 'working', step: 1 });
        const context = await prepareTrip(points, { from: departure, to: departure }, { fetchJson: browserFetch });
        if (!current()) return;
        setStatus({ kind: 'working', step: 2 });
        await nextFrame();
        pick = Math.min(route, context.routes.length - 1);
        next = { places, context, pinned: vias.length > 0, vehicle: value.vehicle, view: { kind: 'at', timing, results: planAt(context, timing) } };
      }
      if (!current()) return;
      setTrip(next);
      setSelected(pick);
      setEditing(false);
      setStatus({ kind: 'idle' });
      writeAddress(resolved, pick, history);
    } catch (err) {
      if (current()) setStatus({ kind: 'error', message: friendly(err) });
    }
  }

  // Open a trip from the address bar, and follow back and forward.
  useEffect(() => {
    const load = () => {
      const fromAddress = readTripQuery(window.location.search);
      if (fromAddress) {
        setInput(fromAddress.input);
        void run(fromAddress.input, { history: 'none', route: fromAddress.route });
      } else {
        latestRun.current++;
        setTrip(null);
        setStatus({ kind: 'idle' });
        setEditing(false);
      }
    };
    load();
    window.addEventListener('popstate', load);
    return () => window.removeEventListener('popstate', load);
    // run only uses setters and refs, so the first one stays good
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function goHome() {
    latestRun.current++; // drop anything still loading
    setTrip(null);
    setStatus({ kind: 'idle' });
    setEditing(false);
    if (window.location.search) window.history.pushState(null, '', window.location.pathname);
    window.scrollTo({ top: 0 });
  }

  /** From the whole day to one departure: the routes and forecast are already here. */
  function pickDeparture(departure: number) {
    if (!trip || trip.view.kind !== 'day') return;
    const day = trip.view;
    const arrival = day.hours ? departure + day.hours * HOUR : undefined;
    const timing: Timing = { departure, vehicle: trip.vehicle, arrival };
    const next: TripInput = { ...input, when: 'at', date: dateInput(departure), time: timeInput(departure), arrive: arrival ? timeInput(arrival) : '' };
    setTrip({ ...trip, view: { kind: 'at', timing, results: planAt(trip.context, timing), day } });
    setInput(next);
    writeAddress(next, selected, 'replace');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function backToDay() {
    if (!trip || trip.view.kind !== 'at' || !trip.view.day) return;
    const { start, hours } = trip.view.day;
    const plan = planDay(trip.context, selected, { start, vehicle: trip.vehicle, hours });
    const next: TripInput = { ...input, when: 'day', date: dateInput(start), hours: hours ? String(hours) : '' };
    setTrip({ ...trip, view: { kind: 'day', start, hours, plan } });
    setInput(next);
    writeAddress(next, selected, 'replace');
  }

  function selectRoute(index: number) {
    setSelected(index);
    writeAddress(input, index, 'replace');
    if (trip?.view.kind === 'day') {
      const { start, hours } = trip.view;
      setTrip({ ...trip, view: { kind: 'day', start, hours, plan: planDay(trip.context, index, { start, vehicle: trip.vehicle, hours }) } });
    }
  }
  // The map keeps one handler; it always reaches the latest selectRoute.
  const latestSelect = useRef(selectRoute);
  latestSelect.current = selectRoute;
  const onMapSelect = useCallback((index: number) => latestSelect.current(index), []);

  /** The way back: the same places reversed, across the whole day, since the time is usually different. */
  function returnTrip() {
    if (!trip) return;
    const places = [...trip.places].reverse();
    const hours = trip.view.kind === 'day' ? trip.view.hours : trip.view.timing.arrival ? (trip.view.timing.arrival - trip.view.timing.departure) / HOUR : undefined;
    const back: TripInput = {
      ...input,
      from: field(places[0]),
      to: field(places[places.length - 1]),
      vias: places.slice(1, -1).map(field),
      when: 'day',
      hours: hours ? String(Math.round(hours * 4) / 4) : '',
    };
    setInput(back);
    void run(back);
    notify('The return trip, across the whole day');
  }

  async function share() {
    if (!trip) return;
    const url = window.location.href;
    const title = `Sun Side: ${short(trip.places[0])} → ${short(trip.places[trip.places.length - 1])}`;
    // Phones get the system share sheet; elsewhere the link is copied.
    if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
      try {
        await navigator.share({ title, url });
      } catch {
        // the share sheet was closed
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      notify('Link copied');
    } catch {
      notify(copyText(url) ? 'Link copied' : "Couldn't copy: the link is in the address bar");
    }
  }

  const busy = status.kind === 'working';
  const results = trip !== null || busy; // a search from the start page shows the results frame while it works
  const stale = busy || status.kind === 'error' ? 'opacity-50' : ''; // the last answer stays, dimmed, until the new one lands
  const vehicleName = trip?.vehicle === 'car' ? 'Car' : 'Bus';
  const summary =
    !trip || !clock
      ? ''
      : trip.view.kind === 'at'
        ? `${dayLabel(trip.view.timing.departure)} · ${clock(trip.view.timing.departure)} → ${clock(trip.view.timing.departure + trip.view.results[selected].stats.minutes * 60_000)} · ${vehicleName}`
        : `${dayLabel(trip.view.start)} · whole day · ${vehicleName}`;

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

  const form = (
    <TripForm
      value={input}
      onChange={setInput}
      onSubmit={() => run(input)}
      busy={busy}
      examples={results ? undefined : EXAMPLES}
      onExample={(next) => {
        setInput(next);
        void run(next);
      }}
    />
  );
  const failure = status.kind === 'error' && (
    <div role="alert" className="flex items-start gap-3 rounded-3xl bg-surface px-5 py-4 text-sm shadow-sm ring-1 ring-critical/30">
      <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-critical" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">That didn't work</p>
        <p className="mt-0.5 text-ink-2">{status.message}</p>
      </div>
      <Button onClick={() => run(input, { history: 'replace' })}>Try again</Button>
    </div>
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <Header onHome={goHome} sections={!results} />
      <main className="flex-1">
        {!results ? (
          <Landing
            search={
              <div className="space-y-3">
                {form}
                {failure}
              </div>
            }
          />
        ) : (
          <div className="mx-auto max-w-6xl space-y-4 px-4 pt-6 pb-16">
            {trip && (
              <TripBar places={trip.places} summary={summary} editing={editing} onEdit={() => setEditing((e) => !e)} onReturn={returnTrip} onShare={share} />
            )}
            {editing && <div className="max-w-2xl">{form}</div>}
            {status.kind === 'working' && <Progress step={status.step} />}
            {failure}
            {trip && clock ? (
              <div className={`grid grid-cols-1 gap-4 transition-opacity lg:grid-cols-[minmax(0,27rem)_minmax(0,1fr)] lg:items-start lg:gap-6 ${stale}`}>
                <div className="space-y-4">
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
                <div className="space-y-4 lg:sticky lg:top-20">
                  <Suspense fallback={<div className={`${CARD} h-[21rem] animate-pulse lg:h-[33rem]`} />}>
                    <RouteMap
                      routes={trip.context.routes}
                      selected={selected}
                      passes={trip.view.kind === 'at' ? trip.view.results[selected].passes : null}
                      places={trip.places ?? NO_PLACES}
                      clock={clock}
                      onSelect={onMapSelect}
                    />
                  </Suspense>
                  {trip.view.kind === 'at' && <Timeline result={trip.view.results[selected]} clock={clock} weather={trip.context.weather} />}
                </div>
              </div>
            ) : (
              busy && <ResultsSkeleton />
            )}
          </div>
        )}
      </main>
      <Footer />
      <Toast message={toast} />
    </div>
  );
}

/** Put the trip in the address bar, so it can be shared, bookmarked and gone back to. */
function writeAddress(value: TripInput, route: number, history: History) {
  const query = tripQuery(value, route);
  if (history === 'none' || !query) return;
  const url = `${window.location.pathname}${query}`;
  if (history === 'push') window.history.pushState(null, '', url);
  else window.history.replaceState(null, '', url);
}

/** The old way to copy, for browsers that block the clipboard API (some in-app browsers do). */
function copyText(text: string): boolean {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.append(area);
  area.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    area.remove();
  }
}

/** A typed place that wasn't picked from the suggestions: take the best match. */
async function resolve(value: PlaceField, near?: LonLat): Promise<Place> {
  if (value.place) return value.place;
  const text = value.text.trim();
  const [best] = await searchPlaces(text, { limit: 1, near, fetchJson: browserFetch });
  if (!best) throw new Error(`Couldn't find "${text}". Try adding the district or state.`);
  return best;
}

/** Resolves after the browser has painted, so a status shows before heavy work starts. */
const nextFrame = () => new Promise<void>((done) => requestAnimationFrame(() => setTimeout(done)));

function friendly(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/failed to fetch|networkerror|timed out|aborted|load failed|\b(429|502|503|504)\b/i.test(message)) {
    return "Couldn't reach the free routing or place-search servers; they're sometimes busy. Please try again in a moment.";
  }
  return message;
}
