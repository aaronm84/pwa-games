# Snake

A modern take on the classic **Snake**, packaged as an installable
**Progressive Web App (PWA)**.

Built from scratch as a standalone Quasar + Capacitor project that drops into the
[`pwa-games`](https://github.com/aaronm84/pwa-games) monorepo. Installable to a
phone's home screen, runs offline and full-screen, with haptics and saved best
score.

## How to play

Swipe on the board (or use the **arrow keys / WASD**) to steer the snake. Eat the
red food to grow and score; the snake speeds up as it gets longer. Grab the gold
**★ bonus** before it disappears for extra points. Don't run into the walls or
your own tail — or turn on **Wrap Walls** in Settings for a gentler game.

## Features

- Swipe + keyboard controls, with a direction buffer so quick turns feel right.
- Speed ramps up as you grow; timed **bonus** pickups for risk/reward.
- **Wrap Walls** option (pass through edges) in Settings.
- Pause/resume, screen-shake on crash, juicy head highlight.
- Best score saved; time-of-day background theme.

## Develop / build

```bash
npm install
npm run dev          # quasar dev -m pwa
npm run build        # quasar build -m pwa  -> dist/pwa
```

## Deploying

Ships in the [`pwa-games`](https://github.com/aaronm84/pwa-games) monorepo; the
repo-root workflow builds it with `PUBLIC_PATH=/pwa-games/snake/` and publishes it
to `https://aaronm84.github.io/pwa-games/snake/`. Hash-mode routing, so no
server-side config needed.
