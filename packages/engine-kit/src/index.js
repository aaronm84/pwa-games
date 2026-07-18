// engine-kit — a mobile-PWA-optimized Babylon.js game foundation.
//
// Stage owns bootstrap/perf/lifecycle (WebGPU with WebGL2 fallback, DPR caps,
// adaptive resolution, pause-when-hidden). physics wraps Havok with offline-
// safe wasm loading. Gestures unifies touch/mouse. presets gives good-looking
// defaults. sfx is a sample-free WebAudio synth kit; haptics wraps vibration.
// Games import what they need and supply the content.
export { Stage } from './stage.js'
export { Stage2D } from './stage2d.js'
export { Gestures } from './input.js'
export {
  initPhysics,
  physicsSupported,
  makeStatic,
  makeDynamic,
  PhysicsAggregate,
  PhysicsShapeType,
  PhysicsMotionType,
} from './physics.js'
export { outdoorLight, pbr, orbitCamera } from './presets.js'
export { createSynth } from './sfx.js'
export { createHaptics } from './haptics.js'

// Common Babylon primitives games need, re-exported from the tree-shaken module
// so game code imports everything from the kit and never the heavy barrel.
export {
  MeshBuilder,
  Mesh,
  VertexData,
  MirrorTexture,
  Texture,
  DynamicTexture,
  Plane,
  Vector3,
  Quaternion,
  PointLight,
  SpotLight,
  GlowLayer,
  FxaaPostProcess,
  Color3,
  Color4,
  StandardMaterial,
  PBRMaterial,
  ArcRotateCamera,
} from './babylon.js'
