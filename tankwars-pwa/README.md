# Tank Wars

A turn-based **artillery duel** (Scorched Earth / Pocket Tanks style), packaged as
an installable **Progressive Web App (PWA)**.

Built from scratch as a standalone Quasar + Capacitor project (HTML5 canvas + a
small custom projectile-physics loop) that drops into the
[`pwa-games`](https://github.com/aaronm84/pwa-games) monorepo. Installable to a
phone's home screen, runs offline and full-screen, with haptics and a saved battle
record.

## How to play

You and the CPU sit on opposite ends of a hilly battlefield. Set your **angle** and
**power** with the sliders/steppers (or **drag the battlefield** to aim), pick a
**weapon**, and **Fire**. Shells fall under **gravity** and drift with the **wind**;
explosions damage nearby tanks and **carve the terrain** — lose the ground beneath
you and you take **fall damage**. Win the round by reducing the enemy to zero;
**best of five rounds** wins the war, with an **Armoury** between rounds.

## Features

- Canvas battlefield with a procedurally generated, **destructible** heightmap.
- **Manual angle/power controls** (sliders + fine steppers) *and* drag-to-aim, with a trajectory preview.
- **Weapon roster**: Tracer (free ranging), Missile, Big Nuke, MIRV (splits at apex), Roller (rolls downhill).
- **Economy + Armoury**: earn cash for damage dealt, buy ammo and utilities between rounds.
- **Utilities**: Repair, Shield, Parachute (cancels fall damage), and fuel-based tank movement.
- Per-turn **wind**, blast damage with falloff + direct-hit bonus, a search-based **AI** opponent.
- Best-of-5 match, health/shield bars, battle record + win streak saved; time-of-day theme.

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
