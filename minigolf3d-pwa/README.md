# Mini Golf 3D — engine-kit prototype

An **experimental** 3D prototype that validates a shared, PWA-optimized game engine
the other games can eventually migrate onto. It's a real playable 3D mini-golf
hole running on **Babylon.js + Havok physics**, packaged as an installable PWA.

> Status: prototype / proof-of-concept. Not on the public landing page yet.

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

## The game (`src/game/course3d.js` + `pages/Game3DPage.vue`)

- Data-driven holes (green + curbs + inner "bars") built into meshes + static
  Havok colliders.
- A dynamic Havok ball with rolling friction; **drag-back-to-putt** applies an
  impulse mapped from the drag onto the ground plane via the camera basis.
- Sink detection, strokes/par HUD, hole-complete, next hole. Three demo holes.

## Verified

Renders in headless WebGL2 (SwiftShader) with PBR + soft shadows; Havok physics
steps correctly (ball rolls the length of the green and **sinks** in the cup);
builds cleanly through Quasar/Vite with the Havok `.wasm` emitted as a bundled,
precacheable asset. Drag-to-putt direction and power confirmed end-to-end.

## Productionization roadmap

1. **Bundle size** — the biggest lever. The prototype imports the `@babylonjs/core`
   *barrel* (~4.9 MB raw / ~1.2 MB gzip). Switching to **per-module imports**
   (`@babylonjs/core/Engines/engine`, …) + `manualChunks` should cut this by 60–75%.
2. **WebGPU** — enabled in `Stage` (`{ webgpu: true }`); default it on once tested
   on real devices (it's off in the prototype because headless CI lacks it).
3. **Convert a real game** — port one existing title (e.g. Fling's physics, or a
   3D 2048) to prove the migration path and harden the kit's API.
4. **Extract `engine/`** into a shared package once a second game adopts it.
5. Instanced meshes / thin instances, GPU particles, and a Vue↔scene HUD bridge.

## Develop / build

```bash
npm install
npm run dev          # quasar dev -m pwa
npm run build        # quasar build -m pwa  -> dist/pwa
```

Stack: Quasar (Vue 3) + Capacitor · `@babylonjs/core` · `@babylonjs/havok`.
