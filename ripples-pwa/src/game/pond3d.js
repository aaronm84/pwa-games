// Builds the pond: a real displaced water surface driven by the wave model,
// the earthen bank around it, swaying reeds, koi beneath the surface, and the
// glowing wavefront rings. World layout: the water lies in the x/z plane at
// y≈0, the pond is a disc of radius R centered on the origin.
import {
  MeshBuilder,
  Mesh,
  VertexData,
  Vector3,
  Color3,
  StandardMaterial,
  Scene,
  pbr,
} from 'src/engine'
import { surfaceHeight, ripplePower } from './waves.js'

// Time-of-day palettes for the pond (the page picks by theme period key).
export const POND_PALETTES = {
  night: { clear: '#0a1628', water: '#16304e', deep: '#050d1a', ring: '#9fd8ff', bank: '#2e2a26', grass: '#1d2b1e', sun: '#aac4ff', sunIntensity: 0.5, petal: '#e8b4d8' },
  dawn: { clear: '#4a2c5e', water: '#6a4a86', deep: '#241030', ring: '#ffd9f0', bank: '#4a3a30', grass: '#3a4a2e', sun: '#ffc9a0', sunIntensity: 0.85, petal: '#ffc0cb' },
  morning: { clear: '#1a5f7a', water: '#2f88a8', deep: '#0a2a3a', ring: '#d8f6ff', bank: '#584634', grass: '#3f6b35', sun: '#fff2dd', sunIntensity: 1.1, petal: '#ffb6c1' },
  midday: { clear: '#0a3a52', water: '#1a6a8a', deep: '#062435', ring: '#e4fbff', bank: '#5a4836', grass: '#437038', sun: '#ffffff', sunIntensity: 1.2, petal: '#ffb6c1' },
  afternoon: { clear: '#2a5f7a', water: '#3f88a8', deep: '#10303f', ring: '#e0f6ff', bank: '#57432f', grass: '#48683a', sun: '#fff0cc', sunIntensity: 1.05, petal: '#ffb6c1' },
  evening: { clear: '#3a2f52', water: '#544a76', deep: '#171029', ring: '#ffd9c9', bank: '#453729', grass: '#33422c', sun: '#ffb27a', sunIntensity: 0.75, petal: '#f4a9c4' },
  dusk: { clear: '#2a1f42', water: '#3f3462', deep: '#100a20', ring: '#c9c1ff', bank: '#352b22', grass: '#26331f', sun: '#c9a9ff', sunIntensity: 0.6, petal: '#e8a9d0' },
}

export function paletteFor(periodKey) {
  return POND_PALETTES[periodKey] || POND_PALETTES.midday
}

// The water: a polar-grid disc (rings × sectors) whose vertices ride the wave
// model every frame. A polar grid keeps the rim exactly circular under the
// bank, and gives even radial resolution for the ring-shaped wavefronts.
function buildWater(scene, R, pal) {
  const RINGS = 44
  const SECTORS = 88
  const positions = [0, 0, 0]
  const indices = []
  for (let ri = 1; ri <= RINGS; ri++) {
    const r = (ri / RINGS) * R
    for (let si = 0; si < SECTORS; si++) {
      const a = (si / SECTORS) * Math.PI * 2
      positions.push(Math.cos(a) * r, 0, Math.sin(a) * r)
    }
  }
  const idx = (ri, si) => (ri === 0 ? 0 : 1 + (ri - 1) * SECTORS + (si % SECTORS))
  // winding chosen so the faces (and computed normals) look up at the camera
  for (let si = 0; si < SECTORS; si++) indices.push(0, idx(1, si), idx(1, si + 1))
  for (let ri = 1; ri < RINGS; ri++) {
    for (let si = 0; si < SECTORS; si++) {
      const a = idx(ri, si)
      const b = idx(ri, si + 1)
      const c = idx(ri + 1, si)
      const d = idx(ri + 1, si + 1)
      indices.push(a, c, b, b, c, d)
    }
  }
  const normals = []
  VertexData.ComputeNormals(positions, indices, normals)

  const water = new Mesh('water', scene)
  const vd = new VertexData()
  vd.positions = new Float32Array(positions)
  vd.indices = indices
  vd.normals = new Float32Array(normals)
  vd.applyToMesh(water, true)

  const mat = pbr(scene, { color: pal.water, rough: 0.34, name: 'waterMat' })
  mat.alpha = 0.86
  mat.metallic = 0.05
  mat.specularIntensity = 0.35 // glints, not a blown-out sun disc
  water.material = mat
  water.receiveShadows = true
  return { water, mat }
}

