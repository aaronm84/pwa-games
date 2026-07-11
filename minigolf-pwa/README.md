# Mini Golf

A **top-down mini golf** game — putt the ball into the cup in as few strokes as
possible — packaged as an installable **Progressive Web App (PWA)**.

Built from scratch as a standalone Quasar + Capacitor project (HTML5 canvas + a
small **custom** top-down physics engine — no game library) that drops into the
[`pwa-games`](https://github.com/aaronm84/pwa-games) monorepo. Installable to a
phone's home screen, runs offline and full-screen, with haptics and saved progress.

## How to play

**Drag back** from the ball — like pulling a slingshot — to aim and set power,
then **release** to putt. The ball rolls with friction and bounces off the course
walls and obstacles. Sink it in the **cup** to finish the hole; each putt is one
**stroke**.

Every hole has a **par** (its target stroke count). Play all nine holes of the
**Front Nine** and try to finish the round **under par**. Ease off the power near
the cup — a ball moving too fast will lip out and roll right over the hole.

## Scoring

- **Hole in one** — sink it on your first putt.
- **Eagle / Birdie** — two / one under par.
- **Par** — right on target.
- **Bogey** and beyond — over par.

A running scorecard tracks every hole; your best full round (total strokes and
score-to-par) and hole-in-one count are saved.

## Course

The bundled **Front Nine** (par 28) is a hand-designed course of nine holes —
straight shots, doglegs, a slalom, a diamond island, a funnel, and a final hole
guarded by a central island. Courses are pure data (`src/game/frontNine.js`:
polygon fairways + obstacle polygons), so new courses are easy to add.

## Develop / build

```bash
npm install
npm run dev          # quasar dev -m pwa
npm run build        # quasar build -m pwa  -> dist/pwa
```

## Deploying

Ships in the [`pwa-games`](https://github.com/aaronm84/pwa-games) monorepo; the
repo-root workflow builds it with `PUBLIC_PATH=/pwa-games/minigolf/` and publishes
it to `https://aaronm84.github.io/pwa-games/minigolf/`.
