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

Every hole has a **par**. Play all **18 holes** of a course and try to finish
**under par**. Ease off the power near the cup — a ball moving too fast will lip
out and roll right over the hole.

Meet the cast: **Otto**, the googly-eyed golf ball who gets nervous near water and
dizzy after a hard bounce, and **Chip**, the dry-witted commentator who has an
opinion about every shot you take.

## Five courses (90 holes)

Pick a course — and a putter — from the clubhouse before you tee off.

| Course | Vibe | Weirdness |
| --- | --- | --- |
| 🌲 **Pinewood Links** (par 61) | A gentle classic resort to warm up on | The odd passing bird |
| 🐊 **Cryptid Cove** (par 63) | Murky, water-heavy swamp | Alligators grab balls from the water; Bigfoot wanders the tree line |
| 👽 **Area 51 Links** (par 63) | Dusty, classified desert | UFOs abduct your ball and drop it who-knows-where |
| ❄️ **Frostbite Falls** (par 60) | Glacier-carved alpine slopes | Ice-slick luge runs, melt pools — and a **Yeti** in the pines |
| 🌋 **Magma Springs** (par 60) | Lush greens on an active volcano | The "water" is **lava**; ash bunkers; lava-tube portals |

Fairways and hazards are drawn with **organic spline shapes** (blobby ponds,
rounded greens, winding doglegs) and each course has its own palette and props
(pines, reeds, cacti).

## Hazards

| Hazard | Behaviour |
| --- | --- |
| 💧 **Water** | one-stroke penalty; Otto swims back to where he was |
| 🐊 **Gators** | on the Cove, they lurk in the ponds and *chomp* balls that hit the water |
| 🏖️ **Sand** | heavy friction — kills the ball's roll |
| 🔴 **Bumpers** | extra-bouncy pegs; bank off them on purpose |
| ⬆️ **Boost pads** | a free burst of speed up the fairway |
| 🌀 **Portals** | linked pairs — one end drops you near the cup |
| 🌬️ **Windmills** | a rotating blade guards the lane; time your putt |
| 🎯 **Moving cups** | the hole slides side to side |
| 🐦👽 **Random events** | birds bomb the green, Bigfoot photobombs, aliens abduct |

## Putters

Five putters, each playing differently, unlocked as you finish rounds and sink aces:

- 🏌️ **The Standard** — balanced all-rounder (starter).
- 🎯 **The Sniper** — shows a predicted bounce path.
- 💥 **The Cannon** — big power, easy to overcook.
- 🧲 **The Magnet** — gently curves slow balls toward the cup.
- 🪶 **The Feather** — feather-light control + one free mulligan per hole.

## Scoring

- **Hole in one**, **Eagle/Birdie** (under par), **Par**, **Bogey** and beyond.
- **Trick shot** — sink it after banking off three or more walls.

A front/back-nine scorecard tracks every hole; per-course best rounds, hole-in-one
count, Otto's water splashes, and alien abductions are all saved.

## Code layout

Courses are pure data. Each lives in `src/game/courses/<id>.js` and is built from
`src/game/courseKit.js` helpers (`softRect`, `blob`, `pond`, `bunker`, …) on top of
`src/game/geometry.js` (Catmull-Rom `smooth`, organic `blob`, `ribbon`). Putters are
in `src/game/putters.js`. The whole game runs on one custom canvas engine in
`src/pages/MiniGolfPage.vue` — no game/physics library.

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