// A pool of emissive rings that make each wavefront readable: they expand
// with the wave and fade with its power.
function buildRippleRings(scene, glowLayer, pal, max = 14) {
  const rings = []
  const mat = new StandardMaterial('ringMat', scene)
  mat.emissiveColor = Color3.FromHexString(pal.ring)
  mat.disableLighting = true
  mat.alpha = 0
  for (let i = 0; i < max; i++) {
    const m = MeshBuilder.CreateTorus(`ring${i}`, { diameter: 1, thickness: 0.045, tessellation: 72 }, scene)
    m.material = mat.clone(`ringMat${i}`)
    m.isVisible = false
    m.isPickable = false
    rings.push(m)
  }
  return {
    update(ripples, waterY) {
      for (let i = 0; i < rings.length; i++) {
        const m = rings[i]
        const r = ripples[i]
        if (!r || r.radius < 0.1) {
          m.isVisible = false
          continue
        }
        const power = ripplePower(r.radius, r.peakRadius, r.peakPower)
        m.isVisible = power > 0.03
        m.position.set(r.x, waterY + 0.03, r.z)
        m.scaling.set(r.radius * 2, 1, r.radius * 2)
        m.material.alpha = Math.min(0.75, power * 0.7)
      }
    },
    dispose() {
      for (const m of rings) {
        m.material.dispose()
        m.dispose()
      }
    },
  }
}

// A reed cluster: tapered blades leaning out of the shallows, some with a
// cattail head. Blades pivot at the waterline so they can sway.
function buildReeds(scene, shadow, reeds, pal) {
  const clusters = []
  const bladeMat = pbr(scene, { color: '#3f7a35', rough: 0.85, name: 'reedMat' })
  const headMat = pbr(scene, { color: '#5e4322', rough: 0.9, name: 'cattailMat' })
  for (const rd of reeds) {
    const blades = []
    for (let b = 0; b < rd.blades; b++) {
      const h = rd.height * (0.75 + (b / rd.blades) * 0.5)
      const blade = MeshBuilder.CreateCylinder(
        'reed',
        { height: h, diameterBottom: 0.06, diameterTop: 0.015, tessellation: 5 },
        scene,
      )
      blade.material = bladeMat
      // bake the pivot to the base so rotation sways the tip, not the middle
      blade.setPivotPoint(new Vector3(0, -h / 2, 0))
      blade.position.set(rd.x + (b - rd.blades / 2) * 0.14, h / 2 - 0.15, rd.z + ((b * 37) % 3) * 0.07)
      const baseLean = rd.lean + (b - rd.blades / 2) * 0.09
      blade.rotation.z = baseLean
      shadow?.addShadowCaster(blade)
      let head = null
      if (b === Math.floor(rd.blades / 2) && rd.height > 1.2) {
        head = MeshBuilder.CreateCapsule('cattail', { height: 0.34, radius: 0.055 }, scene)
        head.material = headMat
        head.parent = blade
        head.position.y = h / 2 - 0.16
      }
      blades.push({ mesh: blade, baseLean, phase: rd.seed + b * 1.3 })
    }
    clusters.push({ x: rd.x, z: rd.z, blades })
  }
  return {
    update(t, ripples) {
      for (const c of clusters) {
        // a passing wavefront leans the whole cluster; otherwise a lazy sway
        let push = 0
        for (const r of ripples) {
          const d = Math.hypot(c.x - r.x, c.z - r.z)
          const off = Math.abs(d - r.radius)
          if (off < 2) push += ripplePower(r.radius, r.peakRadius, r.peakPower) * (1 - off / 2) * 0.2
        }
        for (const b of c.blades) {
          b.mesh.rotation.z = b.baseLean + Math.sin(t * 1.1 + b.phase) * 0.045 + push
        }
      }
    },
    dispose() {
      bladeMat.dispose()
      headMat.dispose()
      for (const c of clusters) for (const b of c.blades) b.mesh.dispose()
    },
  }
}

