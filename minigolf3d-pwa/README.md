# Mini Golf 3D — engine-kit prototype

An **experimental** 3D build that validates a shared, PWA-optimized game engine the
other games can migrate onto. It **converts the real Mini Golf** — all three
courses and 54 holes — onto **Babylon.js + Havok physics**, reusing the flat game's
polygon course data unchanged. Packaged as an installable PWA.

> Status: the full Mini Golf conversion (Stages 1–4) — all 54 holes, hills/ramps,
> critters, cameos and special putters — running on the engine-kit and linked from
> the landing page as **Mini Golf 3D**.

## Why

The 2D games each hand-roll their own canvas loop, physics, and input. This
explores a **reusable `engine/` kit** so future (and converted) games get better
graphics, real physics, 3D, and mobile-tuned performance for free — writing
*content*, not boilerplate.

## The engine-kit (`src/engine/`)

Deliberately generic and extensible — no mini-golf specifics live here:

| Module | Responsibility |
| --- | --- |
| `stage.js` | Babylon engine + scene bootstrap, render loop, resize, **WebGPU→WebGL2 fallback**, DPR cap, **adaptive resolution** to hold a target FPS, pause-when-hidden (battery) |
| `physics.js` | Havok (WASM/SIMD) init with **offline-safe** wasm loading, `physicsSupported()` capability check, static/dynamic body helpers |
| `input.js` | Unified pointer **gestures** (drag / tap) that feel right on touch *and* mouse, with pointer-capture so drags survive leaving the small canvas |
| `presets.js` | One-call **lighting rig** (ambient + soft-shadow sun), PBR materials, orbit camera |
| `index.js` | Barrel export |

A game imports what it needs and supplies the scene:

```js
const stage = new Stage(canvas)
await stage.init()               // WebGPU or WebGL2
outdoorLight(stage.scene)        // lights + shadows
await initPhysics(stage.scene)   // Havok
stage.run(dt => { /* per-frame */ })
```

## The game — a 3D port of the real Mini Golf (Stage 1)

The 2D game's courses are **pure polygon data**, so they port straight across. The
actual `courses.js` / `geometry.js` / `courseKit.js` files are reused verbatim, and
`src/game/hole3d.js` turns each 2D hole into a 3D scene:

- The 520×760 play space maps onto the ground plane (`+y2d` → `+z`, toward the
  camera). The fairway polygon is **extruded** into a green slab; its outline
  becomes **curb walls** (decimated to keep the collider count sane); obstacle
  polygons become raised hedges — all with Havok colliders.
- Hazards from the same data: **water** (splash + penalty, hit-tested in world XZ),
  **sand** (extra damping), **boost pads** (impulse), **bumpers** (bouncy cylinders),
  **portals** (teleport), and **moving cups** (animated).
- A dynamic Havok ball; **drag-back-to-putt** maps the drag onto the ground via the
  camera basis. The ball is **axis-locked to the ground** (a flat green shouldn't
  launch it over a curb) with a cup **gravity-assist** so slow near-misses drop.
- Per-hole intro, HUD (hole/par/shot/total), hole-complete, and a front/back
  scorecard. All **three courses (54 holes)** are selectable from the menu.

### Verified

All three courses render in headless WebGL2 with PBR + soft shadows and their real
organic shapes (blobby greens, ponds, doglegs). Ten representative holes across the
courses — doglegs, obstacle fields, bumpers, portals, moving cups, and the combo
finales — boot without error; the ball **sinks**, the **water penalty** fires, and
the **prod build renders + plays** (Havok wasm bundled). Lint + build clean.

### Stage 2 (done)

- **Windmill blade collision** — the blade is now a kinematic (ANIMATED) Havok body
  that spins and swats the ball; the hub still collides too.
- **Critters** — **gators** lurk in the Cove ponds (glowing eyes) and *chomp* a ball
  that hits the water; **alien UFOs** on Area 51 descend, beam Otto up, and drop him
  elsewhere on the green (no stroke). Themed **Chip commentary** on sinks, splashes,
  chomps, portals, and abductions.

### Stage 3 (done) — terrain

**Hills & ramps** — the marquee 3D feature the flat game can't have. 3D-only
flourishes are layered onto chosen holes via `src/game/enhance3d.js` (the 2D course
data stays untouched): rounded **hills/dunes** (MESH-collider domes the ball crests)
and **ramps** (inclined slabs). This required swapping the Stage-1 hard ground
axis-lock for a **soft upward-speed cap** (a ball can ride a slope but a curb can't
launch it) plus a total-speed cap and **taller, softer curbs**. Verified: a ball
climbs a dune to ~1.3 world-units and still sinks, while flat/obstacle holes keep
the ball grounded (peak height ~0.5) — no flying.

