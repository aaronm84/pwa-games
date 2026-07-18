# Ripples 🪷

A **zen pond puzzle in real 3D**, packaged as an installable **Progressive Web
App (PWA)**. Tap the water to send out ripples and wake every lotus flower
before your taps run out — stones reflect your waves, drifting lily pads absorb
them, and overlapping ripples combine.

Originally a 2D canvas game in the zenith-app repo, now rebuilt on the shared
**[`@aaronm84/engine-kit`](../packages/engine-kit)** (Babylon.js 7 + Havok),
alongside Mini Golf 3D and Alley Nights:

- **A real water surface** — a polar-grid mesh whose vertices ride the wave
  model every frame, so wavefronts are actual moving geometry (plus a glowing
  ring so their power stays readable).
- **Havok under the drift** — the pond is a gravity-zero water world: drifting
  lily pads are dynamic bodies shoved by wavefront impulses, colliding with
  stones, each other, and the invisible protection cylinder around every
  sleeping lotus. Heavy linear damping plays the role of water drag.
- **A pure wave model** (`src/game/waves.js`) — five-zone power curve,
  one-shot reflection/absorption, constructive interference, accumulation —
  unit-tested headless (`npm test`), shared by gameplay and water rendering.
- **Kit everything else** — `Stage` (WebGL2, adaptive resolution), `Gestures`
  (hold-timed taps → light/medium/strong ripples), `outdoorLight` + PBR +
  GlowLayer + FXAA, sample-free synth SFX, kit haptics.

## How to play

**Tap** the pond to create a ripple; **hold** longer for a slower, stronger one.
A ripple's power peaks partway through its journey, so distance matters. Wake
every lotus within the tap limit: stones bounce waves around the pond, lily pads
sap them, and simultaneous wavefronts add up. Finish at the optimal tap count
for 3 stars.

## Features

- Endless seeded levels — the same level number always builds the same pond.
- Wave-physics puzzling: reflection, absorption, interference, accumulation.
- Time-of-day theming — water, light and sky follow your clock (or a manual theme).
- Ambient pond life: koi beneath the surface that scurry from wavefronts,
  swaying reeds, pebbled banks.
- Stars, totals and level progress saved locally.

## Develop / build

```bash
npm install
npm run dev          # quasar dev -m pwa
npm test             # pure wave-model + level-generator checks
npm run build        # quasar build -m pwa  -> dist/pwa
```

A DEV-only hook (`window.__ripples()`) exposes game state and a `tap(x, z,
strength)` injector, so a headless Playwright run can play a level end-to-end
(the engine renders under SwiftShader).

## Deploying

Ships in the [`pwa-games`](https://github.com/aaronm84/pwa-games) monorepo; the
repo-root workflow builds it with `PUBLIC_PATH=/pwa-games/ripples/` and publishes
it to `https://aaronm84.github.io/pwa-games/ripples/`.