// Koi under the surface: a stretched body + tail fin, visible through the
// water's transparency. They wander, and scurry when a wavefront passes.
function buildFish(scene, fishData, R) {
  const fishes = []
  for (const f of fishData) {
    const body = MeshBuilder.CreateSphere('koi', { diameterX: 0.62, diameterY: 0.2, diameterZ: 0.22, segments: 12 }, scene)
    const mat = pbr(scene, { color: f.warm ? '#d96a2e' : '#9fb4c9', rough: 0.5, name: 'koiMat' })
    mat.alpha = 0.9
    body.material = mat
    const tail = MeshBuilder.CreateCylinder('koiTail', { height: 0.26, diameterBottom: 0.2, diameterTop: 0.01, tessellation: 4 }, scene)
    tail.material = mat
    tail.parent = body
    tail.rotation.z = Math.PI / 2
    tail.position.x = -0.38
    tail.scaling.y = 0.35
    body.scaling.setAll(f.size)
    body.position.set(f.x, -0.35, f.z)
    body.isPickable = false
    tail.isPickable = false
    fishes.push({ mesh: body, tail, mat, heading: f.heading, speed: f.speed, base: f.speed, scurry: 0 })
  }
  return {
    update(t, dt, ripples) {
      for (const f of fishes) {
        const p = f.mesh.position
        // frightened by passing wavefronts
        for (const r of ripples) {
          const d = Math.hypot(p.x - r.x, p.z - r.z)
          if (Math.abs(d - r.radius) < 2.2 && f.scurry <= 0) {
            f.scurry = 1.2
            f.heading = Math.atan2(p.z - r.z, p.x - r.x) + (Math.random() - 0.5) * 0.8
          }
        }
        if (f.scurry > 0) f.scurry -= dt
        const speed = f.base * (f.scurry > 0 ? 3.2 : 1)
        f.heading += Math.sin(t * 0.6 + f.base * 10) * 0.012 + (Math.random() - 0.5) * 0.02
        // stay in the pond
        const rr = Math.hypot(p.x, p.z)
        if (rr > R - 1.6) {
          const inward = Math.atan2(-p.z, -p.x)
          let delta = inward - f.heading
          while (delta > Math.PI) delta -= Math.PI * 2
          while (delta < -Math.PI) delta += Math.PI * 2
          f.heading += delta * 0.06
        }
        p.x += Math.cos(f.heading) * speed * dt
        p.z += Math.sin(f.heading) * speed * dt
        p.y = -0.35 + Math.sin(t * 1.4 + f.base * 7) * 0.05
        f.mesh.rotation.y = -f.heading
        f.tail.rotation.y = Math.sin(t * (f.scurry > 0 ? 22 : 9)) * 0.5
      }
    },
    dispose() {
      for (const f of fishes) {
        f.mat.dispose()
        f.tail.dispose()
        f.mesh.dispose()
      }
    },
  }
}

// The tree line past the banks: cheap silhouettes (cones and lollipops) that
// the distance haze softens into scenery.
function buildTrees(scene, trees, pal) {
  const meshes = []
  const mats = []
  const grassC = Color3.FromHexString(pal.grass)
  for (let tone = 0; tone < 3; tone++) {
    const m = pbr(scene, { color: '#000000', rough: 1, name: `treeMat${tone}` })
    m.albedoColor = grassC.scale(0.55 + tone * 0.3).add(new Color3(0.02, 0.05, 0.01))
    mats.push(m)
  }
  const trunkMat = pbr(scene, { color: '#4a3826', rough: 1, name: 'trunkMat' })
  mats.push(trunkMat)
  for (const t of trees) {
    const mat = mats[Math.floor(t.tone * 3)]
    if (t.kind === 'conifer') {
      const cone = MeshBuilder.CreateCylinder('tree', { height: t.height, diameterBottom: t.width, diameterTop: 0.02, tessellation: 7 }, scene)
      cone.position.set(t.x, t.height / 2 - 0.18, t.z)
      cone.material = mat
      cone.isPickable = false
      cone.freezeWorldMatrix()
      meshes.push(cone)
    } else {
      const trunk = MeshBuilder.CreateCylinder('trunk', { height: t.height * 0.5, diameter: t.width * 0.16, tessellation: 6 }, scene)
      trunk.position.set(t.x, t.height * 0.25 - 0.18, t.z)
      trunk.material = trunkMat
      const crown = MeshBuilder.CreateSphere('crown', { diameterX: t.width, diameterY: t.height * 0.7, diameterZ: t.width, segments: 7 }, scene)
      crown.position.set(t.x, t.height * 0.62 - 0.18, t.z)
      crown.material = mat
      for (const m of [trunk, crown]) {
        m.isPickable = false
        m.freezeWorldMatrix()
        meshes.push(m)
      }
    }
  }
  return {
    dispose() {
      for (const m of meshes) m.dispose()
      for (const m of mats) m.dispose()
    },
  }
}

