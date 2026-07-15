// Builds the alley: lane, gutters, kerbs, backstop pit, neon edge strips, and
// the pin rack — all with Havok colliders. World layout: the lane runs along z,
// the bowler stands at +z, the pins live near z = PIN_Z (negative, far end).
import {
  MeshBuilder,
  Vector3,
  Color3,
  StandardMaterial,
  makeStatic,
  pbr,
  PhysicsAggregate,
  PhysicsShapeType,
} from 'src/engine'

export const LANE_W = 2.2 // playable lane width
export const LANE_LEN = 18
export const BALL_R = 0.22
export const PIN_Z = -7.2 // head pin
export const DECK_END = -9.2 // the floor ends here — then the pit
export const PIT_Z = -9.0 // past this (or below the floor) the ball is done
export const START_Z = 6.2 // where the bowler stands (in frame, below the camera)
const GUTTER_W = 0.62

export const PIN_H = 0.78
const PIN_D = 0.22
const PIN_SPACING = 0.58

// standard 10-pin triangle, head pin toward the bowler
export function pinSpots() {
  const s = PIN_SPACING
  const rows = [[0], [-s / 2, s / 2], [-s, 0, s], [-1.5 * s, -s / 2, s / 2, 1.5 * s]]
  const spots = []
  rows.forEach((xs, r) => {
    for (const x of xs) spots.push({ x, z: PIN_Z - r * s * 0.866 })
  })
  return spots
}

export function buildAlley(scene, shadow, colors) {
  const meshes = []
  const aggs = []
  const track = (m) => (meshes.push(m), m)

  const laneMat = pbr(scene, { color: colors.lane, rough: 0.35, name: 'lane' })
  const gutterMat = pbr(scene, { color: colors.gutter, rough: 0.8, name: 'gutter' })
  const darkMat = pbr(scene, { color: colors.backstop, rough: 0.9, name: 'backstop' })

  // lane bed (top at y=0), slick like an oiled lane. The floor STOPS at the pit
  // edge — balls and deadwood drop away behind the pin deck like a real house.
  const floorLen = START_Z + 2 - DECK_END
  const floorZ = (START_Z + 2 + DECK_END) / 2
  const lane = MeshBuilder.CreateBox('lane', { width: LANE_W, height: 0.3, depth: floorLen }, scene)
  lane.position.set(0, -0.15, floorZ)
  lane.material = laneMat
  lane.receiveShadows = true
  aggs.push(makeStatic(lane, { shape: PhysicsShapeType.BOX, friction: 0.18, restitution: 0.1 }))
  track(lane)

  // gutters: a lower floor channel each side, with an outer kerb wall
  for (const side of [-1, 1]) {
    const gx = side * (LANE_W / 2 + GUTTER_W / 2)
    const g = MeshBuilder.CreateBox('gutterFloor', { width: GUTTER_W, height: 0.3, depth: floorLen }, scene)
    g.position.set(gx, -0.27, floorZ)
    g.material = gutterMat
    aggs.push(makeStatic(g, { shape: PhysicsShapeType.BOX, friction: 0.3, restitution: 0.05 }))
    track(g)
    const kerb = MeshBuilder.CreateBox('kerb', { width: 0.18, height: 0.5, depth: floorLen }, scene)
    kerb.position.set(side * (LANE_W / 2 + GUTTER_W + 0.09), 0.1, floorZ)
    kerb.material = darkMat
    aggs.push(makeStatic(kerb, { shape: PhysicsShapeType.BOX, friction: 0.3, restitution: 0.25 }))
    track(kerb)
  }

  // the pit: a deep floor below/behind the deck so everything visibly drops in
  const pit = MeshBuilder.CreateBox('pit', { width: LANE_W + 2 * GUTTER_W + 1, height: 0.3, depth: 2.6 }, scene)
  pit.position.set(0, -1.5, DECK_END - 1.3)
  pit.material = darkMat
  aggs.push(makeStatic(pit, { shape: PhysicsShapeType.BOX, friction: 0.9, restitution: 0 }))
  track(pit)

  // neon edge strips (visual) — the page color-cycles their emissive
  const edges = []
  for (const side of [-1, 1]) {
    const e = MeshBuilder.CreateBox('neon', { width: 0.06, height: 0.05, depth: LANE_LEN + 2 }, scene)
    e.position.set(side * (LANE_W / 2 + 0.03), 0.03, lane.position.z)
    const m = new StandardMaterial('neonMat' + side, scene)
    m.emissiveColor = Color3.FromHexString(side < 0 ? colors.laneEdgeA : colors.laneEdgeB)
    m.disableLighting = true
    e.material = m
    edges.push({ mesh: e, mat: m })
    track(e)
  }

  // aiming arrows painted on the lane (classic range markers)
  const arrowMat = new StandardMaterial('arrowMat', scene)
  arrowMat.emissiveColor = Color3.FromHexString(colors.arrow).scale(0.5)
  arrowMat.disableLighting = true
  arrowMat.alpha = 0.8
  for (let i = -2; i <= 2; i++) {
    const a = MeshBuilder.CreateBox('arrow', { width: 0.07, height: 0.01, depth: 0.34 }, scene)
    a.position.set(i * 0.4, 0.006, 3.4 - Math.abs(i) * 0.5)
    a.material = arrowMat
    track(a)
  }

  // backstop curtain at the far side of the pit (below deck height, so nothing
  // ever bounces back onto the lane)
  const back = MeshBuilder.CreateBox('back', { width: LANE_W + 2 * GUTTER_W + 1, height: 2.2, depth: 0.3 }, scene)
  back.position.set(0, -0.5, DECK_END - 2.7)
  back.material = darkMat
  aggs.push(makeStatic(back, { shape: PhysicsShapeType.BOX, friction: 0.6, restitution: 0 }))
  track(back)

  // gutter floor color pulse handle (lava alley)
  const gutterGlow = colors.gutterGlow ? gutterMat : null

  return {
    edges,
    gutterMat: gutterGlow,
    dispose() {
      for (const a of aggs) a.dispose?.()
      for (const m of meshes) m.dispose()
      laneMat.dispose()
      gutterMat.dispose()
      darkMat.dispose()
      arrowMat.dispose()
      for (const e of edges) e.mat.dispose()
    },
  }
}

