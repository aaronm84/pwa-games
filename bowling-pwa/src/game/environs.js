// Per-alley set dressing — the world beyond the lane. Everything static is
// merged into single meshes and frozen so the whole environment costs a few
// draw calls; only the small animated bits (embers, asteroids) tick.
import { MeshBuilder, Mesh, Color3, StandardMaterial, pbr } from 'src/engine'
import { makePinMesh, pinSpots, LANE_W, START_Z, DECK_END } from './lane3d'

function emissiveMat(scene, hex, { alpha = 1, scale = 1 } = {}) {
  const m = new StandardMaterial('envGlow', scene)
  m.emissiveColor = Color3.FromHexString(hex).scale(scale)
  m.disableLighting = true
  m.alpha = alpha
  return m
}

// A single-draw-call starfield: many tiny boxes merged into one mesh on a far
// shell around the alley.
function starfield(scene, count, mat, seedMul = 1) {
  const bits = []
  for (let i = 0; i < count; i++) {
    const a = (i * 2.399963 * seedMul) % (Math.PI * 2) // golden-angle spread
    const r = 18 + ((i * 7.13) % 14)
    const y = 1 + ((i * 3.77) % 14)
    const s = 0.05 + ((i * 1.31) % 0.09)
    const b = MeshBuilder.CreateBox('star', { size: s }, scene)
    b.position.set(Math.cos(a) * r, y, Math.sin(a) * r - 6)
    bits.push(b)
  }
  const merged = Mesh.MergeMeshes(bits, true, true)
  merged.material = mat
  merged.isPickable = false
  merged.freezeWorldMatrix()
  return merged
}

// A visual-only neighbor lane: a dim lane strip, ghost pins (instances of one
// source mesh) and a ghost bowler's ball that rolls, scatters pins and re-racks
// on its own schedule. No physics — everything is choreographed.
function neighborLane(scene, alley, side, animated, meshes, mats) {
  const off = side * 3.65 // directly adjacent — visible in a portrait view
  const laneMat = new StandardMaterial('nLane' + side, scene)
  laneMat.diffuseColor = Color3.FromHexString(alley.colors.lane).scale(0.6)
  laneMat.specularColor = new Color3(0.05, 0.05, 0.06)
  mats.push(laneMat)
  const strip = MeshBuilder.CreateBox('nStrip', { width: LANE_W, height: 0.28, depth: START_Z + 2 - DECK_END }, scene)
  strip.position.set(off, -0.16, (START_Z + 2 + DECK_END) / 2)
  strip.material = laneMat
  strip.isPickable = false
  strip.freezeWorldMatrix()
  meshes.push(strip)
  // faint neon edges
  const edgeMat = new StandardMaterial('nEdge' + side, scene)
  edgeMat.emissiveColor = Color3.FromHexString(side < 0 ? alley.colors.laneEdgeA : alley.colors.laneEdgeB).scale(0.3)
  edgeMat.disableLighting = true
  mats.push(edgeMat)
  for (const es of [-1, 1]) {
    const e = MeshBuilder.CreateBox('nNeon', { width: 0.05, height: 0.04, depth: START_Z + 1 - DECK_END }, scene)
    e.position.set(off + es * (LANE_W / 2), 0.02, (START_Z + 1 + DECK_END) / 2)
    e.material = edgeMat
    e.isPickable = false
    e.freezeWorldMatrix()
    meshes.push(e)
  }
  // ghost pins: instances of a hidden source pin
  const src = makePinMesh(scene, alley.colors, 'nPinSrc' + side)
  src.body.isVisible = false
  src.body.setEnabled(true)
  for (const st of src.stripes) st.isVisible = false
  meshes.push(src.body)
  mats.push(...src.mats)
  const spots = pinSpots()
  const ghosts = spots.map((sp, i) => {
    const inst = src.body.createInstance('nPin' + side + i)
    inst.position.set(off + sp.x, 0.001, sp.z)
    inst.isPickable = false
    return { inst, sp, down: false, t: 0, axis: 0 }
  })
  const ballMat = new StandardMaterial('nBall' + side, scene)
  ballMat.diffuseColor = Color3.FromHexString(side < 0 ? '#b04a3a' : '#3a7ab0')
  mats.push(ballMat)
  const gball = MeshBuilder.CreateSphere('nBall' + side, { diameter: 0.42, segments: 16 }, scene)
  gball.material = ballMat
  gball.isPickable = false
  gball.setEnabled(false)
  meshes.push(gball)

  // choreography: idle -> roll -> crash -> clear -> re-rack
  let phase = 'idle'
  let timer = 200 + ((side + 2) * 137) % 400
  let rollT = 0
  let drift = 0
  animated.push(() => {
    if (phase === 'idle') {
      if (--timer <= 0) {
        phase = 'roll'
        rollT = 0
        drift = (Math.random() - 0.5) * 0.8
        gball.setEnabled(true)
      }
    } else if (phase === 'roll') {
      rollT++
      const k = rollT / 130
      gball.position.set(off + drift * k, 0.21, START_Z - k * (START_Z - DECK_END + 0.6))
      gball.rotation.x -= 0.25
      if (k >= 0.92) {
        // scatter: most pins tip over at the moment of arrival
        for (const g of ghosts) {
          if (!g.down && Math.random() < 0.75) { g.down = true; g.t = 0; g.axis = Math.random() * Math.PI * 2 }
        }
      }
      if (k >= 1.08) { gball.setEnabled(false); phase = 'crash'; timer = 90 }
    } else if (phase === 'crash') {
      if (--timer <= 0) { phase = 'clear'; timer = 20 }
    } else if (phase === 'clear') {
      timer--
      for (const g of ghosts) if (g.down) g.inst.scaling.setAll(Math.max(0.01, timer / 20))
      if (timer <= 0) {
        for (const g of ghosts) {
          g.inst.rotation.set(0, 0, 0)
          g.inst.scaling.setAll(1)
          g.inst.position.set(off + g.sp.x, 0.001, g.sp.z)
          g.down = false
        }
        phase = 'idle'
        timer = 500 + Math.random() * 700
      }
    }
    // tipping animation
    for (const g of ghosts) {
      if (g.down && g.t < 16) {
        g.t++
        const a = (g.t / 16) * (Math.PI / 2)
        g.inst.rotation.x = Math.cos(g.axis) * a
        g.inst.rotation.z = Math.sin(g.axis) * a
      }
    }
  })
}

