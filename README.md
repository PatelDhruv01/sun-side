# sun-side

Which side of the bus or car should you sit on to avoid the sun? Instead of guessing from
the direction of the destination, sun-side drives the real road minute by minute and works
out how much direct sun comes through each window.

**Status:** Step 2 of 6, scoring and verdicts (command line only, no UI yet).

## Run it

Needs Node.js 22.18 or newer (it runs the TypeScript directly). Everything it uses is free.

```bash
npm install
npm test
npm run trip -- --from "Mumbai" --to "Pune" --depart "2026-11-05 07:00"
```

| Option | Meaning |
|---|---|
| `--from`, `--to` | A place name (`"Swargate, Pune"`) or `"lat,lon"` as Google Maps shows it |
| `--depart` | `"YYYY-MM-DD HH:MM"`, `"HH:MM"` (today) or `now` |
| `--arrive` | Arrival time from your ticket: stretches the timeline to fit (buses are slower than cars) |
| `--scale` | Or stretch it by hand: `1.3` = 30% slower than a car |
| `--tz` | UTC offset of the times you type (default `+05:30`, IST) |
| `--every` | Minutes per row of the printed timeline (default 10) |
| `--continuity` | How much long unbroken sun matters: `1` = only the total, `2` = default, `3` = a lot |
| `--cool-down` | Minutes to cool off once out of the sun (default 15) |
| `--refresh` | Ignore cached route and place lookups |

Each run prints a verdict (which side, how sure, and why), the sun on each side, a timeline,
and writes two files to `out/`:

- a `.csv` with one row per minute (time, position, heading, sun direction and height, W/m² on each face)
- a `.geojson` map: drop it on [geojson.io](https://geojson.io) to see the route coloured by sunny side
  (orange = left, blue = right, yellow = ahead/behind, grey = weak sun, dark = night)

## How it works

1. **Route:** OSRM gives the road as a polyline plus the driving time of every little segment.
2. **Timing:** each segment gets a clock time from the departure time and those segment times
   (optionally stretched to match your arrival time).
3. **Sun:** for every segment, the sun's direction and height at that place and time
   ([NOAA's equations](src/engine/solar.ts), checked against the SunCalc library to within 0.02°).
4. **Sunlight:** clear-sky direct sunlight for that sun height, split onto the left, right,
   front and rear windows by the angle between the road and the sun. Windows are treated as
   vertical, so a high noon sun mostly lands on the roof.
5. **Timeline:** segments are summed into one-minute bins.
6. **Verdict** ([decide.ts](src/engine/decide.ts)): each window gets a "heat bucket" that sun
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

## Layout

| Folder | What's in it |
|---|---|
| `src/engine` | Pure TypeScript, no Node APIs, so it can run in the browser later |
| `src/services` | Free web APIs: OSRM routing, Photon place search |
| `src/cli` | The `trip` command-line test bench |
| `test` | `node:test` checks: hand-checkable directions, SunCalc cross-check, synthetic roads |

## Data sources

Map data © OpenStreetMap contributors (ODbL). Routing by the public OSRM server (FOSSGIS),
fair use only: at most 1 request a second, non-commercial. Place search by Photon (komoot).
Responses are cached in `cache/` so re-runs don't hit the servers again.

## Known limits (for now)

- Clear sky only; weather comes in Step 5.
- Car timings unless you give `--arrive` or `--scale`.
- One route, no via points or alternatives yet (Step 3).
- No shade from hills, buildings or trees.
- The scoring thresholds are first guesses, to be tuned on real trips.

## Roadmap

1. ~~Sun engine~~
2. ~~Scoring: the "heat bucket" for unbroken vs broken sun, honest "doesn't matter" answers, seat switching~~
3. Route and timing: place search, via points, alternatives, ticket-time stretch
4. Basic web UI: inputs, map, verdict, timeline
5. "Not sure when I leave" mode and weather (Open-Meteo)
6. Polish and free deploy: sharing, return trip, mobile/PWA
