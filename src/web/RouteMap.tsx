import type { FeatureCollection } from 'geojson';
import { LngLatBounds, MapLibreMap, NavigationControl, Popup, setWorkerUrl, type GeoJSONSource, type MapLayerMouseEvent } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { useEffect, useRef, useState } from 'react';
import type { ClockFormat } from '../app/explain.ts';
import type { RouteResult } from '../app/plan.ts';
import { stretches, type SunCategory } from '../app/stretches.ts';
import type { Place } from '../services/geocode.ts';
import { themeColour, useDarkMode } from './hooks.ts';

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
  results: RouteResult[] | null;
  selected: number;
  /** Start, via towns, end. */
  places: Place[];
  clock: ClockFormat | null;
  onSelect: (index: number) => void;
}

export function RouteMap({ results, selected, places, clock, onSelect }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const dark = useDarkMode();

  // A fresh map whenever the colour scheme changes: the dark base map is a different style.
  useEffect(() => {
    const m = new MapLibreMap({
      container: box.current!,
      style: dark ? STYLES.dark : STYLES.light,
      center: [79, 22.5],
      zoom: 3.3,
      attributionControl: { compact: true },
      cooperativeGestures: true, // the page scrolls past the map; Ctrl+scroll or two fingers move it
    });
    m.addControl(new NavigationControl({ showCompass: false }), 'top-right');
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
    return () => {
      setMap(null);
      m.remove();
    };
  }, [dark]);

  // The chosen route coloured by sunny side, the others in grey, and the places as dots.
  useEffect(() => {
    if (!map) return;
    const source = (id: string) => map.getSource(id) as GeoJSONSource;
    if (!results) {
      for (const id of ['alternatives', 'route', 'places']) source(id).setData(NOTHING);
      return;
    }
    const colours = Object.fromEntries(CATEGORIES.map((c) => [c.category, themeColour(c.token)])) as Record<SunCategory, string>;
    const chosen = results[selected];
    source('alternatives').setData({
      type: 'FeatureCollection',
      features: results.flatMap((r, index) =>
        index === selected ? [] : [{ type: 'Feature', properties: { index }, geometry: { type: 'LineString', coordinates: r.route.coords } }],
      ),
    });
    source('route').setData({
      type: 'FeatureCollection',
      features: stretches(chosen.route, chosen.passes).map((s) => ({
        type: 'Feature',
        properties: { colour: colours[s.category], category: s.category, from: s.from, to: s.to },
        geometry: { type: 'LineString', coordinates: s.coords },
      })),
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
    for (const r of results) for (const point of r.route.coords) bounds.extend(point);
    map.fitBounds(bounds, { padding: 40, duration: 500, maxZoom: 13 });
  }, [map, results, selected, places]);

  // Hover or tap a stretch for its times; click a grey route to switch to it.
  useEffect(() => {
    if (!map || !clock) return;
    const popup = new Popup({ closeButton: false, closeOnClick: false, offset: 12, maxWidth: '260px' });
    const names = Object.fromEntries(CATEGORIES.map((c) => [c.category, c.name])) as Record<SunCategory, string>;
    const show = (e: MapLayerMouseEvent) => {
      const props = e.features?.[0]?.properties;
      if (!props) return;
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

  return (
    <section aria-label="Route map" className="overflow-hidden rounded-2xl bg-surface shadow-sm ring-1 ring-ink/5">
      <div ref={box} className="h-72 w-full lg:h-[30rem]" />
      {results && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 px-4 py-3 text-xs text-ink-2">
          {CATEGORIES.map((c) => (
            <li key={c.category} className="flex items-center gap-1.5">
              <span aria-hidden className={`h-1 w-4 rounded-full ${c.key}`} />
              {c.name}
            </li>
          ))}
          {results.length > 1 && (
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
