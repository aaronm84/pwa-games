# 2248

A **2248**-style connect-and-merge number puzzle (the "2248 / Numbers" genre),
packaged as an installable **Progressive Web App (PWA)**.

Built from scratch as a standalone Quasar + Capacitor project that drops into the
[`pwa-games`](https://github.com/aaronm84/pwa-games) monorepo. It can be installed
straight to a phone's home screen from the browser — no app store required. It
runs offline, launches full-screen (standalone), uses the device's Vibration API
for haptics and `@capacitor/preferences` (falling back to `localStorage` on the
web) for saving stats and your in-progress board.

## How to play

The board loads **completely full** of numbered tiles. **Drag** across a line of
touching tiles (horizontally, vertically or diagonally): start on two equal
numbers, then keep extending to tiles that match the running total — `2 → 2 → 4 →
8` (that's where the name comes from). Release and the whole chain merges into a
single tile worth their sum. Tiles above fall down and fresh ones drop in from the
top, so the board always stays full. The game ends only when no two touching tiles
share a value.

## Features

- Drag-to-connect chains with a live preview of the tile you'll make.
- Slide (gravity), merge-pop and spawn animations.
- **Undo** your last merge from the in-game menu.
- A **time-of-day theme** that shifts the background through the day.
- Your board is **auto-saved** — close the app and pick up where you left off.
- Stats: best score, best tile and games played.

## Install the dependencies

```bash
npm install
```

## Develop (PWA mode, with service worker + manifest)

```bash
npm run dev          # quasar dev -m pwa
```

To run as a plain SPA without the service worker:

```bash
npm run dev:spa      # quasar dev
```

## Build for production

```bash
npm run build        # quasar build -m pwa  -> outputs to dist/pwa
```

## Preview the production build locally

```bash
npm run serve        # serves dist/pwa at http://localhost:9000
```

## Deploying to GitHub Pages

This game ships inside the [`pwa-games`](https://github.com/aaronm84/pwa-games)
monorepo. The repo-root workflow (`.github/workflows/deploy.yml`) builds every
game on each push to `main` and publishes them to GitHub Pages, building this one
with `PUBLIC_PATH=/pwa-games/2248/` so it is served at
`https://aaronm84.github.io/pwa-games/2248/`. Because the app uses the Vue Router
**hash** mode, it works on GitHub Pages without server-side routing config.

## PWA implementation notes

- **Mode/scaffolding:** `src-pwa/` holds the service-worker registration and the
  web app manifest. PWA options live in the `pwa` block of `quasar.config.js`.
- **Manifest:** `src-pwa/manifest.json` — standalone display, portrait
  orientation, dark teal theme (`#123a37`), with standard + maskable icons.
- **Icons:** generated from `public/app-icon.svg` into `public/icons/`.
- **Caching:** the whole app shell is precached for offline use.
- **Native plugins:** `@capacitor/preferences`, `@capacitor/haptics`,
  `@capacitor/status-bar` and `@capacitor/app` all ship web implementations, so
  they degrade gracefully in the browser.
