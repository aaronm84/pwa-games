// engine-kit / physics — Havok (WASM) setup + thin body helpers.
//
// The wasm is imported as a bundled asset URL and fetched to a byte array, so it
// works offline in the PWA (the service worker precaches it) and doesn't depend on
// a CDN or on the bundler guessing the path.
import HavokPhysics from '@babylonjs/havok'
import havokWasmUrl from '@babylonjs/havok/lib/esm/HavokPhysics.wasm?url'
import { HavokPlugin, Vector3, PhysicsAggregate, PhysicsShapeType, PhysicsMotionType } from '@babylonjs/core'

export { PhysicsAggregate, PhysicsShapeType, PhysicsMotionType }

let _havok = null

// Whether this device can run Havok (needs WebAssembly + SIMD). Games can call
// this to decide between the 3D physics path and a fallback.
export async function physicsSupported() {
  try {
    if (typeof WebAssembly !== 'object') return false
    await getHavok()
    return true
  } catch {
    return false
  }
}

async function getHavok() {
  if (_havok) return _havok
  const res = await fetch(havokWasmUrl)
  const wasmBinary = new Uint8Array(await res.arrayBuffer())
  _havok = await HavokPhysics({ wasmBinary })
  return _havok
}

// Enable Havok on a scene. Returns the plugin.
export async function initPhysics(scene, { gravity = -9.81 } = {}) {
  const havok = await getHavok()
  const plugin = new HavokPlugin(true, havok)
  scene.enablePhysics(new Vector3(0, gravity, 0), plugin)
  return plugin
}

// A static collider from any mesh (mass 0). Use a MESH shape for the terrain,
// BOX for curbs/walls.
export function makeStatic(mesh, { shape = PhysicsShapeType.MESH, friction = 0.6, restitution = 0.4 } = {}) {
  return new PhysicsAggregate(mesh, shape, { mass: 0, friction, restitution }, mesh.getScene())
}

// A dynamic rigid body (the ball).
export function makeDynamic(mesh, { shape = PhysicsShapeType.SPHERE, mass = 1, friction = 0.4, restitution = 0.5, linearDamping = 0.4, angularDamping = 0.4 } = {}) {
  const agg = new PhysicsAggregate(mesh, shape, { mass, friction, restitution }, mesh.getScene())
  agg.body.setLinearDamping(linearDamping)
  agg.body.setAngularDamping(angularDamping)
  return agg
}
