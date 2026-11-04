# Changelog

Notable changes to Sun Side. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-11-04

The first public release, live at https://sun-side.pages.dev.

### Added

- **Sun engine:** the sun's direction and height from NOAA's solar equations (checked against
  SunCalc to within 0.02°), clear-sky direct sunlight, and the sun on each window, minute by
  minute along a route. A command-line trip tool that writes a CSV timeline and a GeoJSON map.
- **Verdicts:** a "heat bucket" score in which long unbroken sun counts extra; clear, slight,
  about-even and little-sun answers; a lean away from low sun in your eyes; seat-change and
  front or back row tips.
- **Routes and timing:** place search (Photon, with Open-Meteo's as a fallback), towns the bus
  goes through, alternative routes from Valhalla labelled by the roads that set them apart,
  typical bus and car times, and stretching to the arrival time on a ticket. Checks whether the
  other routes, and leaving a little earlier or later, give the same answer.
- **The web page:** the search, the verdict, a map of the route coloured by sunny side, and the
  sun on each side window over the trip, with a table view.
- **"Not sure yet":** every departure across a day, half an hour apart, joined into runs that
  share an answer.
- **Weather:** clouds and haze from the Open-Meteo forecast dim the sun, up to 14 days ahead.
- **Start page:** a live demo of a bus on a winding road, how it works, the features, why a
  compass isn't enough, an FAQ, example trips and your recent trips.
- **Answers:** the trip's figures (share in shade, distance, time, forecast), a seat map of the
  bus, how sure it is, and Play the trip, which moves the vehicle along the map with the sun's
  direction.
- **Sharing:** every trip has its own link; Share, Return trip and the back button.
- Light and dark themes, phone layouts, a web app manifest, and motion that stops when
  "reduce motion" is set.
- **Deployment:** Cloudflare Pages, with caching and security headers.
- The MIT licence, a contributor guide, issue forms and CI checks.
