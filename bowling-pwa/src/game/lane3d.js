// Builds the alley: lane, gutters, kerbs, backstop pit, neon edge strips, and
// the pin rack — all with Havok colliders. World layout: the lane runs along z,
// the bowler stands at +z, the pins live near z = PIN_Z (negative, far end).
import {
  MeshBuilder,
  Mesh,
  MirrorTexture,
  DynamicTexture,
  Plane,
  Vector3,
  Color3,
  StandardMaterial,
  makeStatic,
  pbr,
  PhysicsAggregate,
  PhysicsShapeType,
} from 'src/engine'

// Procedural wood grain for the wooden houses: boards running down-lane with
// seams and wavy grain strokes, painted once onto a small canvas texture.
function woodGrainTexture(scene, baseHex) {
  const tex = new DynamicTexture('laneWood', { width: 256, height: 512 }, scene, true)
  const ctx = tex.getContext()
  ctx.fillStyle = baseHex
  ctx.fillRect(0, 0, 256, 512)
  const BOARDS = 8
  const bw = 256 / BOARDS
  for (let b = 0; b < BOARDS; b++) {
    const x = b * bw
    // alternate board tone slightly
    ctx.fillStyle = b % 2 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.05)'
    ctx.fillRect(x, 0, bw, 512)
    // seam between boards
    ctx.strokeStyle = 'rgba(0,0,0,0.30)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(x + 0.75, 0)
    ctx.lineTo(x + 0.75, 512)
    ctx.stroke()
    // grain: a few long wavy strokes per board
    for (let g = 0; g < 4; g++) {
      ctx.strokeStyle = g % 2 ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.07)'
      ctx.lineWidth = 1
      const gx = x + 4 + ((b * 7.3 + g * 9.1) % (bw - 8))
      ctx.beginPath()
      ctx.moveTo(gx, 0)
      for (let y = 0; y <= 512; y += 24) {
        const sway = Math.sin((y / 512) * Math.PI * 2 + b * 1.7 + g * 2.3) * 3
        ctx.lineTo(Math.max(x + 2, Math.min(x + bw - 2, gx + sway)), y)
      }
      ctx.stroke()
    }
    // an occasional knot
    if ((b * 13) % 3 === 0) {
      const kx = x + bw / 2
      const ky = 60 + ((b * 173) % 380)
      ctx.strokeStyle = 'rgba(0,0,0,0.16)'
      ctx.beginPath()
      ctx.ellipse(kx, ky, 4.5, 8, 0.2, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.ellipse(kx, ky, 2, 4, 0.2, 0, Math.PI * 2)
      ctx.stroke()
    }
  }
  tex.update()
  return tex
}

export const LANE_W = 2.2 // playable lane width
export const LANE_LEN = 18
export const BALL_R = 0.22
export const PIN_Z = -7.2 // head pin
export const DECK_END = -9.2 // the floor ends here — then the pit
export const PIT_Z = -9.0 // past this (or below the floor) the ball is done
export const START_Z = 6.2 // where the bowler stands (in frame, below the camera)
const GUTTER_W = 0.62

export const PIN_H = 0.78
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

