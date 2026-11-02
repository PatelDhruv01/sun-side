import { Logo } from './Logo.tsx';

export function Footer() {
  return (
    <footer className="border-t border-hairline">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:grid-cols-[1fr_minmax(0,28rem)]">
        <div>
          <p className="flex items-center gap-2.5 font-semibold tracking-tight">
            <Logo className="size-6" />
            Sun Side
          </p>
          <p className="mt-2 max-w-sm text-sm text-ink-2">Free, no sign-up, and it runs entirely in your browser on open data.</p>
        </div>
        <p className="text-xs leading-relaxed text-muted">
          Map © OpenFreeMap, OpenMapTiles and OpenStreetMap contributors. Routes by OSRM and Valhalla on FOSSGIS's public servers. Places by Photon
          and Open-Meteo; weather by Open-Meteo. Sun position from NOAA's solar equations. These are free services: please go easy on them.
        </p>
      </div>
    </footer>
  );
}
