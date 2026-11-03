import type { ReactNode } from 'react';
import { Logo } from './Logo.tsx';
import { EYEBROW } from './ui.tsx';

/** A credit link, opening in a new tab. */
function Credit({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="underline decoration-axis underline-offset-2 transition-colors hover:text-ink hover:decoration-ink-2">
      {children}
    </a>
  );
}

/** Who each part of the answer comes from. The open-data licences ask for credit with a link. */
const SOURCES: [string, ReactNode][] = [
  [
    'Routes',
    <>
      <Credit href="https://project-osrm.org/">OSRM</Credit> and <Credit href="https://valhalla.github.io/valhalla/">Valhalla</Credit> on{' '}
      <Credit href="https://www.fossgis.de/">FOSSGIS</Credit> servers
    </>,
  ],
  [
    'Places',
    <>
      <Credit href="https://photon.komoot.io/">Photon</Credit> and <Credit href="https://open-meteo.com/">Open-Meteo</Credit>
    </>,
  ],
  [
    'Weather',
    <>
      <Credit href="https://open-meteo.com/">Open-Meteo</Credit>, under <Credit href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</Credit>
    </>,
  ],
  [
    'Map',
    <>
      © <Credit href="https://openfreemap.org/">OpenFreeMap</Credit>, <Credit href="https://openmaptiles.org/">OpenMapTiles</Credit>,{' '}
      <Credit href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</Credit>
    </>,
  ],
  ['Sun', <Credit href="https://gml.noaa.gov/grad/solcalc/">NOAA solar equations</Credit>],
];

export function Footer() {
  return (
    <footer className="border-t border-hairline bg-surface/50">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-[1fr_1.3fr_1fr]">
        <div>
          <p className="flex items-center gap-2.5 font-semibold tracking-tight">
            <Logo className="size-6" />
            Sun Side
          </p>
          <p className="mt-2 max-w-xs text-sm text-ink-2">Which side of the bus or car stays out of the sun, worked out minute by minute.</p>
          <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-good/10 px-2.5 py-1 text-xs font-medium ring-1 ring-good/25">
            <span aria-hidden className="size-1.5 rounded-full bg-good" />
            Free, no sign-up, runs in your browser
          </p>
        </div>
        <div>
          <p className={EYEBROW}>Built on open data</p>
          <dl className="mt-3 grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
            {SOURCES.map(([what, who]) => (
              <div key={what} className="contents">
                <dt className="text-muted">{what}</dt>
                <dd className="text-ink-2">{who}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div>
          <p className={EYEBROW}>Good to know</p>
          <p className="mt-3 text-sm leading-relaxed text-ink-2">
            Shade from hills, buildings and trees isn't counted, and stops along the way are spread over the trip. The routing and search servers are
            free and shared: please go easy on them.
          </p>
        </div>
      </div>
    </footer>
  );
}