export function buildAlley(scene, shadow, colors, opts = {}) {
  const meshes = []
  const aggs = []
  const meshesOwnMats = [] // per-alley extras (pit trim) disposed with the kit
  const track = (m) => (meshes.push(m), m)
  const freeze = (m) => (m.freezeWorldMatrix(), m)

  // the oiled lane: optionally a true planar mirror, so the neon strips, pins
  // and ball reflect in the surface (the page keeps the render list current).
  // Wooden houses lay grained boards under the polish.
  let laneMat
  let mirror = null
  let woodTex = null
  if (opts.reflections) {
    laneMat = new StandardMaterial('lane', scene)
    laneMat.diffuseColor = Color3.FromHexString(colors.lane)
    laneMat.specularColor = new Color3(0.14, 0.14, 0.18)
    mirror = new MirrorTexture('laneMirror', { ratio: 0.5 }, scene, true)
    mirror.mirrorPlane = new Plane(0, -1, 0, 0)
    mirror.level = 0.4
    laneMat.reflectionTexture = mirror
  } else {
    laneMat = new StandardMaterial('lane', scene)
    laneMat.diffuseColor = Color3.FromHexString(colors.lane)
    laneMat.specularColor = new Color3(0.1, 0.1, 0.12)
  }
  if (opts.wood) {
    woodTex = woodGrainTexture(scene, colors.lane)
    woodTex.vScale = 4 // grain repeats down the length of the lane
    laneMat.diffuseTexture = woodTex
    laneMat.diffuseColor = new Color3(1, 1, 1) // the texture carries the tone
  }
  const gutterMat = pbr(scene, { color: colors.gutter, rough: 0.8, name: 'gutter' })
  const darkMat = pbr(scene, { color: colors.backstop, rough: 0.9, name: 'backstop' })
  for (const m of [laneMat, gutterMat, darkMat]) m.maxSimultaneousLights = 6

  // lane bed (top at y=0), slick like an oiled lane. The floor STOPS at the pit
  // edge — balls and deadwood drop away behind the pin deck like a real house.
  const floorLen = START_Z + 2 - DECK_END
  const floorZ = (START_Z + 2 + DECK_END) / 2
  const lane = MeshBuilder.CreateBox('lane', { width: LANE_W, height: 0.3, depth: floorLen }, scene)
  lane.position.set(0, -0.15, floorZ)
  lane.material = laneMat
  lane.receiveShadows = true
  aggs.push(makeStatic(lane, { shape: PhysicsShapeType.BOX, friction: 0.18, restitution: 0.1 }))
  track(freeze(lane))

  // gutters: a lower floor channel each side. The edges are rounded — a soft
  // lip where the lane drops off, and a smooth cylindrical rail outside —
  // so a ball rolls INTO the channel on a curve, not off a cliff.
  for (const side of [-1, 1]) {
    const gx = side * (LANE_W / 2 + GUTTER_W / 2)
    const g = MeshBuilder.CreateBox('gutterFloor', { width: GUTTER_W, height: 0.3, depth: floorLen }, scene)
    g.position.set(gx, -0.27, floorZ)
    g.material = gutterMat
    aggs.push(makeStatic(g, { shape: PhysicsShapeType.BOX, friction: 0.3, restitution: 0.05 }))
    track(freeze(g))
    // rounded lip at the lane/gutter boundary
    const lip = MeshBuilder.CreateCylinder('lip', { diameter: 0.09, height: floorLen, tessellation: 20 }, scene)
    lip.rotation.x = Math.PI / 2
    lip.position.set(side * (LANE_W / 2 + 0.01), -0.045, floorZ)
    lip.material = laneMat
    aggs.push(makeStatic(lip, { shape: PhysicsShapeType.CYLINDER, friction: 0.2, restitution: 0.05 }))
    track(freeze(lip))
    // smooth outer rail
    const rail = MeshBuilder.CreateCylinder('rail', { diameter: 0.22, height: floorLen, tessellation: 24 }, scene)
    rail.rotation.x = Math.PI / 2
    rail.position.set(side * (LANE_W / 2 + GUTTER_W + 0.1), 0.02, floorZ)
    rail.material = darkMat
    aggs.push(makeStatic(rail, { shape: PhysicsShapeType.CYLINDER, friction: 0.3, restitution: 0.2 }))
    track(freeze(rail))
  }

  // the pit + the backer. Every alley treats the end of the lane its own way:
  //  - 'void' (fallback): the classic black hole with a masking hood
  //  - 'open' (Zero-G, Disco): NO backer — the room shows through; just the
  //    neon lintel floats above the deck (Disco hangs its mirror ball here)
  //  - 'masks' (Tiki): a bamboo pole with a row of glowing-eyed tiki masks
  //  - 'volcano' (Lava): the lane dead-ends into a volcano, crater aglow,
  //    lava streaks running down toward the pit
  //  - 'slot' (High Roller): the backer IS a slot machine — the pit is the
  //    payout tray
  //  - 'water' (Poolside): nothing at all — open water behind the deck
  // Colliders are identical in all styles; only the dressing changes.
  const style = opts.pit || 'void'
  const waterPit = style === 'water'
  const voidMat = new StandardMaterial('voidMat', scene)
  voidMat.diffuseColor = new Color3(0, 0, 0)
  voidMat.specularColor = new Color3(0, 0, 0)
  voidMat.disableLighting = true
  voidMat.freeze()
  const totalW = LANE_W + 2 * GUTTER_W + 1
  const pit = MeshBuilder.CreateBox('pit', { width: totalW, height: 0.3, depth: 2.6 }, scene)
  pit.position.set(0, waterPit ? -0.85 : -1.5, DECK_END - 1.3)
  pit.material = voidMat
  pit.isVisible = !waterPit // under water level — the environs' pool shows instead
  aggs.push(makeStatic(pit, { shape: PhysicsShapeType.BOX, friction: 0.9, restitution: 0 }))
  track(freeze(pit))
  if (style === 'void') {
    // masking hood above the opening (the "mouth" of the void)
    const hood = MeshBuilder.CreateBox('hood', { width: totalW, height: 1.8, depth: 0.12 }, scene)
    hood.position.set(0, 2.0, DECK_END - 0.15)
    hood.material = voidMat
    track(freeze(hood))
  }
  if (!waterPit) {
    // side cheeks inside the pit so no lit surface shows through the hole —
    // full height behind the hood, below deck level on the open styles
    const cheekH = style === 'void' ? 2.4 : 1.0
    const cheekY = style === 'void' ? -0.3 : -0.55
    for (const side of [-1, 1]) {
      const cheek = MeshBuilder.CreateBox('cheek', { width: 0.12, height: cheekH, depth: 2.8 }, scene)
      cheek.position.set(side * (totalW / 2 - 0.06), cheekY, DECK_END - 1.4)
      cheek.material = voidMat
      track(freeze(cheek))
    }
  }
  // neon trim: the lintel over the pit mouth (and corner posts where the
  // machinery wants grounding) in the lane's own edge colors
  if (style === 'void' || style === 'open' || style === 'volcano') {
    const trimA = new StandardMaterial('pitTrimA', scene)
    trimA.emissiveColor = Color3.FromHexString(colors.laneEdgeA).scale(0.75)
    trimA.disableLighting = true
    meshesOwnMats.push(trimA)
    const lintel = MeshBuilder.CreateBox('pitTrim', { width: totalW, height: 0.055, depth: 0.14 }, scene)
    lintel.position.set(0, 1.12, DECK_END - 0.14)
    lintel.material = trimA
    track(freeze(lintel))
    if (style !== 'open') {
      const trimB = new StandardMaterial('pitTrimB', scene)
      trimB.emissiveColor = Color3.FromHexString(colors.laneEdgeB).scale(0.75)
      trimB.disableLighting = true
      meshesOwnMats.push(trimB)
      for (const side of [-1, 1]) {
        const post = MeshBuilder.CreateBox('pitPost', { width: 0.055, height: 1.12, depth: 0.14 }, scene)
        post.position.set(side * (totalW / 2 - 0.03), 0.56, DECK_END - 0.14)
        post.material = trimB
        track(freeze(post))
      }
    }
  }
  if (style === 'masks') buildMaskWall(scene, totalW, track, freeze, meshesOwnMats)
  if (style === 'volcano') buildVolcanoBacker(scene, track, freeze, meshesOwnMats)
  if (style === 'slot') buildSlotBacker(scene, totalW, track, freeze, meshesOwnMats)

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
    track(freeze(e))
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
    track(freeze(a))
  }

  // backstop curtain at the far side of the pit — pure void-black, and fully
  // below the deck line so nothing ever bounces back onto the lane. On the
  // water pit it's invisible: the ball visually plunks into the pool.
  const back = MeshBuilder.CreateBox('back', { width: totalW, height: 2.0, depth: 0.3 }, scene)
  back.position.set(0, -1.0, DECK_END - 2.7)
  back.material = voidMat
  back.isVisible = !waterPit
  aggs.push(makeStatic(back, { shape: PhysicsShapeType.BOX, friction: 0.6, restitution: 0 }))
  track(freeze(back))

  // the sweep: the pinsetter's bar that drops down while the deck is serviced.
  // Visual-only (deadwood colliders are already gone when it runs); the page
  // animates sweep.position.y between sweepDownY and sweepUpY.
  // The pinsetter's sweep arm, in house style: neon tubes at Disco, bamboo at
  // the grove, stacked lasers in Zero-G, a lava-dripping basalt bar, a
  // button-tufted leather bumper at the casino, a pool noodle at Poolside.
  // The root is an invisible carrier the page animates; the dressing rides it.
  const sweepKit = buildSweep(scene, colors, opts.sweepStyle || 'bar', track, meshesOwnMats)
  const sweep = sweepKit.root

  // gutter floor color pulse handle (lava alley)
  const gutterGlow = colors.gutterGlow ? gutterMat : null

  return {
    edges,
    gutterMat: gutterGlow,
    mirror,
    sweep,
    sweepUpdate: sweepKit.update,
    sweepDownY: 0.42,
    sweepUpY: 3.6,
    dispose() {
      for (const a of aggs) a.dispose?.()
      for (const m of meshes) m.dispose()
      mirror?.dispose()
      woodTex?.dispose()
      laneMat.dispose()
      gutterMat.dispose()
      darkMat.dispose()
      arrowMat.dispose()
      voidMat.dispose()
      for (const m of meshesOwnMats) m.dispose()
      for (const e of edges) e.mat.dispose()
    },
  }
}

