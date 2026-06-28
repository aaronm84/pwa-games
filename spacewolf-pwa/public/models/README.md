# Models

Drop `.glb` / `.gltf` files here to swap in real 3D ship art (e.g. from
[Quaternius](https://quaternius.com/) — CC0).

The current build uses procedural meshes (cylinders + boxes composed
into an Arwing-style fighter); the visuals are recognisable but
intentionally minimal so the project ships without bundled binary
assets.

## Swap procedure

1. Download a low-poly fighter `.glb` (e.g. from
   [Quaternius's LowPoly Spaceships pack](https://quaternius.itch.io/lowpoly-spaceships)
   or the [Ultimate Space Kit](https://quaternius.com/packs/ultimatespacekit.html)).
2. Save it as `public/models/arwing.glb` (any name — match the constant
   you set in step 4).
3. Install the Babylon glTF loader as a dep:

   ```bash
   npm install @babylonjs/loaders
   ```

4. In `src/game/scene.js`, add near the top imports:

   ```js
   import '@babylonjs/loaders/glTF'
   import { SceneLoader } from '@babylonjs/core'
   ```

   Then anywhere after `shipTilt` is created, add:

   ```js
   const SHIP_MODEL_URL = import.meta.env.BASE_URL + 'models/arwing.glb'

   SceneLoader.ImportMeshAsync('', SHIP_MODEL_URL, '', scene).then((res) => {
     for (const m of playerMeshes) m.setEnabled(false) // hide procedural ship
     const root = res.meshes[0]
     root.parent = shipTilt
     root.scaling.setAll(1.0)        // tune until the model reads the right size
     root.rotation.y = Math.PI       // most models point -Z; flip if yours does
     // Optional: collect res.meshes into a new playerMeshes array so the
     // invuln-flicker covers the loaded model too:
     //   playerMeshes.length = 0
     //   for (const m of res.meshes) playerMeshes.push(m)
   })
   ```

5. Rebuild — Vite/Quasar copies anything under `public/` into the
   deployed `dist/pwa/` at the same path, so the model is served at
   `/<your-base-path>/models/arwing.glb` and works offline thanks to the
   service-worker precache.

## Tuning

- **Scale**: Quaternius models tend to be very small. Try `scaling.setAll(0.05)`
  through `0.5` and bisect.
- **Orientation**: most glTF spaceships face `-Z` by convention; this
  project flies along `+Z`, so a `rotation.y = Math.PI` flip is usually
  needed.
- **Hit radius**: the gameplay constants `PLAYER_HIT_RADIUS` and the
  bolt-spawn wing offsets (`±1.6` on X) were tuned for the procedural
  ship. Adjust if your model's bounding box is much bigger or smaller.

## Why not bundle a model now?

The sandbox network policy this project was built in blocks itch.io and
quaternius.com, so I couldn't download a model to bundle. Once you do
the four steps above, the procedural fallback drops out cleanly.
