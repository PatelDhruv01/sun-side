import { ArrowRight, ArrowUp, Armchair, ChevronRight, CloudSun, Route, Sun, SunMedium, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { HeroArt } from './HeroArt.tsx';
import { MiniDayStrip, MiniDevices, MiniRoute, MiniRoutes, MiniSeatChange, MiniSeats, MiniShare, MiniTimeline, MiniWeather } from './Showcase.tsx';
import { CARD, EYEBROW, stagger } from './ui.tsx';

const FIGURES: { figure: string; text: string }[] = [
  { figure: '1 min', text: 'steps along your real road' },
  { figure: '0.02°', text: 'sun position, checked against SunCalc' },
  { figure: '14 days', text: 'of weather forecast ahead' },
  { figure: 'Free', text: 'no sign-up and no ads' },
];

const STEPS: { icon: LucideIcon; title: string; text: string; art: ReactNode }[] = [
  {
    icon: Route,
    title: 'Your real route',
    text: 'The road as it actually runs, bend by bend, from OpenStreetMap. Other routes are checked too, and you can pin the towns your bus goes through.',
    art: <MiniRoute />,
  },
  {
    icon: Sun,
    title: 'The sun, minute by minute',
    text: "For every minute of the trip: where the sun is, how high it is, and how much of it the forecast's clouds and haze let through.",
    art: <MiniTimeline />,
  },
  {
    icon: Armchair,
    title: 'Your seat, and how sure',
    text: "Which side to sit on, whether it's a clear call or a toss-up, and when it's worth changing seats halfway.",
    art: <MiniSeats />,
  },
];

const FEATURES: { title: string; text: string; art: ReactNode; wide?: boolean }[] = [
  {
    title: 'Not sure when you’ll leave?',
    text: 'Choose “Not sure yet” and it checks every departure that day, half an hour apart, then says which side to take for each part of the day.',
    art: <MiniDayStrip />,
    wide: true,
  },
  {
    title: 'Uses the forecast',
    text: 'Clouds and haze dim the sun, up to 14 days ahead. Further out it assumes a clear sky, the worst case.',
    art: <MiniWeather />,
  },
  {
    title: 'Worth moving seats?',
    text: 'On long trips the sun can swap sides. If moving partway saves enough sun, it says when.',
    art: <MiniSeatChange />,
  },
  {
    title: 'Your bus’s road',
    text: 'Other routes are checked too: pick the one your bus takes, or add a town it goes through.',
    art: <MiniRoutes />,
  },
  {
    title: 'Share it, plan the way back',
    text: 'Every answer has its own link. Return trip works out the whole day for the way home.',
    art: <MiniShare />,
  },
  {
    title: 'Any screen',
    text: 'Made for phones first, light or dark. Add it to your home screen like an app.',
    art: <MiniDevices />,
  },
  {
    title: 'Free and open',
    text: 'No account and no ads. It runs in your browser on open data and free services:',
    art: (
      <ul className="flex flex-wrap gap-1.5 text-xs text-ink-2">
        {['OpenStreetMap', 'OSRM', 'Valhalla', 'Photon', 'Open-Meteo', 'OpenFreeMap', 'NOAA solar equations'].map((name) => (
          <li key={name} className="rounded-full bg-raised px-2.5 py-1 ring-1 ring-hairline">
            {name}
          </li>
        ))}
      </ul>
    ),
    wide: true,
  },
];

const FACTS: { figure: string; text: string }[] = [
  {
    figure: '30°',
    text: 'The sun height at which a side window gets the most sun: mid-morning and mid-afternoon, not noon. At noon it mostly lands on the roof.',
  },
  {
    figure: 'North',
    text: "Where the noon sun is in Chennai in May. “The sun is in the south” doesn't always hold in India.",
  },
  {
    figure: 'Flips',
    text: 'Mumbai → Goa leaving at 7: at car speed the left side gets more sun; at a real bus’s pace the afternoon wins and it’s the right.',
  },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: 'How does it work?',
    a: 'It finds your route on OpenStreetMap roads and drives it minute by minute. For each stretch it works out where the sun is (from NOAA’s solar equations), how much sunlight gets through (from the forecast), and which windows it hits. A heat score that counts long unbroken stretches of sun extra then picks the side.',
  },
  {
    q: 'Is it free? Do I need an account?',
    a: 'Free, with no sign-up. It runs in your browser on free, open services: OpenStreetMap, OSRM, Valhalla, Photon, Open-Meteo and OpenFreeMap.',
  },
  {
    q: 'How accurate is it?',
    a: 'The sun’s position is exact to a fraction of a degree. The rest depends on the route and timing: give your ticket’s arrival time, and add a town the bus goes through if it takes another road. Shade from hills, buildings and trees isn’t counted.',
  },
  {
    q: 'Why does it sometimes say “either side”?',
    a: 'When the sun is mostly ahead of or behind you, after dark, or when both sides get about the same, it says so honestly rather than guess. It also checks whether leaving a little earlier or later would change the answer.',
  },
  {
    q: 'Does it use the weather?',
    a: 'Yes, for trips up to about two weeks ahead: clouds and haze dim the sun. Further out it assumes a clear sky, which is the worst case for sun.',
  },
];