// ---- the sweep arm, per alley ------------------------------------------------
// Root is an invisible carrier box the page animates between sweepDownY and
// sweepUpY; every style hangs world-aligned children off it.
function buildSweep(scene, colors, style, track, mats) {
  const W = LANE_W + 0.7
  let update = null // styles with living parts (lava drips) fill this in
  const root = MeshBuilder.CreateBox('sweep', { width: W, height: 0.3, depth: 0.16 }, scene)
  root.isVisible = false
  root.position.set(0, 3.6, PIN_Z + 1.05)
  track(root)
  const add = (mesh, x = 0, y = 0, z = 0) => {
    mesh.parent = root
    mesh.position.set(x, y, z)
    mesh.isPickable = false
    track(mesh)
    return mesh
  }
  const glowM = (hex, scale = 1) => {
    const m = new StandardMaterial('swGlow', scene)
    m.emissiveColor = Color3.FromHexString(hex).scale(scale)
    m.disableLighting = true
    mats.push(m)
    return m
  }
  const litM = (hex, rough = 0.6) => {
    const m = pbr(scene, { color: hex, rough, name: 'swMat' })
    m.maxSimultaneousLights = 6
    mats.push(m)
    return m
  }

  if (style === 'neon') {
    // Disco: twin neon tubes with sparkle beads strung between them
    const tubeA = MeshBuilder.CreateCylinder('swTubeA', { diameter: 0.075, height: W, tessellation: 16 }, scene)
    tubeA.rotation.z = Math.PI / 2
    tubeA.material = glowM(colors.laneEdgeA, 0.95)
    add(tubeA, 0, 0.09)
    const tubeB = MeshBuilder.CreateCylinder('swTubeB', { diameter: 0.075, height: W, tessellation: 16 }, scene)
    tubeB.rotation.z = Math.PI / 2
    tubeB.material = glowM(colors.laneEdgeB, 0.95)
    add(tubeB, 0, -0.09)
    const beadMat = glowM('#f4f0ff', 1.1)
    for (let i = 0; i < 7; i++) {
      const bead = MeshBuilder.CreateSphere('swBead', { diameter: 0.06, segments: 10 }, scene)
      bead.material = beadMat
      add(bead, -W / 2 + 0.25 + i * (W - 0.5) / 6, i % 2 ? 0.09 : -0.09, 0.05)
    }
  } else if (style === 'bamboo') {
    // Tiki: a thick cane with raised nodes and rope lashings at the ends
    const caneMat = litM('#c9a86a', 0.75)
    const cane = MeshBuilder.CreateCylinder('swCane', { diameter: 0.17, height: W, tessellation: 18 }, scene)
    cane.rotation.z = Math.PI / 2
    cane.material = caneMat
    add(cane)
    const nodeMat = litM('#a8834a', 0.85)
    for (let i = 0; i < 5; i++) {
      const node = MeshBuilder.CreateCylinder('swNode', { diameter: 0.19, height: 0.045, tessellation: 18 }, scene)
      node.rotation.z = Math.PI / 2
      node.material = nodeMat
      add(node, -W / 2 + 0.35 + i * (W - 0.7) / 4)
    }
    const ropeMat = litM('#8a5a2a', 0.95)
    for (const s of [-1, 1]) {
      const rope = MeshBuilder.CreateTorus('swRope', { diameter: 0.2, thickness: 0.035, tessellation: 16 }, scene)
      rope.rotation.z = Math.PI / 2
      rope.material = ropeMat
      add(rope, s * (W / 2 - 0.12))
    }
  } else if (style === 'laser') {
    // Zero-G: no bar at all — three stacked laser beams between emitter pods
    const beamA = glowM(colors.laneEdgeA, 1.1)
    const beamB = glowM(colors.laneEdgeB, 1.1)
    ;[[0.12, beamA], [0, beamB], [-0.12, beamA]].forEach(([y, m]) => {
      const beam = MeshBuilder.CreateBox('swBeam', { width: W - 0.3, height: 0.028, depth: 0.02 }, scene)
      beam.material = m
      add(beam, 0, y)
    })
    const podMat = litM('#9aa4b2', 0.35)
    const lensMat = glowM('#f4f0ff', 1.2)
    for (const s of [-1, 1]) {
      const pod = MeshBuilder.CreateBox('swPod', { width: 0.14, height: 0.42, depth: 0.14 }, scene)
      pod.material = podMat
      add(pod, s * (W / 2 - 0.07))
      const lens = MeshBuilder.CreateSphere('swLens', { diameter: 0.06, segments: 10 }, scene)
      lens.material = lensMat
      add(lens, s * (W / 2 - 0.07), 0.24)
    }
  } else if (style === 'drip') {
    // Lava: a basalt bar shedding glowing drips — each drip stretches, lets a
    // molten bead go, and reforms on its own clock
    const bar = MeshBuilder.CreateBox('swBar', { width: W, height: 0.24, depth: 0.14 }, scene)
    bar.material = litM('#241a14', 0.95)
    add(bar, 0, 0.05)
    const seam = MeshBuilder.CreateBox('swSeam', { width: W, height: 0.045, depth: 0.15 }, scene)
    seam.material = glowM('#ff6a1f', 1.15)
    add(seam, 0, -0.09)
    const dripCols = ['#e8481c', '#ff6a1f', '#ffb52f']
    const drips = []
    for (let i = 0; i < 6; i++) {
      const len = 0.12 + ((i * 2.7) % 3) * 0.07
      const x = -W / 2 + 0.3 + i * (W - 0.6) / 5
      const drip = MeshBuilder.CreateCylinder('swDrip', { diameterTop: 0.05, diameterBottom: 0.008, height: len, tessellation: 10 }, scene)
      drip.material = glowM(dripCols[i % 3], 1.1)
      add(drip, x, -0.12 - len / 2)
      const bead = MeshBuilder.CreateSphere('swBead', { diameter: 0.035, segments: 8 }, scene)
      bead.material = glowM('#ffd23f', 1.3)
      add(bead, x, -0.12 - len)
      drips.push({ drip, bead, len, x, cycle: 130 + i * 29, seed: i * 47 })
    }
    update = (t) => {
      for (const d of drips) {
        const k = ((t + d.seed) % d.cycle) / d.cycle
        if (k < 0.55) {
          // the drip stretches as it gathers, the bead riding its tip
          const grow = 0.55 + (k / 0.55) * 0.6
          d.drip.scaling.y = grow
          d.drip.position.y = -0.12 - (d.len * grow) / 2
          d.bead.position.y = -0.12 - d.len * grow
          d.bead.visibility = 1
        } else {
          // released: the bead falls away and fades; the drip snaps back
          const f = (k - 0.55) / 0.45
          d.drip.scaling.y = 0.55
          d.drip.position.y = -0.12 - (d.len * 0.55) / 2
          d.bead.position.y = -0.12 - d.len - f * f * 1.6
          d.bead.visibility = Math.max(0, 1 - f * 1.15)
        }
      }
    }
  } else if (style === 'plush') {
    // High Roller: a button-tufted leather bumper with gold hardware
    const pad = MeshBuilder.CreateCapsule('swPad', { radius: 0.15, height: W, orientation: new Vector3(1, 0, 0), tessellation: 18, capSubdivisions: 6 }, scene)
    pad.material = litM('#5a1428', 0.55)
    add(pad)
    const buttonMat = glowM('#ffd23f', 0.55)
    for (let i = 0; i < 7; i++) {
      const btn = MeshBuilder.CreateSphere('swBtn', { diameter: 0.045, segments: 10 }, scene)
      btn.material = buttonMat
      add(btn, -W / 2 + 0.3 + i * (W - 0.6) / 6, 0, 0.135)
    }
    const capMat = litM('#ffd23f', 0.3)
    for (const s of [-1, 1]) {
      const cap = MeshBuilder.CreateSphere('swCap', { diameter: 0.2, segments: 14 }, scene)
      cap.material = capMat
      add(cap, s * (W / 2 + 0.02))
    }
  } else if (style === 'noodle') {
    // Poolside: a foam pool noodle with candy stripes
    const foam = MeshBuilder.CreateCapsule('swNoodle', { radius: 0.13, height: W, orientation: new Vector3(1, 0, 0), tessellation: 18, capSubdivisions: 6 }, scene)
    foam.material = litM('#ff5ea0', 0.9)
    add(foam)
    const stripeCols = ['#29b5d8', '#ffd23f']
    for (let i = 0; i < 4; i++) {
      const ring = MeshBuilder.CreateCylinder('swRing', { diameter: 0.272, height: 0.1, tessellation: 18 }, scene)
      ring.rotation.z = Math.PI / 2
      ring.material = litM(stripeCols[i % 2], 0.85)
      add(ring, -W / 2 + 0.5 + i * (W - 1) / 3)
    }
  } else {
    // fallback: the plain service bar with a glow strip
    const bar = MeshBuilder.CreateBox('swPlain', { width: W, height: 0.46, depth: 0.16 }, scene)
    bar.material = litM(colors.sweep || '#22242c', 0.5)
    add(bar)
    const strip = MeshBuilder.CreateBox('swStrip', { width: W, height: 0.05, depth: 0.17 }, scene)
    strip.material = glowM(colors.sweepGlow || colors.arrow)
    add(strip, 0, -0.22)
  }
  return { root, update }
}