// Dragonflies: a darting body with shimmering wing quads, wandering a small
// patch of air on a lissajous path.
function buildDragonflies(scene, flies) {
  const items = []
  const bodyMat = pbr(scene, { color: '#3a6fd8', rough: 0.35, name: 'dflyBody' })
  const wingMat = new StandardMaterial('dflyWing', scene)
  wingMat.emissiveColor = new Color3(0.85, 0.92, 1)
  wingMat.alpha = 0.3
  wingMat.disableLighting = true
  wingMat.backFaceCulling = false
  for (const f of flies) {
    const body = MeshBuilder.CreateCapsule('dfly', { height: 0.34, radius: 0.028 }, scene)
    body.rotation.x = Math.PI / 2
    body.material = bodyMat
    body.isPickable = false
    const wings = []
    for (let w = 0; w < 2; w++) {
      const wing = MeshBuilder.CreatePlane('wing', { width: 0.34, height: 0.09 }, scene)
      wing.material = wingMat
      wing.parent = body
      wing.rotation.x = Math.PI / 2
      wing.position.y = 0.05 - w * 0.1
      wing.isPickable = false
      wings.push(wing)
    }
    items.push({ body, wings, f, dart: 0, dx: 0, dz: 0 })
  }
  return {
    update(t) {
      for (const it of items) {
        const { f } = it
        // lazy lissajous hover with the occasional dart to a new patch
        if (it.dart <= 0 && Math.random() < 0.003) {
          it.dart = 1
          it.dx = (Math.random() - 0.5) * f.wander * 2
          it.dz = (Math.random() - 0.5) * f.wander * 2
        }
        if (it.dart > 0) it.dart = Math.max(0, it.dart - 0.02)
        const ease = 1 - it.dart
        const hx = f.x + Math.sin(t * 0.7 + f.phase) * f.wander * 0.5 + it.dx * ease
        const hz = f.z + Math.sin(t * 0.9 + f.phase * 2) * f.wander * 0.4 + it.dz * ease
        const hy = f.height + Math.sin(t * 2.1 + f.phase) * 0.08
        const prev = it.body.position
        it.body.rotation.y = Math.atan2(hx - prev.x, hz - prev.z)
        prev.set(hx, hy, hz)
        for (let w = 0; w < it.wings.length; w++) {
          it.wings[w].scaling.y = 0.35 + Math.abs(Math.sin(t * 38 + w * 1.7)) * 0.9
        }
      }
    },
    dispose() {
      bodyMat.dispose()
      wingMat.dispose()
      for (const it of items) it.body.dispose(false, true)
    },
  }
}

// Fringe pads: decorative lily pads hugging the banks, bobbing on the swell.
function buildFringePads(scene, fringePads) {
  const items = []
  const mat = pbr(scene, { color: '#35682c', rough: 0.85, name: 'fringePadMat' })
  for (const p of fringePads) {
    const m = MeshBuilder.CreateCylinder('fringe', { diameter: p.radius * 2, height: 0.05, tessellation: 16 }, scene)
    m.position.set(p.x, 0.03, p.z)
    m.rotation.y = p.rotation
    m.material = mat
    m.isPickable = false
    items.push({ mesh: m, p })
  }
  return {
    update(t, ripples) {
      for (const it of items) {
        const y = surfaceHeight(it.p.x, it.p.z, ripples, t)
        it.mesh.position.y = 0.03 + y
        it.mesh.rotation.z = y * 0.8
      }
    },
    dispose() {
      for (const it of items) it.mesh.dispose()
      mat.dispose()
    },
  }
}

