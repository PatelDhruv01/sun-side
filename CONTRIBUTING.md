# Contributing to Sun Side

Thanks for helping. A report of a wrong side is as useful as code: it's how the scoring gets
tuned.

## Reporting

- **It said one side, but the sun was on the other:** use the *Wrong side* issue form and paste
  the link from the address bar. Every trip has one.
- **Something is broken:** use the *Bug report* form.
- **An idea:** use the *Idea* form.
- **A security problem:** see [SECURITY.md](SECURITY.md), and please don't open a public issue.

## Getting set up

You need Node.js 22.18 or newer. The site is built with Node 24, which `.node-version` names.

```bash
git clone https://github.com/PatelDhruv01/sun-side.git
cd sun-side
npm install
npm run dev
```

The page is then at http://localhost:5173. The [README](README.md#run-it-yourself) lists the
other scripts and the command-line trip tool.

## Before a pull request

```bash
npm run typecheck
npm test
npm run build
```

For changes to the page, also check it in the light and dark themes and at phone width (about
375 pixels), and with "reduce motion" switched on if you touched an animation.

## How the code is organised

See [Project layout](README.md#project-layout) in the README. In short: `src/engine` works out
the sun and the verdict, `src/services` talks to the free web services, `src/app` is shared by
the page and the command line, and `src/web` is the page.

## Conventions

- **TypeScript that Node runs directly.** Import local files with their extension
  (`'../engine/types.ts'`).
- **The engine stays pure:** no DOM and no network. The services take an injected `fetchJson`,
  so the tests pass fakes (see `test/fakes.ts`) and never touch the network.
- **Units go in names or doc comments:** degrees clockwise from north, metres, seconds,
  milliseconds since the epoch, W/m².
- **Comments say why,** in plain sentences, and names say what a thing is on the trip
  (`departure`, `heading`, `sunMinutes`).
- **Colours:** the three sun colours are for data (the map, the timeline, the day strip); text
  always uses the ink tokens. The comment at the top of `src/web/style.css` explains.
- **Motion is decoration:** everything has to work, and read, with "reduce motion" set.

## Branches and commits

- One branch per change, merged into `main` when it's ready. `main` goes live on its own;
  Cloudflare builds a preview link for every other branch.
- Commit messages: a short summary line that says what the commit does ("Add a wrong-side issue
  form"), then, if it helps, a blank line and a few bullet points.

## Going easy on the free services

The routing, place-search and weather servers are free and shared, for fair, non-commercial
use, and the routing servers ask for at most one request a second. Don't add calls on every
keystroke or inside loops; reuse what's already been fetched. When experimenting, the command
line caches responses in `cache/`.

## Licence

By contributing, you agree that your contributions are licensed under the project's
[MIT licence](LICENSE).
