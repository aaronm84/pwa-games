# Slots

A **free casino slot machine** (for-fun, no real money), packaged as an
installable **Progressive Web App (PWA)**.

Built from scratch as a standalone Quasar + Capacitor project (HTML5 canvas reel
engine, no game library) that drops into the
[`pwa-games`](https://github.com/aaronm84/pwa-games) monorepo. Installable to a
phone's home screen, runs offline and full-screen, with haptics and a persistent
credit balance.

## How to play

Set your bet and hit **SPIN** (or **Auto**). Match **3+ symbols** left-to-right
on any of the 20 paylines to win credits. Rarer symbols and longer matches pay
more. It's all virtual — build your bankroll and chase the jackpot.

- **💎 Diamond** is Wild — substitutes for any symbol and pays the top prize.
- **💰 Coin** is Scatter — 3+ anywhere pays out and triggers **Free Spins** (×2 wins).
- Five 💎 on a line hits the **progressive Jackpot** that grows with every bet.
- Out of credits? A **top-up** keeps you spinning, plus a **daily bonus** each day.

## Machines

A **lobby** lets you switch between machines that all share one bankroll:

- **Gem Fortune** — 5×3 reels, 20 lines, Wild + Scatter, Free Spins, progressive jackpot.
- **Lucky 7s** — classic single-line 3-reel with a **Hold** feature and pixel-art symbols; 7-7-7 hits the shared jackpot.

Planned: a cascading/tumbling machine (Sugar Tumble) and a Megaways-style machine (Wild Ways).

## Credits

Symbol art adapted from downloaded slot-symbol illustration sets (used privately,
non-commercially). This build is a personal/family project.

## Develop / build

```bash
npm install
npm run dev          # quasar dev -m pwa
npm run build        # quasar build -m pwa  -> dist/pwa
```

## Deploying

Ships in the [`pwa-games`](https://github.com/aaronm84/pwa-games) monorepo; the
repo-root workflow builds it with `PUBLIC_PATH=/pwa-games/slots/` and publishes
it to `https://aaronm84.github.io/pwa-games/slots/`.