// ---- per-alley backers ------------------------------------------------------

// Tiki Grove: a bamboo pole strung above the pit with a row of carved masks —
// glowing eyes, dark mouths, little frond toppers. Merged per material.
function buildMaskWall(scene, totalW, track, freeze, mats) {
  const wood = [[], []] // two alternating carve tones
  const dark = []
  const teeth = []
  const fronds = []
  const eyes = []
  const bambooMat = new StandardMaterial('bambooMat', scene)
  bambooMat.diffuseColor = Color3.FromHexString('#a8834a')
  bambooMat.specularColor = new Color3(0.08, 0.08, 0.06)
  mats.push(bambooMat)
  const pole = MeshBuilder.CreateCylinder('maskPole', { diameter: 0.09, height: totalW, tessellation: 12 }, scene)
  pole.rotation.z = Math.PI / 2
  pole.position.set(0, 2.1, DECK_END - 0.2)
  pole.material = bambooMat
  track(freeze(pole))
  const xs = [-1.5, -0.5, 0.5, 1.5]
  xs.forEach((mx, i) => {
    const my = 1.35
    const mz = DECK_END - 0.22
    // rope from the pole down to the mask
    const rope = MeshBuilder.CreateCylinder('maskRope', { diameter: 0.025, height: 0.32, tessellation: 6 }, scene)
    rope.position.set(mx, 1.93, mz)
    wood[1].push(rope)
    // the face: a tall carved oval with a heavy brow and a long nose
    const face = MeshBuilder.CreateSphere('maskFace', { diameterX: 0.56, diameterY: 0.88, diameterZ: 0.2, segments: 18 }, scene)
    face.position.set(mx, my, mz)
    wood[i % 2].push(face)
    const brow = MeshBuilder.CreateBox('maskBrow', { width: 0.5, height: 0.09, depth: 0.08 }, scene)
    brow.position.set(mx, my + 0.2, mz + 0.06)
    wood[(i + 1) % 2].push(brow)
    const nose = MeshBuilder.CreateBox('maskNose', { width: 0.09, height: 0.26, depth: 0.09 }, scene)
    nose.position.set(mx, my + 0.02, mz + 0.08)
    wood[(i + 1) % 2].push(nose)
    // glowing eyes
    for (const s of [-1, 1]) {
      const eye = MeshBuilder.CreateSphere('maskEye', { diameterX: 0.11, diameterY: 0.09, diameterZ: 0.05, segments: 10 }, scene)
      eye.position.set(mx + s * 0.14, my + 0.11, mz + 0.09)
      eyes.push(eye)
    }
    // mouth: a dark slot, some with teeth
    const mouth = MeshBuilder.CreateBox('maskMouth', { width: 0.3, height: i % 2 ? 0.16 : 0.1, depth: 0.06 }, scene)
    mouth.position.set(mx, my - 0.24, mz + 0.08)
    dark.push(mouth)
    if (i % 2) {
      // carved fangs: little wooden pyramids hanging from the mouth's top lip
      for (const tx of [-0.09, 0, 0.09]) {
        const tooth = MeshBuilder.CreateCylinder('maskTooth', { diameterTop: 0.055, diameterBottom: 0, height: 0.08, tessellation: 4 }, scene)
        tooth.position.set(mx + tx, my - 0.2, mz + 0.085)
        teeth.push(tooth)
      }
    }
    // frond topper
    for (let f = -1; f <= 1; f++) {
      const frond = MeshBuilder.CreateBox('maskFrond', { width: 0.06, height: 0.24, depth: 0.03 }, scene)
      frond.position.set(mx + f * 0.1, my + 0.52, mz)
      frond.rotation.z = f * 0.45
      fronds.push(frond)
    }
  })
  const bake = (bits, hex, { emissive = false, scale = 1 } = {}) => {
    if (!bits.length) return
    const merged = Mesh.MergeMeshes(bits, true, true)
    let m
    if (emissive) {
      m = new StandardMaterial('maskGlow', scene)
      m.emissiveColor = Color3.FromHexString(hex).scale(scale)
      m.disableLighting = true
    } else {
      m = new StandardMaterial('maskMat', scene)
      m.diffuseColor = Color3.FromHexString(hex)
      m.specularColor = new Color3(0.05, 0.05, 0.04)
    }
    mats.push(m)
    merged.material = m
    merged.isPickable = false
    track(freeze(merged))
  }
  bake(wood[0], '#8a5a2a')
  bake(wood[1], '#5f3d1c')
  bake(dark, '#1a0f06')
  bake(teeth, '#b98d54')
  bake(fronds, '#2e6b34')
  bake(eyes, '#ffab3a', { emissive: true, scale: 1.1 })
}

