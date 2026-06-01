# Minesweeper

A modern **Minesweeper**, packaged as an installable **Progressive Web App (PWA)**.

Built from scratch as a standalone Quasar + Capacitor project that drops into the
[`pwa-games`](https://github.com/aaronm84/pwa-games) monorepo. Installable to a
phone's home screen, runs offline and full-screen, with haptics and saved best
times.

## How to play

Tap a square to reveal it — your **first tap is always safe**. Each number tells
you how many of its eight neighbours are mines. **Long-press** (or flip on flag
mode) to flag a suspected mine, and tap a satisfied number to **chord** (clear its
neighbours at once). Reveal every non-mine square to win; hit a mine and it's game
over. Choose **Easy / Medium / Hard** on the menu.

## Features

- Tap to reveal, long-press or flag-mode to flag, chording on numbers.
- **First-click-safe** boards and flood-fill reveal of open areas.
- Three difficulties (8×8 / 12×12 / 14×14) with **best times saved per difficulty**.
- Mine counter, timer, win/lose overlays, time-of-day background theme.

## Develop / build

```bash
npm install
npm run dev          # quasar dev -m pwa
npm run build        # quasar build -m pwa  -> dist/pwa
```

## Deploying

Ships in the [`pwa-games`](https://github.com/aaronm84/pwa-games) monorepo; the
repo-root workflow builds it with `PUBLIC_PATH=/pwa-games/minesweeper/` and
publishes it to `https://aaronm84.github.io/pwa-games/minesweeper/`.
