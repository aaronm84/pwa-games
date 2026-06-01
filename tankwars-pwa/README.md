# Tank Wars

A turn-based **artillery duel** (Scorched Earth / Pocket Tanks style), packaged as
an installable **Progressive Web App (PWA)**.

Built from scratch as a standalone Quasar + Capacitor project (HTML5 canvas + a
small custom projectile-physics loop) that drops into the
[`pwa-games`](https://github.com/aaronm84/pwa-games) monorepo. Installable to a
phone's home screen, runs offline and full-screen, with haptics and a saved battle
record.

## How to play

You and the CPU sit on opposite ends of a hilly battlefield. **Drag from your
tank** toward where you want to shoot — the drag's direction sets the **angle** and
its length sets the **power** (a dotted line previews the start of the arc).
**Release** to fire. Shells fall under **gravity** and drift with the **wind**
(shown up top); explosions damage nearby tanks and **carve the terrain**. Reduce
the enemy's health to zero to win, then the CPU shoots back.

## Features

- Canvas battlefield with a procedurally generated, **destructible** heightmap.
- Drag-to-aim with angle/power readout and a partial trajectory preview.
- Gravity + per-turn **wind**; blast damage with falloff and direct-hit bonus.
- A search-based **AI** opponent (simulates shots, aims for you, with some miss).
- Health bars, win/lose, battle record + win streak saved; time-of-day theme.

## Develop / build

```bash
npm install
npm run dev          # quasar dev -m pwa
npm run build        # quasar build -m pwa  -> dist/pwa
```

## Deploying

Ships in the [`pwa-games`](https://github.com/aaronm84/pwa-games) monorepo; the
repo-root workflow builds it with `PUBLIC_PATH=/pwa-games/tankwars/` and publishes
it to `https://aaronm84.github.io/pwa-games/tankwars/`.
