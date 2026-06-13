# Pegs

A **Peggle-style** ball-and-peg game, packaged as an installable
**Progressive Web App (PWA)**.

Built from scratch as a standalone Quasar + Capacitor project (HTML5 canvas + a
small **custom** ball-vs-peg physics loop — no engine) that drops into the
[`pwa-games`](https://github.com/aaronm84/pwa-games) monorepo. Installable to a
phone's home screen, runs offline and full-screen, with haptics and saved progress.

## How to play

**Drag** anywhere on the field to aim the launcher (a dotted line shows your
starting direction), then **release** to drop a ball. It bounces off pegs and
walls under gravity. Clear **every orange peg** to beat the level — blue pegs are
just points. Catch the falling ball in the **moving bucket** at the bottom for a
free ball. Run out of balls with orange pegs left and it's game over; clear them
all and you advance (leftover balls earn a bonus).

## Features

- Canvas play-field with custom circle-vs-circle bounce physics and wall reflections.
- Drag-to-aim with a launch guide; one ball per shot, hit pegs clear when it settles.
- Orange targets vs blue point pegs; a sweeping **free-ball bucket**.
- Endless levels (more orange pegs each level), best score + highest level saved.

## Develop / build

```bash
npm install
npm run dev          # quasar dev -m pwa
npm run build        # quasar build -m pwa  -> dist/pwa
```

## Deploying

Ships in the [`pwa-games`](https://github.com/aaronm84/pwa-games) monorepo; the
repo-root workflow builds it with `PUBLIC_PATH=/pwa-games/pegs/` and publishes it
to `https://aaronm84.github.io/pwa-games/pegs/`.
