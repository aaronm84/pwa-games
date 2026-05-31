# Solitaire

A relaxing **Klondike solitaire** card game, packaged as an installable
**Progressive Web App (PWA)**.

This game was extracted from the multi-game *Zenith* app into its own standalone
Quasar + Capacitor project, then set up as a PWA so it can be installed straight
to a phone's home screen from the browser — no app store required. It runs
offline, launches full-screen (standalone), uses the device's Vibration API for
haptics and `@capacitor/preferences` (falling back to `localStorage` on the web)
for saving stats and your in-progress game.

## Features

- Classic Klondike solitaire — drag cards, build the tableau down in alternating
  colours, and build the foundations up by suit.
- **Draw one or draw three** modes (Settings → Gameplay).
- **Double-tap** a card to auto-send it to its foundation, plus a one-tap
  **Auto-Complete** once the board is fully face-up.
- Gentle **hints** wiggle a movable card when you've been idle.
- A **time-of-day theme** that shifts the table colours through the day.
- Your game is **auto-saved** — close the app and pick up where you left off.
- Stats: games won, win rate, fastest time, fewest moves and win streaks.

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

The PWA must be served over HTTP (opening `index.html` via `file://` won't work,
and service workers require HTTPS or `localhost`):

```bash
npm run serve        # serves dist/pwa at http://localhost:9000
```

## Installing on your phone

The app must be served over **HTTPS** (or `localhost`) for the service worker and
"Add to Home Screen" to work. Deploy `dist/pwa` to any static host — e.g.
Netlify, Vercel, Cloudflare Pages, or GitHub Pages — then:

- **iOS (Safari):** open the site, tap the **Share** button, then **Add to Home
  Screen**.
- **Android (Chrome):** open the site, then use the **Install app** prompt or the
  ⋮ menu → **Install app / Add to Home screen**.

Once installed it launches in standalone full-screen mode with the Solitaire icon.

### Deploying to GitHub Pages

This game ships inside the [`pwa-games`](https://github.com/aaronm84/pwa-games)
monorepo. The repo-root workflow (`.github/workflows/deploy.yml`) builds every
game on each push to `main` and publishes them to GitHub Pages, building this one
with `PUBLIC_PATH=/pwa-games/solitaire/` so it is served at
`https://aaronm84.github.io/pwa-games/solitaire/`. Because the app uses the Vue
Router **hash** mode, it works on GitHub Pages without server-side routing config.

To host it standalone instead, build with the public path set to your subpath,
e.g. `PUBLIC_PATH=/your-repo/ npm run build` (or `/` for a custom domain).

## PWA implementation notes

- **Mode/scaffolding:** `src-pwa/` holds the service-worker registration and the
  web app manifest. PWA options live in the `pwa` block of `quasar.config.js`.
- **Manifest:** `src-pwa/manifest.json` — standalone display, portrait
  orientation, green card-table theme (`#1b4332`), with standard + maskable icons.
- **Icons:** generated from `public/app-icon.svg` into `public/icons/`
  (128–512 + maskable + Apple touch icons).
- **Caching:** the whole app shell is precached for offline use (the game ships
  no audio or large media, so the install stays small).
- **Native plugins:** the Capacitor plugins used by the game
  (`@capacitor/preferences`, `@capacitor/haptics`, `@capacitor/status-bar`,
  `@capacitor/app`) all ship web implementations, so they degrade gracefully in
  the browser — storage falls back to `localStorage`, haptics to the Vibration
  API, and the status-bar/app-state calls are guarded to native-only.

## Customize the configuration

See [Configuring quasar.config.js](https://v2.quasar.dev/quasar-cli-vite/quasar-config-js)
and [Quasar PWA mode](https://v2.quasar.dev/quasar-cli-vite/developing-pwa/introduction).
