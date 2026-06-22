# Towers

A **lane tower-defense** game, packaged as an installable **Progressive Web App (PWA)**.

Built from scratch as a standalone Quasar + Capacitor project (HTML5 canvas + a
small **custom** game engine — no game library) that drops into the
[`pwa-games`](https://github.com/aaronm84/pwa-games) monorepo. Installable to a
phone's home screen, runs offline and full-screen, with haptics and saved progress.

## How to play

Enemies march along a fixed path toward your gate. **Tap empty ground** beside the
path to build towers, then hit **Send Wave** when you're ready — there's no timer
between waves. Towers fire automatically; kills earn **gold** to build and upgrade
more. **Tap a tower** to upgrade it (to Lv 3) or sell it back. Every enemy that
reaches the gate costs **lives** — at zero lives the run ends. Survive as many
waves as you can.

## Towers

- **Cannon** — cheap, reliable single-target fire (ground only).
- **Mortar** — lobbed **splash** damage; strong against packs (ground only).
- **Frost** — **slows** enemies and can target **air**.
- **Tesla** — **chains** lightning between enemies and hits **air**.

Flyers cut straight to the gate and can only be hit by Frost & Tesla; armored
enemies shrug off small hits. Two maps, endless escalating waves, best wave + score saved.

## Features

- Canvas board with grid placement, fixed enemy path, and arc-length path following.
- Four towers with distinct roles, three upgrade tiers, and sell-back refunds.
- Six enemy types (incl. flyers, armored, and a boss every 10th wave) with true anti-air.
- Gold economy with kill rewards, wave bonuses, and banked interest; Pause / 1× / 2× speed.

## Develop / build

```bash
npm install
npm run dev          # quasar dev -m pwa
npm run build        # quasar build -m pwa  -> dist/pwa
```

## Deploying

Ships in the [`pwa-games`](https://github.com/aaronm84/pwa-games) monorepo; the
repo-root workflow builds it with `PUBLIC_PATH=/pwa-games/towers/` and publishes
it to `https://aaronm84.github.io/pwa-games/towers/`.