// Lava Lanes: the lane dead-ends into a volcano. Dark cone, glowing crater,
// lava streaks running down the face toward the pit.
function buildVolcanoBacker(scene, track, freeze, mats) {
  const rockMat = new StandardMaterial('vRock', scene)
  rockMat.diffuseColor = Color3.FromHexString('#241a14')
  rockMat.specularColor = new Color3(0.03, 0.03, 0.03)
  mats.push(rockMat)
  // squat and wide: the portrait camera's ceiling at this depth is ~y 2.5
  // (less HUD), so the crater must sit low to actually be seen
  const cone = MeshBuilder.CreateCylinder('backVolcano', { diameterTop: 1.4, diameterBottom: 7.8, height: 1.55, tessellation: 30 }, scene)
  cone.position.set(0, 0.775, DECK_END - 4.3)
  cone.material = rockMat
  track(freeze(cone))
  // a shoulder vent so the silhouette isn't a perfect cone
  const shoulder = MeshBuilder.CreateCylinder('vShoulder', { diameterTop: 0.8, diameterBottom: 3.2, height: 1.0, tessellation: 20 }, scene)
  shoulder.position.set(2.2, 0.5, DECK_END - 3.6)
  shoulder.material = rockMat
  track(freeze(shoulder))
  const glow = new StandardMaterial('vGlow', scene)
  glow.emissiveColor = Color3.FromHexString('#ff6a1f').scale(1.2)
  glow.disableLighting = true
  mats.push(glow)
  const crater = MeshBuilder.CreateTorus('vCrater', { diameter: 1.65, thickness: 0.28, tessellation: 26 }, scene)
  crater.position.set(0, 1.58, DECK_END - 4.3)
  crater.material = glow
  track(freeze(crater))
  const hot = new StandardMaterial('vHot', scene)
  hot.emissiveColor = Color3.FromHexString('#ffd23f').scale(1.25)
  hot.disableLighting = true
  mats.push(hot)
  const throat = MeshBuilder.CreateCylinder('vThroat', { diameter: 1.4, height: 0.06, tessellation: 20 }, scene)
  throat.position.set(0, 1.56, DECK_END - 4.3)
  throat.material = hot
  track(freeze(throat))
  // lava streaks: bright runs from the crater lip down the near face toward
  // the pit (top ≈ y2.1 @ z-12.9, base ≈ y0.2 @ z-10.2)
  const streaks = []
  for (const [sx, yaw, len] of [[-0.95, 0.2, 2.6], [0.1, -0.05, 3.1], [1.1, -0.26, 2.4]]) {
    const s = MeshBuilder.CreateBox('vStreak', { width: 0.18, height: 0.07, depth: len }, scene)
    s.position.set(sx, 0.85, DECK_END - 2.4 - len / 2 + 0.2)
    s.rotation.x = -0.42 // the cone's slope
    s.rotation.y = yaw
    streaks.push(s)
  }
  const run = Mesh.MergeMeshes(streaks, true, true)
  run.material = glow
  run.isPickable = false
  track(freeze(run))
}

