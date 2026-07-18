# pwa-games

A collection of installable **Progressive Web App (PWA)** games — playable in any
browser and installable straight to a phone's home screen, no app store required.

Each game is a self-contained [Quasar](https://quasar.dev) (Vue 3) + Capacitor
project in its own top-level `*-pwa/` folder.

## Games

| Game | Folder | Live |
| --- | --- | --- |
| 🃏 **Solitaire** — relaxing Klondike card game | [`solitaire-pwa/`](solitaire-pwa/) | https://aaronm84.github.io/pwa-games/solitaire/ |
| 🔢 **2048** — swipe & merge tile puzzle | [`2048-pwa/`](2048-pwa/) | https://aaronm84.github.io/pwa-games/2048/ |
| 🔗 **2248** — connect & merge numbers (full board) | [`2248-pwa/`](2248-pwa/) | https://aaronm84.github.io/pwa-games/2248/ |
| 🌊 **Flow** — connect dots with pipes, fill the grid | [`flow-pwa/`](flow-pwa/) | https://aaronm84.github.io/pwa-games/flow/ |
| 🐍 **Snake** — modern swipe-controlled snake | [`snake-pwa/`](snake-pwa/) | https://aaronm84.github.io/pwa-games/snake/ |
| 💣 **Minesweeper** — first-click-safe, 3 difficulties | [`minesweeper-pwa/`](minesweeper-pwa/) | https://aaronm84.github.io/pwa-games/minesweeper/ |
| 🔵 **Dots** — connect & loop matching dots | [`dots-pwa/`](dots-pwa/) | https://aaronm84.github.io/pwa-games/dots/ |
| 🪖 **Tank Wars** — turn-based artillery duel vs CPU | [`tankwars-pwa/`](tankwars-pwa/) | https://aaronm84.github.io/pwa-games/tankwars/ |
| 💎 **Gems** — match-3 swap & combo puzzle | [`gems-pwa/`](gems-pwa/) | https://aaronm84.github.io/pwa-games/gems/ |
| 🧩 **Trails** — Tsuro-style path-tile game vs CPU | [`trails-pwa/`](trails-pwa/) | https://aaronm84.github.io/pwa-games/trails/ |
| 🎯 **Pegs** — Peggle-style ball-and-peg bouncer | [`pegs-pwa/`](pegs-pwa/) | https://aaronm84.github.io/pwa-games/pegs/ |
| 🔴 **Marbles** — Zuma-style marble-chain shooter | [`marbles-pwa/`](marbles-pwa/) | https://aaronm84.github.io/pwa-games/marbles/ |
| 🐦 **Fling** — Angry-Birds-style slingshot physics (matter.js) | [`fling-pwa/`](fling-pwa/) | https://aaronm84.github.io/pwa-games/fling/ |
| 🎴 **Wildcard** — Balatro-style poker roguelike (chips × mult vs the blinds) | [`wildcard-pwa/`](wildcard-pwa/) | https://aaronm84.github.io/pwa-games/wildcard/ |
| 🏰 **Towers** — lane tower defense, hold the gate wave after wave | [`towers-pwa/`](towers-pwa/) | https://aaronm84.github.io/pwa-games/towers/ |
| 🚀 **SpaceWolf** — on-rails 3D space dogfighter (Babylon.js) | [`spacewolf-pwa/`](spacewolf-pwa/) | https://aaronm84.github.io/pwa-games/spacewolf/ |
| 🧱 **Bricks** — Breakout-style brick breaker | [`bricks-pwa/`](bricks-pwa/) | https://aaronm84.github.io/pwa-games/bricks/ |
| 🎰 **Slots** — spin the reels, chase the jackpot (for-fun casino) | [`slots-pwa/`](slots-pwa/) | https://aaronm84.github.io/pwa-games/slots/ |
| ⛳ **Mini Golf** — 5 courses, 90 holes, gators, UFOs, yetis, lava & special putters | [`minigolf-pwa/`](minigolf-pwa/) | https://aaronm84.github.io/pwa-games/minigolf/ |
| ⛳ **Mini Golf 3D** — all 90 holes in real 3D on the shared engine-kit (Babylon.js + Havok) | [`minigolf3d-pwa/`](minigolf3d-pwa/) | https://aaronm84.github.io/pwa-games/minigolf3d/ |
| 🪷 **Ripples** — zen pond puzzle on the engine-kit's 2D stage: tap the water, wake the lotus | [`ripples-pwa/`](ripples-pwa/) | https://aaronm84.github.io/pwa-games/ripples/ |

Landing page: **https://aaronm84.github.io/pwa-games/**

## The engine-kit (3D games)

`minigolf3d-pwa/src/engine/` is a small, reusable **Babylon.js + Havok** foundation
(bootstrap, physics, touch gestures, lighting presets) that Mini Golf 3D validated
end-to-end. **[docs/ENGINE.md](docs/ENGINE.md)** documents where it stands, what
the conversion taught us, and the candidate games to build on it next.

## How hosting works

A single GitHub Actions workflow (`.github/workflows/deploy.yml`) builds **every**
game folder on each push to `main` and publishes them to GitHub Pages:

- Each `*-pwa/` folder is built with `PUBLIC_PATH=/pwa-games/<name>/` (the `-pwa`
  suffix is stripped) and copied to `<name>/` on the Pages site.
- A landing page (`index.html`) at the site root links to each game.

So `solitaire-pwa/` is served at `/pwa-games/solitaire/`, and a future
`sudoku-pwa/` would automatically appear at `/pwa-games/sudoku/`.

Games use Vue Router **hash mode**, so deep links work on GitHub Pages with no
server-side routing config.

## Adding a new game

1. Add a new `<name>-pwa/` folder containing a Quasar PWA project (the existing
   games make a good template — copy one and rebrand `package.json`,
   `src-pwa/manifest.json`, the icons in `public/`, and the pages).
2. Add a row to the table above and a card to `index.html`.
3. Push to `main` — the workflow builds and deploys it automatically.

## Local development

```bash
cd solitaire-pwa
npm install
npm run dev        # quasar dev -m pwa
```

See each game's own `README.md` for details.
