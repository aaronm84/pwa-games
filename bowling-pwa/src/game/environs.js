// Per-alley set dressing — the world beyond the lane. Everything static is
// merged into single meshes and frozen so the whole environment costs a few
// draw calls; only the small animated bits (embers, asteroids) tick.
import { MeshBuilder, Mesh, Vector3, Color3, StandardMaterial, pbr } from 'src/engine'
import { makePinMesh, pinSpots, LANE_W, START_Z, DECK_END } from './lane3d'
import { addDiePips } from './hazards'

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
  const src = makePinMesh(scene, alley.colors, 'nPinSrc' + side, alley.pin)
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

export function buildEnvirons(scene, alley, opts = {}) {
  const meshes = []
  const mats = []
  const track = (m) => (meshes.push(m), m)
  const tmat = (m) => (mats.push(m), m)
  const animated = []
  const events = [] // one-shot quips the page surfaces (Bigfoot sightings…)

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
  } else if (alley.fx === 'tiki') {
    // Tiki Grove: torch poles flanking the lane with flickering flames,
    // dark palm fronds, and fireflies drifting through the dusk
    const woodMat = tmat(pbr(scene, { color: '#5a3a1e', rough: 0.9, name: 'tikiWood' }))
    const flameMat = tmat(emissiveMat(scene, '#ffab3a', { scale: 1.4 }))
    const flames = []
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const z = 2.5 - i * 4
        const pole = MeshBuilder.CreateCylinder('torch', { diameter: 0.12, height: 1.6, tessellation: 8 }, scene)
        pole.position.set(side * 2.35, 0.8, z)
        pole.material = woodMat
        pole.isPickable = false
        pole.freezeWorldMatrix()
        track(pole)
        const flame = MeshBuilder.CreateSphere('flame', { diameterX: 0.22, diameterY: 0.34, diameterZ: 0.22, segments: 8 }, scene)
        flame.position.set(side * 2.35, 1.75, z)
        flame.material = flameMat
        flame.isPickable = false
        track(flame)
        flames.push({ flame, seed: i * 2.1 + side })
      }
    }
    animated.push((t) => {
      for (const { flame, seed } of flames) {
        const f = 1 + Math.sin(t * 0.21 + seed * 5) * 0.18 + Math.sin(t * 0.37 + seed) * 0.1
        flame.scaling.set(f, f * (1 + Math.sin(t * 0.3 + seed) * 0.15), f)
      }
    })
    // palm silhouettes: dark fronds fanned atop far poles
    const palmMat = tmat(pbr(scene, { color: '#12200e', rough: 1, name: 'palm' }))
    for (const [px, pz] of [[-3.3, -11], [3.5, -12], [-4.2, -6], [4.4, -5]]) {
      const bits = []
      const trunk = MeshBuilder.CreateCylinder('ptrunk', { diameterTop: 0.12, diameterBottom: 0.2, height: 3.4, tessellation: 8 }, scene)
      trunk.position.set(px, 1.7, pz)
      trunk.rotation.z = px > 0 ? -0.12 : 0.12
      bits.push(trunk)
      for (let f = 0; f < 5; f++) {
        const frond = MeshBuilder.CreateBox('frond', { width: 1.5, height: 0.05, depth: 0.3 }, scene)
        frond.position.set(px, 3.4, pz)
        frond.rotation.y = (f / 5) * Math.PI * 2
        frond.rotation.z = 0.35
        bits.push(frond)
      }
      const palm = Mesh.MergeMeshes(bits, true, true)
      palm.material = palmMat
      palm.isPickable = false
      palm.freezeWorldMatrix()
      track(palm)
    }
    // fireflies
    const flyMat = tmat(emissiveMat(scene, '#d8ff6a', { scale: 1.1 }))
    for (let i = 0; i < 8; i++) {
      const fly = MeshBuilder.CreatePlane('firefly', { size: 0.05 }, scene)
      fly.billboardMode = 7
      fly.material = flyMat
      fly.isPickable = false
      const seed = i * 1.9
      track(fly)
      animated.push((t) => {
        fly.position.set(Math.sin(t * 0.006 + seed * 4) * 2.6, 1 + Math.sin(t * 0.009 + seed) * 0.7, -1 - ((seed * 1.7) % 7))
        fly.visibility = 0.5 + Math.sin(t * 0.05 + seed * 3) * 0.5
      })
    }
  } else if (alley.fx === 'casino') {
    // High Roller: giant dice, drifting cards, and a golden sparkle field
    const dieMat = tmat(pbr(scene, { color: '#f2ede4', rough: 0.35, name: 'die' }))
    for (const [dx, dz, rot] of [[-2.9, -3, 0.5], [3, -5.5, 1.1]]) {
      const die = MeshBuilder.CreateBox('bigdie', { size: 1.1 }, scene)
      die.position.set(dx, 0.55, dz)
      die.rotation.y = rot
      die.material = dieMat
      die.isPickable = false
      track(die)
      // real faces — pip layouts shared with the lane-hazard dice
      const { pips, mat: bigPipMat } = addDiePips(scene, die, 1.1, '#a01a2e')
      mats.push(bigPipMat)
      die.freezeWorldMatrix()
      pips.freezeWorldMatrix()
      track(pips)
    }
    // drifting cards
    const cardMat = tmat(pbr(scene, { color: '#f4f0e8', rough: 0.5, name: 'card' }))
    for (let i = 0; i < 5; i++) {
      const card = MeshBuilder.CreatePlane('card', { width: 0.32, height: 0.46 }, scene)
      card.material = cardMat
      card.isPickable = false
      const seed = i * 1.4
      track(card)
      animated.push((t) => {
        card.position.set(Math.sin(t * 0.004 + seed * 3) * 3, 1.6 + Math.sin(t * 0.006 + seed) * 1.1, -3 - i * 1.8)
        card.rotation.set(t * 0.01 + seed, t * 0.008, 0.4)
      })
    }
    // gold sparkles
    const sparkMat = tmat(emissiveMat(scene, '#ffd23f', { scale: 1.1 }))
    for (let i = 0; i < 10; i++) {
      const sp = MeshBuilder.CreatePlane('spark', { size: 0.06 }, scene)
      sp.billboardMode = 7
      sp.material = sparkMat
      sp.isPickable = false
      const seed = i * 2.3
      track(sp)
      animated.push((t) => {
        sp.position.set(Math.sin(seed * 5) * 3, 0.4 + ((t * 0.005 + seed) % 3.4), -1 - ((seed * 2.1) % 8))
        sp.visibility = 0.4 + Math.sin(t * 0.09 + seed) * 0.4
      })
    }
  } else if (alley.fx === 'poolside') {
    // Poolside: the lanes float on a sunlit pool — water, umbrellas, floaties,
    // and a sun high over the deck
    const waterMat = tmat(pbr(scene, { color: '#2e9ec4', rough: 0.25, name: 'water' }))
    const water = MeshBuilder.CreateBox('poolWater', { width: 40, height: 0.2, depth: 40 }, scene)
    water.position.set(0, -0.55, -4)
    water.material = waterMat
    water.isPickable = false
    water.freezeWorldMatrix()
    track(water)
    const sun = MeshBuilder.CreateSphere('sun', { diameter: 1.6, segments: 16 }, scene)
    sun.position.set(2.8, 3.8, -18)
    sun.material = tmat(emissiveMat(scene, '#fff3c4', { scale: 1.6 }))
    sun.isPickable = false
    sun.freezeWorldMatrix()
    track(sun)
    // umbrellas: one pair flanking the OPEN END of the deck (there's no
    // backstop at the pool — just water behind the pins), one pair up-lane
    const brellaMats = [tmat(pbr(scene, { color: '#ff5e5e', rough: 0.6, name: 'brella1' })), tmat(pbr(scene, { color: '#ffd23f', rough: 0.6, name: 'brella2' }))]
    const poleMat = tmat(pbr(scene, { color: '#e8e2d4', rough: 0.6, name: 'bpole' }))
    for (const [ux, uz, mi] of [[-2.6, 1.5, 0], [2.7, -1, 1], [-2.3, -9.4, 1], [2.4, -9.7, 0]]) {
      const pole = MeshBuilder.CreateCylinder('bp', { diameter: 0.07, height: 1.9, tessellation: 8 }, scene)
      pole.position.set(ux, 0.95, uz)
      pole.material = poleMat
      pole.isPickable = false
      pole.freezeWorldMatrix()
      track(pole)
      const top = MeshBuilder.CreateCylinder('bt', { diameterTop: 0, diameterBottom: 1.7, height: 0.55, tessellation: 10 }, scene)
      top.position.set(ux, 2.0, uz)
      top.material = brellaMats[mi]
      top.isPickable = false
      top.freezeWorldMatrix()
      track(top)
    }
    // floaty rings bobbing on the water
    const floatyMats = [tmat(pbr(scene, { color: '#ff8a5a', rough: 0.5, name: 'f1' })), tmat(pbr(scene, { color: '#59c26a', rough: 0.5, name: 'f2' }))]
    for (let i = 0; i < 3; i++) {
      const ring = MeshBuilder.CreateTorus('floaty', { diameter: 0.9, thickness: 0.18, tessellation: 20 }, scene)
      ring.material = floatyMats[i % 2]
      ring.isPickable = false
      const seed = i * 2.2
      track(ring)
      animated.push((t) => {
        ring.position.set(Math.sin(seed * 3) * 3.1, -0.4 + Math.sin(t * 0.01 + seed) * 0.06, 1 - i * 4.5)
        ring.rotation.y = t * 0.002 + seed
      })
    }
  } else if (alley.fx === 'forest') {
    // Timberline: the first alley with real DEPTH behind the lane — a forest
    // floor rolls away from the pit into layered treelines, campfires flicker
    // in the middle distance, mountains and a moon close the horizon…
    // and once a game, something big crosses the treeline.
    const groundMat = tmat(pbr(scene, { color: '#101c12', rough: 1, name: 'fGround' }))
    const ground = MeshBuilder.CreateBox('fGround', { width: 44, height: 0.1, depth: 22 }, scene)
    ground.position.set(0, -0.08, -22)
    ground.material = groundMat
    ground.isPickable = false
    ground.freezeWorldMatrix()
    track(ground)
    const starMat = tmat(emissiveMat(scene, '#dfe8d8', { scale: 0.55 }))
    track(starfield(scene, 60, starMat, 1.13))
    const moon = MeshBuilder.CreateSphere('fMoon', { diameterX: 1.7, diameterY: 1.7, diameterZ: 0.4, segments: 16 }, scene)
    moon.position.set(4.6, 6.4, -27)
    moon.material = tmat(emissiveMat(scene, '#e8ecd8', { scale: 0.95 }))
    moon.isPickable = false
    moon.freezeWorldMatrix()
    track(moon)
    // mountains on the horizon
    const mtnMat = tmat(pbr(scene, { color: '#0e161c', rough: 1, name: 'fMtn' }))
    const mtnBits = []
    for (const [mx, h, w] of [[-11, 8, 14], [1, 6.5, 12], [12, 9, 15]]) {
      const m = MeshBuilder.CreateCylinder('fMtnC', { diameterTop: 0, diameterBottom: w, height: h, tessellation: 7 }, scene)
      m.position.set(mx, h / 2 - 0.1, -30)
      mtnBits.push(m)
    }
    const mtns = Mesh.MergeMeshes(mtnBits, true, true)
    mtns.material = mtnMat
    mtns.isPickable = false
    mtns.freezeWorldMatrix()
    track(mtns)
    // layered treelines: darker and taller the farther back they stand
    const pineRow = (z, hexa, n, hMin, hMax, gap) => {
      const bits = []
      for (let i = 0; i < n; i++) {
        const x = -((n - 1) / 2) * gap + i * gap + ((i * 7.3) % 1.4) - 0.7
        if (z > -15 && Math.abs(x) < 3.2) continue // keep the pit view open up close
        const h = hMin + ((i * 3.7) % (hMax - hMin))
        const tree = MeshBuilder.CreateCylinder('fPine', { diameterTop: 0, diameterBottom: h * 0.5, height: h, tessellation: 6 }, scene)
        tree.position.set(x, h / 2 - 0.1, z + ((i * 5.1) % 2) - 1)
        bits.push(tree)
      }
      const row = Mesh.MergeMeshes(bits, true, true)
      row.material = tmat(pbr(scene, { color: hexa, rough: 1, name: 'fPineRow' }))
      row.isPickable = false
      row.freezeWorldMatrix()
      track(row)
    }
    pineRow(-21, '#0d1a12', 13, 3.0, 5.4, 2.9)
    pineRow(-16.5, '#122417', 11, 2.2, 4.0, 2.8)
    pineRow(-12, '#16301e', 9, 1.9, 3.4, 3.4)
    // campfires in the middle distance: crossed logs, breathing flames, embers
    const logMat = tmat(pbr(scene, { color: '#2e2014', rough: 1, name: 'fLog' }))
    const flameMat = tmat(emissiveMat(scene, '#ffab3a', { scale: 1.35 }))
    const coreMat = tmat(emissiveMat(scene, '#ffe28a', { scale: 1.5 }))
    const emberMat = tmat(emissiveMat(scene, '#ffb52f', { scale: 1.2 }))
    for (const [fx2, fz, seed] of [[-2.9, -13, 0.7], [3.4, -16, 2.3]]) {
      const logBits = []
      for (const ry of [0.5, 2.1, 3.7]) {
        const lg = MeshBuilder.CreateCylinder('fFireLog', { diameter: 0.14, height: 0.9, tessellation: 6 }, scene)
        lg.rotation.z = Math.PI / 2 - 0.12
        lg.rotation.y = ry
        lg.position.set(fx2, 0.08, fz)
        logBits.push(lg)
      }
      const logs = Mesh.MergeMeshes(logBits, true, true)
      logs.material = logMat
      logs.isPickable = false
      logs.freezeWorldMatrix()
      track(logs)
      const flame = MeshBuilder.CreateSphere('fFlame', { diameterX: 0.34, diameterY: 0.55, diameterZ: 0.34, segments: 8 }, scene)
      flame.position.set(fx2, 0.4, fz)
      flame.material = flameMat
      flame.isPickable = false
      track(flame)
      const core = MeshBuilder.CreateSphere('fFlameCore', { diameterX: 0.16, diameterY: 0.3, diameterZ: 0.16, segments: 8 }, scene)
      core.position.set(fx2, 0.32, fz)
      core.material = coreMat
      core.isPickable = false
      track(core)
      animated.push((t) => {
        const f = 1 + Math.sin(t * 0.19 + seed * 5) * 0.2 + Math.sin(t * 0.33 + seed) * 0.12
        flame.scaling.set(f, f * (1 + Math.sin(t * 0.27 + seed) * 0.18), f)
        core.scaling.setAll(1 + Math.sin(t * 0.4 + seed * 2) * 0.25)
      })
      for (let i = 0; i < 3; i++) {
        const e = MeshBuilder.CreatePlane('fEmber', { size: 0.06 }, scene)
        e.billboardMode = 7
        e.material = emberMat
        e.isPickable = false
        const es = seed + i * 1.9
        track(e)
        animated.push((t) => {
          const phase = ((t * 0.006) + es) % 3
          e.position.set(fx2 + Math.sin(t * 0.02 + es) * 0.25, 0.5 + phase * 0.8, fz)
          e.visibility = phase < 2.4 ? 1 - phase / 2.6 : 0
        })
      }
    }
    // fireflies drifting between the near trunks
    const flyMat = tmat(emissiveMat(scene, '#d8ff6a', { scale: 1 }))
    for (let i = 0; i < 6; i++) {
      const fly = MeshBuilder.CreatePlane('fFly', { size: 0.05 }, scene)
      fly.billboardMode = 7
      fly.material = flyMat
      fly.isPickable = false
      const seed = i * 2.1
      track(fly)
      animated.push((t) => {
        fly.position.set(Math.sin(t * 0.005 + seed * 4) * 3, 0.8 + Math.sin(t * 0.008 + seed) * 0.6, -1.5 - ((seed * 1.9) % 8))
        fly.visibility = 0.5 + Math.sin(t * 0.045 + seed * 3) * 0.5
      })
    }
    // ambient event: a shooting star over the mountains
    const shootMat = tmat(emissiveMat(scene, '#f4f8e8', { scale: 1.3 }))
    const shoot = MeshBuilder.CreateSphere('fShoot', { diameterX: 0.55, diameterY: 0.07, diameterZ: 0.07, segments: 6 }, scene)
    shoot.material = shootMat
    shoot.isPickable = false
    shoot.setEnabled(false)
    track(shoot)
    let shootAt = 1000
    animated.push((t) => {
      const k = (t - shootAt) / 120
      const active = k >= 0 && k < 1
      shoot.setEnabled(active)
      if (active) {
        shoot.position.set(6 - k * 12, 7.2 - k * 1.6, -25)
        shoot.rotation.z = 0.14
        shoot.visibility = Math.min(1, 4 * Math.min(k, 1 - k))
      }
      if (k >= 1) shootAt = t + 1300 + Math.random() * 1100
    })
    // ---- the visitor: BIGFOOT crosses the treeline once per game ----------
    // A shaggy upright walker (the classic 6-beat gait: arms counter-swing the
    // legs, the body bobs). He strides in from one side, freezes mid-lane when
    // he notices you noticing him, then BOLTS. Once. Blink and you miss it.
    const bf = makeBigfootRig(scene, meshes, mats)
    const BF_Z = -14.8
    const fromLeft = Math.random() < 0.5
    const dirX = fromLeft ? 1 : -1
    const facing = fromLeft ? Math.PI / 2 : -Math.PI / 2
    let bfState = 'waiting'
    let bfAt = opts.bigfootSoon ? 240 : 1600 + Math.random() * 4800
    let bfT = 0
    let bfPause = 0
    animated.push((t) => {
      if (bfState === 'done') return
      if (bfState === 'waiting') {
        if (t < bfAt) return
        bfState = 'walking'
        bf.torso.setEnabled(true)
        // dev-forced sightings enter close so headless checks don't wait out
        // the full crossing at software-render frame rates
        bf.torso.position.set(-dirX * (opts.bigfootSoon ? 5 : 10.5), bf.baseY, BF_Z)
        bf.torso.rotation.y = facing
      }
      bfT++
      if (bfState === 'walking' || bfState === 'fleeing') {
        const flee = bfState === 'fleeing'
        bf.torso.position.x += dirX * (flee ? 0.06 : 0.032)
        const ph = bfT * (flee ? 0.28 : 0.16)
        const sw = Math.sin(ph)
        bf.legL.rotation.x = sw * 0.6
        bf.legR.rotation.x = -sw * 0.6
        bf.armL.rotation.x = -sw * (flee ? 0.7 : 0.5)
        bf.armR.rotation.x = sw * (flee ? 0.7 : 0.5)
        bf.torso.position.y = bf.baseY - Math.abs(Math.cos(ph)) * 0.1
        bf.torso.rotation.x = (flee ? 0.16 : 0.08) + Math.sin(ph * 2) * 0.03
        bf.torso.rotation.y += (facing - bf.torso.rotation.y) * 0.12
        if (bfState === 'walking' && Math.abs(bf.torso.position.x) < 0.35) {
          bfState = 'staring'
          bfPause = 105
          events.push('Wait… WAIT. Did anyone else see that?!')
        }
        if (Math.abs(bf.torso.position.x) > 11) {
          bfState = 'done'
          bf.torso.setEnabled(false)
        }
      } else if (bfState === 'staring') {
        // caught mid-stride: square up to the camera, hold… hold… GO
        bf.torso.rotation.y += (0 - bf.torso.rotation.y) * 0.12
        bf.torso.rotation.x += (0.02 - bf.torso.rotation.x) * 0.1
        for (const p of [bf.legL, bf.legR, bf.armL, bf.armR]) p.rotation.x *= 0.85
        if (--bfPause <= 0) bfState = 'fleeing'
      }
    })
  } else if (alley.fx === 'carnival') {
    // The Midway: string lights chasing down the lane, a turning ferris wheel,
    // drifting balloons, striped tent walls — and fireworks on their own clock
    const tentA = tmat(pbr(scene, { color: '#5a1a28', rough: 0.9, name: 'tentA' }))
    const tentB = tmat(pbr(scene, { color: '#3a2a20', rough: 0.9, name: 'tentB' }))
    for (const side of [-1, 1]) {
      const bitsA = []
      const bitsB = []
      for (let i = 0; i < 8; i++) {
        const p = MeshBuilder.CreateBox('tent', { width: 1.3, height: 3.4, depth: 1.9 }, scene)
        p.position.set(side * (7.6 + (i % 2) * 0.5), 1.6, 4 - i * 2.4)
        p.rotation.y = side * 0.1
        ;(i % 2 ? bitsB : bitsA).push(p)
      }
      for (const [bits, m] of [[bitsA, tentA], [bitsB, tentB]]) {
        const wall = Mesh.MergeMeshes(bits, true, true)
        wall.material = m
        wall.isPickable = false
        wall.freezeWorldMatrix()
        track(wall)
      }
    }
    // string lights: two chase groups per side, blinking in alternation
    const bulbA = tmat(emissiveMat(scene, '#ffd23f'))
    const bulbB = tmat(emissiveMat(scene, '#ff4a5e'))
    for (const side of [-1, 1]) {
      const bitsA = []
      const bitsB = []
      for (let i = 0; i < 10; i++) {
        const b = MeshBuilder.CreateSphere('bulb', { diameter: 0.08, segments: 8 }, scene)
        const z = 3.5 - i * 1.5
        b.position.set(side * 2.85, 2.15 + Math.sin(i * 1.1) * 0.12, z)
        ;(i % 2 ? bitsB : bitsA).push(b)
      }
      for (const [bits, m] of [[bitsA, bulbA], [bitsB, bulbB]]) {
        const chain = Mesh.MergeMeshes(bits, true, true)
        chain.material = m
        chain.isPickable = false
        chain.freezeWorldMatrix()
        track(chain)
      }
    }
    animated.push((t) => {
      const ph = Math.floor(t / 24) % 2
      bulbA.emissiveColor = Color3.FromHexString('#ffd23f').scale(ph ? 1 : 0.3)
      bulbB.emissiveColor = Color3.FromHexString('#ff4a5e').scale(ph ? 0.3 : 1)
    })
    // the ferris wheel, turning all night at the end of the midway
    const wheelRoot = MeshBuilder.CreateBox('wheelRoot', { size: 0.01 }, scene)
    wheelRoot.isVisible = false
    wheelRoot.position.set(5.6, 3.6, -20)
    track(wheelRoot)
    const rim = MeshBuilder.CreateTorus('wheelRim', { diameter: 5.6, thickness: 0.12, tessellation: 36 }, scene)
    rim.rotation.x = Math.PI / 2
    rim.material = tmat(emissiveMat(scene, '#ff4a5e', { scale: 0.55 }))
    rim.parent = wheelRoot
    rim.isPickable = false
    track(rim)
    const spokeMat = tmat(emissiveMat(scene, '#ffd23f', { scale: 0.4 }))
    for (let i = 0; i < 3; i++) {
      const spoke = MeshBuilder.CreateBox('wheelSpoke', { width: 5.5, height: 0.07, depth: 0.07 }, scene)
      spoke.rotation.z = (i / 3) * Math.PI
      spoke.material = spokeMat
      spoke.parent = wheelRoot
      spoke.isPickable = false
      track(spoke)
    }
    const cabMats = [tmat(emissiveMat(scene, '#6ad8ff', { scale: 0.5 })), tmat(emissiveMat(scene, '#ffd23f', { scale: 0.5 }))]
    const cabins = []
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      const cab = MeshBuilder.CreateBox('wheelCab', { width: 0.42, height: 0.34, depth: 0.2 }, scene)
      cab.position.set(Math.cos(a) * 2.8, Math.sin(a) * 2.8, 0)
      cab.material = cabMats[i % 2]
      cab.parent = wheelRoot
      cab.isPickable = false
      cabins.push(cab)
      track(cab)
    }
    // support legs
    const legMat = tmat(pbr(scene, { color: '#2a1a22', rough: 0.9, name: 'wheelLeg' }))
    for (const s of [-1, 1]) {
      const leg = MeshBuilder.CreateCylinder('wheelLegC', { diameter: 0.16, height: 4.4, tessellation: 8 }, scene)
      leg.position.set(5.6 + s * 0.9, 1.7, -20)
      leg.rotation.z = s * 0.22
      leg.material = legMat
      leg.isPickable = false
      leg.freezeWorldMatrix()
      track(leg)
    }
    animated.push((t) => {
      wheelRoot.rotation.z = t * 0.0035
      for (const cab of cabins) cab.rotation.z = -wheelRoot.rotation.z // gondolas hang level
    })
    // balloons that got away
    const balloonMats = [tmat(pbr(scene, { color: '#ff4a5e', rough: 0.4, name: 'bal1' })), tmat(pbr(scene, { color: '#6ad8ff', rough: 0.4, name: 'bal2' })), tmat(pbr(scene, { color: '#ffd23f', rough: 0.4, name: 'bal3' }))]
    for (let i = 0; i < 4; i++) {
      const bal = MeshBuilder.CreateSphere('balloon', { diameterX: 0.34, diameterY: 0.42, diameterZ: 0.34, segments: 12 }, scene)
      bal.material = balloonMats[i % 3]
      bal.isPickable = false
      const seed = i * 2.7
      track(bal)
      animated.push((t) => {
        const rise = ((t * 0.0045) + seed) % 8
        bal.position.set(Math.sin(seed * 3) * 4 + Math.sin(t * 0.006 + seed) * 0.4, rise - 0.5, -4 - ((seed * 2.3) % 9))
        bal.visibility = rise < 6.5 ? 1 : Math.max(0, (8 - rise) / 1.5)
      })
    }
    // ambient event: FIREWORKS over the midway
    const fwMats = [tmat(emissiveMat(scene, '#ff6ad8', { scale: 1.5 })), tmat(emissiveMat(scene, '#ffd23f', { scale: 1.5 })), tmat(emissiveMat(scene, '#6ad8ff', { scale: 1.5 }))]
    const fwBits = []
    for (let i = 0; i < 14; i++) {
      const b = MeshBuilder.CreatePlane('fw', { size: 0.15 }, scene)
      b.billboardMode = 7
      b.material = fwMats[i % 3]
      b.isPickable = false
      b.setEnabled(false)
      track(b)
      fwBits.push(b)
    }
    let fwAt = 950
    let fwX = 0
    animated.push((t) => {
      const k = (t - fwAt) / 190
      const active = k >= 0 && k < 1
      fwBits.forEach((b, i) => {
        b.setEnabled(active)
        if (active) {
          const a = (i / 14) * Math.PI * 2
          const r = k * (1.6 + (i % 3) * 0.7)
          b.position.set(fwX + Math.cos(a) * r, 4.8 + Math.sin(a) * r - k * k * 1.2, -17)
          b.visibility = 1 - k
        }
      })
      if (k >= 1) { fwAt = t + 1100 + Math.random() * 1000; fwX = (Math.random() - 0.5) * 8 }
    })
  } else if (alley.fx === 'aurora') {
    // Polar Nights: snowfields and icebergs under breathing aurora ribbons,
    // with snow drifting down through the lights
    const snowGround = tmat(pbr(scene, { color: '#8fb0c8', rough: 0.9, name: 'aSnow' }))
    const ground = MeshBuilder.CreateBox('aGround', { width: 44, height: 0.1, depth: 24 }, scene)
    ground.position.set(0, -0.08, -22)
    ground.material = snowGround
    ground.isPickable = false
    ground.freezeWorldMatrix()
    track(ground)
    const starMat = tmat(emissiveMat(scene, '#dfe8ff', { scale: 0.7 }))
    track(starfield(scene, 70, starMat, 1.47))
    // icebergs and pressure ridges on the horizon
    const bergMat = tmat(pbr(scene, { color: '#9fc4dc', rough: 0.6, name: 'aBerg' }))
    const bergBits = []
    for (const [bx, bz, h, w] of [[-9, -24, 4.2, 6], [-2, -27, 2.8, 5], [7, -23, 5, 7], [13, -26, 3.4, 5]]) {
      const berg = MeshBuilder.CreateCylinder('aBergC', { diameterTop: w * 0.25, diameterBottom: w, height: h, tessellation: 5 }, scene)
      berg.position.set(bx, h / 2 - 0.1, bz)
      berg.rotation.y = bx * 0.7
      bergBits.push(berg)
    }
    const bergs = Mesh.MergeMeshes(bergBits, true, true)
    bergs.convertToFlatShadedMesh()
    bergs.material = bergMat
    bergs.isPickable = false
    bergs.freezeWorldMatrix()
    track(bergs)
    // drifted snow banks flanking the lane
    const bankMat = tmat(pbr(scene, { color: '#c8dcea', rough: 0.95, name: 'aBank' }))
    const bankBits = []
    for (const [bx, bz, s] of [[-4.2, -2, 2.6], [4.5, -5, 3.2], [-4.8, -9, 2.8], [4.2, 1.5, 2.2]]) {
      const bank = MeshBuilder.CreateSphere('aBankS', { diameterX: s, diameterY: s * 0.32, diameterZ: s * 0.8, segments: 10 }, scene)
      bank.position.set(bx, 0, bz)
      bankBits.push(bank)
    }
    const banks = Mesh.MergeMeshes(bankBits, true, true)
    banks.material = bankMat
    banks.isPickable = false
    banks.freezeWorldMatrix()
    track(banks)
    // the aurora: three broad ribbons, breathing and drifting
    const ribbons = []
    const ribbonCols = ['#4ae8a0', '#a88aff', '#6ad8ff']
    for (let i = 0; i < 3; i++) {
      const m = new StandardMaterial('aRibbon' + i, scene)
      m.emissiveColor = Color3.FromHexString(ribbonCols[i]).scale(0.8)
      m.disableLighting = true
      m.alpha = 0.18
      m.backFaceCulling = false
      mats.push(m)
      const rib = MeshBuilder.CreatePlane('aRib', { width: 13 - i * 2, height: 2.6 + i * 0.5 }, scene)
      rib.position.set(-2 + i * 3, 5.4 + i * 0.9, -25 + i * 0.5)
      rib.rotation.z = 0.12 - i * 0.1
      rib.material = m
      rib.isPickable = false
      track(rib)
      ribbons.push({ rib, m, seed: i * 2.2, hex: ribbonCols[i] })
    }
    animated.push((t) => {
      for (const { rib, m, seed, hex } of ribbons) {
        m.alpha = 0.1 + (Math.sin(t * 0.006 + seed) * 0.5 + 0.5) * 0.14
        m.emissiveColor = Color3.FromHexString(hex).scale(0.6 + Math.sin(t * 0.004 + seed * 3) * 0.25)
        rib.scaling.y = 1 + Math.sin(t * 0.005 + seed * 2) * 0.18
        rib.position.x += Math.sin(t * 0.0016 + seed) * 0.004
      }
    })
    // snowfall
    const flakeMat = tmat(emissiveMat(scene, '#eef6ff', { scale: 0.55 }))
    for (let i = 0; i < 14; i++) {
      const flake = MeshBuilder.CreatePlane('aFlake', { size: 0.05 + (i % 3) * 0.02 }, scene)
      flake.billboardMode = 7
      flake.material = flakeMat
      flake.isPickable = false
      const seed = i * 1.7
      track(flake)
      animated.push((t) => {
        const fall = 6 - ((t * 0.008 + seed * 1.3) % 6.5)
        flake.position.set(Math.sin(seed * 4) * 4 + Math.sin(t * 0.01 + seed) * 0.5, fall, -1 - ((seed * 2.7) % 10))
        flake.visibility = fall > -0.2 ? 0.85 : 0
      })
    }
  } else if (alley.fx === 'west') {
    // Dry Gulch: mesas against a dying sunset, saguaros standing sentry,
    // drifting dust — and now and then a tumbleweed bounces through the back
    const dirtMat = tmat(pbr(scene, { color: '#5a3a24', rough: 1, name: 'wDirt' }))
    const ground = MeshBuilder.CreateBox('wGround', { width: 44, height: 0.1, depth: 24 }, scene)
    ground.position.set(0, -0.08, -22)
    ground.material = dirtMat
    ground.isPickable = false
    ground.freezeWorldMatrix()
    track(ground)
    // the sun, huge and low, refusing to set
    const sun = MeshBuilder.CreateSphere('wSun', { diameterX: 3.2, diameterY: 3.2, diameterZ: 0.4, segments: 18 }, scene)
    sun.position.set(-2.5, 2.1, -30)
    sun.material = tmat(emissiveMat(scene, '#ff8a4a', { scale: 1.15 }))
    sun.isPickable = false
    sun.freezeWorldMatrix()
    track(sun)
    // mesas: flat-topped slabs with lighter caprock
    const mesaMat = tmat(pbr(scene, { color: '#4a2517', rough: 1, name: 'wMesa' }))
    const capMat = tmat(pbr(scene, { color: '#6b3a20', rough: 1, name: 'wCap' }))
    const mesaBits = []
    const capBits = []
    for (const [mx, w, h] of [[-9.5, 6.5, 3.6], [2.5, 4.5, 2.4], [11, 5.5, 4.4]]) {
      const mesa = MeshBuilder.CreateCylinder('wMesaC', { diameterTop: w * 0.82, diameterBottom: w, height: h, tessellation: 9 }, scene)
      mesa.position.set(mx, h / 2 - 0.1, -26)
      mesaBits.push(mesa)
      const cap = MeshBuilder.CreateCylinder('wCapC', { diameterTop: w * 0.8, diameterBottom: w * 0.84, height: 0.3, tessellation: 9 }, scene)
      cap.position.set(mx, h - 0.05, -26)
      capBits.push(cap)
    }
    for (const [bits, m] of [[mesaBits, mesaMat], [capBits, capMat]]) {
      const merged = Mesh.MergeMeshes(bits, true, true)
      merged.material = m
      merged.isPickable = false
      merged.freezeWorldMatrix()
      track(merged)
    }
    // saguaros standing along the lane like regulars at the rail
    const cactMat = tmat(pbr(scene, { color: '#2e5a34', rough: 0.85, name: 'wCact' }))
    for (const [cx, cz, s] of [[-2.9, 1.5, 1], [3.1, -2.5, 1.25], [-3.4, -7, 1.1], [3.6, -10.5, 0.9]]) {
      const bits = []
      const trunk = MeshBuilder.CreateCapsule('wCactT', { radius: 0.11 * s, height: 1.7 * s, tessellation: 10, capSubdivisions: 4 }, scene)
      trunk.position.set(cx, 0.85 * s, cz)
      bits.push(trunk)
      for (const sd of [-1, 1]) {
        const out = MeshBuilder.CreateCapsule('wCactO', { radius: 0.07 * s, height: 0.3 * s, orientation: new Vector3(1, 0, 0), tessellation: 8, capSubdivisions: 4 }, scene)
        out.position.set(cx + sd * 0.2 * s, (0.75 + (sd < 0 ? 0 : 0.3)) * s, cz)
        bits.push(out)
        const up = MeshBuilder.CreateCapsule('wCactU', { radius: 0.07 * s, height: 0.55 * s, tessellation: 8, capSubdivisions: 4 }, scene)
        up.position.set(cx + sd * 0.32 * s, (1.0 + (sd < 0 ? 0 : 0.3)) * s, cz)
        bits.push(up)
      }
      const cact = Mesh.MergeMeshes(bits, true, true)
      cact.material = cactMat
      cact.isPickable = false
      cact.freezeWorldMatrix()
      track(cact)
    }
    // dust motes drifting on the wind
    const dustMat = tmat(emissiveMat(scene, '#c8a05a', { scale: 0.35, alpha: 0.5 }))
    for (let i = 0; i < 8; i++) {
      const d = MeshBuilder.CreatePlane('wDust', { size: 0.07 + (i % 3) * 0.03 }, scene)
      d.billboardMode = 7
      d.material = dustMat
      d.isPickable = false
      const seed = i * 2.3
      track(d)
      animated.push((t) => {
        const drift = ((t * 0.01 + seed * 2) % 16) - 8
        d.position.set(drift, 0.3 + Math.sin(t * 0.008 + seed) * 0.4, -2 - ((seed * 1.9) % 9))
        d.visibility = Math.max(0, 0.6 - Math.abs(drift) / 14)
      })
    }
    // ambient event: a tumbleweed bounces clean across the back forty
    const weedBits = []
    for (let i = 0; i < 4; i++) {
      const ring = MeshBuilder.CreateTorus('wWeed', { diameter: 0.55 - (i % 2) * 0.08, thickness: 0.02, tessellation: 10 }, scene)
      ring.rotation.set(i * 0.8, i * 1.2, i * 0.5)
      weedBits.push(ring)
    }
    const weed = Mesh.MergeMeshes(weedBits, true, true)
    weed.material = tmat(pbr(scene, { color: '#a8824a', rough: 1, name: 'wWeedM' }))
    weed.isPickable = false
    weed.setEnabled(false)
    track(weed)
    let weedAt = 700
    animated.push((t) => {
      const k = (t - weedAt) / 300
      const active = k >= 0 && k < 1
      weed.setEnabled(active)
      if (active) {
        weed.position.set(-13 + k * 26, 0.3 + Math.abs(Math.sin(k * Math.PI * 5)) * (0.7 - k * 0.3), -13.5)
        weed.rotation.z = -k * 22
      }
      if (k >= 1) weedAt = t + 1200 + Math.random() * 1400
    })
  }

  return {
    update(t) {
      for (const fn of animated) fn(t)
    },
    // one-shot events (the Bigfoot sighting) the page turns into quips
    takeEvent() {
      return events.shift() || null
    },
    dispose() {
      for (const m of meshes) m.dispose()
      for (const m of mats) m.dispose()
    },
  }
}

