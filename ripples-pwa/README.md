# Ripples 🪷

A **zen pond puzzle**, packaged as an installable **Progressive Web App (PWA)**.
Tap the water to send out ripples and wake every lotus flower before your taps
run out — stones reflect your waves, drifting lily pads absorb them, and
overlapping ripples combine.

Originally built in the zenith-app repo; ported here onto the shared
**[`@aaronm84/engine-kit`](../packages/engine-kit)** as the kit's first **2D**
game. The pond keeps its Canvas-2D look, but everything under it is kit:

- **`Stage2D`** (added to the kit by this port) — canvas bootstrap, DPR cap,
  clamped `dt` loop, pause-when-hidden; imported from the Babylon-free
  `@aaronm84/engine-kit/2d` entry so no `@babylonjs/*` peer deps are needed.
- **`Gestures`** — unified touch/mouse taps, with hold-duration measured for
  light/medium/strong ripples.
- **`createSynth`** — the original sampled `.wav` splashes are replaced with
  sample-free WebAudio water plops (filtered noise + a sliding tone).
- **`createHaptics`** — vibration feedback, no-op-safe on iOS Safari.

## How to play

**Tap** the pond to create a ripple; **hold** longer for a slower, stronger one.
A ripple's power peaks partway through its journey, so distance matters. Wake
every lotus within the tap limit: stones bounce waves around the pond, lily pads
sap them, and simultaneous wavefronts add up. Finish at the optimal tap count
for 3 stars.

## Features

- Endless seeded levels — the same level number always builds the same pond.
- Wave-physics puzzling: reflection, absorption, interference, accumulation.
- Time-of-day theming — the pond's palette follows your clock (or a manual theme).
- Ambient pond life: drifting lily pads, swaying reeds, fish that scurry from waves.
- Stars, totals and level progress saved locally.

## Develop / build

```bash
npm install
npm run dev          # quasar dev -m pwa
npm run build        # quasar build -m pwa  -> dist/pwa
```

## Deploying

Ships in the [`pwa-games`](https://github.com/aaronm84/pwa-games) monorepo; the
repo-root workflow builds it with `PUBLIC_PATH=/pwa-games/ripples/` and publishes
it to `https://aaronm84.github.io/pwa-games/ripples/`.
