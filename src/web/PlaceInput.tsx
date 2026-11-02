import { useEffect, useId, useState } from 'react';
import type { LonLat } from '../engine/types.ts';
import { searchPlaces, type Place } from '../services/geocode.ts';
import { browserFetch } from './fetch.ts';

/** What's typed in a place box, and the place picked from its suggestions, if any. */
export interface PlaceField {
  text: string;
  place: Place | null;
}

export const emptyField: PlaceField = { text: '', place: null };

interface Props {
  label: string;
  field: PlaceField;
  onChange: (field: PlaceField) => void;
  placeholder?: string;
  /** Prefer suggestions near here, e.g. the middle of the trip for a via town. */
  near?: LonLat;
}

/** A place box with suggestions as you type: Photon's, or Open-Meteo's when Photon is down. */
export function PlaceInput({ label, field, onChange, placeholder, near }: Props) {
  const id = useId();
  const [options, setOptions] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const query = field.place ? '' : field.text.trim();
  const [nearLon, nearLat] = near ?? [];

  useEffect(() => {
    if (query.length < 3) {
      setOptions([]);
      return;
    }
    let current = true;
    // Wait for a pause in typing: the free servers ask for fair use.
    const timer = setTimeout(() => {
      const around: LonLat | undefined = nearLon === undefined || nearLat === undefined ? undefined : [nearLon, nearLat];
      searchPlaces(query, { limit: 5, near: around, fetchJson: browserFetch })
        .then((found) => {
          if (!current) return;
          setOptions(found);
          setActive(0);
        })
        .catch(() => {
          if (current) setOptions([]);
        });
    }, 300);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [query, nearLon, nearLat]);

  const choose = (place: Place) => {
    onChange({ text: place.label, place });
    setOpen(false);
    setOptions([]);
  };
  const listOpen = open && options.length > 0;

  return (
    <div className="relative">
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-ink-2">
        {label}
      </label>
      <input
        id={id}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={listOpen}
        aria-controls={`${id}-options`}
        aria-activedescendant={listOpen ? `${id}-option-${active}` : undefined}
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        value={field.text}
        onChange={(e) => {
          onChange({ text: e.target.value, place: null });
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (!listOpen) return;
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const step = e.key === 'ArrowDown' ? 1 : -1;
            setActive((a) => (a + step + options.length) % options.length);
          } else if (e.key === 'Enter') {
            e.preventDefault();
            choose(options[active]);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        className="w-full rounded-lg border border-hairline bg-page px-3 py-2.5 text-base outline-none placeholder:text-muted focus:border-ink-2"
      />
      {listOpen && (
        <ul id={`${id}-options`} role="listbox" className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-hairline bg-surface shadow-lg">
          {options.map((place, i) => (
            <li
              key={`${place.label}|${place.position.join()}`}
              id={`${id}-option-${i}`}
              role="option"
              aria-selected={i === active}
              // mousedown, so the choice lands before the box loses focus
              onMouseDown={(e) => {
                e.preventDefault();
                choose(place);
              }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer px-3 py-2 text-sm ${i === active ? 'bg-page' : ''}`}
            >
              <span className="text-ink">{place.label}</span>
              {place.kind && <span className="ml-2 text-xs text-muted">{place.kind}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