/** Back up to the search, ready to type. */
function startPlanning() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
  document.querySelector<HTMLInputElement>('#plan input:not([type="radio"])')?.focus({ preventScroll: true });
}

/** The start page: what it does, the search, and how it works. */
export function Landing({ search }: { search: ReactNode }) {
  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pt-10 pb-12 sm:pt-16 lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-start lg:gap-14 lg:pt-20">
        <div>
          <p className="inline-flex animate-rise items-center gap-2 rounded-full bg-surface px-3 py-1 text-xs font-medium text-ink-2 shadow-sm ring-1 ring-hairline">
            <SunMedium aria-hidden className="size-3.5 text-brand motion-safe:animate-spin-slow" />
            Free · no sign-up · live weather
          </p>
          <h1 className="mt-5 animate-rise text-[2.75rem] leading-[1.02] font-semibold tracking-[-0.035em] sm:text-6xl lg:text-[4.1rem]" style={stagger(1)}>
            Sit on the{' '}
            <span className="animate-highlight bg-[linear-gradient(transparent_60%,var(--color-brand-soft)_60%)] bg-no-repeat">shady side.</span>
          </h1>
          <p className="mt-5 max-w-xl animate-rise text-lg leading-relaxed text-ink-2" style={stagger(2)}>
            Sun Side drives your real route minute by minute, with every bend in the road, the sun's direction and height, and the weather forecast,
            then tells you which side of the bus or car stays out of the sun.
          </p>
          <div id="plan" className="mt-8 animate-rise scroll-mt-24" style={stagger(3)}>
            {search}
          </div>
        </div>
        <HeroArt className="mt-12 animate-rise lg:sticky lg:top-24 lg:mt-4" />
      </section>

      <section aria-label="In numbers" className="mx-auto max-w-6xl px-4 pb-6">
        <ul className="reveal grid grid-cols-2 gap-px overflow-hidden rounded-3xl bg-hairline ring-1 ring-hairline md:grid-cols-4">
          {FIGURES.map(({ figure, text }) => (
            <li key={figure} className="bg-surface px-5 py-5 sm:px-6">
              <span className="block text-2xl font-semibold tracking-tight sm:text-[1.7rem]">{figure}</span>
              <span className="mt-1 block text-sm text-ink-2">{text}</span>
            </li>
          ))}
        </ul>
      </section>

      <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14">
        <div className="reveal">
          <p className={EYEBROW}>How it works</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">The whole trip, worked out</h2>
          <p className="mt-3 max-w-2xl text-ink-2">
            The direction of your destination isn't enough: roads bend, and the sun moves and climbs all day. So instead of guessing, it follows the
            trip from start to finish.
          </p>
        </div>
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, text, art }, i) => (
            <li key={title} className={`${CARD} reveal relative flex flex-col p-3`}>
              <div className="rounded-[1.1rem] bg-raised px-4 py-5 ring-1 ring-hairline">{art}</div>
              <div className="px-3 pt-5 pb-3">
                <div className="flex items-center justify-between">
                  <span className="grid size-10 place-items-center rounded-2xl bg-brand-soft text-ink">
                    <Icon aria-hidden className="size-5" />
                  </span>
                  <span className="text-sm font-semibold text-muted tabular-nums">0{i + 1}</span>
                </div>
                <h3 className="mt-4 text-lg font-semibold tracking-tight">{title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{text}</p>
              </div>
              {i < STEPS.length - 1 && (
                <span aria-hidden className="absolute top-1/2 -right-[1.15rem] z-10 hidden size-8 -translate-y-1/2 place-items-center rounded-full bg-surface text-muted shadow-sm ring-1 ring-hairline md:grid">
                  <ArrowRight className="size-4" />
                </span>
              )}
            </li>
          ))}
        </ol>
      </section>

      <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14">
        <div className="reveal">
          <p className={EYEBROW}>Features</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Built for real trips</h2>
          <p className="mt-3 max-w-2xl text-ink-2">Ticket times, unknown departures, other roads, long rides and the way back: it handles the messy parts too.</p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ title, text, art, wide }) => (
            <article
              key={title}
              className={`${CARD} reveal flex flex-col justify-between gap-5 p-6 transition-[translate,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[0_1px_2px_rgb(0_0_0/0.04),0_24px_48px_-24px_rgb(0_0_0/0.3)] ${
                wide ? 'lg:col-span-2' : ''
              }`}
            >
              <div>
                <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-ink-2">{text}</p>
              </div>
              {art}
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="reveal">
          <p className={EYEBROW}>Why a compass isn't enough</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">The sun doesn't play fair</h2>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {FACTS.map(({ figure, text }) => (
            <div key={figure} className="reveal group relative overflow-hidden rounded-3xl bg-ink p-6 text-surface">
              <span aria-hidden className="absolute -top-16 -right-16 size-40 rounded-full bg-brand/25 blur-2xl transition-transform duration-700 group-hover:scale-125" />
              <p className="relative text-5xl font-semibold tracking-tight">{figure}</p>
              <p className="relative mt-4 text-[15px] leading-relaxed opacity-80">{text}</p>
            </div>
          ))}
        </div>
        <p className="reveal mt-5 flex items-center gap-2 text-sm text-ink-2">
          <CloudSun aria-hidden className="size-4 text-muted" />
          And on hazy or cloudy days there's simply less sun to dodge, which the forecast accounts for.
        </p>
      </section>

      <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-14">
        <div className="reveal">
          <p className={EYEBROW}>FAQ</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Questions</h2>
        </div>
        <div className={`${CARD} reveal mt-8 divide-y divide-hairline`}>
          {FAQ.map(({ q, a }) => (
            <details key={q} className="group px-6 py-1 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-lg py-4 font-medium transition-colors hover:text-ink-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
                {q}
                <ChevronRight aria-hidden className="size-4 shrink-0 text-muted transition-transform duration-300 group-open:rotate-90" />
              </summary>
              <p className="animate-rise pb-5 text-[15px] leading-relaxed text-ink-2 [animation-duration:0.4s]">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-6 pb-20">
        <div className="reveal relative overflow-hidden rounded-[2rem] bg-ink px-6 py-12 text-center text-surface sm:px-12 sm:py-16">
          <span aria-hidden className="absolute -top-24 left-1/2 size-[28rem] -translate-x-1/2 rounded-full bg-brand/25 blur-3xl" />
          <SunMedium aria-hidden className="relative mx-auto size-10 text-brand motion-safe:animate-spin-slow" />
          <h2 className="relative mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">Know your side before you board</h2>
          <p className="relative mx-auto mt-3 max-w-xl opacity-80">Two places and a time is all it needs. It takes a few seconds, and it's free.</p>
          <button
            type="button"
            onClick={startPlanning}
            className="relative mt-8 inline-flex h-12 items-center gap-2 rounded-xl bg-brand px-6 font-semibold text-black shadow-[0_8px_30px_-8px_var(--color-brand)] transition-[scale,box-shadow] duration-200 hover:shadow-[0_12px_40px_-8px_var(--color-brand)] focus-visible:ring-2 focus-visible:ring-surface focus-visible:ring-offset-2 focus-visible:ring-offset-ink focus-visible:outline-none active:scale-[0.97]"
          >
            Plan a trip
            <ArrowUp aria-hidden className="size-4" />
          </button>
        </div>
      </section>
    </>
  );
}
