# Dots

A **Two Dots–style** connect-the-dots puzzle, packaged as an installable
**Progressive Web App (PWA)**.

Built from scratch as a standalone Quasar + Capacitor project that drops into the
[`pwa-games`](https://github.com/aaronm84/pwa-games) monorepo. Installable to a
phone's home screen, runs offline and full-screen, with haptics and a saved best
score.

## How to play

Drag between **adjacent dots of the same colour** (up/down/left/right) to link
them, then release to clear them and score. New dots drop in from the top. Close a
**loop** (link back into a square or larger ring) to clear **every** dot of that
colour at once — worth double. You get **30 moves**; rack up the highest score you
can.

## Features

- Smooth drag-to-connect with a live link line and pop animations.
- **Loop detection** that clears a whole colour for a big bonus.
- Gravity refill, 30-move score-attack rounds, best score saved.
- Time-of-day background theme; haptics on connect/clear.

## Develop / build

```bash
npm install
npm run dev          # quasar dev -m pwa
npm run build        # quasar build -m pwa  -> dist/pwa
```

## Deploying

Ships in the [`pwa-games`](https://github.com/aaronm84/pwa-games) monorepo; the
repo-root workflow builds it with `PUBLIC_PATH=/pwa-games/dots/` and publishes it
to `https://aaronm84.github.io/pwa-games/dots/`.
