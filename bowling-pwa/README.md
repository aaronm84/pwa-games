# Alley Nights 🎳 — cosmic ten-pin on the engine-kit

Funky ten-pin bowling with **real physics**: a Havok-simulated ball, ten dynamic
pins that topple and scatter for real, hook spin that bends down-lane, and full
ten-frame scoring (strikes, spares, and the three-throw tenth). Installable PWA.

**The second game on the shared engine-kit** (`src/engine/` — Babylon.js 7 +
Havok, carried over from Mini Golf 3D). See `docs/ENGINE.md` at the repo root.

## The game

- **Flick to bowl** — drag back for power, drag sideways while winding up to add
  **hook**; the spin bends the ball harder as it travels the oiled lane.
- **Real pin physics** — pins are individual dynamic bodies; strikes are earned
  from momentum and pocket angles, not dice rolls. Deadwood is cleared between
  throws and standing pins stay exactly where they wobbled to.
- **Real scoring** — a pure `scoring.js` module implements the full rules
  (strike/spare bonuses, tenth-frame extras, 300 max), unit-tested by
  `scoring.test.mjs` (perfect game, all-spares, the textbook 167, tenth-frame
  edge cases).
- **The rack** — four balls with different feels: the House Ball, the Boulder
  (heavy, straight), the Comet (fast, bendy) and the Glitterball (maximum hook,
  zero chill).

## Three funky alleys

| Alley | Vibe | Gimmick |
| --- | --- | --- |
| 🪩 **Disco Nova** | Cosmic bowling, color-cycling neon lane | The mirror ball flashes and drops confetti on strikes |
| 🌋 **Lava Lanes** | Bowling over a magma flow | The gutters glow and pulse; gutter balls *sizzle* |
| 🛸 **Zero-G Lanes** | Space-station lanes | **Lower gravity** — pins topple in slow motion; a UFO buzzes strikes |

Each alley has its own announcer lines for strikes, spares, gutters, and splits.

## Develop / build

```bash
npm install
npm run dev            # quasar dev -m pwa
npm run build          # quasar build -m pwa -> dist/pwa
node src/game/scoring.test.mjs   # scoring rules unit tests
```

DEV-only `?alley=&ball=` URL overrides and a `window.__bwl()` state hook (with a
deterministic `devThrow`) support headless Playwright verification, same recipe
as Mini Golf 3D.

Stack: Quasar (Vue 3) + Capacitor · `@babylonjs/core` (tree-shaken) · `@babylonjs/havok`.
