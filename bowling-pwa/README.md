# Alley Nights 🎳 — cosmic ten-pin on the engine-kit

Funky ten-pin bowling with **real physics**: a Havok-simulated ball, ten dynamic
pins that topple and scatter for real, hook spin that bends down-lane, and full
ten-frame scoring (strikes, spares, and the three-throw tenth). Installable PWA.

**The second game on the shared engine-kit** (`src/engine/` — Babylon.js 7 +
Havok, carried over from Mini Golf 3D). See `docs/ENGINE.md` at the repo root.

## The game

- **A real swing** (Switch-bowling style) — slide sideways to walk the approach
  and line up, drag down to wind the ball back behind you, then **snap forward
  and release while moving** to bowl. Power = backswing depth × release snap;
  drifting the forward stroke sideways puts **hook** on the ball, and a limp
  release dribbles it down the lane. Timing is the skill.
- **Real pin physics** — pins are individual dynamic bodies; strikes are earned
  from momentum and pocket angles, not dice rolls. Deadwood is cleared between
  throws and standing pins stay exactly where they wobbled to.
- **Real scoring** — a pure `scoring.js` module implements the full rules
  (strike/spare bonuses, tenth-frame extras, 300 max), unit-tested by
  `scoring.test.mjs` (perfect game, all-spares, the textbook 167, tenth-frame
  edge cases).
- **The rack** — four balls with different feels: the House Ball, the Boulder
  (heavy, straight), the Comet (fast, bendy) and the Glitterball (maximum hook,
  zero chill). Any ball can be **repainted** from an eight-swatch palette, and
  the **Pro Shop** (🎨 in-game) builds a fully custom fifth ball: weight, punch
  and hook sliders plus a shell color.
- **Rivals & tournament** — challenge one of four regulars (Cousin Rollo,
  Rexxie, SPARE-O 3000, Granny Lois — each with a hand-drawn league portrait)
  to a head-to-head game on **any alley** (the rival picker has an alley row):
  you alternate frames on the same physics lane, and the rival actually bowls —
  skill-based aim at the pocket or at what's standing, with hook and speed noise
  scaling down as skill goes up. Every rival **brings their own ball** (look and
  weight swap in on their turn — Rexxie hurls a 9-pound Meteor, Rollo lobs the
  5-pound Snoozer). **Tournament** runs the three toughest rivals as a ladder:
  win to advance, lose and it resets, survive Granny Lois to take the title.
- **Lane hazards (leveled)** — a Settings level (Off / Light / Wild) scatters
  junk on the boards to bowl around. Every alley has its own catalog —
  platform disco shoes and rogue mirror balls; **encroaching lava** that
  visibly slows any ball that rolls through it; a crash-landed saucer and a
  passed-out alien; pineapples, mai tais and still-burning fallen torches;
  pip-faced dice, chip stacks and stray martinis; beach balls, floaties,
  sunglasses, towels and flip-flops — plus cross-theme clutter (a rogue pin
  from lane 12, somebody's spilled soda, a runaway house ball, a lost rental
  shoe) that can turn up anywhere. Light = sometimes one; Wild = always a mess.

## Graphics & options

The lane is a true **planar mirror** (pins, ball and neon reflect in the oiled
surface), every emissive **blooms** through a glow layer, and each alley has a
full environment beyond the lane — neon arches and a starfield at Disco Nova, a
glowing volcano, canyon crags and drifting embers at Lava Lanes, a ringed planet
and slow asteroids at Zero-G. Statics are merged + frozen so it all stays cheap.
The house is alive: **neighbor lanes on both sides get bowled by ghost players**
(their pins scatter and re-rack on their own schedules), each alley runs ambient
events (laser sweeps from the mirror ball, volcano eruptions, passing comets),
and the room's lighting drifts as your round progresses — the **tenth frame goes
clutch**: neon dims, the deck spotlight burns hotter, the vignette closes in.
Settings has a **Lane & Graphics** panel: reflections, glow, ball-path trace,
snappy pinsetter, and hook/power sensitivity sliders. During a roll, **hold to
fast-forward**; releasing mid-backswing **cancels** the throw; after each throw
a faint line traces the path your ball took.

## Six funky alleys

| Alley | Vibe | Gimmick |
| --- | --- | --- |
| 🪩 **Disco Nova** | Cosmic bowling, color-cycling neon lane | The mirror ball flashes and drops confetti on strikes |
| 🌋 **Lava Lanes** | Bowling over a magma flow | The gutters glow and pulse; gutter balls *sizzle* |
| 🛸 **Zero-G Lanes** | Space-station lanes | **Lower gravity** — pins topple in slow motion; a UFO buzzes strikes |
| 🗿 **Tiki Grove** | Jungle dusk: torches, palms, fireflies | Carved **totem pins**; coconut hazards |
| 🎰 **High Roller** | Velvet, gold, terrible odds | Giant dice and drifting cards; gilded pins |
| 🏖️ **Poolside** | Full daylight on the boardwalk | **No backstop at all** — the deck ends over open water (splash!), flanked by umbrellas |

Each alley has its own announcer lines for strikes, spares, gutters, and splits —
and its own **pin livery**: every theme dresses the lathe-turned pins in its own
body color and band set (the tiki pins are three-band carved totems). The
machinery wears the house colors too: the **pinsetter sweep arm is themed per
alley** — bamboo at the grove, gold-trimmed velvet at the casino, lifeguard
white at the pool. And the black backer is gone everywhere: **every alley ends
its lane its own way** — deep space shows behind the Zero-G pins under a
floating neon line, a faceted mirror ball hangs over the Disco Nova pit
throwing rays and glints, Tiki Grove strings a bamboo pole of glowing-eyed
carved masks, Lava Lanes dead-ends into a squat volcano with a glowing caldera
and lava streaks, and at High Roller the backer IS a slot machine (cherries,
BAR, magenta seven, blinking crown lights, lever) — the pit is the payout tray.

## Develop / build

```bash
npm install
npm run dev            # quasar dev -m pwa
npm run build          # quasar build -m pwa -> dist/pwa
node src/game/scoring.test.mjs   # scoring rules unit tests
```

DEV-only `?alley=&ball=&vs=&tour=&hazards=1` URL overrides and a
`window.__bwl()` state hook (with a deterministic `devThrow`) support headless
Playwright verification, same recipe as Mini Golf 3D.

Stack: Quasar (Vue 3) + Capacitor · `@babylonjs/core` (tree-shaken) · `@babylonjs/havok`.
