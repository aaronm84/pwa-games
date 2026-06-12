# Gems

A **match-3** puzzle (Bejeweled / Candy Crush style), packaged as an installable
**Progressive Web App (PWA)**.

Built from scratch as a standalone Quasar + Capacitor project that drops into the
[`pwa-games`](https://github.com/aaronm84/pwa-games) monorepo. Installable to a
phone's home screen, runs offline and full-screen, with haptics and a saved best
score.

## How to play

Swap two neighbouring gems — by **swiping** one into the other or **tapping** two
adjacent gems — to line up **three or more** of the same colour. A swap only sticks
if it makes a match; otherwise it snaps back. Cleared gems drop and new ones fall
in, which can **chain into combos** for big multipliers. You have **25 moves** to
score as high as you can.

- Match **4** → a **✛ blast** gem that clears its row and column.
- Match **5** → a **★ bomb** that clears every gem of that colour.
- The board **reshuffles** automatically if no valid swaps remain.

## Develop / build

```bash
npm install
npm run dev          # quasar dev -m pwa
npm run build        # quasar build -m pwa  -> dist/pwa
```

## Deploying

Ships in the [`pwa-games`](https://github.com/aaronm84/pwa-games) monorepo; the
repo-root workflow builds it with `PUBLIC_PATH=/pwa-games/gems/` and publishes it
to `https://aaronm84.github.io/pwa-games/gems/`.
