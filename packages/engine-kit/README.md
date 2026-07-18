# @aaronm84/engine-kit 🎳⛳

A **mobile-PWA-optimized game foundation** on Babylon.js + Havok. Extracted
from (and battle-tested by) the games in
[pwa-games](https://github.com/aaronm84/pwa-games) — a full 3D mini-golf and
the Alley Nights bowling game both run on it.

Framework-agnostic ESM (no Vue/React dependency), tree-shaken Babylon
imports, and every default tuned for **phones**: device-pixel-ratio caps,
adaptive resolution that trades pixels for frame rate, pause-when-hidden,
offline-safe physics wasm, autoplay-safe audio.

## What's in the kit

| Module | What it does |
| --- | --- |
| `Stage` | Renderer bootstrap + lifecycle: WebGPU with WebGL2 fallback, DPR cap (`maxDpr`), **adaptive resolution** that steps render scale down/up to hold `targetFps`, resize handling, pause-when-hidden. `stage.run(dt => …)` is your loop. |
| `initPhysics` / `makeStatic` / `makeDynamic` / `physicsSupported` | Havok (WASM) with the binary **bundled and fetched locally** — works offline under a service worker. Thin aggregate helpers with sane damping/friction defaults. |
| `Gestures` | One drag model for touch + mouse: start/move/end with dx/dy/dist/velocity — enough for swings, putts and camera pulls. |
| `outdoorLight` / `pbr` / `orbitCamera` | Good-looking defaults: hemi+key rig with soft (blur-ESM) shadows and a `shadowSize` knob, matte PBR materials, a phone-tuned orbit camera. |
| `createSynth` | Sample-free WebAudio SFX: filtered `noise()` bursts, `tone()` notes with pitch slides, and speed-tracking `loop()`s. One master gain, `configure({on, vol})`, gesture `unlock()`, an `events` counter for headless tests. |
| `createHaptics` | Vibration helpers (light/medium/heavy/success/scaled crash) that no-op gracefully where unsupported. |
| Babylon re-exports | `MeshBuilder`, `Mesh`, `VertexData`, textures, lights, `GlowLayer`, `FxaaPostProcess`, materials, math — re-exported from a **side-effect-complete tree-shaken module**, so games never import the heavy `@babylonjs/core` barrel and never hit "feature not registered" runtime surprises. |

## Install

```bash
npm i @aaronm84/engine-kit @babylonjs/core @babylonjs/havok
```

(Babylon and Havok are peer dependencies — you control their versions.)

> **Bundler note:** the physics module imports the Havok `.wasm` via `?url`,
> so the kit targets **Vite-family bundlers** (Vite, Quasar, Astro…). PRs
> welcome for a locator override.

## Quickstart

```js
import { Stage, initPhysics, makeDynamic, makeStatic, outdoorLight, pbr,
         Gestures, MeshBuilder, Vector3, createSynth } from '@aaronm84/engine-kit'

const stage = new Stage(canvas, { maxDpr: 3, targetFps: 60 })
await stage.init()
const { shadow } = outdoorLight(stage.scene, { shadowSize: 2048 })
await initPhysics(stage.scene, { gravity: -9.81 })

const ground = MeshBuilder.CreateBox('g', { width: 20, height: 0.3, depth: 20 }, stage.scene)
ground.material = pbr(stage.scene, { color: '#3a7a4a' })
makeStatic(ground)

const ball = MeshBuilder.CreateSphere('b', { diameter: 0.4 }, stage.scene)
makeDynamic(ball, { mass: 6 })
shadow.addShadowCaster(ball)

const sfx = createSynth()
new Gestures(canvas, {
  onDragStart: () => sfx.unlock(),
  onDragEnd: (g) => { /* turn the gesture into an impulse */ },
})

stage.run((dt) => { /* per-frame game logic */ })
```

## Design notes

- **Adaptive resolution**: `Stage` watches the rolling FPS and nudges
  `hardwareScalingLevel` in 0.25 steps, so a hot phone drops pixels instead
  of frames — and climbs back when there's headroom.
- **Tree-shaking with side effects handled**: Babylon registers features by
  side effect. `src/babylon.js` is the single place those imports live
  (mesh builders, shadow/glow/physics scene components), which is what makes
  per-module imports safe.
- **Headless-testable**: everything works under SwiftShader/Playwright; the
  synth counts `events` so CI can assert audio wiring without ears.

## Publishing

From `packages/engine-kit`: bump `version`, then `npm publish --access public`.

MIT © aaronm84
