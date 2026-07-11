# Mini Golf

A **top-down mini golf** game — putt the ball into the cup in as few strokes as
possible — packaged as an installable **Progressive Web App (PWA)**.

Built from scratch as a standalone Quasar + Capacitor project (HTML5 canvas + a
small **custom** top-down physics engine — no game library) that drops into the
[`pwa-games`](https://github.com/aaronm84/pwa-games) monorepo. Installable to a
phone's home screen, runs offline and full-screen, with haptics and saved progress.

## How to play

**Drag back** from the ball — like pulling a slingshot — to aim and set power,
then **release** to putt. The ball rolls with friction and bounces off the course
walls and obstacles. Sink it in the **cup** to finish the hole; each putt is one
**stroke**.

Every hole has a **par** (its target stroke count). Play all **18 holes** and try
to finish the round **under par**. Ease off the power near the cup — a ball moving
too fast will lip out and roll right over the hole.

Meet the cast: **Otto**, the googly-eyed golf ball who gets nervous near water and
dizzy after a hard bounce, and **Chip**, the dry-witted commentator who has an
opinion about every shot you take.

## Scoring

- **Hole in one** — sink it on your first putt.
- **Eagle / Birdie** — two / one under par.
- **Par** — right on target.
- **Bogey** and beyond — over par.
- **Trick shot** — sink it after banking off three or more walls.

A running scorecard (front nine + back nine) tracks every hole; your best full
round (total strokes and score-to-par), hole-in-one count, and Otto's water
splashes are saved.

## The course — 18 holes

**Front Nine (par 28)** is a classic resort course — straight shots, doglegs, a
slalom, a diamond island, a funnel, and an island finisher.

**Back Nine — "The Funhouse" (par 30)** turns weird, one signature gimmick per
hole, building to an everything-at-once finale:

| Hazard | Behaviour |
| --- | --- |
| 💧 **Water** | one-stroke penalty; Otto swims back to where he was |
| 🏖️ **Sand** | heavy friction — kills the ball's roll |
| 🔴 **Bumpers** | extra-bouncy pegs; bank off them on purpose |
| ⬆️ **Boost pads** | a free burst of speed up the fairway |
| 🌀 **Portals** | linked pairs — one end drops you near the cup |
| 🌬️ **Windmills** | a rotating blade guards the lane; time your putt |
| 🎯 **Moving cups** | the hole slides side to side |

Courses and holes are pure data (`src/game/course.js`: polygon fairways, obstacle
polygons, and hazard definitions), so adding or editing holes is easy.

## Develop / build

```bash
npm install
npm run dev          # quasar dev -m pwa
npm run build        # quasar build -m pwa  -> dist/pwa
```

## Deploying

Ships in the [`pwa-games`](https://github.com/aaronm84/pwa-games) monorepo; the
repo-root workflow builds it with `PUBLIC_PATH=/pwa-games/minigolf/` and publishes
it to `https://aaronm84.github.io/pwa-games/minigolf/`.