export function buildPond(scene, shadow, level, pal) {
  const R = level.R
  const disposables = []

  // the world past the water fades into haze — this is what makes a 13-unit
  // disc read as an expansive pond instead of a diorama
  scene.fogMode = Scene.FOGMODE_EXP2
  scene.fogColor = Color3.FromHexString(pal.clear)
  scene.fogDensity = 0.021

  const { water, mat: waterMat } = buildWater(scene, R, pal)
  disposables.push(water, waterMat)

  // the dark depth beneath the transparent surface — this is what makes the
  // water read as deep instead of as tinted glass
  // sits just under the surface (and above the grass apron) so the pond
  // interior reads dark through the transparent water
  const depth = MeshBuilder.CreateDisc('depth', { radius: R + 0.3, tessellation: 72 }, scene)
  depth.rotation.x = Math.PI / 2
  depth.position.y = -0.16
  const depthMat = pbr(scene, { color: pal.deep, rough: 1, name: 'depthMat' })
  depth.material = depthMat
  depth.isPickable = false
  depth.freezeWorldMatrix()
  disposables.push(depth, depthMat)

  // the bank: an earthen ring hugging the waterline, on a grass apron
  const bank = MeshBuilder.CreateTorus('bank', { diameter: R * 2 + 0.9, thickness: 1.5, tessellation: 96 }, scene)
  bank.scaling.y = 0.55
  bank.position.y = 0.02
  const bankMat = pbr(scene, { color: pal.bank, rough: 0.95, name: 'bankMat' })
  bank.material = bankMat
  bank.receiveShadows = true
  bank.isPickable = false
  bank.freezeWorldMatrix()
  disposables.push(bank, bankMat)

  const grass = MeshBuilder.CreateDisc('grass', { radius: R + 40, tessellation: 72 }, scene)
  grass.rotation.x = Math.PI / 2
  grass.position.y = -0.18
  const grassMat = pbr(scene, { color: pal.grass, rough: 1, name: 'grassMat' })
  grass.material = grassMat
  grass.receiveShadows = true
  grass.isPickable = false
  grass.freezeWorldMatrix()
  disposables.push(grass, grassMat)

  // scattered pebbles along the bank line
  const pebbleMat = pbr(scene, { color: '#8b8378', rough: 0.9, name: 'pebbleMat' })
  disposables.push(pebbleMat)
  let pseed = 7
  const prand = () => ((pseed = (pseed * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < 22; i++) {
    const a = prand() * Math.PI * 2
    const rr = R + 0.15 + prand() * 0.9
    const peb = MeshBuilder.CreateSphere('pebble', { diameter: 0.16 + prand() * 0.26, segments: 6 }, scene)
    peb.scaling.y = 0.6
    peb.position.set(Math.cos(a) * rr, 0.32 + prand() * 0.05, Math.sin(a) * rr)
    peb.material = pebbleMat
    peb.isPickable = false
    peb.freezeWorldMatrix()
    disposables.push(peb)
  }

  const reeds = buildReeds(scene, shadow, level.reeds, pal)
  const fish = buildFish(scene, level.fish, R)
  const rings = buildRippleRings(scene, null, pal, 20)
  const trees = buildTrees(scene, level.trees, pal)
  const dragonflies = buildDragonflies(scene, level.dragonflies)
  const fringe = buildFringePads(scene, level.fringePads)

  // per-frame water displacement
  const vb = water.getVerticesData('position')
  const positions = new Float32Array(vb)
  const normals = new Float32Array(water.getVerticesData('normal'))
  const indices = water.getIndices()

  return {
    water,
    update(t, dt, ripples) {
      for (let i = 0; i < positions.length; i += 3) {
        positions[i + 1] = surfaceHeight(positions[i], positions[i + 2], ripples, t)
      }
      VertexData.ComputeNormals(positions, indices, normals)
      water.updateVerticesData('position', positions, false, false)
      water.updateVerticesData('normal', normals, false, false)
      rings.update(ripples, 0)
      reeds.update(t, ripples)
      fish.update(t, dt, ripples)
      dragonflies.update(t)
      fringe.update(t, ripples)
    },
    dispose() {
      rings.dispose()
      reeds.dispose()
      fish.dispose()
      trees.dispose()
      dragonflies.dispose()
      fringe.dispose()
      for (const d of disposables) d.dispose()
    },
  }
}
