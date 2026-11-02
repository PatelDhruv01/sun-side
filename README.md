# sun-side

Which side of the bus or car should you sit on to avoid the sun? Instead of guessing from
the direction of the destination, sun-side drives the real road minute by minute and works
out how much direct sun comes through each window.

**Status:** Step 6 of 6, polish done (free deploy still to do).

## Run it

Needs Node.js 22.18 or newer (it runs the TypeScript directly). Everything it uses is free.

```bash
npm install
npm test
npm run dev
```

`npm run dev` serves the web page at http://localhost:5173: pick the places (suggestions come
as you type), the date and times, bus or car, and it shows where to sit, a map of the route
coloured by sunny side, and the sun on each side window over the trip. Choose **Not sure yet**
instead of a time and it works out every departure that day ("leave 06:00–12:00: sit LEFT…");
pick one for the full answer. `npm run build` makes the static site in `dist/`.

The page opens on a short explainer (how it works, why a compass isn't enough, FAQ) with
the search up top and one-click example trips. An answer shows a seat map of the bus, the
sun time on each side, any seat change worth making, and how sure it is. Every trip lives in
the address bar, so **Share** (or copying the link) opens the same answer elsewhere, and the
back button steps through your searches. **Return trip** flips the places and shows the whole
day for the way back. It has light and dark themes (following the system until you pick one),
works on phones, and can be added to a home screen.

The same engine runs from the command line, with more detail and knobs:

```bash
npm run trip -- --from "Ahmedabad" --to "Himatnagar" --depart "2026-11-15 09:00" --arrive "11:00"
npm run trip -- --from "Ahmedabad" --to "Himatnagar" --depart "2026-11-15" --hours 2
```

| Option | Meaning |
|---|---|
| `--from`, `--to` | A place name (`"Swargate, Pune"`) or `"lat,lon"` as Google Maps shows it |
| `--via` | A town the bus goes through, to pin the route (repeat for more) |
| `--depart` | `"YYYY-MM-DD HH:MM"`, `"HH:MM"` (today) or `now`; a date alone works out every departure that day |
| `--arrive` | Arrival time from your ticket: stretches the timeline to fit |
| `--hours` | With a date alone: how long the trip takes |
| `--vehicle` | `bus` (default) or `car`: a typical trip time when `--arrive` isn't given |
| `--scale` | Or stretch by hand: `1.3` = 30% slower than the free-flowing car time |
| `--route` | Which of the routes found to show in detail (default 1, the quickest) |
| `--tz` | UTC offset of the times you type (default `+05:30`, IST) |
| `--every` | Minutes per row of the printed timeline (default 10) |
| `--continuity` | How much long unbroken sun matters: `1` = only the total, `2` = default, `3` = a lot |
| `--cool-down` | Minutes to cool off once out of the sun (default 15) |
| `--no-weather` | Assume a clear sky instead of using the forecast |
| `--refresh` | Ignore cached lookups, forecasts included |

Each run prints a verdict (which side, how sure, and why), whether the other routes and a
slightly earlier or later departure agree, the sun on each side, a timeline, and writes two
files to `out/`:

- a `.csv` with one row per minute (time, position, heading, sun direction and height, W/m² on each face)
- a `.geojson` map: drop it on [geojson.io](https://geojson.io) to see the route coloured by sunny side
  (blue = left, orange = right, aqua = ahead/behind, light grey = weak sun, dark grey = night),
  with the other routes found in thin grey. These are the web page's colours too: categorical
  slots 1-3 of a palette checked for colour-blind separation in light and dark mode.

## How it works

1. **Places:** Photon finds towns, bus stands and streets; when it's unreachable (it often is),
   Open-Meteo's place search covers towns and cities.
2. **Routes** ([routing.ts](src/services/routing.ts)): OSRM gives the road as a polyline plus the
   driving time of every little segment. Valhalla adds alternative routes, which OSRM rarely
   finds; its own times run far too slow for India, so they're rescaled against OSRM's. Routes
   that differ only by a few streets out of town (all but 15 km and 80% shared) count as one.
   Each route is labelled by the roads that set it apart ("via NH147, SH41"). Via towns pin
   the route; neither engine offers alternatives then.
3. **Timing** ([timing.ts](src/engine/timing.ts)): OSRM's times assume free-flowing traffic, so
   without a ticket the timeline uses a typical trip: 1.5× for a bus, 1.25× for a car (rough
   factors from usual Indian journey times). With `--arrive`, it's stretched to fit exactly.
4. **Sun:** for every segment, the sun's direction and height at that place and time
   ([NOAA's equations](src/engine/solar.ts), checked against the SunCalc library to within 0.02°).
5. **Sunlight:** clear-sky direct sunlight for that sun height, split onto the left, right,
   front and rear windows by the angle between the road and the sun. Windows are treated as
   vertical, so a high noon sun mostly lands on the roof.
   **Weather** ([weather.ts](src/engine/weather.ts)): for dates up to about two weeks ahead,
   Open-Meteo's hourly forecast for each 0.5° square (about 55 km) the routes cross. Each hour it
   says how much of the clear-sky sun gets through (clouds, and haze, which takes 5–20% even on
   clear days); that share scales the minute-by-minute clear-sky value, so a cloudy stretch counts
   for less. Beyond the forecast, a clear sky.
6. **Timeline:** segments are summed into one-minute bins.
7. **Verdict** ([decide.ts](src/engine/decide.ts)): each window gets a "heat bucket" that sun
   fills and shade drains (15-minute cool-down). The heat score adds up how full the bucket
   is, squared, so one long unbroken stretch counts for more than the same sun in short
   bursts: 60 unbroken minutes score like about 95 minutes in 10-minute bursts. Then:
   - the side with the lower score wins: "clear" if the other is at least twice as bad and
     about 20 strong-sun minutes worse, otherwise "only slightly better";
   - within 15% of each other is "either", with a lean to the side with less low sun in
     your eyes (glare) when that differs by 10+ minutes;
   - very little heat on both sides is "either" too;
   - a single seat change is suggested when it cuts the heat by at least 25%;
   - a rows tip appears when the windscreen or rear window gets a lot of sun.
8. **Checks** ([evaluate.ts](src/engine/evaluate.ts)): the verdict is worked out for every route
   found and for leaving 30 minutes early, 30 minutes late and an hour late, and the output says
   whether they agree.
9. **Not sure when** ([sweep.ts](src/engine/sweep.ts)): the verdict for every departure that day,
   half an hour apart, joined into runs that share one ("either side" split by why: after dark,
   little sun, or about even).

## Layout

| Folder | What's in it |
|---|---|
| `src/engine` | The sun, the simulation and the verdict: pure TypeScript, runs in Node and the browser |
| `src/services` | Free web APIs: OSRM and Valhalla routing, Photon and Open-Meteo place search |
| `src/app` | Shared by the page and the command line: the trip pipeline, the verdict in words, map stretches |
| `src/web` | The web page: React, Tailwind and MapLibre, built with Vite |
| `src/cli` | The `trip` command-line test bench |
| `test` | `node:test` checks: hand-checkable directions, SunCalc cross-check, synthetic roads, fake API answers |

## Data sources

Map data © OpenStreetMap contributors (ODbL); map tiles by OpenFreeMap (free, no key, no limits).
Routing by the public OSRM and Valhalla servers (FOSSGIS), fair use only: at most 1 request a
second, non-commercial. Place search by Photon (komoot) and Open-Meteo (GeoNames data). Weather
from Open-Meteo's forecast API (free for non-commercial use), one request per trip. The
command line caches responses in `cache/`; the page fetches each URL once per visit and waits
for a pause in typing before searching. A failed request is retried once.

## Known limits (for now)

- The forecast reaches about two weeks ahead, in 0.5° squares; further out it's a clear sky.
- Without a ticket time, the typical bus and car factors are rough guesses.
- Stops along the way aren't modelled; their time is spread over the whole trip.
- Alternatives depend on what the free engines return; often there is only one route, and
  `--via` is the way to match a bus that goes another way.
- No shade from hills, buildings or trees.
- The scoring thresholds are first guesses, to be tuned on real trips.
- The page reads and shows times in the reader's own time zone.
- The page's script is about 100 KB compressed; the map (about 290 KB, mostly MapLibre) loads
  only once there's an answer to show.

## Roadmap

1. ~~Sun engine~~
2. ~~Scoring: the "heat bucket" for unbroken vs broken sun, honest "doesn't matter" answers, seat switching~~
3. ~~Route and timing: place search, via points, alternatives, ticket-time stretch~~
4. ~~Basic web UI: inputs, map, verdict, timeline~~
5. ~~"Not sure when I leave" mode and weather (Open-Meteo)~~
6. Polish and free deploy: ~~landing page, sharing, return trip, themes, mobile/PWA~~; free hosting next
