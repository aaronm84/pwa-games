# Trails

A **Tsuro-style** path-tile game, packaged as an installable
**Progressive Web App (PWA)**.

Built from scratch as a standalone Quasar + Capacitor project (SVG board + a small
turn-based engine) that drops into the
[`pwa-games`](https://github.com/aaronm84/pwa-games) monorepo. Installable to a
phone's home screen, runs offline and full-screen, with haptics and a saved win
record.

## How to play

You and two CPU rivals each have a token on the edge of a 6×6 board. On your turn,
pick a tile from your hand of three, **rotate** it to taste (a preview shows in the
square in front of your token), and **place** it. Your token then **follows the
path** drawn on the tile, continuing across any tiles it meets, and stops on the
next empty square. If a path runs your token **off the board** — or two tokens are
driven into the same point — those tokens are eliminated. The **last token on the
board wins**.

## Features

- 6×6 SVG board with procedurally generated path tiles (random 4-path matchings).
- Place + **rotate** from a hand of three; live preview in the target square.
- Faithful Tsuro path-following and off-board / collision elimination.
- A safety-seeking **AI** for the two rivals (avoids self-elimination when it can).
- Win record + streak saved; time-of-day background theme.

## Develop / build

```bash
npm install
npm run dev          # quasar dev -m pwa
npm run build        # quasar build -m pwa  -> dist/pwa
```

## Deploying

Ships in the [`pwa-games`](https://github.com/aaronm84/pwa-games) monorepo; the
repo-root workflow builds it with `PUBLIC_PATH=/pwa-games/trails/` and publishes it
to `https://aaronm84.github.io/pwa-games/trails/`.
