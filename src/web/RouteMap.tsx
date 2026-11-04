import type { FeatureCollection } from 'geojson';
import { FullscreenControl, LngLatBounds, MapLibreMap, Marker, NavigationControl, Popup, setWorkerUrl, type GeoJSONSource, type MapLayerMouseEvent } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { useEffect, useRef, useState } from 'react';
import type { ClockFormat } from '../app/explain.ts';
import { stretches, type SunCategory } from '../app/stretches.ts';
import { compass } from '../engine/geo.ts';
import { SUN_THRESHOLD } from '../engine/summary.ts';
import type { Vehicle } from '../engine/timing.ts';
import type { LonLat, SegmentPass, TimelineBin } from '../engine/types.ts';
import type { Place } from '../services/geocode.ts';
import type { CandidateRoute } from '../services/routing.ts';
import { themeColour } from './hooks.ts';
import { useTheme } from './theme.ts';
import { CARD } from './ui.tsx';

// MapLibre looks for its worker next to its own file, which bundling moves; point it at Vite's copy.
setWorkerUrl(workerUrl);

/** OpenFreeMap: free vector map tiles, no key and no usage limits. */
const STYLES = { light: 'https://tiles.openfreemap.org/styles/positron', dark: 'https://tiles.openfreemap.org/styles/dark' };

/** Each kind of stretch: its colour token, its legend key and its name. */
const CATEGORIES: { category: SunCategory; token: string; key: string; name: string }[] = [
  { category: 'sun on left', token: '--color-sun-left', key: 'bg-sun-left', name: 'Sun on the left' },
  { category: 'sun on right', token: '--color-sun-right', key: 'bg-sun-right', name: 'Sun on the right' },
  { category: 'sun ahead or behind', token: '--color-sun-ends', key: 'bg-sun-ends', name: 'Sun ahead or behind' },
  { category: 'weak sun', token: '--color-weak', key: 'bg-weak', name: 'Weak sun' },
  { category: 'night', token: '--color-night', key: 'bg-night', name: 'Dark' },
];

const NOTHING: FeatureCollection = { type: 'FeatureCollection', features: [] };

interface Props {
  routes: CandidateRoute[] | null;
  selected: number;
  /** The chosen route as driven at one departure, to colour it by sunny side; without it, it's drawn plain. */
  passes: SegmentPass[] | null;
  /** Start, via towns, end. */
  places: Place[];
  clock: ClockFormat | null;
  onSelect: (index: number) => void;
  /** A moment of the trip to show the vehicle at, with the sun's direction: from the timeline or playback. */
  cursor?: TimelineBin | null;
  vehicle?: Vehicle;
}

/** A dot towards the sun, around the vehicle. */
const SUN_DOT = `
  <div data-sun class="absolute inset-0 transition-opacity duration-200">
    <span class="absolute top-0 left-1/2 size-3 -translate-x-1/2 rounded-full bg-brand shadow-[0_0_12px_3px_var(--color-brand)]"></span>
    <span class="absolute top-3.5 left-1/2 h-3.5 w-0.5 -translate-x-1/2 rounded-full bg-brand/60"></span>
  </div>`;
const SHAPE = 'absolute top-1/2 left-1/2 h-8 w-6 -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_2px_4px_rgb(0_0_0/0.35)]';

/** The vehicle on the map, nose up, its sunny side's windows lit: a long bus, or a car with front and rear windows. */
const MARKERS: Record<Vehicle, string> = {
  bus: `${SUN_DOT}
  <svg data-vehicle viewBox="0 0 24 32" class="${SHAPE}">
    <rect x="4.5" y="2.5" width="15" height="27" rx="5" class="fill-surface stroke-ink" stroke-width="2" />
    <path d="M7.5 7.5 Q12 5 16.5 7.5 L16.5 10 Q12 8 7.5 10 Z" class="fill-ink" opacity="0.5" />
    <rect data-left x="2.5" y="11" width="2.5" height="15" rx="1.2" class="fill-axis" />
    <rect data-right x="19" y="11" width="2.5" height="15" rx="1.2" class="fill-axis" />
  </svg>`,
  car: `${SUN_DOT}
  <svg data-vehicle viewBox="0 0 24 32" class="${SHAPE}">
    <rect x="5" y="4" width="14" height="24" rx="6.5" class="fill-surface stroke-ink" stroke-width="2" />
    <path d="M7.5 9.5 Q12 7.5 16.5 9.5 L15.8 12.5 Q12 11.5 8.2 12.5 Z" class="fill-ink" opacity="0.5" />
    <path d="M8.2 22 Q12 23 15.8 22 L16.4 24.5 Q12 26 7.6 24.5 Z" class="fill-ink" opacity="0.35" />
    <rect data-left x="3" y="13" width="2.5" height="8" rx="1.2" class="fill-axis" />
    <rect data-right x="18.5" y="13" width="2.5" height="8" rx="1.2" class="fill-axis" />
  </svg>`,
};

