# Wildcard

A **poker roguelike** — build scoring poker hands, collect jokers, and beat the
blinds — packaged as an installable **Progressive Web App (PWA)**.

Built from scratch as a standalone Quasar + Capacitor project (Vue 3, no game
library) that drops into the
[`pwa-games`](https://github.com/aaronm84/pwa-games) monorepo. Installable to a
phone's home screen, runs offline and full-screen, with haptics and saved progress.

## How to play

Each **blind** sets a chip target. **Tap** up to **five** cards from your hand and
**Play Hand** to score them as a poker hand — the score is *chips × mult*. **Discard**
cards you don't want to draw replacements (both hands and discards are limited).
Beat the target to clear the blind and earn **cash**.

Clear all three blinds in an **ante**, then push your luck through **eight antes**
to win the run. The third blind of every ante is a **Boss Blind** that adds a twist
(fewer hands, a dead suit, halved scores…) — read it before you play.

## Scoring

- Each poker hand type has a **base chips & mult** (a Flush beats a Pair).
- Every scoring card adds its rank in **chips** (face = 10, ace = 11).
- **Jokers** add chips, add mult, or multiply your mult.
- Final score = **(base + card chips) × total mult**.

## Features

- Full Balatro-style loop: eight antes × three blinds, with Boss Blind twists.
- Between blinds, spend **cash** in the **shop** on a deck of collectible **jokers**
  (flat chips, flat mult, and the coveted ×mult scalers).
- Leftover **hands** at a cleared blind pay a bonus — banking hands is a real choice.
- Best ante, best score, and runs won/played are saved via Capacitor Preferences.

## Develop / build

```bash
npm install
npm run dev          # quasar dev -m pwa
npm run build        # quasar build -m pwa  -> dist/pwa
```

## Deploying

Ships in the [`pwa-games`](https://github.com/aaronm84/pwa-games) monorepo; the
repo-root workflow builds it with `PUBLIC_PATH=/pwa-games/wildcard/` and publishes
it to `https://aaronm84.github.io/pwa-games/wildcard/`.
