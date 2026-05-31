# 2048

The classic **2048** sliding-tile puzzle, packaged as an installable
**Progressive Web App (PWA)**.

Built from scratch as a standalone Quasar + Capacitor project that drops into the
[`pwa-games`](https://github.com/aaronm84/pwa-games) monorepo. It can be installed
straight to a phone's home screen from the browser — no app store required. It
runs offline, launches full-screen (standalone), uses the device's Vibration API
for haptics and `@capacitor/preferences` (falling back to `localStorage` on the
web) for saving stats and your in-progress board.

## How to play

Swipe (or use the arrow keys / WASD) to slide all tiles in one direction. When
two tiles with the same number touch, they merge into one worth double. A new
tile appears after every move. Reach the **2048** tile to win — then keep going
for a higher score. The game ends when the board is full with no moves left.

## Features

- Smooth slide + merge + pop tile animations.
- **Swipe** controls on touch devices, **arrow keys / WASD** on desktop.
- **Undo** your last move from the in-game menu.
- A **time-of-day theme** that shifts the background through the day.
- Your board is **auto-saved** — close the app and pick up where you left off.
- Stats: best score, best tile, games played and wins.

## Install the dependencies

```bash
npm install
```

## Develop (PWA mode, with service worker + manifest)

```bash
npm run dev          # quasar dev -m pwa
```

To run as a plain SPA without the service worker (handy for fast iteration):

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
with `PUBLIC_PATH=/pwa-games/2048/` so it is served at
`https://aaronm84.github.io/pwa-games/2048/`. Because the app uses the Vue Router
**hash** mode, it works on GitHub Pages without server-side routing config.

To host it standalone instead, build with the public path set to your subpath,
e.g. `PUBLIC_PATH=/your-repo/ npm run build` (or `/` for a custom domain).

## PWA implementation notes

- **Mode/scaffolding:** `src-pwa/` holds the service-worker registration and the
  web app manifest. PWA options live in the `pwa` block of `quasar.config.js`.
- **Manifest:** `src-pwa/manifest.json` — standalone display, portrait
  orientation, warm dark theme (`#3c3a32`), with standard + maskable icons.
- **Icons:** generated from `public/app-icon.svg` into `public/icons/`
  (128–512 + maskable + Apple touch icons).
- **Caching:** the whole app shell is precached for offline use (the game ships
  no audio or large media, so the install stays small).
- **Native plugins:** `@capacitor/preferences`, `@capacitor/haptics`,
  `@capacitor/status-bar` and `@capacitor/app` all ship web implementations, so
  they degrade gracefully in the browser — storage falls back to `localStorage`,
  haptics to the Vibration API, and the status-bar/app-state calls are guarded to
  native-only.