const line = (coordinates: LonLat[], properties: Record<string, unknown>) => ({
  type: 'Feature' as const,
  properties,
  geometry: { type: 'LineString' as const, coordinates },
});

export function RouteMap({ routes, selected, passes, places, clock, onSelect, cursor = null, vehicle = 'bus' }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const { dark } = useTheme();

  // A fresh map whenever the colour scheme changes: the dark base map is a different style.
  useEffect(() => {
    const m = new MapLibreMap({
      container: box.current!,
      style: dark ? STYLES.dark : STYLES.light,
      center: [79, 22.5],
      zoom: 3.3,
      attributionControl: { compact: true },
      cooperativeGestures: true, // the page scrolls past the map; Ctrl+scroll or two fingers move it
      dragRotate: false, // north stays up, so the sun's direction reads true
      pitchWithRotate: false,
    });
    m.touchZoomRotate.disableRotation();
    m.keyboard.disableRotation();
    m.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    m.addControl(new FullscreenControl(), 'top-right');
    m.on('load', () => {
      const round = { 'line-join': 'round', 'line-cap': 'round' } as const;
      for (const id of ['alternatives', 'route', 'places']) m.addSource(id, { type: 'geojson', data: NOTHING });
      m.addLayer({
        id: 'alternatives',
        type: 'line',
        source: 'alternatives',
        layout: round,
        paint: { 'line-color': themeColour('--color-muted'), 'line-width': 4, 'line-opacity': 0.7 },
      });
      m.addLayer({ id: 'route-casing', type: 'line', source: 'route', layout: round, paint: { 'line-color': themeColour('--color-surface'), 'line-width': 9 } });
      m.addLayer({ id: 'route', type: 'line', source: 'route', layout: round, paint: { 'line-color': ['get', 'colour'], 'line-width': 5 } });
      m.addLayer({
        id: 'places',
        type: 'circle',
        source: 'places',
        paint: {
          'circle-radius': ['get', 'radius'],
          'circle-color': ['get', 'fill'],
          'circle-stroke-color': themeColour('--color-ink'),
          'circle-stroke-width': 2,
        },
      });
      setMap(m);
    });
    const element = document.createElement('div');
    element.className = 'pointer-events-none size-16'; // MapLibre places it absolutely
    marker.current = new Marker({ element });
    return () => {
      setMap(null);
      marker.current?.remove();
      marker.current = null;
      m.remove();
    };
  }, [dark]);

  // The vehicle at the moment the timeline points to, turned to the road, its sunny side lit.
  useEffect(() => {
    const pin = marker.current;
    if (!map || !pin) return;
    if (!cursor) {
      pin.remove();
      return;
    }
    const element = pin.getElement();
    if (element.dataset.kind !== vehicle) {
      element.innerHTML = MARKERS[vehicle];
      element.dataset.kind = vehicle;
    }
    const shape = element.querySelector<SVGElement>('[data-vehicle]')!;
    const sun = element.querySelector<HTMLElement>('[data-sun]')!;
    shape.style.rotate = `${cursor.heading}deg`;
    sun.style.rotate = `${cursor.sun.azimuth}deg`;
    sun.style.opacity = cursor.sun.elevation > 0 ? '1' : '0';
    for (const side of ['left', 'right'] as const) {
      element.querySelector(`[data-${side}]`)!.setAttribute('class', cursor.faces[side] >= SUN_THRESHOLD ? 'fill-brand' : 'fill-axis');
    }
    pin.setLngLat(cursor.position);
    if (!pin.getElement().isConnected) pin.addTo(map);
  }, [map, cursor, vehicle]);

  // The chosen route coloured by sunny side (or plain, with no time picked), the others in grey, and the places as dots.
  useEffect(() => {
    if (!map) return;
    const source = (id: string) => map.getSource(id) as GeoJSONSource;
    if (!routes) {
      for (const id of ['alternatives', 'route', 'places']) source(id).setData(NOTHING);
      return;
    }
    const colours = Object.fromEntries(CATEGORIES.map((c) => [c.category, themeColour(c.token)])) as Record<SunCategory, string>;
    const chosen = routes[selected];
    source('alternatives').setData({
      type: 'FeatureCollection',
      features: routes.flatMap((route, index) => (index === selected ? [] : [line(route.coords, { index })])),
    });
    source('route').setData({
      type: 'FeatureCollection',
      features: passes
        ? stretches(chosen, passes).map((s) => line(s.coords, { colour: colours[s.category], category: s.category, from: s.from, to: s.to }))
        : [line(chosen.coords, { colour: themeColour('--color-ink') })],
    });
    const ink = themeColour('--color-ink');
    const surface = themeColour('--color-surface');
    source('places').setData({
      type: 'FeatureCollection',
      features: places.map((place, i) => {
        const end = i === places.length - 1;
        return {
          type: 'Feature',
          properties: { radius: i === 0 || end ? 6 : 4, fill: end ? surface : ink }, // start filled, end hollow, via small
          geometry: { type: 'Point', coordinates: place.position },
        };
      }),
    });
    const bounds = new LngLatBounds();
    for (const route of routes) for (const point of route.coords) bounds.extend(point);
    map.fitBounds(bounds, { padding: 40, duration: 500, maxZoom: 13 });
  }, [map, routes, selected, passes, places]);

  // Hover or tap a stretch for its times; click a grey route to switch to it.
  useEffect(() => {
    if (!map || !clock) return;
    const popup = new Popup({ closeButton: false, closeOnClick: false, offset: 12, maxWidth: '260px' });
    const names = Object.fromEntries(CATEGORIES.map((c) => [c.category, c.name])) as Record<SunCategory, string>;
    const show = (e: MapLayerMouseEvent) => {
      const props = e.features?.[0]?.properties;
      if (!props?.category) return; // a plain route has no times to show
      popup.setLngLat(e.lngLat).setText(`${clock(props.from)}–${clock(props.to)}: ${names[props.category as SunCategory].toLowerCase()}`).addTo(map);
    };
    const hide = () => popup.remove();
    const pick = (e: MapLayerMouseEvent) => {
      const index = e.features?.[0]?.properties?.index;
      if (typeof index === 'number') onSelect(index);
    };
    const pointer = () => {
      map.getCanvas().style.cursor = 'pointer';
    };
    const plain = () => {
      map.getCanvas().style.cursor = '';
    };
    map.on('mousemove', 'route', show);
    map.on('click', 'route', show);
    map.on('mouseleave', 'route', hide);
    map.on('click', 'alternatives', pick);
    map.on('mouseenter', 'alternatives', pointer);
    map.on('mouseleave', 'alternatives', plain);
    return () => {
      map.off('mousemove', 'route', show);
      map.off('click', 'route', show);
      map.off('mouseleave', 'route', hide);
      map.off('click', 'alternatives', pick);
      map.off('mouseenter', 'alternatives', pointer);
      map.off('mouseleave', 'alternatives', plain);
      popup.remove();
    };
  }, [map, clock, onSelect]);

  const sunny = cursor ? (['left', 'right'] as const).find((side) => cursor.faces[side] >= SUN_THRESHOLD && cursor.faces[side] >= cursor.faces[side === 'left' ? 'right' : 'left']) : undefined;
  return (
    <section aria-label="Route map" className={`${CARD} animate-rise overflow-hidden`}>
      <div className="relative">
        <div ref={box} className="h-72 w-full lg:h-[30rem]" />
        {cursor && clock && (
          <p aria-hidden className="pointer-events-none absolute top-3 left-3 flex items-center gap-2 rounded-xl bg-surface/90 px-3 py-2 text-xs shadow-lg ring-1 ring-ink/5 backdrop-blur">
            <span className="font-semibold tabular-nums">{clock(cursor.start)}</span>
            <span className="text-muted tabular-nums">km {Math.round(cursor.distance / 1000)}</span>
            <span className="h-3.5 w-px bg-hairline" />
            <span className={`size-2 rounded-full ${sunny === 'left' ? 'bg-sun-left' : sunny === 'right' ? 'bg-sun-right' : cursor.sun.elevation > 0 ? 'bg-weak' : 'bg-night'}`} />
            <span className="text-ink-2">
              {cursor.sun.elevation <= 0 ? 'Sun down' : sunny ? `Sun on the ${sunny}, ${compass(cursor.sun.azimuth)}` : `Sun ${compass(cursor.sun.azimuth)}, not on a side`}
            </span>
          </p>
        )}
      </div>
      {routes && !passes && <p className="px-5 py-3.5 text-xs text-ink-2">Pick a departure time to see the route coloured by sunny side.</p>}
      {routes && passes && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 px-5 py-3.5 text-xs text-ink-2">
          {CATEGORIES.map((c) => (
            <li key={c.category} className="flex items-center gap-1.5">
              <span aria-hidden className={`h-1 w-4 rounded-full ${c.key}`} />
              {c.name}
            </li>
          ))}
          {routes.length > 1 && (
            <li className="flex items-center gap-1.5">
              <span aria-hidden className="h-1 w-4 rounded-full bg-muted opacity-70" />
              Other routes (click to switch)
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