// High Roller: the backer IS a slot machine — cabinet, three reels showing
// cherry/BAR/seven, a light row across the top, and the lever arm. The pit
// below is the payout tray.
function buildSlotBacker(scene, totalW, track, freeze, mats) {
  const cab = new StandardMaterial('slotCab', scene)
  cab.diffuseColor = Color3.FromHexString('#4a1626')
  cab.specularColor = new Color3(0.12, 0.08, 0.1)
  mats.push(cab)
  // the cabinet stops well above the deck: the whole bottom is the payout
  // tray — a wide dark mouth the ball visibly disappears into
  const body = MeshBuilder.CreateBox('slotBody', { width: totalW, height: 1.92, depth: 0.3 }, scene)
  body.position.set(0, 1.61, DECK_END - 0.45)
  body.material = cab
  track(freeze(body))
  const mouthMat = new StandardMaterial('slotMouth', scene)
  mouthMat.diffuseColor = new Color3(0, 0, 0)
  mouthMat.specularColor = new Color3(0, 0, 0)
  mouthMat.disableLighting = true
  mats.push(mouthMat)
  // cavity: recessed black back + ceiling, framed in gold
  const mouthBack = MeshBuilder.CreateBox('slotMouthBack', { width: totalW, height: 0.7, depth: 0.06 }, scene)
  mouthBack.position.set(0, 0.3, DECK_END - 0.9)
  mouthBack.material = mouthMat
  track(freeze(mouthBack))
  const mouthTop = MeshBuilder.CreateBox('slotMouthTop', { width: totalW, height: 0.06, depth: 0.55 }, scene)
  mouthTop.position.set(0, 0.66, DECK_END - 0.62)
  mouthTop.material = mouthMat
  track(freeze(mouthTop))
  for (const side of [-1, 1]) {
    const cheekIn = MeshBuilder.CreateBox('slotMouthCheek', { width: 0.06, height: 0.7, depth: 0.55 }, scene)
    cheekIn.position.set(side * (totalW / 2 - 0.03), 0.3, DECK_END - 0.62)
    cheekIn.material = mouthMat
    track(freeze(cheekIn))
  }
  // crown: a rounded topper with the house's gold trim
  const crown = MeshBuilder.CreateCylinder('slotCrown', { diameter: 0.5, height: totalW, tessellation: 18 }, scene)
  crown.rotation.z = Math.PI / 2
  crown.position.set(0, 2.5, DECK_END - 0.45)
  crown.material = cab
  track(freeze(crown))
  const gold = new StandardMaterial('slotGold', scene)
  gold.emissiveColor = Color3.FromHexString('#ffd23f').scale(0.75)
  gold.disableLighting = true
  mats.push(gold)
  // gold frame around the payout mouth + a slanted tray lip below it
  const trayBits = []
  const lipTop = MeshBuilder.CreateBox('slotTrayTop', { width: totalW, height: 0.055, depth: 0.1 }, scene)
  lipTop.position.set(0, 0.68, DECK_END - 0.34)
  trayBits.push(lipTop)
  for (const side of [-1, 1]) {
    const post = MeshBuilder.CreateBox('slotTrayPost', { width: 0.055, height: 0.68, depth: 0.1 }, scene)
    post.position.set(side * (totalW / 2 - 0.03), 0.34, DECK_END - 0.34)
    trayBits.push(post)
  }
  const trayFrame = Mesh.MergeMeshes(trayBits, true, true)
  trayFrame.material = gold
  trayFrame.isPickable = false
  track(freeze(trayFrame))
  // reel window: cream panel + gold frame
  const face = new StandardMaterial('slotFace', scene)
  face.diffuseColor = Color3.FromHexString('#f2ede4')
  face.specularColor = new Color3(0.1, 0.1, 0.1)
  mats.push(face)
  const win = MeshBuilder.CreateBox('slotWin', { width: 2.9, height: 1.05, depth: 0.06 }, scene)
  win.position.set(0, 1.5, DECK_END - 0.28)
  win.material = face
  track(freeze(win))
  const frameBits = []
  for (const [w, h, fx, fy] of [[3.0, 0.07, 0, 2.06], [3.0, 0.07, 0, 0.94], [0.07, 1.19, -1.5, 1.5], [0.07, 1.19, 1.5, 1.5]]) {
    const bar = MeshBuilder.CreateBox('slotFrame', { width: w, height: h, depth: 0.07 }, scene)
    bar.position.set(fx, fy, DECK_END - 0.26)
    frameBits.push(bar)
  }
  // reel dividers
  for (const dx of [-0.475, 0.475]) {
    const div = MeshBuilder.CreateBox('slotDiv', { width: 0.05, height: 1.05, depth: 0.065 }, scene)
    div.position.set(dx, 1.5, DECK_END - 0.27)
    frameBits.push(div)
  }
  const frame = Mesh.MergeMeshes(frameBits, true, true)
  frame.material = gold
  frame.isPickable = false
  track(freeze(frame))
  // the symbols: 🍒 (red discs + stem), BAR (gold slab), 7 (magenta diamond)
  const zSym = DECK_END - 0.235
  const cherryMat = new StandardMaterial('slotCherry', scene)
  cherryMat.emissiveColor = Color3.FromHexString('#ff4a6a').scale(0.9)
  cherryMat.disableLighting = true
  mats.push(cherryMat)
  const cherryBits = []
  for (const cx of [-1.07, -0.83]) {
    const c = MeshBuilder.CreateSphere('slotC', { diameterX: 0.24, diameterY: 0.24, diameterZ: 0.05, segments: 14 }, scene)
    c.position.set(cx, 1.38, zSym)
    cherryBits.push(c)
  }
  const stem = MeshBuilder.CreateBox('slotStem', { width: 0.05, height: 0.3, depth: 0.04 }, scene)
  stem.position.set(-0.95, 1.62, zSym)
  stem.rotation.z = 0.2
  cherryBits.push(stem)
  const cherry = Mesh.MergeMeshes(cherryBits, true, true)
  cherry.material = cherryMat
  cherry.isPickable = false
  track(freeze(cherry))
  const bar = MeshBuilder.CreateBox('slotBar', { width: 0.6, height: 0.22, depth: 0.05 }, scene)
  bar.position.set(0, 1.5, zSym)
  bar.material = gold
  track(freeze(bar))
  const sevenMat = new StandardMaterial('slotSeven', scene)
  sevenMat.emissiveColor = Color3.FromHexString('#ff3df0').scale(0.9)
  sevenMat.disableLighting = true
  mats.push(sevenMat)
  const seven = MeshBuilder.CreateBox('slotSevenD', { width: 0.34, height: 0.34, depth: 0.05 }, scene)
  seven.position.set(0.95, 1.5, zSym)
  seven.rotation.z = Math.PI / 4
  seven.material = sevenMat
  track(freeze(seven))
  // blinking-style light row across the crown (two alternating colors)
  const lightA = new StandardMaterial('slotLightA', scene)
  lightA.emissiveColor = Color3.FromHexString('#ffd23f')
  lightA.disableLighting = true
  const lightB = new StandardMaterial('slotLightB', scene)
  lightB.emissiveColor = Color3.FromHexString('#ff4a6a')
  lightB.disableLighting = true
  mats.push(lightA, lightB)
  const dotsA = []
  const dotsB = []
  for (let i = 0; i < 7; i++) {
    const dot = MeshBuilder.CreateSphere('slotDot', { diameter: 0.11, segments: 10 }, scene)
    dot.position.set(-1.8 + i * 0.6, 2.62, DECK_END - 0.42)
    ;(i % 2 ? dotsB : dotsA).push(dot)
  }
  for (const [bits, m] of [[dotsA, lightA], [dotsB, lightB]]) {
    const merged = Mesh.MergeMeshes(bits, true, true)
    merged.material = m
    merged.isPickable = false
    track(freeze(merged))
  }
  // the lever arm, cocked and ready
  const chrome = new StandardMaterial('slotChrome', scene)
  chrome.diffuseColor = Color3.FromHexString('#b9c2ce')
  chrome.specularColor = new Color3(0.6, 0.6, 0.65)
  mats.push(chrome)
  const arm = MeshBuilder.CreateCylinder('slotArm', { diameter: 0.07, height: 1.0, tessellation: 12 }, scene)
  arm.position.set(totalW / 2 + 0.18, 1.9, DECK_END - 0.45)
  arm.rotation.z = -0.28
  arm.material = chrome
  track(freeze(arm))
  const knobMat = new StandardMaterial('slotKnob', scene)
  knobMat.diffuseColor = Color3.FromHexString('#e8342f')
  knobMat.emissiveColor = Color3.FromHexString('#e8342f').scale(0.25)
  mats.push(knobMat)
  const knob = MeshBuilder.CreateSphere('slotKnob', { diameter: 0.2, segments: 14 }, scene)
  knob.position.set(totalW / 2 + 0.32, 2.38, DECK_END - 0.45)
  knob.material = knobMat
  track(freeze(knob))
}

