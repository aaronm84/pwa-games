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
  DynamicTexture,
  PointLight,
  Scene,
  pbr,
} from 'src/engine'
import { surfaceHeight, ripplePower, stepRipples } from './waves.js'
import { buildTufts, buildLettuces, buildHyacinths, buildCannas, warpPadMesh } from './flora.js'

// Time-of-day palettes for the pond (the page picks by theme period key).
// Beyond material colors, each period carries its sky (a vertical gradient
// the fog blends into), a celestial body (a low warm sun, or a crescent moon
// with stars), the color of the light's glitter path on the water, and how
// much the bank lanterns and fireflies matter — dawn and dusk get both.
export const POND_PALETTES = {
  night: { clear: '#131c3a', water: '#16304e', deep: '#050d1a', ring: '#9fd8ff', bank: '#2e2a26', grass: '#1d2b1e', sun: '#aac4ff', sunIntensity: 0.5, petal: '#e8b4d8', skyTop: '#080d24', skyHorizon: '#25335e', glitter: '#b8d8ff', celestial: 'moon', stars: true, clouds: false, lanternGlow: 1.0, fireflies: 18, exposure: 0.98 },
  dawn: { clear: '#8a5a72', water: '#6a4a86', deep: '#241030', ring: '#ffd9f0', bank: '#4a3a30', grass: '#3a4a2e', sun: '#ffc9a0', sunIntensity: 0.85, petal: '#ffc0cb', skyTop: '#453a78', skyHorizon: '#ff9e6b', glitter: '#ffd9a8', celestial: 'sun', sunHeight: 6, sunSize: 3.6, stars: false, clouds: true, lanternGlow: 0.55, fireflies: 8, exposure: 1.04 },
  morning: { clear: '#9fc4c4', water: '#2f88a8', deep: '#0a2a3a', ring: '#d8f6ff', bank: '#584634', grass: '#3f6b35', sun: '#fff2dd', sunIntensity: 1.1, petal: '#ffb6c1', skyTop: '#3f8fd0', skyHorizon: '#cfe8d4', glitter: '#fff2c8', celestial: 'sun', sunHeight: 9, sunSize: 3, stars: false, clouds: true, lanternGlow: 0, fireflies: 0, exposure: 1.06 },
  midday: { clear: '#a8d4de', water: '#1a6a8a', deep: '#062435', ring: '#e4fbff', bank: '#5a4836', grass: '#437038', sun: '#ffffff', sunIntensity: 1.2, petal: '#ffb6c1', skyTop: '#2a7fd4', skyHorizon: '#bfe4ee', glitter: '#ffffff', celestial: 'sun', sunHeight: 11, sunSize: 2.6, stars: false, clouds: true, lanternGlow: 0, fireflies: 0, exposure: 1.06 },
  afternoon: { clear: '#b8ceb8', water: '#3f88a8', deep: '#10303f', ring: '#e0f6ff', bank: '#57432f', grass: '#48683a', sun: '#fff0cc', sunIntensity: 1.05, petal: '#ffb6c1', skyTop: '#4a92c8', skyHorizon: '#e8dcb0', glitter: '#ffedb8', celestial: 'sun', sunHeight: 8.5, sunSize: 3.2, stars: false, clouds: true, lanternGlow: 0, fireflies: 0, exposure: 1.05 },
  evening: { clear: '#7a5468', water: '#544a76', deep: '#171029', ring: '#ffd9c9', bank: '#453729', grass: '#33422c', sun: '#ffb27a', sunIntensity: 0.75, petal: '#f4a9c4', skyTop: '#392f68', skyHorizon: '#ff9668', glitter: '#ffc9a0', celestial: 'sun', sunHeight: 5.5, sunSize: 3.2, stars: false, clouds: true, lanternGlow: 0.8, fireflies: 12, exposure: 1.02 },
  dusk: { clear: '#463862', water: '#3f3462', deep: '#100a20', ring: '#c9c1ff', bank: '#352b22', grass: '#26331f', sun: '#c9a9ff', sunIntensity: 0.6, petal: '#e8a9d0', skyTop: '#1c1440', skyHorizon: '#7a5a92', glitter: '#d8c0ff', celestial: 'moon', stars: true, clouds: false, lanternGlow: 1.0, fireflies: 16, exposure: 1.0 },
}

export function paletteFor(periodKey) {
  return POND_PALETTES[periodKey] || POND_PALETTES.midday
}