export function buildEnvirons(scene, alley) {
  const meshes = []
  const mats = []
  const track = (m) => (meshes.push(m), m)
  const tmat = (m) => (mats.push(m), m)
  const animated = []

  // the rest of the house: a lane being bowled on each side
  neighborLane(scene, alley, -1, animated, meshes, mats)
  neighborLane(scene, alley, 1, animated, meshes, mats)

  if (alley.fx === 'discoball') {
    // Disco Nova: a starfield and three neon arches spanning the lane
    const starMat = tmat(emissiveMat(scene, '#cdd3ff', { scale: 0.8 }))
    track(starfield(scene, 70, starMat))
    const archAMat = tmat(emissiveMat(scene, alley.colors.laneEdgeA, { scale: 0.65 }))
    const archBMat = tmat(emissiveMat(scene, alley.colors.laneEdgeB, { scale: 0.65 }))
    for (let i = 0; i < 3; i++) {
      const arch = MeshBuilder.CreateTorus('arch', { diameter: 7 - i * 0.6, thickness: 0.09, tessellation: 40 }, scene)
      // upright, spanning ACROSS the lane like a gate (half-buried = an arch)
      arch.rotation.x = Math.PI / 2
      arch.position.set(0, 0.4, -1.5 - i * 2.6)
      arch.material = i % 2 ? archAMat : archBMat
      arch.isPickable = false
      arch.freezeWorldMatrix()
      track(arch)
    }
    // ambient event: twin laser beams sweep from the mirror ball now and then
    const laserMat = tmat(emissiveMat(scene, alley.colors.laneEdgeA, { alpha: 0.5, scale: 1.1 }))
    const lasers = []
    for (const la of [-1, 1]) {
      const beam = MeshBuilder.CreateBox('laser', { width: 0.05, height: 9, depth: 0.05 }, scene)
      beam.material = laserMat
      beam.isPickable = false
      beam.setEnabled(false)
      track(beam)
      lasers.push({ beam, dir: la })
    }
    let laserAt = 900
    animated.push((t) => {
      const active = t > laserAt && t < laserAt + 220
      for (const { beam, dir } of lasers) {
        beam.setEnabled(active)
        if (active) {
          // a spotlight beam ANCHORED at the mirror ball, sweeping like a light
          // rig — never a free-standing pole on the lane
          const th = Math.sin((t - laserAt) * 0.025) * dir * 0.65
          beam.rotation.z = th
          beam.position.set(Math.sin(th) * 4.5, 4.6 - Math.cos(th) * 4.5, -3)
        }
      }
      if (t > laserAt + 220) laserAt = t + 1000 + Math.random() * 900
    })
  } else if (alley.fx === 'lava') {
    // Lava Lanes: canyon walls, a glowing volcano on the horizon, drifting embers
    const rockMat = tmat(pbr(scene, { color: '#241a14', rough: 0.95, name: 'rock' }))
    for (const side of [-1, 1]) {
      const wallBits = []
      for (let i = 0; i < 6; i++) {
        const w = MeshBuilder.CreateBox('crag', { width: 1.4 + (i % 3) * 0.5, height: 2.2 + ((i * 2.7) % 2.4), depth: 3.2 }, scene)
        w.position.set(side * (7.4 + (i % 2) * 0.9), 0.8, 4 - i * 3.1)
        w.rotation.y = side * 0.12 * (i % 3)
        wallBits.push(w)
      }
      const wall = Mesh.MergeMeshes(wallBits, true, true)
      wall.material = rockMat
      wall.isPickable = false
      wall.freezeWorldMatrix()
      track(wall)
    }
    const cone = MeshBuilder.CreateCylinder('volcano', { diameterTop: 1.4, diameterBottom: 5, height: 3.4, tessellation: 24 }, scene)
    cone.position.set(-3.4, 1.4, -14.5)
    cone.material = rockMat
    cone.isPickable = false
    cone.freezeWorldMatrix()
    track(cone)
    const crater = MeshBuilder.CreateTorus('crater', { diameter: 1.5, thickness: 0.26, tessellation: 28 }, scene)
    crater.position.set(-3.4, 3.15, -14.5)
    crater.material = tmat(emissiveMat(scene, '#ff6a1f', { scale: 1.1 }))
    crater.isPickable = false
    crater.freezeWorldMatrix()
    track(crater)
    // embers: a dozen glowing motes drifting upward, recycled forever
    const emberMat = tmat(emissiveMat(scene, '#ffb52f', { scale: 1.2 }))
    for (let i = 0; i < 12; i++) {
      const e = MeshBuilder.CreatePlane('ember', { size: 0.07 + (i % 3) * 0.03 }, scene)
      e.billboardMode = 7
      e.material = emberMat
      e.isPickable = false
      const seed = i * 1.7
      track(e)
      animated.push((t) => {
        const phase = ((t * 0.004) + seed) % 6
        e.position.set(
          Math.sin(seed * 3.3) * 2.8 + Math.sin(t * 0.01 + seed) * 0.5,
          phase * 0.75 - 0.3,
          -2 - ((seed * 2.9) % 6),
        )
        e.visibility = phase < 5 ? 1 : Math.max(0, 6 - phase)
      })
    }
    // ambient event: the volcano erupts — crater flares and spits fast embers
    const burstMat = tmat(emissiveMat(scene, '#ff8a3a', { scale: 1.6 }))
    const burstBits = []
    for (let i = 0; i < 10; i++) {
      const b = MeshBuilder.CreatePlane('burst', { size: 0.16 }, scene)
      b.billboardMode = 7
      b.material = burstMat
      b.isPickable = false
      b.setEnabled(false)
      track(b)
      burstBits.push(b)
    }
    const craterMat = crater.material
    let eruptAt = 1100
    animated.push((t) => {
      const k = (t - eruptAt) / 240
      const active = k >= 0 && k < 1
      craterMat.emissiveColor = Color3.FromHexString('#ff6a1f').scale(active ? 1.1 + Math.sin(k * Math.PI) * 1.4 : 1.1)
      burstBits.forEach((b, i) => {
        b.setEnabled(active)
        if (active) {
          const a = (i / 10) * Math.PI * 2
          const r = k * (1 + (i % 3) * 0.6)
          b.position.set(-3.4 + Math.cos(a) * r, 3.2 + k * 2.6 - k * k * 2.1, -14.5 + Math.sin(a) * r * 0.5)
          b.visibility = 1 - k
        }
      })
      if (k >= 1) eruptAt = t + 1500 + Math.random() * 1200
    })
  } else if (alley.fx === 'ufo') {
    // Zero-G: deep starfield, a big slow planet, drifting asteroids, a truss
    const starMat = tmat(emissiveMat(scene, '#dfe8ff', { scale: 0.9 }))
    track(starfield(scene, 90, starMat, 1.31))
    const planetMat = tmat(pbr(scene, { color: '#3d6fb5', rough: 0.75, name: 'planet' }))
    planetMat.emissiveColor = Color3.FromHexString('#16304f')
    const planet = MeshBuilder.CreateSphere('planet', { diameter: 10, segments: 32 }, scene)
    planet.position.set(4.2, 3.6, -24)
    planet.material = planetMat
    planet.isPickable = false
    track(planet)
    animated.push((t) => { planet.rotation.y = t * 0.0006 })
    const beltMat = tmat(emissiveMat(scene, '#8fb8d8', { scale: 0.35 }))
    const ring = MeshBuilder.CreateTorus('pring', { diameter: 15, thickness: 0.35, tessellation: 48 }, scene)
    ring.position.copyFrom(planet.position)
    ring.rotation.x = 1.15
    ring.material = beltMat
    ring.isPickable = false
    ring.freezeWorldMatrix()
    track(ring)
    const rockMat = tmat(pbr(scene, { color: '#5c6470', rough: 0.9, name: 'asteroid' }))
    for (let i = 0; i < 4; i++) {
      const a = MeshBuilder.CreateSphere('asteroid', { diameterX: 0.8 + i * 0.2, diameterY: 0.6 + (i % 2) * 0.3, diameterZ: 0.7, segments: 6 }, scene)
      a.material = rockMat
      a.isPickable = false
      const seed = i * 2.3
      track(a)
      animated.push((t) => {
        a.position.set(Math.sin(t * 0.002 + seed) * (3 + i * 0.5), 1.9 + Math.sin(t * 0.003 + seed * 2) * 0.8, -10 - i * 2)
        a.rotation.y = t * 0.004 + seed
        a.rotation.x = t * 0.003
      })
    }
    // ambient event: a comet streaks across the deep sky
    const cometMat = tmat(emissiveMat(scene, '#bfe8ff', { scale: 1.3 }))
    const comet = MeshBuilder.CreateSphere('comet', { diameterX: 0.5, diameterY: 0.12, diameterZ: 0.12, segments: 8 }, scene)
    comet.material = cometMat
    comet.isPickable = false
    comet.setEnabled(false)
    track(comet)
    let cometAt = 800
    animated.push((t) => {
      const k = (t - cometAt) / 170
      const active = k >= 0 && k < 1
      comet.setEnabled(active)
      if (active) {
        comet.position.set(-7 + k * 14, 3.1 + Math.sin(k * Math.PI) * 0.9, -16)
        comet.rotation.z = -0.12
        comet.visibility = Math.min(1, 4 * Math.min(k, 1 - k))
      }
      if (k >= 1) cometAt = t + 1100 + Math.random() * 1000
    })
  }

  return {
    update(t) {
      for (const fn of animated) fn(t)
    },
    dispose() {
      for (const m of meshes) m.dispose()
      for (const m of mats) m.dispose()
    },
  }
}
