import { MapPin, X } from 'lucide-react';
import { useEffect, useId, useState, type ReactNode } from 'react';
import type { LonLat } from '../engine/types.ts';
import { searchPlaces, type Place } from '../services/geocode.ts';
import { browserFetch } from './fetch.ts';

/** What's typed in a place box, and the place picked from its suggestions, if any. */
export interface PlaceField {
  text: string;
  place: Place | null;
}

export const emptyField: PlaceField = { text: '', place: null };

export const FIELD_LABEL = 'mb-1.5 block text-[13px] font-medium text-ink-2';
export const FIELD_INPUT =
  'h-12 w-full rounded-xl border border-hairline bg-raised px-3.5 text-base text-ink outline-none transition-colors placeholder:text-muted hover:border-axis focus:border-ink-2 focus:bg-surface';

interface Props {
  label: string;
  field: PlaceField;
  onChange: (field: PlaceField) => void;
  placeholder?: string;
  /** Prefer suggestions near here, e.g. the middle of the trip for a via town. */
  near?: LonLat;
  /** Drawn inside the box, on the left. */
  icon?: ReactNode;
  /** A small control on the label's line, such as "Swap". */
  action?: ReactNode;
}

/** A place box with suggestions as you type: Photon's, or Open-Meteo's when Photon is down. */
export function PlaceInput({ label, field, onChange, placeholder, near, icon, action }: Props) {
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
      <div className="flex items-end justify-between gap-2">
        <label htmlFor={id} className={FIELD_LABEL}>
          {label}
        </label>
        {action}
      </div>
      <div className="relative">
        {icon && <span className="pointer-events-none absolute inset-y-0 left-3.5 grid place-items-center text-muted">{icon}</span>}
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
          className={`${FIELD_INPUT} ${icon ? 'pl-10' : ''} ${field.text ? 'pr-10' : ''}`}
        />
        {field.text && (
          <button
            type="button"
            aria-label={`Clear ${label}`}
            onClick={() => onChange(emptyField)}
            className="absolute inset-y-0 right-1.5 my-auto grid size-9 place-items-center rounded-lg text-muted hover:bg-ink/[0.05] hover:text-ink"
          >
            <X aria-hidden className="size-4" />
          </button>
        )}
      </div>
      {listOpen && (
        <ul
          id={`${id}-options`}
          role="listbox"
          className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-2xl bg-surface p-1 shadow-xl ring-1 ring-ink/10"
        >
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
              className={`flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 text-sm ${i === active ? 'bg-ink/[0.05]' : ''}`}
            >
              <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
              <span className="min-w-0">
                <span className="block truncate text-ink">{place.label}</span>
                {place.kind && <span className="block text-xs text-muted capitalize">{place.kind}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
