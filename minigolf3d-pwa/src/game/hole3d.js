// Turns a 2D Mini Golf hole (the exact same polygon data the flat game uses) into
// a 3D scene: an extruded green, curb walls around its outline, obstacle blocks,
// hazard patches (water/sand/boost), bumpers, portals and a cup — all with Havok
// colliders. The 520x760 play space maps onto the ground plane; +y2d (the tee end)
// becomes +z (near the camera), matching the flat game's orientation.
import earcut from 'earcut'
import {
  MeshBuilder,
  Vector3,
  Color3,
  StandardMaterial,
  makeStatic,
  pbr,
  PhysicsShapeType,
  PhysicsMotionType,
  PhysicsAggregate,
} from 'src/engine'

// Babylon's default earcut injection can come through undefined depending on the
// bundle, so pass it explicitly to every CreatePolygon call.
function polygon(name, shape, depth, scene) {
  return MeshBuilder.CreatePolygon(name, { shape, depth }, scene, earcut)
}

export const S = 1 / 26 // world units per 2D pixel
export const BALL_R = 7 * S
export const CUP_R = 15 * S
const CURB_H = 0.55
const CURB_T = 0.34
const OBST_H = 0.75

export function xz(p) {
  return { x: (p.x - 260) * S, z: (p.y - 380) * S }
}
function v3(p, y = 0) {
  return new Vector3((p.x - 260) * S, y, (p.y - 380) * S)
}
// world-XZ polygon (for hazard hit-testing in the controller)
function worldPoly(poly) {
  return poly.map((p) => xz(p))
}

