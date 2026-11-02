import { Armchair, ChevronRight, CloudSun, Route, Sun, SunMedium, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { HeroArt } from './HeroArt.tsx';
import { CARD, EYEBROW } from './ui.tsx';

const STEPS: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: Route,
    title: 'Your real route',
    text: 'The road as it actually runs, bend by bend, from OpenStreetMap. Other routes are checked too, and you can pin the towns your bus goes through.',
  },
  {
    icon: Sun,
    title: 'The sun, minute by minute',
    text: "For every minute of the trip: where the sun is, how high it is, and how much of it the forecast's clouds and haze let through.",
  },
  {
    icon: Armchair,
    title: 'Your seat, and how sure',
    text: "Which side to sit on, whether it's a clear call or a toss-up, and when it's worth changing seats halfway.",
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

/** The start page: what it does, the search, and how it works. */
export function Landing({ search }: { search: ReactNode }) {
  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pt-10 pb-14 sm:pt-16 lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-start lg:gap-14 lg:pt-20">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1 text-xs font-medium text-ink-2 shadow-sm ring-1 ring-hairline">
            <SunMedium aria-hidden className="size-3.5 text-brand" />
            Free · no sign-up · live weather
          </p>
          <h1 className="mt-5 text-[2.75rem] leading-[1.02] font-semibold tracking-[-0.035em] sm:text-6xl lg:text-[4.1rem]">
            Sit on the <span className="bg-[linear-gradient(transparent_60%,var(--color-brand-soft)_60%)]">shady side.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-2">
            Sun Side drives your real route minute by minute, with every bend in the road, the sun's direction and height, and the weather forecast,
            then tells you which side of the bus or car stays out of the sun.
          </p>
          <div className="mt-8">{search}</div>
        </div>
        <HeroArt className="mt-12 lg:mt-4" />
      </section>

      <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14">
        <p className={EYEBROW}>How it works</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">The whole trip, worked out</h2>
        <p className="mt-3 max-w-2xl text-ink-2">
          The direction of your destination isn't enough: roads bend, and the sun moves and climbs all day. So instead of guessing, it follows the
          trip from start to finish.
        </p>
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className={`${CARD} p-6`}>
              <div className="flex items-center justify-between">
                <span className="grid size-10 place-items-center rounded-2xl bg-brand-soft text-ink">
                  <Icon aria-hidden className="size-5" />
                </span>
                <span className="text-sm font-semibold text-muted tabular-nums">0{i + 1}</span>
              </div>
              <h3 className="mt-5 text-lg font-semibold tracking-tight">{title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <p className={EYEBROW}>Why a compass isn't enough</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">The sun doesn't play fair</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {FACTS.map(({ figure, text }) => (
            <div key={figure} className="rounded-3xl bg-ink p-6 text-surface">
              <p className="text-5xl font-semibold tracking-tight">{figure}</p>
              <p className="mt-4 text-[15px] leading-relaxed opacity-80">{text}</p>
            </div>
          ))}
        </div>
        <p className="mt-5 flex items-center gap-2 text-sm text-ink-2">
          <CloudSun aria-hidden className="size-4 text-muted" />
          And on hazy or cloudy days there's simply less sun to dodge, which the forecast accounts for.
        </p>
      </section>

      <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-14">
        <p className={EYEBROW}>FAQ</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Questions</h2>
        <div className={`${CARD} mt-8 divide-y divide-hairline`}>
          {FAQ.map(({ q, a }) => (
            <details key={q} className="group px-6 py-1 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-medium">
                {q}
                <ChevronRight aria-hidden className="size-4 shrink-0 text-muted transition-transform group-open:rotate-90" />
              </summary>
              <p className="pb-5 text-[15px] leading-relaxed text-ink-2">{a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