### Stage 4 (done) — character & content

- **Special putters** — the flat game's five putters port over; the equipped one's
  modifiers fold into the 3D physics (`power` scales the shot impulse, `friction`
  scales roll-out, `homing` boosts the cup gravity-assist). Verified: cannon carries
  further than standard, further than feather; the magnet still sinks.
- **Ambient cameos** — **bird flyovers** flap across and may drop a **splat** on the
  green (a fading patch that adds drag), and **Bigfoot** shuffles across the Cove tree
  line. Both are driven off the same `course.events` the flat game uses.
- **Otto's face** — two googly eyes billboard-track the camera on the ball and squint
  when it's over water.
- **Environment props** — themed rough decoration scattered off the fairway (pines on
  Pinewood, reeds on the Cove, cacti/rocks on Area 51), colliderless so they never
  affect a putt.

### Stage 5 (done) — feel & polish

Feedback-driven refinements:

- **Camera** pulls back and tilts a touch more overhead so the whole hole (and the
  ball) always stays framed — no more edges cut off or ball hidden behind a curb.
- **Bigfoot** rebuilt with a real **walk cycle** (shaggy upright figure, tan
  face/hands/feet; arms counter-swing the legs, body bobs, seamless loop).
- **Harder cup** — tighter capture radius, a lower sink-speed, and a much weaker,
  shorter gravity-assist so a ball merely grazing the cup's range no longer vacuums
  in. Slow, well-placed putts still drop.
- **Contour lines** — topographic rings band the hills to show the vertical variation.
- **Rarer cameos** — Bigfoot / alien / bird windows are much longer and probability-
  gated, so a sighting feels magical rather than scheduled.
- **Gators lunge** — a gator now has a *chance* (not every time) to rise and snatch
  the ball when it skirts a pond, with a jaws-open lunge, penalty and reset.
- **In-game putter bag** — swap putters mid-round from a bag sheet (the whole
  collection, locked ones shown with their unlock hint); mods apply live.

Playtest fixes on top:

- **Lip-outs** — a ball can never glide over the hole untouched: too fast over the
  cup and the rim kicks it sideways and shaves its speed (slow, placed putts drop).
- **Windmills actually spin** — the blade's Havok body had switched the mesh to
  quaternion rotation, silently ignoring the Euler spin since Stage 2; the spin now
  drives the quaternion (collision was always live).
- **Bigfoot/UFO actually appear** — sighting clocks were reset every hole, so
  windows longer than a hole never fired; they now span the round.
- **Putters actually unlock** — the 3D game now records progress (rounds, aces,
  splashes, abductions); finishing a round shows any newly unlocked putter.

Course/hole/putter `?course=&hole=&putter=` dev overrides exist for testing (DEV-only).

## Bundle size

Babylon is imported **per-module** (via `src/engine/babylon.js`) instead of the
`@babylonjs/core` barrel, so Vite tree-shakes away the ~80% of the engine this game
never uses. `manualChunks` then isolates Babylon into a cacheable vendor chunk.

| | Engine JS (gzip) |
| --- | --- |
| `@babylonjs/core` barrel | **~1.09 MB** |
| Per-module + `manualChunks` | **~0.5 MB** (≈ 54% smaller) |

`babylon.js` also carries the required **side-effect imports** (mesh builders, the
shadow scene component, `joinedPhysicsEngineComponent` for `scene.enablePhysics`) —
keep it in sync with the Babylon features the game uses, since a missing one fails
at runtime, not build time. (The 2 MB Havok `.wasm` is separate and unavoidable for
physics.) Verified: dev + prod render identically with PBR + shadows, and the ball
still sinks — nothing was tree-shaken away by mistake.

## Productionization roadmap

1. **WebGPU** — enabled in `Stage` (`{ webgpu: true }`); default it on once tested
   on real devices (it's off in the prototype because headless CI lacks it).
2. **Convert a real game** — port one existing title (e.g. Fling's physics, or a
   3D 2048) to prove the migration path and harden the kit's API.
3. **Extract `engine/`** into a shared package once a second game adopts it.
4. Instanced meshes / thin instances, GPU particles, and a Vue↔scene HUD bridge.

## Develop / build

```bash
npm install
npm run dev          # quasar dev -m pwa
npm run build        # quasar build -m pwa  -> dist/pwa
```

Stack: Quasar (Vue 3) + Capacitor · `@babylonjs/core` · `@babylonjs/havok`.