export function buildHole3D(scene, shadow, def, theme) {
  const meshes = []
  const aggs = []
  const track = (m) => {
    meshes.push(m)
    return m
  }

  const grass = pbr(scene, { color: theme.grass, rough: 0.95, name: 'grass' })
  const rough = pbr(scene, { color: theme.grassDark || theme.grass, rough: 1, name: 'rough' })
  const curbMat = pbr(scene, { color: theme.lip || '#e9edf2', rough: 0.6, name: 'curb' })

  // --- green (extruded polygon slab, top face at y=0) ---
  const green = polygon('green', def.fairway.map((p) => v3(p)), 0.6, scene)
  green.material = grass
  green.receiveShadows = true
  aggs.push(makeStatic(green, { shape: PhysicsShapeType.MESH, friction: 0.85, restitution: 0.2 }))
  track(green)

  // --- curb walls around the fairway outline (decimated to keep collider count sane) ---
  const pts = def.fairway
  const step = Math.max(1, Math.round(pts.length / 44))
  for (let i = 0; i < pts.length; i += step) {
    const a = xz(pts[i])
    const b = xz(pts[(i + step) % pts.length])
    curbSegment(scene, a, b, curbMat, aggs, track)
  }

  // --- obstacles (hedges) ---
  for (const w of def.walls || []) {
    const ob = polygon('obst', w.map((p) => v3(p)), OBST_H, scene)
    ob.position.y = OBST_H
    ob.material = rough
    ob.receiveShadows = true
    shadow.addShadowCaster(ob)
    aggs.push(makeStatic(ob, { shape: PhysicsShapeType.MESH, friction: 0.5, restitution: 0.5 }))
    track(ob)
  }

  // --- hazard patches (flat, non-colliding; the controller does the gameplay) ---
  const waterPolys = []
  const sandPolys = []
  const boostZones = []
  for (const z of def.zones || []) {
    const patch = polygon('zone', z.poly.map((p) => v3(p)), 0.05, scene)
    patch.position.y = 0.02
    const m = new StandardMaterial('zoneMat', scene)
    m.specularColor = new Color3(0, 0, 0)
    if (z.type === 'water') {
      m.diffuseColor = Color3.FromHexString('#2f7fb0')
      m.alpha = 0.82
      waterPolys.push(worldPoly(z.poly))
    } else if (z.type === 'sand') {
      m.diffuseColor = Color3.FromHexString(theme.sand || '#d9c48f')
      sandPolys.push(worldPoly(z.poly))
    } else if (z.type === 'boost') {
      m.diffuseColor = Color3.FromHexString('#ffd23f')
      m.alpha = 0.5
      boostZones.push({ poly: worldPoly(z.poly), dir: { x: z.dir.x, z: z.dir.y } })
    }
    patch.material = m
    track(patch)
  }

  // --- bumpers ---
  const bumpers = []
  for (const b of def.bumpers || []) {
    const c = xz(b)
    const r = b.r * S
    const puck = MeshBuilder.CreateCylinder('bumper', { diameter: r * 2, height: 0.7, tessellation: 20 }, scene)
    puck.position.set(c.x, 0.35, c.z)
    puck.material = pbr(scene, { color: '#e0398a', rough: 0.5, name: 'bump' })
    shadow.addShadowCaster(puck)
    aggs.push(makeStatic(puck, { shape: PhysicsShapeType.CYLINDER, friction: 0.3, restitution: 1.15 }))
    track(puck)
    bumpers.push({ x: c.x, z: c.z, r })
  }

  // --- portals ---
  const portals = []
  for (const pt of def.portals || []) {
    const a = xz(pt.a)
    const b = xz(pt.b)
    const r = pt.r * S
    ring(scene, a, r, '#7e57c2', track)
    ring(scene, b, r, '#26c6da', track)
    portals.push({ a, b, r })
  }

  // --- windmills (Stage 1: spinning blade visual + a solid hub collider) ---
  const windmills = []
  for (const wm of def.windmills || []) {
    const c = xz(wm)
    const len = wm.len * S
    const hubR = wm.hub * S
    const hub = MeshBuilder.CreateCylinder('hub', { diameter: hubR * 2, height: 1.2, tessellation: 16 }, scene)
    hub.position.set(c.x, 0.6, c.z)
    hub.material = pbr(scene, { color: '#5d4037', rough: 0.8, name: 'hub' })
    shadow.addShadowCaster(hub)
    aggs.push(makeStatic(hub, { shape: PhysicsShapeType.CYLINDER, friction: 0.5, restitution: 0.5 }))
    track(hub)
    const blade = MeshBuilder.CreateBox('blade', { width: len * 2, height: 0.4, depth: 0.5 }, scene)
    blade.position.set(c.x, 0.55, c.z)
    blade.material = pbr(scene, { color: '#f5f5f5', rough: 0.5, name: 'blade' })
    shadow.addShadowCaster(blade)
    track(blade)
    // kinematic (ANIMATED) body: we spin the mesh each frame and Havok imparts the
    // blade's swept velocity to the ball on contact — so it actually swats it
    const bladeAgg = new PhysicsAggregate(blade, PhysicsShapeType.BOX, { mass: 0, restitution: 0.4 }, scene)
    bladeAgg.body.setMotionType(PhysicsMotionType.ANIMATED)
    bladeAgg.body.disablePreStep = false
    aggs.push(bladeAgg)
    windmills.push({ blade, speed: wm.speed, angle: 0 })
  }

  // --- cup + flag ---
  const cupC = xz(def.cup)
  const cupMesh = MeshBuilder.CreateCylinder('cup', { diameter: CUP_R * 2, height: 0.4, tessellation: 24 }, scene)
  const cupMat = new StandardMaterial('cupMat', scene)
  cupMat.diffuseColor = new Color3(0.05, 0.09, 0.06)
  cupMat.specularColor = new Color3(0, 0, 0)
  cupMesh.material = cupMat
  cupMesh.position.set(cupC.x, -0.18, cupC.z)
  track(cupMesh)

  const pole = MeshBuilder.CreateCylinder('pole', { diameter: 0.06, height: 2.6, tessellation: 8 }, scene)
  const poleMat = new StandardMaterial('poleMat', scene)
  poleMat.diffuseColor = new Color3(0.9, 0.9, 0.9)
  pole.material = poleMat
  pole.position.set(cupC.x, 1.2, cupC.z)
  shadow.addShadowCaster(pole)
  track(pole)

  const flag = MeshBuilder.CreatePlane('flag', { width: 1, height: 0.6 }, scene)
  const flagMat = new StandardMaterial('flagMat', scene)
  flagMat.diffuseColor = new Color3(0.9, 0.15, 0.15)
  flagMat.emissiveColor = new Color3(0.35, 0.03, 0.03)
  flagMat.backFaceCulling = false
  flag.material = flagMat
  flag.position.set(cupC.x + 0.5, 2.1, cupC.z)
  track(flag)

  const cupGroup = [cupMesh, pole, flag]

  return {
    teePos: new Vector3(xz(def.tee).x, BALL_R + 0.05, xz(def.tee).z),
    tee: xz(def.tee),
    cup: {
      base: cupC,
      move: def.cup.move || null,
      pos: new Vector3(cupC.x, 0, cupC.z),
      setXZ(x, z) {
        this.pos.x = x
        this.pos.z = z
        for (const m of cupGroup) m.position.x = x - (m === flag ? -0.5 : 0)
        for (const m of cupGroup) m.position.z = z
      },
    },
    waterPolys,
    sandPolys,
    boostZones,
    bumpers,
    portals,
    windmills,
    dispose() {
      for (const a of aggs) a.dispose?.()
      for (const m of meshes) m.dispose()
      grass.dispose()
      rough.dispose()
      curbMat.dispose()
    },
  }
}

function curbSegment(scene, a, b, mat, aggs, track) {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const len = Math.hypot(dx, dz)
  if (len < 0.001) return
  const box = MeshBuilder.CreateBox('curb', { width: len + CURB_T, height: CURB_H, depth: CURB_T }, scene)
  box.position.set((a.x + b.x) / 2, CURB_H / 2 - 0.05, (a.z + b.z) / 2)
  box.rotation.y = Math.atan2(dx, dz) - Math.PI / 2
  box.material = mat
  aggs.push(makeStatic(box, { shape: PhysicsShapeType.BOX, friction: 0.4, restitution: 0.55 }))
  track(box)
}

function ring(scene, c, r, color, track) {
  const t = MeshBuilder.CreateTorus('portal', { diameter: r * 2, thickness: 0.12, tessellation: 24 }, scene)
  t.position.set(c.x, 0.12, c.z)
  const m = new StandardMaterial('portalMat', scene)
  m.emissiveColor = Color3.FromHexString(color)
  m.disableLighting = true
  t.material = m
  track(t)
}
