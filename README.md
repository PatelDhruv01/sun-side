# sun-side

Which side of the bus or car should you sit on to avoid the sun? Instead of guessing from
the direction of the destination, sun-side drives the real road minute by minute and works
out how much direct sun comes through each window.

**Status:** Step 3 of 6, routes and timing (command line only, no UI yet).

## Run it

Needs Node.js 22.18 or newer (it runs the TypeScript directly). Everything it uses is free.

```bash
npm install
npm test
npm run trip -- --from "Ahmedabad" --to "Himatnagar" --depart "2026-12-15 09:00" --arrive "11:00"
```

| Option | Meaning |
|---|---|
| `--from`, `--to` | A place name (`"Swargate, Pune"`) or `"lat,lon"` as Google Maps shows it |
| `--via` | A town the bus goes through, to pin the route (repeat for more) |
| `--depart` | `"YYYY-MM-DD HH:MM"`, `"HH:MM"` (today) or `now` |
| `--arrive` | Arrival time from your ticket: stretches the timeline to fit |
| `--vehicle` | `bus` (default) or `car`: a typical trip time when `--arrive` isn't given |
| `--scale` | Or stretch by hand: `1.3` = 30% slower than the free-flowing car time |
| `--route` | Which of the routes found to show in detail (default 1, the quickest) |
| `--tz` | UTC offset of the times you type (default `+05:30`, IST) |
| `--every` | Minutes per row of the printed timeline (default 10) |
| `--continuity` | How much long unbroken sun matters: `1` = only the total, `2` = default, `3` = a lot |
| `--cool-down` | Minutes to cool off once out of the sun (default 15) |
| `--refresh` | Ignore cached route and place lookups |

Each run prints a verdict (which side, how sure, and why), whether the other routes and a
slightly earlier or later departure agree, the sun on each side, a timeline, and writes two
files to `out/`:

- a `.csv` with one row per minute (time, position, heading, sun direction and height, W/m² on each face)
- a `.geojson` map: drop it on [geojson.io](https://geojson.io) to see the route coloured by sunny side
  (orange = left, blue = right, yellow = ahead/behind, grey = weak sun, dark = night), with the
  other routes found in thin grey

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

## Layout

| Folder | What's in it |
|---|---|
| `src/engine` | Pure TypeScript, no Node APIs, so it can run in the browser later |
| `src/services` | Free web APIs: OSRM and Valhalla routing, Photon and Open-Meteo place search |
| `src/cli` | The `trip` command-line test bench |
| `test` | `node:test` checks: hand-checkable directions, SunCalc cross-check, synthetic roads |

## Data sources

Map data © OpenStreetMap contributors (ODbL). Routing by the public OSRM and Valhalla servers
(FOSSGIS), fair use only: at most 1 request a second, non-commercial. Place search by Photon
(komoot) and Open-Meteo (GeoNames data). Responses are cached in `cache/` so re-runs don't hit
the servers again, and a failed request is retried once.

## Known limits (for now)

- Clear sky only; weather comes in Step 5.
- Without a ticket time, the typical bus and car factors are rough guesses.
- Stops along the way aren't modelled; their time is spread over the whole trip.
- Alternatives depend on what the free engines return; often there is only one route, and
  `--via` is the way to match a bus that goes another way.
- No shade from hills, buildings or trees.
- The scoring thresholds are first guesses, to be tuned on real trips.

## Roadmap

1. ~~Sun engine~~
2. ~~Scoring: the "heat bucket" for unbroken vs broken sun, honest "doesn't matter" answers, seat switching~~
3. ~~Route and timing: place search, via points, alternatives, ticket-time stretch~~
4. Basic web UI: inputs, map, verdict, timeline
5. "Not sure when I leave" mode and weather (Open-Meteo)
6. Polish and free deploy: sharing, return trip, mobile/PWA