// The classic pin silhouette, lathe-turned: broad belly, slim neck, rounded
// head. Radii/heights are the real pin's proportions scaled to PIN_H.
// (r, y) pairs from base to crown, in units of PIN_H.
const PIN_PROFILE = [
  [0.067, 0.0],
  [0.123, 0.064],
  [0.151, 0.154],
  [0.159, 0.244], // the belly
  [0.144, 0.359],
  [0.108, 0.487],
  [0.071, 0.615],
  [0.060, 0.699], // the neck
  [0.067, 0.769],
  [0.083, 0.840], // the head
  [0.079, 0.910],
  [0.054, 0.968],
  [0.015, 0.994],
]

// Ring radius of the pin silhouette at a normalized height (for band sizing)
function pinRadiusAt(yn) {
  for (let i = 1; i < PIN_PROFILE.length; i++) {
    if (PIN_PROFILE[i][1] >= yn) {
      const [r0, y0] = PIN_PROFILE[i - 1]
      const [r1, y1] = PIN_PROFILE[i]
      const t = (yn - y0) / (y1 - y0 || 1)
      return r0 + (r1 - r0) * t
    }
  }
  return PIN_PROFILE[PIN_PROFILE.length - 1][0]
}

// The bare pin visual (lathed body + themed bands) — shared by the real physics
// pins and the ghost pins on the neighbor lanes. `pinStyle` comes from the
// alley: { body: hex, bands: [{ y, c }] } — totem stripes, gold rings, etc.
export function makePinMesh(scene, colors, name = 'pin', pinStyle = null) {
  const shape = PIN_PROFILE.map(([r, y]) => new Vector3(r * PIN_H, y * PIN_H, 0))
  const body = MeshBuilder.CreateLathe(name, { shape, tessellation: 28, closed: true, cap: 3 }, scene)
  const mat = pbr(scene, { color: pinStyle?.body || colors.pin, rough: 0.32, name: 'pinMat' })
  mat.maxSimultaneousLights = 6
  body.material = mat
  const bands = pinStyle?.bands || [{ y: 0.66, c: colors.pinStripe }, { y: 0.735, c: colors.pinStripe }]
  const stripes = []
  const mats = [mat]
  for (const b of bands) {
    const band = MeshBuilder.CreateTorus('band', { diameter: (pinRadiusAt(b.y) + 0.012) * PIN_H * 2, thickness: 0.018, tessellation: 24 }, scene)
    const bm = pbr(scene, { color: b.c, rough: 0.4, name: 'bandMat' })
    band.material = bm
    band.parent = body
    band.position.y = b.y * PIN_H
    stripes.push(band)
    mats.push(bm)
  }
  return { body, stripes, mats }
}

