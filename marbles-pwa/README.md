# Marbles

A **Zuma / Bonsai-Blast-style** marble shooter, packaged as an installable
**Progressive Web App (PWA)**.

Built from scratch as a standalone Quasar + Capacitor project (HTML5 canvas + a
small **custom** path/chain engine — no physics library) that drops into the
[`pwa-games`](https://github.com/aaronm84/pwa-games) monorepo. Installable to a
phone's home screen, runs offline and full-screen, with haptics and saved progress.

## How to play

A chain of coloured marbles creeps along a winding track toward a hole. **Drag**
to aim the launcher and **release** to fire a marble into the chain. Line up
**three or more** of one colour to pop them; popping the front pushes the whole
chain back, and closing a gap between matching colours triggers a **combo**. Clear
the entire chain to beat the level — but if the lead marble reaches the **hole**,
it's game over. **Tap the launcher** to swap your current and next marble.

## Features

- Canvas track with a contiguous advancing chain and arc-length path following.
- Drag-to-aim launcher with a current + next-marble queue and tap-to-swap.
- Match-3 popping with cascading **combos** and a rising score multiplier.
- Shots only use colours still in play; endless levels, best score + level saved.

## Develop / build

```bash
npm install
npm run dev          # quasar dev -m pwa
npm run build        # quasar build -m pwa  -> dist/pwa
```

## Deploying

Ships in the [`pwa-games`](https://github.com/aaronm84/pwa-games) monorepo; the
repo-root workflow builds it with `PUBLIC_PATH=/pwa-games/marbles/` and publishes
it to `https://aaronm84.github.io/pwa-games/marbles/`.