// One pin: a cylinder body (the collider) with a painted stripe and a head.
// Dynamic from birth so a hit topples it realistically.
export function makePin(scene, shadow, x, z, colors) {
  const body = MeshBuilder.CreateCylinder('pin', { diameter: PIN_D, height: PIN_H, tessellation: 12 }, scene)
  body.position.set(x, PIN_H / 2, z)
  const mat = pbr(scene, { color: colors.pin, rough: 0.4, name: 'pinMat' })
  body.material = mat
  shadow.addShadowCaster(body)
  const stripe = MeshBuilder.CreateCylinder('stripe', { diameter: PIN_D + 0.015, height: 0.06, tessellation: 12 }, scene)
  stripe.material = pbr(scene, { color: colors.pinStripe, rough: 0.4, name: 'stripeMat' })
  stripe.parent = body
  stripe.position.y = PIN_H * 0.22
  let agg = new PhysicsAggregate(body, PhysicsShapeType.CYLINDER, { mass: 1.5, friction: 0.55, restitution: 0.25 }, scene)
  agg.body.setLinearDamping(0.1)
  agg.body.setAngularDamping(0.2)
  return {
    body,
    home: { x, z },
    // standing = still mostly upright and still on the deck
    isStanding() {
      const up = Vector3.TransformNormal(Vector3.Up(), body.getWorldMatrix())
      return up.y > 0.8 && body.position.y > PIN_H * 0.3 && body.position.z > PIT_Z
    },
    // drop the collider now (deadwood must stop interacting) but keep the mesh
    // so the page can fade it out
    freeze() {
      agg?.dispose()
      agg = null
    },
    dispose() {
      agg?.dispose()
      agg = null
      stripe.material.dispose()
      stripe.dispose()
      mat.dispose()
      body.dispose()
    },
  }
}
