import { Logo } from './Logo.tsx';
import { EYEBROW } from './ui.tsx';

const SOURCES: [string, string][] = [
  ['Routes', 'OSRM and Valhalla on FOSSGIS servers'],
  ['Places', 'Photon and Open-Meteo'],
  ['Weather', 'Open-Meteo'],
  ['Map', '© OpenFreeMap, OpenMapTiles, OpenStreetMap contributors'],
  ['Sun', 'NOAA solar equations'],
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
