# The engine-kit: where we are & what to build next

_Last updated when the kit became a real package: `packages/engine-kit`,
publishable to npm as **`@aaronm84/engine-kit`**._

## Where we are

The repo's 3D games — **Mini Golf 3D** and **Alley Nights** (bowling) — run on a
shared, PWA-optimized foundation we call the **engine-kit**, built on
**Babylon.js 7 + Havok physics** (WASM). It now lives as a standalone,
framework-agnostic ESM package at **`packages/engine-kit`**:

- both apps depend on it via `"@aaronm84/engine-kit": "file:../packages/engine-kit"`,
  and their old `src/engine/index.js` files are one-line shims re-exporting it,
  so no game code changed
- other repos can consume it the same way today, or from npm once published:
  from `packages/engine-kit`, bump the version and `npm publish --access public`
- peer deps: `@babylonjs/core` + `@babylonjs/havok` (consumers pick versions);
  bundler note: the Havok wasm loads via Vite's `?url`, so the kit targets
  Vite-family bundlers (Vite / Quasar / Astro)
- gotcha for `file:` consumers: set `resolve.preserveSymlinks = true` in the
  app's Vite config so the linked package resolves Babylon from the APP's
  node_modules (both apps' quasar.config.js show the pattern)

### The kit itself (7 small modules, ~zero game specifics)

| Module | What it gives a game |
| --- | --- |
| `stage.js` | Engine + scene bootstrap, render loop with `dt`, resize, **WebGPU→WebGL2 fallback**, DPR cap, **adaptive resolution** to hold target FPS, pause-when-hidden (battery) |
| `physics.js` | Havok init with **offline-safe WASM loading** (bundled via Vite `?url`), capability check, `makeStatic`/`makeDynamic` body helpers |
| `input.js` | Unified **pointer gestures** (drag/tap) that behave identically on touch and mouse, with pointer capture |
| `presets.js` | One-call outdoor **lighting rig** (ambient + soft-shadow sun), PBR material helper, orbit camera |
| `babylon.js` | **Per-module Babylon imports** + required side-effect registrations, so Vite tree-shakes the ~80% of Babylon we don't use |
| `sfx.js` | `createSynth()` — a **sample-free WebAudio kit**: filtered noise bursts, tones with pitch slides, speed-tracking loops; autoplay-safe unlock, master volume, an `events` counter for headless tests |
| `haptics.js` | `createHaptics()` — vibration helpers (light/medium/heavy/success/scaled crash) that no-op gracefully where unsupported |

**Cost of 3D:** ~0.5 MB gzipped engine JS (vs ~1.09 MB naive) + ~2 MB Havok WASM,
cached after first load. Renders headless (SwiftShader) for CI-style verification.

### What the Mini Golf conversion proved

The 2D game's courses are pure polygon data, and **the exact same course files
drive both games** — `hole3d.js` extrudes greens/curbs/hedges from the polygons
and Havok does the rest. On top of that base the conversion shipped, stage by
stage: kinematic obstacles (spinning windmill blades that really swat the ball),
critters and ambient cameos (gators that lunge, a walking Yeti/Bigfoot, UFO
abductions with safe drop zones), 3D-only terrain (hills/dunes with contour
rings), **procedural green breaks** (gentle mounds/dips that bend the rolling
ball, printed as contour rings you read like a real green), new hazard systems
(erupting geysers, putt-bending anomalies), special putters whose modifiers fold
into the physics, an in-game putter bag, progress/unlocks, and cup physics with
real **lip-outs**. All 5 courses × 18 holes validated by `validate-courses.mjs`
plus a headless Playwright harness that actually putts.

### Hard-won lessons (read before building on the kit)

1. **Babylon side-effects**: importing a class isn't enough — mesh builders,
   `shadowGeneratorSceneComponent`, `joinedPhysicsEngineComponent` must be
   *imported for effect* in `engine/babylon.js`. A missing one fails at runtime,
   not build time.
2. **Quaternion vs Euler**: the moment a mesh gets a physics body, Babylon
   switches it to `rotationQuaternion` — writes to `.rotation` are silently
   ignored. Animate kinematic bodies through the quaternion.
3. **Kinematic (ANIMATED) bodies** with `disablePreStep = false` are the pattern
   for moving obstacles that should *push* the ball (windmill blades, future
   flippers).
4. **Teleporting a dynamic body** needs the `disablePreStep` dance for one frame.
5. **Clamp `dt`, don't replace it** — per-frame forces scaled by a fake fixed dt
   silently weaken at low frame rates.
6. **Cap velocities in gameplay code** (total speed + upward speed) rather than
   fighting collider tunneling; tune restitution per surface.
7. **Verify headless**: SwiftShader WebGL2 + a tiny DEV-only state hook
   (`window.__g3d()`) + URL param overrides made every feature provable without
   a device. Cheap and it caught real bugs (rocketing balls, missing earcut,
   physics too weak at low FPS).

## What to build next on the engine

Two directions: **new titles** designed around physics, and **3D conversions** of
existing hits. Scored by how much they reuse vs. what new capability they force
the kit to grow (that's a feature — each game should harden the kit).

### New title candidates

| Idea | One-liner | Reuses | New kit muscle | Effort | Wow |
| --- | --- | --- | --- | --- | --- |
| 🎳 **Bowling** ("Alley Nights") | Flick to bowl, curve with a swiped hook; cosmic mode, characters heckling | Drag-power gesture, dynamic bodies, lighting rig | Many-body dynamics, persistent multi-frame score UI | **S–M** | **High** — Havok pin scatter *is* the demo |
| 🎱 **Pool / 8-ball** | Drag-to-aim cue (same muscle as putting), pass-and-play + trick-shot puzzles | Aim/power UI, cup-style pockets, ball physics | Precise spin/english, turn structure, table framing camera | **M** | High — evergreen replay |
| 🌀 **Tilt maze** | Tilt the board (drag or gyro), roll a marble past holes & traps; levels are data like courses | Nearly everything from mini golf (breaks/hills literally) | Kinematic *board* (world moves, not ball), gyro input option | **S–M** | Medium-high |
| 🪩 **Pinball** | Full table with flippers, ramps, bumpers, missions | Windmill-blade kinematics → **flippers**, bumpers, ramps, lighting | Trigger/sensor zones, flipper feel tuning, nudge | **M–L** | **Very high** — flagship material |
| 🥌 **Shuffleboard / curling** | Slide & knock opponents off the scoring zones, local 2-player | Putt gesture, friction zones (sand tech) | Turn-based local multiplayer pattern | **S** | Medium |
| 🏀 **Mini hoops** | Flick arc shots at a (moving) hoop, trick-shot ladders | Flick gesture, impulse physics | Arc/aerial ball flight (we've only rolled so far) | **S** | Medium |

### Conversion candidates (2D → engine-kit)

| Existing game | 3D take | Notes |
| --- | --- | --- |
| 🐦 **Fling** (matter.js) | Slingshot vs *3D stacked towers* — Havok stacking is the spectacle | The roadmap's original "convert a second game" pick; retires the matter.js one-off |
| 🎯 **Pegs** | 3D Peggle: pegs as glowing cylinders, ball ricochet in depth | Bumper restitution tech is already proven |
| 🧱 **Bricks** | Brick breaker with depth, physics debris | Simple; mostly juice |
| 🔴 **Marbles / grid puzzles** | — | Gain little from 3D; skip |

### Recommendation

1. **🎳 Bowling first** — best wow-per-effort in the list: ten pins, one ball,
   one lane, and every needed mechanic already exists in the kit. It forces the
   two things the kit hasn't done (lots of simultaneous dynamic bodies, and a
   real score/turn UI pattern), and it's a natural home for the franchise's
   humor (Otto, cameos, themed alleys).
2. **🎱 Pool second** — same aim language as putting so it inherits polished
   controls, and it adds spin + turn-taking to the kit. Deep replay value.
3. **🪩 Pinball as the flagship third** — everything it needs will exist by
   then (flippers = windmill tech, bumpers, ramps, sensors from geysers);
   budget extra time for feel tuning.

**Status:** 🎳 **Bowling shipped** as `bowling-pwa/` ("Alley Nights") — the
kit's second adopter. It carried `src/engine/` over unchanged (a good sign for
the API) and exercised the new muscles as predicted: eleven simultaneous dynamic
bodies, per-alley gravity, and a real turn/score UI driven by a pure, unit-tested
scoring module.

**Extraction trigger (now met):** with two consumers, the next infrastructure
task is extracting `src/engine/` into a shared workspace package
(e.g. `packages/engine-kit/`) so fixes stop needing to be copied between games.

## How a new engine game starts (the recipe)

```bash
# 1. scaffold a Quasar PWA like the others (copy minigolf3d-pwa, strip src/game)
# 2. keep src/engine/ (or adopt the extracted package when it exists)
# 3. game loop:
const stage = new Stage(canvas)          // WebGPU→WebGL2, adaptive res
await stage.init()
outdoorLight(stage.scene)                // or a custom rig
await initPhysics(stage.scene)           // Havok, offline-safe
new Gestures(canvas, { onDrag, onDragEnd })
stage.run(dt => tick(dt))                // clamp dt, apply gameplay forces
# 4. content as data (the mini-golf courses pattern), validators from day one
# 5. DEV-only window.__hook() + URL overrides → headless Playwright verification
```

The deploy workflow needs nothing new: any `*-pwa/quasar.config.js` folder is
built and published automatically; add a landing-page card when it's ready.
