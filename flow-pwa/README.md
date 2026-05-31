# Flow

A **Flow Free–style** pipe-connect puzzle, packaged as an installable
**Progressive Web App (PWA)**.

Built from scratch as a standalone Quasar + Capacitor project that drops into the
[`pwa-games`](https://github.com/aaronm84/pwa-games) monorepo. It can be installed
straight to a phone's home screen from the browser — no app store required. It
runs offline, launches full-screen (standalone), uses the device's Vibration API
for haptics and `@capacitor/preferences` (falling back to `localStorage` on the
web) for saving progress and your in-progress board.

## How to play

Each level shows a grid with pairs of coloured dots. **Drag from a dot to its
match** to lay a pipe between them (pipes run between squares that touch up, down,
left or right). Pipes can't cross — drawing over another colour cuts it short.
A level is solved when **every pair is connected and every square is filled**.
Drag back along a pipe to erase it, or redraw from a dot to start that colour over.

## Features

- Smooth drag-to-draw with overwrite-on-cross and backtrack-to-erase.
- Live pipe rendering, coverage % and connected-flows counter.
- **Endless, deterministic levels** — a built-in generator guarantees every level
  is solvable with full coverage; levels grow and add colours as you advance.
- A **time-of-day theme** that shifts the background through the day.
- Your board is **auto-saved** — close the app and pick up where you left off.
- Progress: highest level reached and total levels solved.

## Levels

Levels are generated procedurally from a seed derived from the level number
(`src/pages/FlowPage.vue`), so each level is the same every time and is always
solvable. The generator carves a Hamiltonian path across the grid (with a
serpentine fallback) and splits it into colour segments, which guarantees a
full-coverage solution exists.

## Install the dependencies

```bash
npm install
```

## Develop / build

```bash
npm run dev          # quasar dev -m pwa
npm run build        # quasar build -m pwa  -> dist/pwa
npm run serve        # serve the production build at http://localhost:9000
```

## Deploying to GitHub Pages

This game ships inside the [`pwa-games`](https://github.com/aaronm84/pwa-games)
monorepo. The repo-root workflow (`.github/workflows/deploy.yml`) builds every
game on each push to `main` and publishes them to GitHub Pages, building this one
with `PUBLIC_PATH=/pwa-games/flow/` so it is served at
`https://aaronm84.github.io/pwa-games/flow/`. The app uses Vue Router **hash**
mode, so it works on GitHub Pages without server-side routing config.

## PWA implementation notes

- **Manifest:** `src-pwa/manifest.json` — standalone, portrait, dark navy theme
  (`#16213e`), with standard + maskable icons.
- **Icons:** generated from `public/app-icon.svg` into `public/icons/`.
- **Caching:** the whole app shell is precached for offline use.
- **Native plugins:** `@capacitor/preferences`, `@capacitor/haptics`,
  `@capacitor/status-bar` and `@capacitor/app` all ship web implementations and
  degrade gracefully in the browser.
