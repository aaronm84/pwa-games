# SpaceWolf

An on-rails 3D space dogfighter inspired by Star Fox, packaged as an installable
**Progressive Web App (PWA)**.

Built as a standalone Quasar + Capacitor project that renders a 3D scene with
**Babylon.js**. Installable to a phone or iPad's home screen; runs offline in
landscape, with a touch-friendly control bar (d-pad arrows + 5 action buttons)
for fire, special weapon, weapon cycle, barrel roll, and turbo boost.

## Controls

The on-screen control bar sits at the bottom of the screen:

- **Left / right arrows** (far edges) — steer
- **Fire** — main cannon
- **Special** — fire current special weapon
- **Cycle** — switch special weapon
- **Roll** — barrel roll
- **Turbo** — boost forward

The ship auto-flies forward; the camera is a 3/4 chase view.

## Stack

- [Quasar 2](https://quasar.dev) + Vue 3 + Pinia (UI shell, PWA infrastructure)
- [Babylon.js](https://www.babylonjs.com/) (3D engine; runs WebGL2 on iOS Safari)
- Capacitor (optional native wrappers for iOS/Android)

## Develop / build

```bash
npm install
npm run dev          # quasar dev -m pwa
npm run build        # quasar build -m pwa  -> dist/pwa
```

## Deploying

Ships in the [`pwa-games`](https://github.com/aaronm84/pwa-games) monorepo; the
repo-root workflow builds it with `PUBLIC_PATH=/pwa-games/spacewolf/` and
publishes it to `https://aaronm84.github.io/pwa-games/spacewolf/`.

## Status

Scaffold: playable ship auto-flies forward through a starfield, 3/4 chase camera,
touch HUD wired up to an input store. Weapons, enemies, audio, and real art come next.
