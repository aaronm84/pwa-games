// engine-kit — shared Babylon.js + Havok foundation for PWA games.
//
// Extensible on purpose: Stage handles bootstrap/perf/lifecycle, physics.js wraps
// Havok, input.js unifies touch/mouse gestures, presets.js gives good-looking
// defaults. A game imports what it needs and supplies the content.
export { Stage } from './stage.js'
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