// The water: a polar-grid disc (rings × sectors) whose vertices ride the wave
// model every frame. A polar grid keeps the rim exactly circular under the
// bank, and gives even radial resolution for the ring-shaped wavefronts.
function buildWater(scene, R, pal) {
  const RINGS = 60
  const SECTORS = 112
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
  mat.specularIntensity = 0.4 // glints, not a blown-out sun disc
  mat.clearCoat.isEnabled = true // the wet sheen that sells a water surface
  mat.clearCoat.intensity = 0.55
  mat.clearCoat.roughness = 0.32
  water.material = mat
  water.receiveShadows = true
  // the surface renders FIRST among transparents, so everything sitting on
  // it (aim guide, wavefront rings, splashes) draws over, never under
  water.alphaIndex = 1
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

// Koi under the surface: a stretched body + tail fin, visible through the
// water's transparency. They wander, and scurry when a wavefront passes.
function buildFish(scene, fishData, R) {
  const fishes = []
  for (const f of fishData) {
    const body = MeshBuilder.CreateSphere('koi', { diameterX: 0.62, diameterY: 0.2, diameterZ: 0.22, segments: 12 }, scene)
    const mat = pbr(scene, { color: f.warm ? '#e0742f' : '#9fb4c9', rough: 0.5, name: 'koiMat' })
    mat.emissiveColor = Color3.FromHexString(f.warm ? '#e0742f' : '#9fb4c9').scale(0.16)
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

// an unlit emissive material for sky/glow work (never fogged unless asked)
function unlit(scene, name, hex, { alpha = 1, fog = false, add = false } = {}) {
  const m = new StandardMaterial(name, scene)
  m.emissiveColor = Color3.FromHexString(hex)
  m.disableLighting = true
  m.alpha = alpha
  m.fogEnabled = fog
  if (add) m.alphaMode = 1 // additive: light on top of water, not paint
  m.backFaceCulling = false
  return m
}

// The sky: a big cylinder wearing a painted vertical gradient, plus the
// period's celestial body — a warm low sun with a halo, or a crescent moon
// with a spill of stars — and a few soft clouds. The scene fog is tinted to
// the horizon color, so the tree line melts into the sky.
function buildSky(scene, pal) {
  const meshes = []
  const mats = []

  const tex = new DynamicTexture('skyGrad', { width: 4, height: 256 }, scene, false)
  const ctx = tex.getContext()
  const g = ctx.createLinearGradient(0, 256, 0, 0)
  g.addColorStop(0, pal.skyHorizon)
  g.addColorStop(0.45, mixHex(pal.skyHorizon, pal.skyTop, 0.55))
  g.addColorStop(1, pal.skyTop)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 4, 256)
  tex.update()

  const domeMat = new StandardMaterial('skyMat', scene)
  domeMat.emissiveTexture = tex
  domeMat.disableLighting = true
  domeMat.fogEnabled = false
  domeMat.backFaceCulling = false
  const dome = MeshBuilder.CreateCylinder('sky', { height: 70, diameter: 170, tessellation: 36, cap: 0 }, scene)
  dome.position.y = 30
  dome.material = domeMat
  dome.isPickable = false
  dome.freezeWorldMatrix()
  meshes.push(dome)
  mats.push(domeMat, tex)

  const cap = MeshBuilder.CreateDisc('skyCap', { radius: 86, tessellation: 36 }, scene)
  cap.rotation.x = -Math.PI / 2
  cap.position.y = 64
  cap.material = unlit(scene, 'skyCapMat', pal.skyTop, { fog: false })
  cap.isPickable = false
  cap.freezeWorldMatrix()
  meshes.push(cap)
  mats.push(cap.material)

  const faceCamera = (m) => {
    m.rotation.y = Math.PI // discs face +z; the camera looks from +z
    m.isPickable = false
    m.freezeWorldMatrix()
    meshes.push(m)
  }

  if (pal.celestial === 'sun') {
    const sun = MeshBuilder.CreateDisc('sunDisc', { radius: pal.sunSize, tessellation: 40 }, scene)
    sun.position.set(-11, pal.sunHeight, -62)
    sun.material = unlit(scene, 'sunMat', pal.glitter, { fog: false })
    faceCamera(sun)
    mats.push(sun.material)
    const halo = MeshBuilder.CreateDisc('sunHalo', { radius: pal.sunSize * 1.5, tessellation: 40 }, scene)
    halo.position.set(-11, pal.sunHeight, -62.5)
    halo.material = unlit(scene, 'sunHaloMat', pal.skyHorizon, { alpha: 0.18, fog: false, add: true })
    faceCamera(halo)
    mats.push(halo.material)
  } else {
    // a crescent: a bright disc with a sky-colored bite taken out of it
    const moon = MeshBuilder.CreateDisc('moon', { radius: 1.6, tessellation: 40 }, scene)
    moon.position.set(-8, 9, -62)
    moon.material = unlit(scene, 'moonMat', '#f4f0dc', { fog: false })
    faceCamera(moon)
    mats.push(moon.material)
    const bite = MeshBuilder.CreateDisc('moonBite', { radius: 1.48, tessellation: 40 }, scene)
    bite.position.set(-7.35, 9.35, -61.7)
    bite.material = unlit(scene, 'moonBiteMat', pal.skyTop, { fog: false })
    faceCamera(bite)
    mats.push(bite.material)
    const glowM = MeshBuilder.CreateDisc('moonGlow', { radius: 2.9, tessellation: 40 }, scene)
    glowM.position.set(-8, 9, -62.5)
    glowM.material = unlit(scene, 'moonGlowMat', '#8fa8d8', { alpha: 0.16, fog: false, add: true })
    faceCamera(glowM)
    mats.push(glowM.material)
  }

  if (pal.stars) {
    let seed = 31
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    const bits = []
    for (let i = 0; i < 64; i++) {
      const s = MeshBuilder.CreateDisc('star', { radius: 0.14 + rnd() * 0.22, tessellation: 6 }, scene)
      s.position.set((rnd() * 2 - 1) * 52, 2 + rnd() * 15, -58 - rnd() * 8)
      s.rotation.y = Math.PI
      bits.push(s)
    }
    const stars = Mesh.MergeMeshes(bits, true, true)
    stars.material = unlit(scene, 'starMat', '#d8e4ff', { alpha: 0.85, fog: false })
    stars.isPickable = false
    stars.freezeWorldMatrix()
    meshes.push(stars)
    mats.push(stars.material)
  }

  if (pal.clouds) {
    let seed = 97
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    const cloudMat = unlit(scene, 'cloudMat', mixHex('#ffffff', pal.skyHorizon, 0.65), { alpha: 0.45, fog: false })
    mats.push(cloudMat)
    for (let c = 0; c < 4; c++) {
      const cx = 6 + rnd() * 42 // screen-left half: never crowding the sun
      const cy = 6 + rnd() * 5
      for (let b = 0; b < 2 + Math.floor(rnd() * 2); b++) {
        const puff = MeshBuilder.CreateSphere('cloud', { diameterX: 7 + rnd() * 9, diameterY: 1.8 + rnd() * 1.4, diameterZ: 3, segments: 6 }, scene)
        puff.position.set(cx + (rnd() - 0.5) * 8, cy + (rnd() - 0.5) * 1.5, -58 - rnd() * 4)
        puff.material = cloudMat
        puff.isPickable = false
        puff.freezeWorldMatrix()
        meshes.push(puff)
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

function mixHex(a, b, k) {
  const ca = Color3.FromHexString(a)
  const cb = Color3.FromHexString(b)
  return new Color3(ca.r + (cb.r - ca.r) * k, ca.g + (cb.g - ca.g) * k, ca.b + (cb.b - ca.b) * k).toHexString()
}

// The light's glitter path: a soft additive streak on the water running out
// toward the sun (or moon), shimmering slowly. The single strongest cue of
// the reference paintings, at the cost of one quad.
function buildGlitter(scene, pal, R) {
  // a soft elongated falloff, not a hard-edged quad — the light path should
  // melt into the water, never read as a band laid on top of it
  const tex = new DynamicTexture('glitterTex', { width: 128, height: 512 }, scene, false)
  const ctx = tex.getContext()
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, 128, 512)
  ctx.save()
  ctx.translate(64, 256)
  ctx.scale(1, 4)
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 64)
  g.addColorStop(0, 'rgba(255,255,255,0.85)')
  g.addColorStop(0.45, 'rgba(255,255,255,0.3)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(-64, -64, 128, 128)
  ctx.restore()
  tex.update()
  tex.hasAlpha = false

  const mat = unlit(scene, 'glitterMat', pal.glitter, { alpha: 0.09, fog: true, add: true })
  mat.emissiveTexture = tex
  const streak = MeshBuilder.CreatePlane('glitter', { width: 2.6, height: R * 1.7 }, scene)
  streak.rotation.x = Math.PI / 2
  streak.rotation.y = -0.17 // toward the celestial azimuth
  streak.position.set(-2.1, 0.02, -R * 0.28)
  streak.material = mat
  streak.isPickable = false
  return {
    update(t) {
      mat.alpha = 0.055 + Math.sin(t * 1.1) * 0.015 + Math.sin(t * 3.7) * 0.01
      streak.scaling.x = 1 + Math.sin(t * 0.7) * 0.1
    },
    dispose() {
      streak.dispose()
      tex.dispose()
      mat.dispose()
    },
  }
}

// Fireflies after dark, drifting pollen by day: small emissive motes
// wandering the banks. Fireflies pulse (the GlowLayer turns each pulse into
// a bloom); pollen just floats.
function buildMotes(scene, pal, R) {
  const isFirefly = (pal.fireflies || 0) > 0
  const count = isFirefly ? pal.fireflies : 8
  const mat = unlit(scene, 'moteMat', isFirefly ? '#d8ffa0' : '#fff2d0', { alpha: isFirefly ? 1 : 0.7, fog: true })
  let seed = 13
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const motes = []
  for (let i = 0; i < count; i++) {
    const m = MeshBuilder.CreateSphere('mote', { diameter: isFirefly ? 0.11 : 0.05, segments: 4 }, scene)
    m.material = mat
    m.isPickable = false
    const a = rnd() * Math.PI * 2
    motes.push({
      mesh: m,
      cx: Math.cos(a) * (R * 0.6 + rnd() * (R * 0.5)),
      cz: Math.sin(a) * (R * 0.6 + rnd() * (R * 0.5)),
      cy: 0.3 + rnd() * (isFirefly ? 1.0 : 1.4),
      p1: rnd() * Math.PI * 2,
      p2: rnd() * Math.PI * 2,
      w: 0.8 + rnd() * 1.6,
    })
  }
  return {
    update(t) {
      for (const f of motes) {
        const speed = isFirefly ? 0.5 : 0.22
        f.mesh.position.set(
          f.cx + Math.sin(t * speed + f.p1) * f.w + Math.sin(t * 1.3 + f.p2) * 0.3,
          f.cy + Math.sin(t * 0.7 + f.p2) * 0.25,
          f.cz + Math.cos(t * speed * 0.8 + f.p2) * f.w,
        )
        if (isFirefly) {
          // each firefly blinks on its own clock
          const blink = 0.35 + Math.max(0, Math.sin(t * 1.7 + f.p1 * 3)) ** 3
          f.mesh.scaling.setAll(blink * 1.7)
        }
      }
    },
    dispose() {
      for (const f of motes) f.mesh.dispose()
      mat.dispose()
    },
  }
}

// Two bank lanterns: warm amber points whose light and long water
// reflections carry the night ponds (and fade politely by day).
function buildLanterns(scene, pal, R) {
  const glow = pal.lanternGlow || 0
  const meshes = []
  const mats = []
  const lights = []
  const flickers = []
  const spots = [
    { x: -8.6, z: Math.sqrt(Math.max(0, R * R - 8.6 * 8.6)) - 2.6 },
    { x: 7.9, z: -Math.sqrt(Math.max(0, R * R - 7.9 * 7.9)) + 4.4 },
  ]
  const postMat = pbr(scene, { color: '#3a2d20', rough: 0.9, name: 'lanternPost' })
  mats.push(postMat)
  for (const s of spots) {
    const post = MeshBuilder.CreateCylinder('post', { height: 1.7, diameter: 0.1, tessellation: 6 }, scene)
    post.position.set(s.x, 1.0, s.z)
    post.material = postMat
    post.isPickable = false
    post.freezeWorldMatrix()
    meshes.push(post)

    const headMat = unlit(scene, 'lanternHead', '#ffb85c', { fog: true })
    headMat.emissiveColor = Color3.FromHexString('#ffb85c').scale(0.25 + glow * 0.75)
    mats.push(headMat)
    const head = MeshBuilder.CreateBox('lanternBox', { width: 0.26, height: 0.32, depth: 0.26 }, scene)
    head.position.set(s.x, 1.95, s.z)
    head.material = headMat
    head.isPickable = false
    head.freezeWorldMatrix()
    meshes.push(head)

    const cap = MeshBuilder.CreateCylinder('lanternCap', { height: 0.08, diameterBottom: 0.36, diameterTop: 0.1, tessellation: 8 }, scene)
    cap.position.set(s.x, 2.15, s.z)
    cap.material = postMat
    cap.isPickable = false
    cap.freezeWorldMatrix()
    meshes.push(cap)

    if (glow > 0) {
      const pt = new PointLight('lanternLight', new Vector3(s.x, 1.95, s.z), scene)
      pt.diffuse = Color3.FromHexString('#ffb469')
      pt.intensity = 0.55 * glow
      pt.range = 8
      lights.push(pt)
      flickers.push({ pt, base: 0.55 * glow, phase: s.x })

      // the long amber smear on the water, pointing at the viewer
      const reflMat = unlit(scene, 'lanternRefl', '#ffb469', { alpha: 0.15 * glow, fog: true, add: true })
      mats.push(reflMat)
      const refl = MeshBuilder.CreatePlane('lanternReflM', { width: 0.4, height: 3.4 }, scene)
      refl.rotation.x = Math.PI / 2
      const toward = Math.atan2(0 - s.x, (R - 2) - s.z)
      refl.rotation.y = -toward
      refl.position.set(s.x * 0.82, 0.025, s.z * 0.82 + 1.2)
      refl.material = reflMat
      refl.isPickable = false
      meshes.push(refl)
    }
  }
  return {
    update(t) {
      for (const f of flickers) {
        f.pt.intensity = f.base * (0.92 + Math.sin(t * 6.5 + f.phase) * 0.05 + Math.sin(t * 17 + f.phase) * 0.03)
      }
    },
    dispose() {
      for (const l of lights) l.dispose()
      for (const m of meshes) m.dispose()
      for (const m of mats) m.dispose()
    },
  }
}

// Wildflowers dotting the banks between the reeds — iris purple, buttercup
// gold, white, rose. Heads merged per color to keep draw calls flat.
function buildBankFlowers(scene, R) {
  const colors = ['#9a7bd8', '#e8c25a', '#f2ead8', '#e88fb0']
  let seed = 57
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const stems = []
  const headsByColor = [[], [], [], []]
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2
    const r = R + 0.3 + rnd() * 1.6
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    if (z > R - 3 && Math.abs(x) < 5) continue // keep the thrower's spot clear
    const h = 0.22 + rnd() * 0.2
    const stem = MeshBuilder.CreateCylinder('wfStem', { height: h, diameter: 0.025, tessellation: 4 }, scene)
    stem.position.set(x, 0.32 + h / 2, z)
    stems.push(stem)
    const head = MeshBuilder.CreateSphere('wfHead', { diameter: 0.1 + rnd() * 0.06, segments: 5 }, scene)
    head.position.set(x, 0.34 + h, z)
    headsByColor[Math.floor(rnd() * 4)].push(head)
  }
  const out = []
  const mats = []
  const stemMerged = Mesh.MergeMeshes(stems, true, true)
  if (stemMerged) {
    const sm = pbr(scene, { color: '#3f6b35', rough: 0.9, name: 'wfStemMat' })
    stemMerged.material = sm
    stemMerged.isPickable = false
    stemMerged.freezeWorldMatrix()
    out.push(stemMerged)
    mats.push(sm)
  }
  headsByColor.forEach((heads, i) => {
    if (!heads.length) return
    const merged = Mesh.MergeMeshes(heads, true, true)
    const hm = pbr(scene, { color: colors[i], rough: 0.7, name: `wfHeadMat${i}` })
    hm.emissiveColor = Color3.FromHexString(colors[i]).scale(0.12)
    merged.material = hm
    merged.isPickable = false
    merged.freezeWorldMatrix()
    out.push(merged)
    mats.push(hm)
  })
  return {
    dispose() {
      for (const m of out) m.dispose()
      for (const m of mats) m.dispose()
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
      const lower = MeshBuilder.CreateCylinder('tree', { height: t.height * 0.7, diameterBottom: t.width, diameterTop: t.width * 0.28, tessellation: 7 }, scene)
      lower.position.set(t.x, t.height * 0.35 - 0.18, t.z)
      lower.material = mat
      const upper = MeshBuilder.CreateCylinder('tree', { height: t.height * 0.5, diameterBottom: t.width * 0.62, diameterTop: 0.02, tessellation: 7 }, scene)
      upper.position.set(t.x, t.height * 0.78 - 0.18, t.z)
      upper.material = mat
      for (const m of [lower, upper]) {
        m.isPickable = false
        m.freezeWorldMatrix()
        meshes.push(m)
      }
    } else {
      const trunk = MeshBuilder.CreateCylinder('trunk', { height: t.height * 0.5, diameter: t.width * 0.16, tessellation: 6 }, scene)
      trunk.position.set(t.x, t.height * 0.25 - 0.18, t.z)
      trunk.material = trunkMat
      const crown = MeshBuilder.CreateSphere('crown', { diameterX: t.width, diameterY: t.height * 0.7, diameterZ: t.width, segments: 7 }, scene)
      crown.position.set(t.x, t.height * 0.62 - 0.18, t.z)
      crown.material = mat
      const crown2 = MeshBuilder.CreateSphere('crown2', { diameterX: t.width * 0.6, diameterY: t.height * 0.4, diameterZ: t.width * 0.6, segments: 6 }, scene)
      crown2.position.set(t.x + t.width * 0.34, t.height * 0.5 - 0.18, t.z + t.width * 0.1)
      crown2.material = mats[Math.min(2, Math.floor(t.tone * 3) + 1)]
      for (const m of [trunk, crown, crown2]) {
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
    const m = MeshBuilder.CreateCylinder('fringe', { diameter: p.radius * 2, height: 0.05, tessellation: 18, arc: 0.9, enclose: true }, scene)
    warpPadMesh(m, p.seed, 0.04)
    m.position.set(p.x, 0.03, p.z)
    m.rotation.y = p.rotation
    m.material = mat
    m.isPickable = false
    items.push({ mesh: m, p, sy: 0 })
  }
  return {
    update(t, dt, ripples) {
      for (const it of items) {
        const y = surfaceHeight(it.p.x, it.p.z, ripples, t)
        it.sy += (y - it.sy) * Math.min(1, dt * 6)
        it.mesh.position.y = 0.03 + it.sy
        it.mesh.rotation.z += (it.sy * 0.4 - it.mesh.rotation.z) * Math.min(1, dt * 3)
      }
    },
    dispose() {
      for (const it of items) it.mesh.dispose()
      mat.dispose()
    },
  }
}

// ---- boulder banks: the rock-garden rim ------------------------------------
// Two rows of flat-shaded boulders replace the smooth earthen lip: a
// shoulder-height outer row on the bank crest, and a half-submerged inner
// row at the waterline. Merged per tone to keep draw calls flat.
function buildRockBanks(scene, R) {
  const tones = ['#8a8578', '#9a8468', '#a08578']
  let seed = 41
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const groups = [[], [], []]
  const drop = (x, z, d, y, squash) => {
    const b = MeshBuilder.CreateIcoSphere('boulder', { radius: d / 2, subdivisions: 1, flat: true }, scene)
    b.scaling.set(1 + rnd() * 0.5, squash, 1 + rnd() * 0.5)
    b.rotation.y = rnd() * Math.PI * 2
    b.position.set(x, y, z)
    groups[Math.floor(rnd() * 3)].push(b)
  }
  // outer row: the crest boulders
  for (let i = 0; i < 36; i++) {
    const a = rnd() * Math.PI * 2
    const rr = R + 0.35 + rnd() * 1.1
    const x = Math.cos(a) * rr
    const z = Math.sin(a) * rr
    if (z > R - 4.5 && Math.abs(x) < 5) continue // throw corridor stays clear
    drop(x, z, 0.55 + rnd() * 0.65, 0.3 + rnd() * 0.12, 0.55 + rnd() * 0.35)
  }
  // inner row: smaller stones half in the water
  for (let i = 0; i < 22; i++) {
    const a = rnd() * Math.PI * 2
    const rr = R - 0.25 - rnd() * 0.5
    const x = Math.cos(a) * rr
    const z = Math.sin(a) * rr
    if (z > R - 5 && Math.abs(x) < 5) continue
    drop(x, z, 0.3 + rnd() * 0.35, 0.02 + rnd() * 0.05, 0.5 + rnd() * 0.3)
  }
  const out = []
  const mats = []
  groups.forEach((g, i) => {
    if (!g.length) return
    const merged = Mesh.MergeMeshes(g, true, true)
    if (!merged) return
    const m = pbr(scene, { color: tones[i], rough: 0.95, name: `boulderMat${i}` })
    merged.material = m
    merged.receiveShadows = true
    merged.isPickable = false
    merged.freezeWorldMatrix()
    out.push(merged)
    mats.push(m)
  })
  return {
    dispose() {
      for (const m of out) m.dispose()
      for (const m of mats) m.dispose()
    },
  }
}

// ---- the waterfall ---------------------------------------------------------
// A boulder shelf on the far bank spilling two scrolling water sheets into a
// foam ring. It keeps its own little wavefronts — perpetual gentle ripples
// at the base that the pond surface rides but gameplay never feels (they die
// ~3 units short of the throw fan, and live outside the page's ripple list).
function buildWaterfall(scene, shadow, wf, pal) {
  if (!wf) return null
  const meshes = []
  const mats = []
  const len = Math.hypot(wf.x, wf.z)
  const nx = wf.x / len // outward from pond center
  const nz = wf.z / len
  const tx = -nz // tangent along the bank
  const tz = nx
  const s = wf.scale
  const yaw = Math.atan2(nx, nz)

  let seed = Math.max(2, Math.floor(wf.seed * 1000) % 1000)
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)

  // the shelf: three tiers of boulders stacked into a spill
  const rockMat = pbr(scene, { color: '#8f8574', rough: 0.95, name: 'fallsRockMat' })
  mats.push(rockMat)
  // the shelf: a rock crest with a NOTCH the water spills through. The
  // sheet's top edge hides behind the crest stones, so the fall visibly
  // originates from the rocks — never from thin air above them.
  const bits = []
  const stone = (lat, off, y, d) => {
    const b = MeshBuilder.CreateIcoSphere('fallsBoulder', { radius: d / 2, subdivisions: 1, flat: true }, scene)
    b.scaling.set(1.15 + rnd() * 0.4, 0.7 + rnd() * 0.3, 1 + rnd() * 0.4)
    b.rotation.y = rnd() * Math.PI * 2
    b.position.set(wf.x + nx * off + tx * lat, y, wf.z + nz * off + tz * lat)
    bits.push(b)
  }
  // crest flanking the notch
  stone(-0.8 * s, 0.5, 0.88 * s, 0.95 * s)
  stone(0.82 * s, 0.45, 0.85 * s, 0.95 * s)
  // the tall back stone the spill emerges in front of
  stone(0, 0.9, 0.75 * s, 1.25 * s)
  // aprons of lower boulders breaking the fall
  stone(-0.85 * s, 0.15, 0.38 * s, 0.9 * s)
  stone(0.9 * s, 0.1, 0.34 * s, 0.85 * s)
  stone(-0.5 * s, -0.1, 0.12 * s, 0.7 * s)
  stone(0.55 * s, -0.05, 0.1 * s, 0.75 * s)
  stone(0.05 * s, 0.35, 0.3 * s, 0.85 * s)
  const shelf = Mesh.MergeMeshes(bits, true, true)
  if (shelf) {
    shelf.material = rockMat
    shelf.receiveShadows = true
    shelf.isPickable = false
    shelf.freezeWorldMatrix()
    shadow?.addShadowCaster(shelf)
    meshes.push(shelf)
  }

  // the falling water: vertical streaks on a scrolling texture. Dark pixels
  // are transparent (getAlphaFromRGB), streaks are broken and fade at the
  // sheet's edges and lip, so it reads as falling water, not a lit rectangle
  const tex = new DynamicTexture('fallsTex', { width: 64, height: 256 }, scene, false)
  const ctx = tex.getContext()
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, 64, 256)
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.18 + rnd() * 0.45})`
    const x = rnd() * 64
    const w = 1 + rnd() * 2.2
    const y0 = rnd() * 256
    const h = 40 + rnd() * 150
    ctx.fillRect(x, y0, w, h)
    if (y0 + h > 256) ctx.fillRect(x, 0, w, y0 + h - 256) // wrap the streak
  }
  // feather the flanks so the sheet has no hard vertical edges
  const edge = ctx.createLinearGradient(0, 0, 64, 0)
  edge.addColorStop(0, 'rgba(0,0,0,1)')
  edge.addColorStop(0.22, 'rgba(0,0,0,0)')
  edge.addColorStop(0.78, 'rgba(0,0,0,0)')
  edge.addColorStop(1, 'rgba(0,0,0,1)')
  ctx.fillStyle = edge
  ctx.fillRect(0, 0, 64, 256)
  tex.update()
  tex.wrapV = 1
  tex.getAlphaFromRGB = true // dark = see-through, streaks = water
  mats.push(tex)

  const sheetMat = new StandardMaterial('fallsSheetMat', scene)
  sheetMat.emissiveTexture = tex
  sheetMat.emissiveColor = Color3.FromHexString(mixHex('#cfe6f2', pal.glitter, 0.25))
  sheetMat.opacityTexture = tex
  sheetMat.disableLighting = true
  sheetMat.alpha = 0.85
  sheetMat.backFaceCulling = false
  mats.push(sheetMat)

  // the sheet itself is CURVED: it hugs the lip, bellies out on the way
  // down and flares into the pond — built as a small bent grid, not a plane
  const makeCurvedSheet = (name, w, h, bend, mat) => {
    const rows = 9
    const cols = 5
    const positions = []
    const uvs = []
    const indices = []
    for (let r = 0; r <= rows; r++) {
      const v = r / rows
      const y = h * (1 - v)
      const out = bend * (0.1 + 0.8 * Math.pow(v, 1.7)) // hugs the lip, flares at the base
      // narrow at the notch, widening as the water falls and sprays
      const width = w * (0.55 + 0.5 * v)
      for (let c = 0; c <= cols; c++) {
        const u = c / cols
        const lat = (u - 0.5) * width
        // a slight lateral wave so the sheet isn't a machined ribbon
        const wob = Math.sin(v * 5 + u * 3) * 0.03 * w
        positions.push(lat + wob, y, -out)
        uvs.push(u, 1 - v)
      }
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const a = r * (cols + 1) + c
        indices.push(a, a + 1, a + cols + 1, a + 1, a + cols + 2, a + cols + 1)
      }
    }
    const normals = []
    VertexData.ComputeNormals(positions, indices, normals)
    const mesh = new Mesh(name, scene)
    const vd = new VertexData()
    vd.positions = new Float32Array(positions)
    vd.indices = indices
    vd.normals = new Float32Array(normals)
    vd.uvs = new Float32Array(uvs)
    vd.applyToMesh(mesh, false)
    mesh.material = mat
    mesh.isPickable = false
    return mesh
  }

  // the sheet tops out just below the crest stones' shoulders, in front of
  // the tall back stone — the water reads as coming out of the rocks
  const sheet = makeCurvedSheet('fallsSheet', 1.05 * s, 0.98 * s, 0.7, sheetMat)
  sheet.position.set(wf.x - nx * 0.2, 0.02, wf.z - nz * 0.2)
  sheet.rotation.y = yaw
  meshes.push(sheet)

  const sheet2Mat = sheetMat.clone('fallsSheet2Mat')
  sheet2Mat.alpha = 0.5
  mats.push(sheet2Mat)
  const sheet2 = makeCurvedSheet('fallsSheet2', 0.5 * s, 0.8 * s, 0.85, sheet2Mat)
  sheet2.position.set(wf.x - nx * 0.26 + tx * 0.18, 0.02, wf.z - nz * 0.26 + tz * 0.18)
  sheet2.rotation.y = yaw
  meshes.push(sheet2)

  // churned foam where the fall meets the pond: a few overlapping patches
  // pulsing on their own clocks, not one printed ellipse
  const bx = wf.x - nx * 1.05
  const bz = wf.z - nz * 1.05
  const foams = []
  const foamSpots = [
    { dx: 0, dz: 0, r: 0.42, ph: 0, sp: 2.6 },
    { dx: tx * 0.38 - nx * 0.12, dz: tz * 0.38 - nz * 0.12, r: 0.26, ph: 2.1, sp: 3.4 },
    { dx: -tx * 0.34 - nx * 0.2, dz: -tz * 0.34 - nz * 0.2, r: 0.3, ph: 4.2, sp: 3.0 },
  ]
  for (const f of foamSpots) {
    const fm = unlit(scene, 'fallsFoamMat', '#e8f4ff', { alpha: 0.2, fog: true, add: true })
    mats.push(fm)
    const disc = MeshBuilder.CreateDisc('fallsFoam', { radius: f.r * s, tessellation: 20 }, scene)
    disc.rotation.x = Math.PI / 2
    disc.position.set(bx + f.dx, 0.04, bz + f.dz)
    disc.material = fm
    disc.isPickable = false
    meshes.push(disc)
    foams.push({ mat: fm, mesh: disc, ph: f.ph, sp: f.sp })
  }

  // a soft mist plume rising off the base
  const mistMat = unlit(scene, 'fallsMistMat', '#dceaf4', { alpha: 0.05, fog: true, add: true })
  mats.push(mistMat)
  const mist = MeshBuilder.CreateSphere('fallsMist', { diameterX: 0.9 * s, diameterY: 0.45 * s, diameterZ: 0.5 * s, segments: 6 }, scene)
  mist.position.set(bx, 0.18 * s, bz)
  mist.material = mistMat
  mist.isPickable = false
  meshes.push(mist)

  // the perpetual gentle wavefronts at the base — pond-only, never gameplay
  let ambient = []
  let emitAcc = 0.9
  let n = 0
  return {
    step(t, dt) {
      tex.vOffset = (tex.vOffset - dt * (0.85 + Math.sin(t * 2.3) * 0.06)) % 1
      for (const f of foams) {
        f.mat.alpha = 0.16 + Math.max(0, Math.sin(t * f.sp + f.ph)) * 0.09
        f.mesh.scaling.setAll(1 + Math.sin(t * f.sp * 0.7 + f.ph) * 0.12)
      }
      mistMat.alpha = 0.045 + Math.sin(t * 1.7 + 1) * 0.015
      mist.scaling.setAll(1 + Math.sin(t * 1.3) * 0.06)
      emitAcc += dt
      if (emitAcc > 1.05) {
        emitAcc = 0
        n++
        ambient.push({
          id: `falls_${n}`,
          group: `falls_${n}`,
          x: bx + Math.sin(t * 2.7) * 0.3,
          z: bz + Math.cos(t * 1.9) * 0.3,
          radius: 0.05,
          speed: 1.5,
          peakRadius: 0.8,
          peakPower: 0.14,
          maxRadius: 1.9,
        })
      }
      ambient = stepRipples(ambient, dt)
      return ambient
    },
    dispose() {
      for (const m of meshes) m.dispose()
      for (const m of mats) m.dispose()
    },
  }
}

// ---- pad colonies: dense carpets of small lily pads ------------------------
// Each colony is one merged mesh of hand-sized pads that bobs as a raft;
// the first colony carries a little magenta bloom.
function buildPadColonies(scene, colonies) {
  const mats = [
    pbr(scene, { color: '#3f7a32', rough: 0.85, name: 'colonyMat0' }),
    pbr(scene, { color: '#568a3a', rough: 0.85, name: 'colonyMat1' }),
  ]
  const bloomMat = pbr(scene, { color: '#d0348e', rough: 0.5, name: 'colonyBloomMat' })
  bloomMat.emissiveColor = Color3.FromHexString('#d0348e').scale(0.2)
  const heartMat = pbr(scene, { color: '#f2d34a', rough: 0.6, name: 'colonyHeartMat' })
  const items = []
  for (const col of colonies) {
    const bits = []
    for (const leaf of col.leaves) {
      const p = MeshBuilder.CreateCylinder('colonyPad', { diameter: leaf.r * 2, height: 0.035, tessellation: 12, arc: 0.92, enclose: true }, scene)
      warpPadMesh(p, col.seed + leaf.rot, 0.02)
      p.position.set(leaf.dx, 0, leaf.dz)
      p.rotation.y = leaf.rot
      bits.push(p)
    }
    const mesh = Mesh.MergeMeshes(bits, true, true)
    if (!mesh) continue
    mesh.material = mats[Math.floor((col.seed * 100) % 2)]
    mesh.position.set(col.x, 0.035, col.z)
    mesh.isPickable = false
    if (col.bloom && col.leaves.length) {
      const at = col.leaves[0]
      const bloom = MeshBuilder.CreateSphere('colonyBloom', { diameterX: 0.2, diameterY: 0.13, diameterZ: 0.2, segments: 6 }, scene)
      bloom.position.set(at.dx, 0.08, at.dz)
      bloom.material = bloomMat
      bloom.parent = mesh
      bloom.isPickable = false
      const heart = MeshBuilder.CreateSphere('colonyHeart', { diameter: 0.06, segments: 4 }, scene)
      heart.position.set(at.dx, 0.14, at.dz)
      heart.material = heartMat
      heart.parent = mesh
      heart.isPickable = false
    }
    items.push({ mesh, col, sy: 0 })
  }
  return {
    update(t, dt, ripples) {
      for (const it of items) {
        const y = surfaceHeight(it.col.x, it.col.z, ripples, t)
        it.sy += (y - it.sy) * Math.min(1, dt * 4)
        it.mesh.position.y = 0.035 + it.sy
        it.mesh.rotation.z += (it.sy * 0.25 - it.mesh.rotation.z) * Math.min(1, dt * 3)
        it.mesh.rotation.y = Math.sin(t * 0.3 + it.col.seed * 6) * 0.03
      }
    },
    dispose() {
      for (const it of items) it.mesh.dispose(false, true)
      for (const m of mats) m.dispose()
      bloomMat.dispose()
      heartMat.dispose()
    },
  }
}

// ---- flower drifts: planted sweeps between the far-bank boulders -----------
function buildFlowerDrifts(scene, drifts) {
  const colors = ['#d84a66', '#cf3f92', '#8a5ad8', '#e8c25a']
  const out = []
  const mats = []
  const leafMat = pbr(scene, { color: '#31552a', rough: 0.95, name: 'driftLeafMat' })
  mats.push(leafMat)
  for (const d of drifts) {
    let seed = Math.max(2, Math.floor(d.seed * 1000) % 1000)
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    // the foliage mound under the blooms
    const mound = MeshBuilder.CreateSphere('driftMound', { diameterX: d.spread * 2.2, diameterY: 0.45, diameterZ: d.spread * 1.6, segments: 6 }, scene)
    mound.position.set(d.x, 0.3, d.z)
    mound.rotation.y = d.seed
    mound.material = leafMat
    mound.isPickable = false
    mound.freezeWorldMatrix()
    out.push(mound)
    // the color: a merged scatter of small heads
    const heads = []
    for (let i = 0; i < d.count; i++) {
      const a = rnd() * Math.PI * 2
      const rr = Math.sqrt(rnd()) * d.spread
      const h = MeshBuilder.CreateSphere('driftHead', { diameter: 0.1 + rnd() * 0.08, segments: 5 }, scene)
      h.position.set(d.x + Math.cos(a) * rr, 0.46 + rnd() * 0.14, d.z + Math.sin(a) * rr * 0.72)
      heads.push(h)
    }
    const merged = Mesh.MergeMeshes(heads, true, true)
    if (!merged) continue
    const m = pbr(scene, { color: colors[d.hue % 4], rough: 0.7, name: `driftMat${d.hue}` })
    m.emissiveColor = Color3.FromHexString(colors[d.hue % 4]).scale(0.13)
    merged.material = m
    merged.isPickable = false
    merged.freezeWorldMatrix()
    out.push(merged)
    mats.push(m)
  }
  return {
    dispose() {
      for (const m of out) m.dispose()
      for (const m of mats) m.dispose()
    },
  }
}

export function buildPond(scene, shadow, level, pal) {
  const R = level.R
  const disposables = []

  // the world past the water fades into haze — this is what makes a 13-unit
  // disc read as an expansive pond instead of a diorama
  scene.fogMode = Scene.FOGMODE_EXP2
  scene.fogColor = Color3.FromHexString(mixHex(pal.skyHorizon, pal.water, 0.3))
  scene.fogDensity = 0.019

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

  const reeds = buildTufts(scene, shadow, level.reeds, pal)
  const fish = buildFish(scene, level.fish, R)
  const rings = buildRippleRings(scene, null, pal, 20)
  const trees = buildTrees(scene, level.trees, pal)
  const dragonflies = buildDragonflies(scene, level.dragonflies)
  const fringe = buildFringePads(scene, level.fringePads)
  const sky = buildSky(scene, pal)
  const glitter = buildGlitter(scene, pal, R)
  const motes = buildMotes(scene, pal, R)
  const lanterns = buildLanterns(scene, pal, R)
  const flowers = buildBankFlowers(scene, R)
  const lettuces = buildLettuces(scene, shadow, level.lettuces || [])
  const hyacinths = buildHyacinths(scene, shadow, level.hyacinths || [])
  const rockBanks = buildRockBanks(scene, R)
  const falls = buildWaterfall(scene, shadow, level.waterfall, pal)
  const colonies = buildPadColonies(scene, level.padColonies || [])
  const drifts = buildFlowerDrifts(scene, level.flowerDrifts || [])
  const cannas = buildCannas(scene, shadow, level.cannas || [])

  // per-frame water displacement
  const vb = water.getVerticesData('position')
  const positions = new Float32Array(vb)
  const normals = new Float32Array(water.getVerticesData('normal'))
  const indices = water.getIndices()

  return {
    water,
    update(t, dt, ripples) {
      // the waterfall's ambient wavefronts join the gameplay ripples for
      // everything that reads the water — but never enter the page's list,
      // so win/lose logic and the glowing rings stay gameplay-only
      const ambient = falls ? falls.step(t, dt) : null
      const all = ambient && ambient.length ? ripples.concat(ambient) : ripples
      for (let i = 0; i < positions.length; i += 3) {
        positions[i + 1] = surfaceHeight(positions[i], positions[i + 2], all, t)
      }
      VertexData.ComputeNormals(positions, indices, normals)
      water.updateVerticesData('position', positions, false, false)
      water.updateVerticesData('normal', normals, false, false)
      rings.update(ripples, 0)
      reeds.update(t, all)
      fish.update(t, dt, all)
      dragonflies.update(t)
      fringe.update(t, dt, all)
      glitter.update(t)
      motes.update(t)
      lanterns.update(t)
      lettuces.update(t, dt, all)
      hyacinths.update(t, dt, all)
      colonies.update(t, dt, all)
      cannas.update(t)
    },
    dispose() {
      rings.dispose()
      reeds.dispose()
      fish.dispose()
      trees.dispose()
      dragonflies.dispose()
      fringe.dispose()
      sky.dispose()
      glitter.dispose()
      motes.dispose()
      lanterns.dispose()
      flowers.dispose()
      lettuces.dispose()
      hyacinths.dispose()
      rockBanks.dispose()
      falls?.dispose()
      colonies.dispose()
      drifts.dispose()
      cannas.dispose()
      for (const d of disposables) d.dispose()
    },
  }
}