// One pin: a lathed body whose collider is its convex hull, so the ball meets a
// real pin shape. Dynamic from birth so a hit topples it realistically.
export function makePin(scene, shadow, x, z, colors, pinStyle = null) {
  const { body, stripes, mats } = makePinMesh(scene, colors, 'pin', pinStyle)
  body.position.set(x, 0.001, z)
  shadow.addShadowCaster(body)
  let agg = new PhysicsAggregate(body, PhysicsShapeType.CONVEX_HULL, { mass: 1.5, friction: 0.55, restitution: 0.25 }, scene)
  agg.body.setLinearDamping(0.1)
  agg.body.setAngularDamping(0.2)
  return {
    body,
    home: { x, z },
    // standing = still mostly upright, on the deck, not down in the pit, and
    // not leaning off the lane edge (a pin propped on the gutter lip is down)
    isStanding() {
      const up = Vector3.TransformNormal(Vector3.Up(), body.getWorldMatrix())
      return up.y > 0.8 && body.position.y > -0.4 && body.position.z > PIT_Z && Math.abs(body.position.x) < LANE_W / 2
    },
    // still wobbling/sliding? the count waits for quiet pins
    isMoving() {
      if (!agg) return false
      const v = agg.body.getLinearVelocity()
      const w = agg.body.getAngularVelocity()
      return Math.hypot(v.x, v.y, v.z) > 0.25 || Math.hypot(w.x, w.y, w.z) > 0.6
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
      for (const s of stripes) s.dispose()
      for (const m of mats) m.dispose()
      body.dispose()
    },
  }
}