// The Bigfoot rig: primitive-built shaggy walker, hidden until his cue. Limbs
// pivot from shoulders/hips (the pivot spheres double as joints); the forest
// block drives the gait. Scaled to read at the treeline, not to star.
function makeBigfootRig(scene, meshes, mats) {
  const fur = pbr(scene, { color: '#4a3423', rough: 0.95, name: 'bfFur' })
  const furDark = pbr(scene, { color: '#3a2818', rough: 0.95, name: 'bfFurD' })
  const skin = pbr(scene, { color: '#c8975a', rough: 0.8, name: 'bfSkin' })
  const eyeMat = pbr(scene, { color: '#241a12', rough: 0.4, name: 'bfEye' })
  mats.push(fur, furDark, skin, eyeMat)
  const S = 0.85 // background scale
  const torso = MeshBuilder.CreateSphere('bf', { diameterX: 1.05 * S, diameterY: 1.7 * S, diameterZ: 0.85 * S, segments: 8 }, scene)
  torso.material = fur
  meshes.push(torso)
  const head = MeshBuilder.CreateSphere('bfh', { diameterX: 0.8 * S, diameterY: 0.85 * S, diameterZ: 0.8 * S, segments: 8 }, scene)
  head.material = fur
  head.parent = torso
  head.position.set(0, 1.15 * S, 0.02)
  meshes.push(head)
  const face = MeshBuilder.CreateSphere('bff', { diameterX: 0.42 * S, diameterY: 0.5 * S, diameterZ: 0.3 * S, segments: 6 }, scene)
  face.material = skin
  face.parent = head
  face.position.set(0, -0.05 * S, 0.34 * S)
  meshes.push(face)
  for (const sx of [-1, 1]) {
    const e = MeshBuilder.CreateSphere('bfe', { diameter: 0.08 * S, segments: 6 }, scene)
    e.material = eyeMat
    e.parent = head
    e.position.set(sx * 0.12 * S, 0.05 * S, 0.46 * S)
    meshes.push(e)
  }
  function limb(name, isArm, side) {
    const pivot = MeshBuilder.CreateSphere(name + 'p', { diameter: 0.34 * S, segments: 6 }, scene)
    pivot.material = fur
    pivot.parent = torso
    pivot.position.set(side * (isArm ? 0.62 : 0.28) * S, (isArm ? 0.55 : -0.75) * S, 0)
    meshes.push(pivot)
    const seg = MeshBuilder.CreateCylinder(name, { diameterTop: 0.32 * S, diameterBottom: 0.38 * S, height: (isArm ? 1.05 : 1.15) * S, tessellation: 8 }, scene)
    seg.material = isArm ? fur : furDark
    seg.parent = pivot
    seg.position.y = -(isArm ? 0.55 : 0.6) * S
    meshes.push(seg)
    const end = isArm
      ? MeshBuilder.CreateSphere(name + 'h', { diameterX: 0.34 * S, diameterY: 0.3 * S, diameterZ: 0.34 * S, segments: 6 }, scene)
      : MeshBuilder.CreateBox(name + 'f', { width: 0.36 * S, height: 0.22 * S, depth: 0.6 * S }, scene)
    end.material = skin
    end.parent = pivot
    end.position.set(0, -(isArm ? 1.05 : 1.15) * S, isArm ? 0 : 0.14 * S)
    meshes.push(end)
    return pivot
  }
  const armL = limb('bfaL', true, -1)
  const armR = limb('bfaR', true, 1)
  const legL = limb('bflL', false, -1)
  const legR = limb('bflR', false, 1)
  torso.setEnabled(false) // hidden until his moment
  return { torso, armL, armR, legL, legR, baseY: 1.75 * S }
}
