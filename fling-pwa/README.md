# Fling

An **Angry-Birds-style** slingshot physics game, packaged as an installable
**Progressive Web App (PWA)**.

Built as a standalone Quasar + Capacitor project (HTML5 canvas rendering driven
by the [**matter.js**](https://brm.io/matter-js/) rigid-body physics engine) that
drops into the [`pwa-games`](https://github.com/aaronm84/pwa-games) monorepo.
Installable to a phone's home screen, runs offline and full-screen, with haptics
and saved progress.

## How to play

Each level has a few **targets** perched in or on wooden structures. **Drag back**
from the slingshot to set angle and power — a dotted arc previews the shot — then
**release** to fling. Knock the targets out directly, or topple the towers so
blocks crush them. Clear **every target** before you run out of shots. Finishing
with shots to spare earns a bonus.

## Features

- Real rigid-body physics via **matter.js** — stacked structures topple and
  tumble, blocks crush targets, debris settles.
- Drag-back slingshot aiming with a live dotted **trajectory preview** and
  power proportional to pull distance.
- Five hand-designed levels (post, table, house, crate tower, pyramid) plus
  endless procedurally generated levels beyond.
- Limited shots per level, target clears + leftover-shot bonus scoring, best
  score and highest level saved.

## Develop / build

```bash
npm install
npm run dev          # quasar dev -m pwa
npm run build        # quasar build -m pwa  -> dist/pwa
```

## Deploying

Ships in the [`pwa-games`](https://github.com/aaronm84/pwa-games) monorepo; the
repo-root workflow builds it with `PUBLIC_PATH=/pwa-games/fling/` and publishes
it to `https://aaronm84.github.io/pwa-games/fling/`.

## Credits

Sprites (birds, targets, wooden blocks) from the **Kenney "Physics Assets"** pack
by Kenney — [kenney.nl](https://kenney.nl/assets/physics-assets), licensed
**CC0** (public domain; no attribution required — credited here as a courtesy).
Full license text in `src/assets/fling/KENNEY-LICENSE.txt`.
