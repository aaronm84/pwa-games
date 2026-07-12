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
const CURB_H = 0.9
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

export function buildHole3D(scene, shadow, def, theme, extra = {}) {
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

  // --- 3D terrain: hills (rounded mounds) + ramps (inclined slabs) ---
  const contourMat = new StandardMaterial('contour', scene)
  contourMat.diffuseColor = Color3.FromHexString(theme.grassDark || '#3a7d34')
  contourMat.specularColor = new Color3(0, 0, 0)
  contourMat.alpha = 0.5
  for (const hl of extra.hills || []) {
    const c = xz(hl)
    const r = hl.r * S
    const h = hl.h || 1.2
    const dome = MeshBuilder.CreateSphere('hill', { diameterX: r * 2, diameterY: h * 2, diameterZ: r * 2, segments: 20 }, scene)
    dome.position.set(c.x, 0, c.z)
    dome.material = grass
    dome.receiveShadows = true
    shadow.addShadowCaster(dome)
    aggs.push(makeStatic(dome, { shape: PhysicsShapeType.MESH, friction: 0.85, restitution: 0.2 }))
    track(dome)
    // topographic contour rings: a circle of constant elevation at each band
    for (const frac of [0.28, 0.52, 0.76]) {
      const y = h * frac
      const rr = r * Math.sqrt(Math.max(0, 1 - frac * frac))
      const ring = MeshBuilder.CreateTorus('contour', { diameter: rr * 2, thickness: 0.045, tessellation: 40 }, scene)
      ring.material = contourMat
      ring.position.set(c.x, y + 0.01, c.z)
      ring.isPickable = false
      track(ring)
    }
  }
  for (const rp of extra.ramps || []) {
    const c = xz(rp)
    const w = rp.w * S
    const l = rp.l * S
    const slab = MeshBuilder.CreateBox('ramp', { width: w, height: 0.25, depth: l }, scene)
    const angle = Math.atan2(rp.h, l) * (rp.dir === 'down' ? 1 : -1)
    slab.rotation.x = angle
    slab.position.set(c.x, rp.h / 2, c.z)
    slab.material = grass
    slab.receiveShadows = true
    shadow.addShadowCaster(slab)
    aggs.push(makeStatic(slab, { shape: PhysicsShapeType.BOX, friction: 0.85, restitution: 0.15 }))
    track(slab)
  }

  // --- decorative props scattered in the rough (never on the fairway) ---
  const propMats = buildProps(scene, def, theme, shadow, track)

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
      contourMat.dispose()
      for (const m of propMats) m.dispose()
    },
  }
}

// deterministic tiny RNG so props don't reshuffle every frame
function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}
function pointInPoly2d(px, py, poly) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

// Scatter cheap themed props (pines / reeds / cacti / rocks) in the rough. Purely
// cosmetic — no colliders — so they never interfere with a putt.
function buildProps(scene, def, theme, shadow, track) {
  const kind = theme.prop || 'rock'
  const rand = rng(def.name.length * 131 + (def.tee.x | 0) * 7 + (def.cup.y | 0) + 7)
  const mats = {}
  const mat = (hex, rough = 0.9) => (mats[hex] ||= pbr(scene, { color: hex, rough, name: 'prop' + hex }))
  let made = 0
  for (let tries = 0; tries < 200 && made < 16; tries++) {
    const px = 20 + rand() * 480
    const py = 30 + rand() * 700
    if (pointInPoly2d(px, py, def.fairway)) continue
    const c = xz({ x: px, y: py })
    const s = 0.7 + rand() * 0.7
    if (kind === 'pine') {
      const trunk = MeshBuilder.CreateCylinder('trunk', { diameter: 0.18 * s, height: 0.6 * s, tessellation: 6 }, scene)
      trunk.material = mat('#6b4a2b')
      trunk.position.set(c.x, 0.3 * s, c.z)
      const cone = MeshBuilder.CreateCylinder('pine', { diameterTop: 0, diameterBottom: 0.95 * s, height: 1.7 * s, tessellation: 8 }, scene)
      cone.material = mat(theme.rough || '#1f5c37')
      cone.position.set(c.x, 1.2 * s, c.z)
      shadow.addShadowCaster(cone)
      track(trunk); track(cone)
    } else if (kind === 'reed') {
      for (let r = 0; r < 3; r++) {
        const reed = MeshBuilder.CreateCylinder('reed', { diameterTop: 0.02, diameterBottom: 0.06 * s, height: (1 + rand()) * s, tessellation: 5 }, scene)
        reed.material = mat('#5b6b2e')
        reed.position.set(c.x + (rand() - 0.5) * 0.4, 0.5 * s, c.z + (rand() - 0.5) * 0.4)
        reed.rotation.z = (rand() - 0.5) * 0.3
        track(reed)
      }
    } else if (kind === 'cactus') {
      const trunk = MeshBuilder.CreateCylinder('cactus', { diameter: 0.3 * s, height: 1.4 * s, tessellation: 8 }, scene)
      trunk.material = mat('#4e7a3a')
      trunk.position.set(c.x, 0.7 * s, c.z)
      shadow.addShadowCaster(trunk)
      if (rand() < 0.7) {
        const arm = MeshBuilder.CreateCylinder('arm', { diameter: 0.18 * s, height: 0.6 * s, tessellation: 6 }, scene)
        arm.material = mat('#4e7a3a')
        arm.position.set(c.x + 0.3 * s, 0.9 * s, c.z)
        track(arm)
      }
      track(trunk)
    } else {
      const rock = MeshBuilder.CreateSphere('rock', { diameterX: 0.6 * s, diameterY: 0.4 * s, diameterZ: 0.7 * s, segments: 6 }, scene)
      rock.material = mat('#7d7568')
      rock.position.set(c.x, 0.18 * s, c.z)
      shadow.addShadowCaster(rock)
      track(rock)
    }
    made++
  }
  return Object.values(mats)
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
  aggs.push(makeStatic(box, { shape: PhysicsShapeType.BOX, friction: 0.4, restitution: 0.35 }))
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
