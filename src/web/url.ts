// A trip in the address bar, so a link opens straight to the same answer. Places carry their
// coordinates and names, so nothing has to be looked up again.
import type { Place } from '../services/geocode.ts';
import type { PlaceField } from './PlaceInput.tsx';
import type { TripInput } from './TripForm.tsx';

const placeParam = ({ position: [lon, lat], label }: Place) => `${lat.toFixed(5)},${lon.toFixed(5)},${label}`;

function readPlace(value: string | null): Place | null {
  const match = value && /^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(.+)$/.exec(value);
  return match ? { label: match[3], position: [Number(match[2]), Number(match[1])] } : null;
}

/** The query string for a trip whose places have been found. `route` is 0-based. */
export function tripQuery(input: TripInput, route: number): string {
  const places = [input.from, ...input.vias, input.to].map((field) => field.place);
  if (places.some((place) => !place)) return '';
  const query = new URLSearchParams();
  query.set('from', placeParam(input.from.place!));
  query.set('to', placeParam(input.to.place!));
  for (const via of input.vias) query.append('via', placeParam(via.place!));
  query.set('date', input.date);
  if (input.when === 'day') {
    query.set('when', 'day');
    if (input.hours) query.set('hours', input.hours);
  } else {
    query.set('time', input.time);
    if (input.arrive) query.set('arrive', input.arrive);
  }
  query.set('by', input.vehicle);
  if (route > 0) query.set('route', String(route + 1));
  return `?${query}`;
}

/** The trip in an address's query string, if there's a whole one there. */
export function readTripQuery(search: string): { input: TripInput; route: number } | null {
  const query = new URLSearchParams(search);
  const from = readPlace(query.get('from'));
  const to = readPlace(query.get('to'));
  const date = query.get('date') ?? '';
  const when = query.get('when') === 'day' ? 'day' : 'at';
  const time = query.get('time') ?? '';
  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(date) || (when === 'at' && !/^\d{2}:\d{2}$/.test(time))) return null;
  const field = (place: Place): PlaceField => ({ text: place.label, place });
  const vias = query.getAll('via').flatMap((value) => {
    const place = readPlace(value);
    return place ? [field(place)] : [];
  });
  return {
    input: {
      from: field(from),
      to: field(to),
      vias,
      date,
      when,
      time: time || '09:00',
      arrive: query.get('arrive') ?? '',
      hours: query.get('hours') ?? '',
      vehicle: query.get('by') === 'car' ? 'car' : 'bus',
    },
    route: Math.max(0, (Number(query.get('route')) || 1) - 1),
  };
}
