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

// Procedural wood grain for the wooden houses, modeled on reclaimed alley
// flooring: MANY narrow boards, each its own tone; staggered butt joints
// where boards meet end-to-end (with a tone break); dense fine grain lines
// running the length; the occasional cathedral arc. Painted once at build.
function woodGrainTexture(scene, baseHex, look = {}) {
  // NOTE the orientation: on the lane's top face, canvas X runs DOWN the
  // lane and canvas Y runs across it — so boards are horizontal rows here.
  // `look` tunes the character: spread = board-to-board contrast, warm = hue
  // drift, seam/grain = line strength. Soft looks (Poolside) blend together.
  const { spread = 0.6, warm: warmRange = 0.26, seam = 0.42, grain = 1 } = look
  const W = 1024
  const H = 512
  const tex = new DynamicTexture('laneWood', { width: W, height: H }, scene, true)
  const ctx = tex.getContext()
  const base = Color3.FromHexString(baseHex)
  // seeded per BUILD — every session (and every house) lays its own floor
  let seed = 1 + Math.floor(Math.random() * 2147483645)
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const shade = (mul, warm) => {
    const r = Math.min(255, Math.max(0, base.r * 255 * mul * (1 + warm)))
    const g = Math.min(255, Math.max(0, base.g * 255 * mul))
    const b = Math.min(255, Math.max(0, base.b * 255 * mul * (1 - warm * 0.8)))
    return [r | 0, g | 0, b | 0]
  }
  const BOARDS = 18
  const bh = H / BOARDS
  for (let b = 0; b < BOARDS; b++) {
    const y0b = b * bh
    // this strip's personality: overall lightness + warmth drift
    const boardMul = 1 - spread / 2 + rnd() * spread
    const boardWarm = (rnd() - 0.5) * warmRange
    // staggered butt joints split the strip into segments, each retoned
    const joints = [0]
    let x = 120 + rnd() * 420
    while (x < W - 80) { joints.push(x | 0); x += 260 + rnd() * 520 }
    joints.push(W)
    for (let s = 0; s < joints.length - 1; s++) {
      const x0 = joints[s]
      const x1 = joints[s + 1]
      const mul = boardMul * (1 - spread * 0.28 + rnd() * spread * 0.56)
      const warm = boardWarm + (rnd() - 0.5) * 0.1
      const [cr, cg, cb] = shade(mul, warm)
      ctx.fillStyle = `rgb(${cr},${cg},${cb})`
      ctx.fillRect(x0, y0b, x1 - x0, bh)
      // dense fine grain: many long streaks running down-lane, lightly wavy
      const lines = 7 + (rnd() * 5 | 0)
      for (let g = 0; g < lines; g++) {
        const dark = rnd() < 0.6
        ctx.strokeStyle = dark ? `rgba(0,0,0,${(0.08 + rnd() * 0.12) * grain})` : `rgba(255,235,200,${(0.06 + rnd() * 0.1) * grain})`
        ctx.lineWidth = rnd() < 0.25 ? 1.6 : 0.9
        const gy = y0b + 2 + rnd() * (bh - 4)
        const amp = 0.6 + rnd() * 1.8
        const ph = rnd() * 6.3
        const wl = 140 + rnd() * 260
        ctx.beginPath()
        ctx.moveTo(x0, gy)
        for (let xx = x0; xx <= x1; xx += 18) {
          const sway = Math.sin((xx / wl) * Math.PI * 2 + ph) * amp
          ctx.lineTo(xx, Math.max(y0b + 1, Math.min(y0b + bh - 1, gy + sway)))
        }
        ctx.stroke()
      }
      // cathedral arcs: nested elongated ellipses, like the reference
      if (rnd() < 0.3 && x1 - x0 > 220) {
        const cy = y0b + bh / 2
        const cx = x0 + 80 + rnd() * (x1 - x0 - 160)
        for (let a = 0; a < 4; a++) {
          ctx.strokeStyle = `rgba(0,0,0,${0.11 - a * 0.02})`
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.ellipse(cx, cy, 26 + a * 22, Math.min(bh / 2 - 2, 4 + a * 4), 0, 0, Math.PI * 2)
          ctx.stroke()
        }
      }
      // butt joint: a dark end-seam where this segment meets the next
      if (x1 < W) {
        ctx.fillStyle = `rgba(0,0,0,${seam})`
        ctx.fillRect(x1 - 1, y0b, 2, bh)
      }
    }
    // long seam between strips
    ctx.fillStyle = `rgba(0,0,0,${seam})`
    ctx.fillRect(0, y0b, W, 1.4)
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
    mirror = new MirrorTexture('laneMirror', { ratio: opts.mirrorRatio || 0.5 }, scene, true)
    mirror.mirrorPlane = new Plane(0, -1, 0, 0)
    mirror.level = 0.4
    laneMat.reflectionTexture = mirror
  } else {
    laneMat = new StandardMaterial('lane', scene)
    laneMat.diffuseColor = Color3.FromHexString(colors.lane)
    laneMat.specularColor = new Color3(0.1, 0.1, 0.12)
  }
  if (opts.wood) {
    // 'soft' (Poolside) keeps the boards sun-bleached and close in tone
    const look = opts.wood === 'soft' ? { spread: 0.2, warm: 0.08, seam: 0.2, grain: 0.65 } : {}
    woodTex = woodGrainTexture(scene, colors.lane, look)
    woodTex.uScale = 4 // canvas X runs down-lane; repeat the pattern 4×
    woodTex.anisotropicFilteringLevel = 8 // grain stays crisp at grazing angles
    laneMat.diffuseTexture = woodTex
    laneMat.diffuseColor = new Color3(1, 1, 1) // the texture carries the tone
  }
  if (opts.ice) {
    // Polar Nights: a polished ice slab — hard bright speculars, hotter mirror
    laneMat.specularColor = new Color3(0.5, 0.56, 0.62)
    laneMat.specularPower = 96
    if (mirror) mirror.level = 0.55
  }
  const gutterMat = pbr(scene, { color: colors.gutter, rough: 0.8, name: 'gutter' })
  const darkMat = pbr(scene, { color: colors.backstop, rough: 0.9, name: 'backstop' })
  for (const m of [laneMat, gutterMat, darkMat]) m.maxSimultaneousLights = 6
  // these never change defines after setup (the lava gutter pulse only writes
  // a color uniform, so even gutterMat is safe to freeze)
  scene.onAfterRenderObservable.addOnce(() => { laneMat.freeze(); darkMat.freeze() })

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
  //  - 'forest' (Timberline): a rustic log gate with lanterns — the view stays
  //    OPEN so the deep forest backdrop (environs) shows through
  //  - 'ducks' (The Midway): a striped shooting-gallery wall with rows of
  //    sliding tin ducks
  //  - 'igloo' (Polar Nights): an igloo with a warm doorway, ice spires around
  //  - 'saloon' (Dry Gulch): a false-front saloon; the batwing doors sway
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
  let pitUpdate = null // animated backers (duck rows, saloon doors) tick here
  if (style === 'masks') buildMaskWall(scene, totalW, track, freeze, meshesOwnMats)
  if (style === 'volcano') buildVolcanoBacker(scene, track, freeze, meshesOwnMats)
  if (style === 'slot') buildSlotBacker(scene, totalW, track, freeze, meshesOwnMats)
  if (style === 'forest') buildForestGate(scene, totalW, track, freeze, meshesOwnMats)
  if (style === 'ducks') pitUpdate = buildDuckGallery(scene, totalW, track, freeze, meshesOwnMats)
  if (style === 'igloo') buildIglooBacker(scene, track, freeze, meshesOwnMats)
  if (style === 'saloon') pitUpdate = buildSaloonBacker(scene, totalW, track, freeze, meshesOwnMats)

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
    pitUpdate,
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
  } else if (style === 'log') {
    // Timberline: a pine log on the chains — bark rings, pale cut ends, rope
    const log = MeshBuilder.CreateCylinder('swLog', { diameter: 0.2, height: W, tessellation: 16 }, scene)
    log.rotation.z = Math.PI / 2
    log.material = litM('#6b4a2a', 0.85)
    add(log)
    const barkMat = litM('#4a3018', 0.95)
    for (let i = 0; i < 4; i++) {
      const ring = MeshBuilder.CreateTorus('swBark', { diameter: 0.205, thickness: 0.022, tessellation: 14 }, scene)
      ring.rotation.z = Math.PI / 2
      ring.material = barkMat
      add(ring, -W / 2 + 0.4 + i * (W - 0.8) / 3)
    }
    const cutMat = litM('#d8b880', 0.7)
    for (const s of [-1, 1]) {
      const cut = MeshBuilder.CreateCylinder('swCut', { diameter: 0.19, height: 0.015, tessellation: 16 }, scene)
      cut.rotation.z = Math.PI / 2
      cut.material = cutMat
      add(cut, s * (W / 2 + 0.005))
    }
    const ropeMat = litM('#8a6a3a', 0.95)
    for (const s of [-1, 1]) {
      const rope = MeshBuilder.CreateTorus('swLogRope', { diameter: 0.23, thickness: 0.03, tessellation: 14 }, scene)
      rope.rotation.z = Math.PI / 2
      rope.material = ropeMat
      add(rope, s * (W / 2 - 0.16))
    }
  } else if (style === 'marquee') {
    // The Midway: a painted marquee bar with a row of chasing lightbulbs
    const bar = MeshBuilder.CreateBox('swMarq', { width: W, height: 0.22, depth: 0.14 }, scene)
    bar.material = litM('#8a1a2a', 0.6)
    add(bar)
    const trim = glowM('#ffd23f', 0.5)
    for (const y of [0.12, -0.12]) {
      const t = MeshBuilder.CreateBox('swTrim', { width: W, height: 0.03, depth: 0.15 }, scene)
      t.material = trim
      add(t, 0, y)
    }
    const on = glowM('#fff0c0', 1.15)
    const off = glowM('#ffd23f', 0.3)
    const bulbs = []
    for (let i = 0; i < 9; i++) {
      const bulb = MeshBuilder.CreateSphere('swBulb', { diameter: 0.055, segments: 10 }, scene)
      bulb.material = i % 2 ? off : on
      add(bulb, -W / 2 + 0.2 + i * (W - 0.4) / 8, 0, 0.08)
      bulbs.push(bulb)
    }
    update = (t) => {
      // the chase: alternating bulbs swap every ~third of a second
      const ph = Math.floor(t / 20) % 2
      for (let i = 0; i < bulbs.length; i++) bulbs[i].material = (i + ph) % 2 ? off : on
    }
  } else if (style === 'icicle') {
    // Polar Nights: a frosted bar with a snow cap and hanging icicles
    const bar = MeshBuilder.CreateBox('swIce', { width: W, height: 0.2, depth: 0.14 }, scene)
    bar.material = litM('#9fc4dc', 0.35)
    add(bar)
    const cap = MeshBuilder.CreateBox('swSnow', { width: W, height: 0.06, depth: 0.16 }, scene)
    cap.material = litM('#f4faff', 0.6)
    add(cap, 0, 0.12)
    const iceMat = litM('#bfe4f5', 0.15)
    iceMat.alpha = 0.85
    const lens = [0.28, 0.14, 0.22, 0.32, 0.16, 0.26, 0.12]
    lens.forEach((L, i) => {
      const ic = MeshBuilder.CreateCylinder('swIcicle', { diameterTop: 0.05, diameterBottom: 0, height: L, tessellation: 8 }, scene)
      ic.material = iceMat
      add(ic, -W / 2 + 0.25 + i * (W - 0.5) / 6, -0.1 - L / 2)
    })
    const glintMat = glowM('#eaf8ff', 0.8)
    for (const gx of [-W * 0.28, W * 0.31]) {
      const g = MeshBuilder.CreateSphere('swGlint', { diameter: 0.035, segments: 8 }, scene)
      g.material = glintMat
      add(g, gx, 0.14, 0.06)
    }
  } else if (style === 'lasso') {
    // Dry Gulch: a taut rope with whipped ends and a lazy loop swinging below
    const rope = MeshBuilder.CreateCapsule('swRope', { radius: 0.055, height: W, orientation: new Vector3(1, 0, 0), tessellation: 14, capSubdivisions: 5 }, scene)
    rope.material = litM('#c8a05a', 0.9)
    add(rope)
    const wrapMat = litM('#8a6a3a', 0.95)
    for (let i = 0; i < 5; i++) {
      const wrap = MeshBuilder.CreateTorus('swWrap', { diameter: 0.13, thickness: 0.025, tessellation: 12 }, scene)
      wrap.rotation.z = Math.PI / 2
      wrap.material = wrapMat
      add(wrap, -W / 2 + 0.35 + i * (W - 0.7) / 4)
    }
    for (const s of [-1, 1]) {
      const coil = MeshBuilder.CreateTorus('swCoil', { diameter: 0.22, thickness: 0.05, tessellation: 14 }, scene)
      coil.rotation.z = Math.PI / 2
      coil.material = wrapMat
      add(coil, s * (W / 2 - 0.08))
    }
    const loop = MeshBuilder.CreateTorus('swLoop', { diameter: 0.5, thickness: 0.035, tessellation: 18 }, scene)
    loop.material = rope.material
    add(loop, 0.3, -0.32)
    loop.rotation.x = 0.25
    update = (t) => {
      loop.rotation.x = 0.25 + Math.sin(t * 0.02) * 0.12
      loop.position.x = 0.3 + Math.sin(t * 0.013) * 0.08
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

// Tiki Grove: a bamboo pole strung with carved bar masks. The tiki look is a
// 2D design language — pointed eye-masks, huge lip rings with triangle teeth,
// zig-zag crowns — so each mask is PAINTED: its features are traced from the
// reference as canvas components, randomized and combined per session, then
// hung on a thin wooden board (alpha texture carries the silhouette).
function roundedRect(ctx, x, y, w, h, rTop, rBot) {
  ctx.beginPath()
  ctx.moveTo(x + rTop, y)
  ctx.lineTo(x + w - rTop, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + rTop)
  ctx.lineTo(x + w, y + h - rBot)
  ctx.quadraticCurveTo(x + w, y + h, x + w - rBot, y + h)
  ctx.lineTo(x + rBot, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - rBot)
  ctx.lineTo(x, y + rTop)
  ctx.quadraticCurveTo(x, y, x + rTop, y)
  ctx.closePath()
}

function drawTikiMask(ctx, W, H, rnd) {
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)]
  const WOODS = ['#8a5a2a', '#75502e', '#6b4423']
  const WARM = ['#d8302a', '#e8722a', '#f0b62a']
  const GREENS = ['#3f8a4a', '#6aa84f']
  const CREAM = '#f6ecd8'
  const DARK = '#2a1608'
  const wood = pick(WOODS)
  const accentA = pick(WARM)
  let accentB = pick(WARM)
  if (accentB === accentA) accentB = pick(GREENS)
  const cx = W / 2
  const bx = 40, bw = W - 80
  const bTop = 92, bBot = H - 8
  ctx.clearRect(0, 0, W, H)
  ctx.lineJoin = 'round'

  // ---- ears (some masks): round bumps behind the board edges ----
  if (rnd() < 0.4) {
    ctx.fillStyle = wood
    ctx.strokeStyle = DARK
    ctx.lineWidth = 5
    for (const sd of [-1, 1]) {
      ctx.beginPath()
      ctx.ellipse(cx + sd * (bw / 2 + 4), bTop + 110, 22, 34, 0, 0, Math.PI * 2)
      ctx.fill(); ctx.stroke()
    }
  }

  // ---- the board: tombstone silhouette, wood grain, carved outline ----
  ctx.fillStyle = wood
  ctx.strokeStyle = DARK
  ctx.lineWidth = 6
  roundedRect(ctx, bx, bTop, bw, bBot - bTop, 60 + rnd() * 24, 18)
  ctx.fill(); ctx.stroke()
  ctx.save()
  ctx.clip() // grain stays inside the board
  ctx.strokeStyle = 'rgba(0,0,0,0.14)'
  ctx.lineWidth = 2
  for (let g = 0; g < 7; g++) {
    const gx = bx + 14 + g * (bw - 24) / 6 + rnd() * 6
    ctx.beginPath()
    ctx.moveTo(gx, bTop)
    ctx.quadraticCurveTo(gx + (rnd() - 0.5) * 22, (bTop + bBot) / 2, gx + (rnd() - 0.5) * 10, bBot)
    ctx.stroke()
  }
  ctx.restore()

  // ---- headdress: zig-zag crown / palm spikes / leaf fan / flower ----
  const hv = rnd()
  if (hv < 0.35) {
    // zig-zag crown of triangles across the board top
    const n = 7
    for (let i = 0; i < n; i++) {
      const x0 = bx + 8 + i * (bw - 16) / n
      const x1 = bx + 8 + (i + 1) * (bw - 16) / n
      ctx.fillStyle = [accentA, accentB, pick(WARM)][i % 3]
      ctx.strokeStyle = DARK
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.moveTo(x0, bTop + 12)
      ctx.lineTo((x0 + x1) / 2, bTop - 54 - rnd() * 14)
      ctx.lineTo(x1, bTop + 12)
      ctx.closePath()
      ctx.fill(); ctx.stroke()
    }
  } else if (hv < 0.65) {
    // radiating palm spikes
    const n = 9
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.3
      ctx.fillStyle = i % 2 ? pick(GREENS) : '#8fbf4f'
      ctx.strokeStyle = DARK
      ctx.lineWidth = 3.5
      const len = 58 + (1 - Math.abs(i - (n - 1) / 2) / n) * 26
      const tx = cx + Math.cos(a) * len
      const ty = bTop + 6 + Math.sin(a) * len
      ctx.beginPath()
      ctx.moveTo(cx - 10, bTop + 10)
      ctx.lineTo(tx, ty)
      ctx.lineTo(cx + 10, bTop + 10)
      ctx.closePath()
      ctx.fill(); ctx.stroke()
    }
  } else if (hv < 0.85) {
    // fat leaf fan
    for (let i = -2; i <= 2; i++) {
      ctx.fillStyle = pick(GREENS)
      ctx.strokeStyle = DARK
      ctx.lineWidth = 4
      ctx.save()
      ctx.translate(cx + i * 26, bTop + 4)
      ctx.rotate(i * 0.42)
      ctx.beginPath()
      ctx.ellipse(0, -36, 15, 40, 0, 0, Math.PI * 2)
      ctx.fill(); ctx.stroke()
      ctx.restore()
    }
  } else {
    // hibiscus flower
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      ctx.fillStyle = pick(['#e86aa8', '#d8302a', '#e8722a'])
      ctx.strokeStyle = DARK
      ctx.lineWidth = 3.5
      ctx.save()
      ctx.translate(cx + Math.sin(a) * 26, bTop - 26 + Math.cos(a) * 26)
      ctx.rotate(-a)
      ctx.beginPath()
      ctx.ellipse(0, 0, 13, 20, 0, 0, Math.PI * 2)
      ctx.fill(); ctx.stroke()
      ctx.restore()
    }
    ctx.fillStyle = '#f0b62a'
    ctx.beginPath()
    ctx.arc(cx, bTop - 26, 12, 0, Math.PI * 2)
    ctx.fill(); ctx.stroke()
  }

  // ---- the signature eye-mask: winged shape with pointed outer corners ----
  const eyeY = bTop + 96
  ctx.fillStyle = accentA
  ctx.strokeStyle = DARK
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.moveTo(bx - 6, eyeY + 26) // pointed outer left
  ctx.quadraticCurveTo(bx + 16, eyeY - 44, cx - 24, eyeY - 34)
  ctx.quadraticCurveTo(cx, eyeY - 20, cx + 24, eyeY - 34) // brow dip
  ctx.quadraticCurveTo(bx + bw - 16, eyeY - 44, bx + bw + 6, eyeY + 26)
  ctx.quadraticCurveTo(cx + 50, eyeY + 34, cx, eyeY + 22)
  ctx.quadraticCurveTo(cx - 50, eyeY + 34, bx - 6, eyeY + 26)
  ctx.closePath()
  ctx.fill(); ctx.stroke()
  // eyes: big cream almonds with a dark or glowing pupil (some squint)
  const squint = rnd() < 0.3
  for (const sd of [-1, 1]) {
    ctx.fillStyle = CREAM
    ctx.strokeStyle = DARK
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.ellipse(cx + sd * 46, eyeY - 2, 30, squint ? 12 : 21, 0, 0, Math.PI * 2)
    ctx.fill(); ctx.stroke()
    if (!squint) {
      ctx.fillStyle = rnd() < 0.5 ? DARK : '#f7a72e'
      ctx.beginPath()
      ctx.arc(cx + sd * 46, eyeY - 2, 8.5, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // ---- nose: rounded wedge with nostrils ----
  const noseY = eyeY + 52
  ctx.fillStyle = rnd() < 0.5 ? accentB : wood
  ctx.strokeStyle = DARK
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.moveTo(cx, noseY - 26)
  ctx.quadraticCurveTo(cx + 22, noseY + 10, cx + 12, noseY + 16)
  ctx.quadraticCurveTo(cx, noseY + 22, cx - 12, noseY + 16)
  ctx.quadraticCurveTo(cx - 22, noseY + 10, cx, noseY - 26)
  ctx.closePath()
  ctx.fill(); ctx.stroke()

  // ---- the mouth: a huge lip ring full of triangle teeth ----
  const mTop = noseY + 34
  const mH = 86 + rnd() * 18
  const mX = bx + 22, mW = bw - 44
  const lipC = pick(['#d8302a', accentA])
  ctx.fillStyle = lipC
  ctx.strokeStyle = DARK
  ctx.lineWidth = 6
  roundedRect(ctx, mX, mTop, mW, mH, 30, 30)
  ctx.fill(); ctx.stroke()
  // the slot
  const sX = mX + 18, sW = mW - 36, sTop = mTop + 20, sH = mH - 40
  ctx.fillStyle = CREAM
  roundedRect(ctx, sX, sTop, sW, sH, 14, 14)
  ctx.fill()
  ctx.save()
  ctx.clip()
  // teeth: lip-colored triangles biting into the cream from both edges
  const nT = 4 + Math.floor(rnd() * 2)
  ctx.fillStyle = lipC
  for (let t = 0; t <= nT; t++) {
    const x0 = sX + t * (sW / nT) - sW / nT / 2
    ctx.beginPath()
    ctx.moveTo(x0, sTop - 1)
    ctx.lineTo(x0 + sW / nT, sTop - 1)
    ctx.lineTo(x0 + sW / nT / 2, sTop + sH * 0.42)
    ctx.closePath()
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(x0 + sW / nT / 2, sTop + sH + 1)
    ctx.lineTo(x0 + sW / nT * 1.5, sTop + sH + 1)
    ctx.lineTo(x0 + sW / nT, sTop + sH * 0.58)
    ctx.closePath()
    ctx.fill()
  }
  // some mouths loll a tongue over the bottom lip
  if (rnd() < 0.35) {
    ctx.fillStyle = '#c22a3a'
    ctx.strokeStyle = DARK
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.ellipse(cx + (rnd() - 0.5) * 30, sTop + sH, 26, 34, 0, 0, Math.PI * 2)
    ctx.fill(); ctx.stroke()
  }
  ctx.restore()

  // ---- chin: painted leaves or stripes under the mouth ----
  const chinY = mTop + mH + 4
  if (chinY < bBot - 20) {
    if (rnd() < 0.5) {
      for (let i = -1; i <= 1; i++) {
        ctx.fillStyle = pick(GREENS)
        ctx.strokeStyle = DARK
        ctx.lineWidth = 3.5
        ctx.save()
        ctx.translate(cx + i * 34, chinY + 16)
        ctx.rotate(i * 0.5 + Math.PI)
        ctx.beginPath()
        ctx.ellipse(0, -12, 11, 20, 0, 0, Math.PI * 2)
        ctx.fill(); ctx.stroke()
        ctx.restore()
      }
    } else {
      ctx.fillStyle = accentB
      ctx.strokeStyle = DARK
      ctx.lineWidth = 4
      roundedRect(ctx, bx + 20, chinY, bw - 40, 16, 8, 8)
      ctx.fill(); ctx.stroke()
    }
  }
}

function buildMaskWall(scene, totalW, track, freeze, mats) {
  const bambooMat = new StandardMaterial('bambooMat', scene)
  bambooMat.diffuseColor = Color3.FromHexString('#a8834a')
  bambooMat.specularColor = new Color3(0.08, 0.08, 0.06)
  mats.push(bambooMat)
  const pole = MeshBuilder.CreateCylinder('maskPole', { diameter: 0.09, height: totalW, tessellation: 12 }, scene)
  pole.rotation.z = Math.PI / 2
  pole.position.set(0, 2.16, DECK_END - 0.2)
  pole.material = bambooMat
  track(freeze(pole))
  const ropeBits = []
  const xs = [-1.5, -0.5, 0.5, 1.5]
  for (const mx of xs) {
    const rope = MeshBuilder.CreateCylinder('mRope', { diameter: 0.025, height: 0.3, tessellation: 6 }, scene)
    rope.position.set(mx, 1.98, DECK_END - 0.22)
    ropeBits.push(rope)
    // the painted plaque: alpha texture carries the whole traced design
    const tex = new DynamicTexture('maskTex', { width: 256, height: 416 }, scene, true)
    tex.hasAlpha = true
    drawTikiMask(tex.getContext(), 256, 416, Math.random)
    tex.update()
    tex.anisotropicFilteringLevel = 8
    const mat = new StandardMaterial('maskMat', scene)
    mat.diffuseTexture = tex
    mat.useAlphaFromDiffuseTexture = true
    mat.emissiveColor = new Color3(0.34, 0.3, 0.26) // torchlit even at dusk
    mat.specularColor = new Color3(0.03, 0.03, 0.02)
    mat.maxSimultaneousLights = 6
    mats.push(mat)
    const plane = MeshBuilder.CreatePlane('maskPlane', { width: 0.62, height: 1.0, sideOrientation: Mesh.DOUBLESIDE }, scene)
    plane.material = mat
    plane.position.set(mx, 1.32, DECK_END - 0.24)
    plane.isPickable = false
    track(freeze(plane))
    // a slim wooden backing so the plaque reads as carved, not paper
    const back = MeshBuilder.CreateBox('maskBack', { width: 0.46, height: 0.78, depth: 0.05 }, scene)
    back.position.set(mx, 1.28, DECK_END - 0.28)
    back.material = bambooMat
    back.isPickable = false
    track(freeze(back))
  }
  const ropes = Mesh.MergeMeshes(ropeBits, true, true)
  const ropeMat = new StandardMaterial('ropeMat', scene)
  ropeMat.diffuseColor = Color3.FromHexString('#5f3d1c')
  mats.push(ropeMat)
  ropes.material = ropeMat
  ropes.isPickable = false
  track(freeze(ropes))
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

// Timberline: a rustic log gate framing the pit — the view through it stays
// open so the deep forest backdrop reads. Two posts, a crossbeam, rope
// lashings, and a pair of warm lanterns hanging from the beam.
function buildForestGate(scene, totalW, track, freeze, mats) {
  const woodMat = new StandardMaterial('gateWood', scene)
  woodMat.diffuseColor = Color3.FromHexString('#5a4028')
  woodMat.specularColor = new Color3(0.05, 0.05, 0.04)
  mats.push(woodMat)
  for (const side of [-1, 1]) {
    const post = MeshBuilder.CreateCylinder('gatePost', { diameter: 0.17, height: 2.25, tessellation: 12 }, scene)
    post.position.set(side * (totalW / 2 - 0.12), 1.125, DECK_END - 0.2)
    post.material = woodMat
    track(freeze(post))
  }
  const beam = MeshBuilder.CreateCylinder('gateBeam', { diameter: 0.19, height: totalW + 0.3, tessellation: 12 }, scene)
  beam.rotation.z = Math.PI / 2
  beam.position.set(0, 2.28, DECK_END - 0.2)
  beam.material = woodMat
  track(freeze(beam))
  const ropeMat = new StandardMaterial('gateRope', scene)
  ropeMat.diffuseColor = Color3.FromHexString('#8a6a3a')
  mats.push(ropeMat)
  for (const side of [-1, 1]) {
    const lash = MeshBuilder.CreateTorus('gateLash', { diameter: 0.24, thickness: 0.035, tessellation: 12 }, scene)
    lash.rotation.z = Math.PI / 2
    lash.position.set(side * (totalW / 2 - 0.12), 2.28, DECK_END - 0.2)
    lash.material = ropeMat
    track(freeze(lash))
  }
  // lanterns: warm glowing orbs on short straps under the beam
  const strapMat = new StandardMaterial('lampStrap', scene)
  strapMat.diffuseColor = Color3.FromHexString('#2e2418')
  mats.push(strapMat)
  const glow = new StandardMaterial('lampGlow', scene)
  glow.emissiveColor = Color3.FromHexString('#ffb46a').scale(0.95)
  glow.disableLighting = true
  mats.push(glow)
  for (const lx of [-1.15, 1.15]) {
    const strap = MeshBuilder.CreateCylinder('lampS', { diameter: 0.02, height: 0.22, tessellation: 6 }, scene)
    strap.position.set(lx, 2.1, DECK_END - 0.2)
    strap.material = strapMat
    track(freeze(strap))
    const lamp = MeshBuilder.CreateSphere('lamp', { diameter: 0.13, segments: 12 }, scene)
    lamp.position.set(lx, 1.93, DECK_END - 0.2)
    lamp.material = glow
    track(freeze(lamp))
  }
}

// The Midway: a shooting-gallery backer — striped canvas wall, pennant row on
// top, and two chains of tin ducks gliding in opposite directions. Returns the
// update that drives the ducks.
function buildDuckGallery(scene, totalW, track, freeze, mats) {
  const zWall = DECK_END - 1.5
  const stripeA = new StandardMaterial('galStripeA', scene)
  stripeA.diffuseColor = Color3.FromHexString('#c8303a')
  stripeA.specularColor = new Color3(0.04, 0.04, 0.04)
  const stripeB = new StandardMaterial('galStripeB', scene)
  stripeB.diffuseColor = Color3.FromHexString('#f2e8d0')
  stripeB.specularColor = new Color3(0.04, 0.04, 0.04)
  mats.push(stripeA, stripeB)
  const N = 8
  const sw = (totalW + 0.4) / N
  const bitsA = []
  const bitsB = []
  for (let i = 0; i < N; i++) {
    const s = MeshBuilder.CreateBox('galStripe', { width: sw, height: 1.95, depth: 0.1 }, scene)
    s.position.set(-(totalW + 0.4) / 2 + sw / 2 + i * sw, 1.72, zWall)
    ;(i % 2 ? bitsB : bitsA).push(s)
  }
  for (const [bits, m] of [[bitsA, stripeA], [bitsB, stripeB]]) {
    const merged = Mesh.MergeMeshes(bits, true, true)
    merged.material = m
    merged.isPickable = false
    track(freeze(merged))
  }
  // dark under-counter mouth: the ball vanishes beneath the gallery
  const mouthMat = new StandardMaterial('galMouth', scene)
  mouthMat.diffuseColor = new Color3(0, 0, 0)
  mouthMat.specularColor = new Color3(0, 0, 0)
  mouthMat.disableLighting = true
  mats.push(mouthMat)
  const mouth = MeshBuilder.CreateBox('galMouthP', { width: totalW + 0.4, height: 0.85, depth: 0.08 }, scene)
  mouth.position.set(0, 0.33, zWall + 0.02)
  mouth.material = mouthMat
  track(freeze(mouth))
  // counter lip in gold
  const gold = new StandardMaterial('galGold', scene)
  gold.emissiveColor = Color3.FromHexString('#ffd23f').scale(0.7)
  gold.disableLighting = true
  mats.push(gold)
  const lip = MeshBuilder.CreateBox('galLip', { width: totalW + 0.4, height: 0.06, depth: 0.12 }, scene)
  lip.position.set(0, 0.76, zWall + 0.03)
  lip.material = gold
  track(freeze(lip))
  // pennant valance along the top
  const pennCols = [stripeA, gold]
  for (let i = 0; i < 9; i++) {
    const p = MeshBuilder.CreateCylinder('galPenn', { diameterTop: 0.26, diameterBottom: 0, height: 0.3, tessellation: 3 }, scene)
    p.scaling.z = 0.15
    p.position.set(-(totalW + 0.4) / 2 + 0.26 + i * (totalW - 0.1) / 8, 2.55, zWall + 0.08)
    p.material = pennCols[i % 2]
    p.isPickable = false
    track(freeze(p))
  }
  // star decals scattered on the canvas
  const starMat = new StandardMaterial('galStar', scene)
  starMat.emissiveColor = Color3.FromHexString('#ffe9a0').scale(0.55)
  starMat.disableLighting = true
  mats.push(starMat)
  for (const [sx, sy] of [[-1.7, 2.2], [-0.6, 2.35], [0.9, 2.25], [1.8, 2.1]]) {
    const st = MeshBuilder.CreateBox('galStarB', { width: 0.09, height: 0.09, depth: 0.02 }, scene)
    st.position.set(sx, sy, zWall + 0.06)
    st.rotation.z = Math.PI / 4
    st.material = starMat
    track(freeze(st))
  }
  // the duck rows: rails + tin ducks that slide, wrap, and fade at the edges
  const railMat = new StandardMaterial('galRail', scene)
  railMat.diffuseColor = Color3.FromHexString('#2a1a20')
  mats.push(railMat)
  for (const ry of [1.06, 1.66]) {
    const rail = MeshBuilder.CreateBox('galRailB', { width: totalW + 0.2, height: 0.035, depth: 0.05 }, scene)
    rail.position.set(0, ry, zWall + 0.09)
    rail.material = railMat
    track(freeze(rail))
  }
  const duckMat = new StandardMaterial('galDuck', scene)
  duckMat.diffuseColor = Color3.FromHexString('#ffd23f')
  duckMat.specularColor = new Color3(0.2, 0.18, 0.08)
  const beakMat = new StandardMaterial('galBeak', scene)
  beakMat.diffuseColor = Color3.FromHexString('#ff8a3a')
  mats.push(duckMat, beakMat)
  const half = totalW / 2 - 0.1
  const ducks = []
  const makeDuck = (x, y, dir, speed) => {
    const bits = []
    const body = MeshBuilder.CreateSphere('gd', { diameterX: 0.3, diameterY: 0.22, diameterZ: 0.14, segments: 12 }, scene)
    bits.push(body)
    const head = MeshBuilder.CreateSphere('gdh', { diameter: 0.14, segments: 10 }, scene)
    head.position.set(dir * 0.12, 0.14, 0)
    bits.push(head)
    const tail = MeshBuilder.CreateSphere('gdt', { diameterX: 0.1, diameterY: 0.12, diameterZ: 0.08, segments: 8 }, scene)
    tail.position.set(-dir * 0.14, 0.06, 0)
    bits.push(tail)
    const duck = Mesh.MergeMeshes(bits, true, true)
    duck.material = duckMat
    duck.isPickable = false
    const beak = MeshBuilder.CreateCylinder('gdb', { diameterTop: 0, diameterBottom: 0.05, height: 0.08, tessellation: 8 }, scene)
    beak.rotation.z = -dir * Math.PI / 2
    beak.position.set(dir * 0.21, 0.14, 0)
    beak.material = beakMat
    beak.isPickable = false
    beak.parent = duck
    duck.position.set(x, y, zWall + 0.12)
    track(duck)
    ducks.push({ duck, x, y, dir, speed })
  }
  makeDuck(-1.4, 1.12, 1, 0.011)
  makeDuck(0, 1.12, 1, 0.011)
  makeDuck(1.4, 1.12, 1, 0.011)
  makeDuck(-0.8, 1.72, -1, 0.008)
  makeDuck(0.9, 1.72, -1, 0.008)
  return (t) => {
    for (const d of ducks) {
      let x = d.x + d.dir * d.speed * t
      // wrap into the wall span; fade in/out at the edges like a real gallery
      x = ((x + half) % (2 * half) + 2 * half) % (2 * half) - half
      d.duck.position.x = x
      d.duck.position.y = d.y + Math.sin(t * 0.06 + d.x * 3) * 0.015 // chain rattle
      const edge = Math.min(half - Math.abs(x), 0.35) / 0.35
      d.duck.visibility = Math.max(0, edge)
    }
  }
}

// Polar Nights: an igloo hunkered behind the deck — warm doorway, block seams,
// ice spires and snow mounds flanking it.
function buildIglooBacker(scene, track, freeze, mats) {
  const iceMat = new StandardMaterial('igIce', scene)
  iceMat.diffuseColor = Color3.FromHexString('#cfe4f0')
  iceMat.specularColor = new Color3(0.25, 0.28, 0.32)
  mats.push(iceMat)
  const dome = MeshBuilder.CreateSphere('igDome', { diameter: 3.8, segments: 20, slice: 0.52 }, scene)
  dome.scaling.y = 0.72
  dome.position.set(0.5, 0, DECK_END - 3.6)
  dome.material = iceMat
  track(freeze(dome))
  // block seams: darker rings around the dome
  const seamMat = new StandardMaterial('igSeam', scene)
  seamMat.diffuseColor = Color3.FromHexString('#a8c4d8')
  mats.push(seamMat)
  for (const [sy, sd] of [[0.5, 3.42], [0.95, 2.6]]) {
    const seam = MeshBuilder.CreateTorus('igSeamT', { diameter: sd, thickness: 0.035, tessellation: 28 }, scene)
    seam.position.set(0.5, sy, DECK_END - 3.6)
    seam.material = seamMat
    track(freeze(seam))
  }
  // the entrance tunnel, glowing warm from the inside
  const tun = MeshBuilder.CreateSphere('igTun', { diameter: 1.15, segments: 14, slice: 0.55 }, scene)
  tun.scaling.z = 1.5
  tun.position.set(0.2, 0, DECK_END - 2.2)
  tun.material = iceMat
  track(freeze(tun))
  const warm = new StandardMaterial('igWarm', scene)
  warm.emissiveColor = Color3.FromHexString('#ffb46a').scale(0.9)
  warm.disableLighting = true
  mats.push(warm)
  const door = MeshBuilder.CreateCylinder('igDoor', { diameter: 0.5, height: 0.04, tessellation: 18 }, scene)
  door.rotation.x = Math.PI / 2
  door.position.set(0.2, 0.28, DECK_END - 1.75)
  door.material = warm
  track(freeze(door))
  // flanking ice spires + snow mounds
  const spireMat = new StandardMaterial('igSpire', scene)
  spireMat.diffuseColor = Color3.FromHexString('#9ac8e8')
  spireMat.specularColor = new Color3(0.3, 0.34, 0.38)
  spireMat.alpha = 0.92
  mats.push(spireMat)
  for (const [px, pz, h] of [[-2.4, -1.6, 1.9], [-2.9, -2.6, 1.3], [2.6, -1.9, 2.2], [3.1, -3, 1.4]]) {
    const sp = MeshBuilder.CreateCylinder('igSpireC', { diameterTop: 0, diameterBottom: 0.55, height: h, tessellation: 6 }, scene)
    sp.position.set(px, h / 2, DECK_END + pz)
    sp.rotation.y = px * 1.7
    sp.material = spireMat
    track(freeze(sp))
  }
  const snowMat = new StandardMaterial('igSnow', scene)
  snowMat.diffuseColor = Color3.FromHexString('#eef6fc')
  mats.push(snowMat)
  for (const [mx, mz, s] of [[-1.9, -2.8, 1.2], [2.2, -3.4, 1.5], [0.4, -4.6, 2.2]]) {
    const mound = MeshBuilder.CreateSphere('igMound', { diameterX: s * 1.6, diameterY: s * 0.5, diameterZ: s, segments: 10 }, scene)
    mound.position.set(mx, 0.05, DECK_END + mz)
    mound.material = snowMat
    track(freeze(mound))
  }
}

// Dry Gulch: a false-front saloon. Wood facade with warm windows, a painted
// SALOON sign on the parapet, and batwing doors that never stop swinging.
// Returns the update that sways the doors.
function buildSaloonBacker(scene, totalW, track, freeze, mats) {
  const zWall = DECK_END - 0.9
  const wood = new StandardMaterial('salWood', scene)
  wood.diffuseColor = Color3.FromHexString('#4a2f1a')
  wood.specularColor = new Color3(0.05, 0.04, 0.03)
  mats.push(wood)
  const doorW = 1.3
  const panelW = (totalW + 0.4 - doorW) / 2
  for (const side of [-1, 1]) {
    const panel = MeshBuilder.CreateBox('salPanel', { width: panelW, height: 1.66, depth: 0.12 }, scene)
    panel.position.set(side * (doorW / 2 + panelW / 2), 1.55, zWall)
    panel.material = wood
    track(freeze(panel))
  }
  const header = MeshBuilder.CreateBox('salHeader', { width: doorW + 0.2, height: 0.55, depth: 0.12 }, scene)
  header.position.set(0, 2.1, zWall)
  header.material = wood
  track(freeze(header))
  // false-front parapet + sign board
  const parapet = MeshBuilder.CreateBox('salTop', { width: totalW + 0.6, height: 0.5, depth: 0.14 }, scene)
  parapet.position.set(0, 2.62, zWall)
  parapet.material = wood
  track(freeze(parapet))
  const signTex = new DynamicTexture('salSign', { width: 512, height: 128 }, scene, true)
  const ctx = signTex.getContext()
  ctx.fillStyle = '#2e1c0e'
  ctx.fillRect(0, 0, 512, 128)
  ctx.strokeStyle = '#ffd9a0'
  ctx.lineWidth = 8
  ctx.strokeRect(10, 10, 492, 108)
  ctx.fillStyle = '#ffd9a0'
  ctx.font = 'bold 84px Georgia, serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('SALOON', 256, 70)
  signTex.update()
  const signMat = new StandardMaterial('salSignM', scene)
  signMat.diffuseTexture = signTex
  signMat.emissiveColor = new Color3(0.5, 0.42, 0.3) // lamplit even at dusk
  signMat.specularColor = new Color3(0.03, 0.03, 0.02)
  mats.push(signMat)
  const sign = MeshBuilder.CreatePlane('salSignP', { width: 2.3, height: 0.575 }, scene)
  sign.position.set(0, 2.62, zWall + 0.08)
  sign.material = signMat
  sign.isPickable = false
  track(freeze(sign))
  // warm windows on the panels
  const warm = new StandardMaterial('salWarm', scene)
  warm.emissiveColor = Color3.FromHexString('#ffca6a').scale(0.75)
  warm.disableLighting = true
  mats.push(warm)
  for (const side of [-1, 1]) {
    const win = MeshBuilder.CreateBox('salWin', { width: 0.5, height: 0.6, depth: 0.04 }, scene)
    win.position.set(side * (doorW / 2 + panelW / 2), 1.62, zWall + 0.06)
    win.material = warm
    track(freeze(win))
    const bar = MeshBuilder.CreateBox('salWinBar', { width: 0.52, height: 0.05, depth: 0.05 }, scene)
    bar.position.set(side * (doorW / 2 + panelW / 2), 1.62, zWall + 0.07)
    bar.material = wood
    track(freeze(bar))
  }
  // the mouth below the facade — the dark space the ball rolls into
  const mouthMat = new StandardMaterial('salMouth', scene)
  mouthMat.diffuseColor = new Color3(0, 0, 0)
  mouthMat.specularColor = new Color3(0, 0, 0)
  mouthMat.disableLighting = true
  mats.push(mouthMat)
  const mouth = MeshBuilder.CreateBox('salMouthP', { width: totalW + 0.4, height: 0.78, depth: 0.08 }, scene)
  mouth.position.set(0, 0.34, zWall + 0.02)
  mouth.material = mouthMat
  track(freeze(mouth))
  // batwing doors on hinge pivots, swinging forever in the desert wind
  const doorMat = new StandardMaterial('salDoor', scene)
  doorMat.diffuseColor = Color3.FromHexString('#6b4423')
  doorMat.specularColor = new Color3(0.06, 0.05, 0.04)
  mats.push(doorMat)
  const pivots = []
  for (const side of [-1, 1]) {
    const pivot = MeshBuilder.CreateBox('salHinge', { size: 0.02 }, scene)
    pivot.isVisible = false
    pivot.position.set(side * (doorW / 2), 1.3, zWall + 0.05)
    track(pivot)
    const door = MeshBuilder.CreateBox('salDoorP', { width: doorW / 2 - 0.06, height: 0.62, depth: 0.03 }, scene)
    door.position.set(-side * (doorW / 4 - 0.02), 0, 0)
    door.material = doorMat
    door.isPickable = false
    door.parent = pivot
    track(door)
    // slat lines carved into each door
    for (const sy of [-0.18, 0, 0.18]) {
      const slat = MeshBuilder.CreateBox('salSlat', { width: doorW / 2 - 0.1, height: 0.02, depth: 0.035 }, scene)
      slat.position.set(-side * (doorW / 4 - 0.02), sy, 0)
      slat.material = wood
      slat.isPickable = false
      slat.parent = pivot
      track(slat)
    }
    pivots.push({ pivot, side })
  }
  return (t) => {
    for (const { pivot, side } of pivots) {
      pivot.rotation.y = side * (0.2 + Math.sin(t * 0.021 + side) * 0.16)
    }
  }
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

// One set of pin materials — build once per game and share across every rack
// so re-racking ten pins per frame stops churning materials.
export function makePinMats(scene, colors, pinStyle = null) {
  const body = pbr(scene, { color: pinStyle?.body || colors.pin, rough: 0.32, name: 'pinMat' })
  body.maxSimultaneousLights = 6
  const bandDefs = pinStyle?.bands || [{ y: 0.66, c: colors.pinStripe }, { y: 0.735, c: colors.pinStripe }]
  const bands = bandDefs.map((b) => {
    const m = pbr(scene, { color: b.c, rough: 0.4, name: 'bandMat' })
    m.maxSimultaneousLights = 6
    return m
  })
  return { body, bands, bandDefs, dispose() { body.dispose(); for (const m of bands) m.dispose() } }
}

// The bare pin visual (lathed body + themed bands) — shared by the real physics
// pins and the ghost pins on the neighbor lanes. `pinStyle` comes from the
// alley: { body: hex, bands: [{ y, c }] }. Pass `shared` (from makePinMats) to
// reuse materials; the pin then never disposes them.
export function makePinMesh(scene, colors, name = 'pin', pinStyle = null, shared = null) {
  const shape = PIN_PROFILE.map(([r, y]) => new Vector3(r * PIN_H, y * PIN_H, 0))
  const body = MeshBuilder.CreateLathe(name, { shape, tessellation: 28, closed: true, cap: 3 }, scene)
  const pm = shared || makePinMats(scene, colors, pinStyle)
  body.material = pm.body
  const stripes = []
  pm.bandDefs.forEach((b, i) => {
    const band = MeshBuilder.CreateTorus('band', { diameter: (pinRadiusAt(b.y) + 0.012) * PIN_H * 2, thickness: 0.018, tessellation: 24 }, scene)
    band.material = pm.bands[i]
    band.parent = body
    band.position.y = b.y * PIN_H
    stripes.push(band)
  })
  // only own what we created — shared materials outlive the pin
  return { body, stripes, mats: shared ? [] : [pm.body, ...pm.bands] }
}

// One pin: a lathed body whose collider is its convex hull, so the ball meets a
// real pin shape. Dynamic from birth so a hit topples it realistically.
export function makePin(scene, shadow, x, z, colors, pinStyle = null, sharedMats = null) {
  const { body, stripes, mats } = makePinMesh(scene, colors, 'pin', pinStyle, sharedMats)
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
