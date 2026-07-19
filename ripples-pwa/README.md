# Ripples 🪷

A **zen stone-skipping pond in real 3D**, packaged as an installable
**Progressive Web App (PWA)**. Skim stones across an expansive pond — every
skip sends out a ripple, and you must wake every lotus flower before your
stones run out. Rocks reflect your waves (and clack stones out of the air),
drifting lily pads swallow stone and wave alike, and overlapping ripples
combine.

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
- **The bowling control language, on water** — slide to aim along a dashed
  guide, drag down to wind up, snap forward to release: backswing × snap =
  power, and a sideways snap bends the flight. The stone itself is a pure,
  unit-tested flight model (`src/game/skip.js`): gravity, skim-or-plunge
  contacts, per-skip decay.
- **An expansive, living pond** — a low camera behind the thrower, distance
  haze, a ragged tree line, dragonflies, koi that scurry from wavefronts,
  fringe pads bobbing on the swell.
- **A rock garden around the water** — boulder-rimmed banks, a waterfall
  spilling over the far shore (its steady wash on the synth, its perpetual
  gentle ripples on the surface — kept out of the gameplay wave list), dense
  colonies of hand-sized lily pads, canna stands and planted flower drifts
  between the rocks.
- **Kit everything else** — `Stage` (WebGL2, adaptive resolution), `Gestures`
  driving the swing, `outdoorLight` + PBR + GlowLayer + FXAA, sample-free
  synth SFX, kit haptics.

## How to play

**Slide** sideways to aim, **drag down** to wind up, **snap forward** to send
the stone skimming. Every skip ripples the water — harder skips ripple bigger —
and a ripple's power peaks partway through its journey, so where your skips
land matters. The calm circle around a sleeping flower hushes any skip inside
it: wake flowers from beside, not above. Finish at the optimal stone count for
3 stars.

## Features

- Endless seeded levels — the same level number always builds the same pond.
- Wave-physics puzzling: reflection, absorption, interference, accumulation.
- Time-of-day theming — water, light and sky follow your clock (or a manual theme).
- Ambient pond life: koi beneath the surface that scurry from wavefronts,
  swaying reeds, boulder banks, a waterfall with sound and ripples of its own.
- Stars, totals and level progress saved locally — replay any unlocked pond
  from the level picker.
- Loading screen and dialogs dressed in the pond's own time-of-day palette.

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
