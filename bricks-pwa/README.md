# Bricks

A **Breakout / Arkanoid-style** brick breaker, packaged as an installable
**Progressive Web App (PWA)**.

Built from scratch as a standalone Quasar + Capacitor project (HTML5 canvas + a
small **custom** physics engine — no game library) that drops into the
[`pwa-games`](https://github.com/aaronm84/pwa-games) monorepo. Installable to a
phone's home screen, runs offline and full-screen, with haptics and saved progress.

## How to play

**Drag** left and right to move the paddle, and **tap** to launch the ball. Bounce
it off the paddle to smash every brick on the level — where the ball hits the
paddle steers its bounce, so the edges angle it more. Don't let the ball fall past
the paddle: each miss costs a life, and it's game over at zero. Clear the wall to
advance to the next, tougher level.

## Features

- Custom circle-vs-AABB physics with sub-stepping (no tunnelling at speed).
- Paddle-position steering for precise aim, and a ball-speed ramp per level.
- Multi-hit bricks (colour-coded by remaining hits) and endless generated levels.
- **Power-ups** dropped by bricks: Multi (3 balls), Wide paddle, Slow ball, +1 life.
- Break particles, floating score, best score + level saved.

## Develop / build

```bash
npm install
npm run dev          # quasar dev -m pwa
npm run build        # quasar build -m pwa  -> dist/pwa
```

## Deploying

Ships in the [`pwa-games`](https://github.com/aaronm84/pwa-games) monorepo; the
repo-root workflow builds it with `PUBLIC_PATH=/pwa-games/bricks/` and publishes
it to `https://aaronm84.github.io/pwa-games/bricks/`.
