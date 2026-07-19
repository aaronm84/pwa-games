// The pond's plant life, grown procedurally around one primitive: the
// curved RIBBON — a tapering strip of quads following a droop curve. Blades
// arch out and sag at the tip, leaves cup and curl, and nothing is a stiff
// cylinder. Grass tufts get true per-vertex sway (bend grows quadratically
// toward the tip, each blade on its own phase, pushed harder when a
// wavefront passes) — floppy, not hinged.
//
// Species, from the reference photos: grass tufts with drooping broad
// leaves, water-lettuce rosettes of ribbed fan leaves, and water hyacinth —
// rounded paddle leaves around a violet bloom spike.
import { Mesh, MeshBuilder, VertexData, Color3, pbr } from 'src/engine'
import { surfaceHeight, ripplePower } from './waves.js'

// quadratic bezier
function bez(p0, p1, p2, t) {
  const u = 1 - t
  return u * u * p0 + 2 * u * t * p1 + t * t * p2
}

// Append one ribbon to the arrays. The spine runs from the base outward
// along `dir` (unit xz), rising to `height` then drooping so the tip ends
// at `tipDrop` of the height. Width follows widthFn(t) (half-width), and
// `cup` lifts the edges into a soft V cross-section. Every vertex records
// its sway weight (t²) and the blade's lean direction + phase, so the tuft
// can flex in update() without touching the topology.
function addRibbon(out, base, dir, { length, height, tipDrop = 0.35, widthFn, cup = 0, segments = 7, phase = 0, sway = 1 }) {
  const startIndex = out.positions.length / 3
  const sideX = -dir.z
  const sideZ = dir.x
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const along = bez(0, length * 0.55, length, t)
    const up = bez(0.02, height, height * tipDrop, t)
    const w = widthFn(t)
    for (const s of [-1, 1]) {
      out.positions.push(
        base.x + dir.x * along + sideX * w * s,
        up + cup * Math.abs(s) * w * 2,
        base.z + dir.z * along + sideZ * w * s,
      )
      const weight = t * t * sway
      out.sway.push(weight * dir.x, weight * dir.z, phase)
    }
    if (i > 0) {
      const a = startIndex + (i - 1) * 2
      out.indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
  }
}

function buildMeshFromRibbons(scene, name, out, material) {
  const mesh = new Mesh(name, scene)
  const vd = new VertexData()
  vd.positions = new Float32Array(out.positions)
  vd.indices = out.indices
  const normals = []
  VertexData.ComputeNormals(out.positions, out.indices, normals)
  vd.normals = new Float32Array(normals)
  vd.applyToMesh(mesh, true)
  mesh.material = material
  mesh.isPickable = false
  return mesh
}

// ---- de-stiffening lily pads -----------------------------------------------
// One-time vertex warp: the rim curls up unevenly and the edge goes wavy,
// so pads read as living leaves instead of machined discs.
export function warpPadMesh(mesh, seed, amp = 0.05) {
  const pos = mesh.getVerticesData('position')
  if (!pos) return
  let maxR = 0
  for (let i = 0; i < pos.length; i += 3) {
    const r = Math.hypot(pos[i], pos[i + 2])
    if (r > maxR) maxR = r
  }
  if (maxR < 1e-6) return
  for (let i = 0; i < pos.length; i += 3) {
    const r = Math.hypot(pos[i], pos[i + 2]) / maxR
    if (r > 0.5) {
      const k = (r - 0.5) / 0.5
      const a = Math.atan2(pos[i + 2], pos[i])
      pos[i + 1] += k * k * (Math.sin(a * 3 + seed * 10) * amp + Math.cos(a * 5 + seed * 4) * amp * 0.4 + amp * 0.5)
    }
  }
  mesh.updateVerticesData('position', pos, false, false)
  const indices = mesh.getIndices()
  const normals = []
  VertexData.ComputeNormals(pos, indices, normals)
  mesh.updateVerticesData('normal', new Float32Array(normals), false, false)
  mesh.refreshBoundingInfo()
}

// ---- grass tufts with drooping leaves (per-vertex sway) --------------------
export function buildTufts(scene, shadow, reeds, pal) {
  const bladeMat = pbr(scene, { color: '#4c8438', rough: 0.85, name: 'tuftMat' })
  bladeMat.backFaceCulling = false
  const tufts = []

  for (const rd of reeds) {
    const out = { positions: [], indices: [], sway: [] }
    const base = { x: rd.x, z: rd.z }
    const blades = 5 + rd.blades * 2
    for (let b = 0; b < blades; b++) {
      const a = rd.seed + (b / blades) * Math.PI * 2 + Math.sin(b * 7.3) * 0.4
      const dir = { x: Math.cos(a), z: Math.sin(a) }
      const h = rd.height * (0.55 + ((b * 37) % 10) / 18)
      addRibbon(out, base, dir, {
        length: 0.12 + h * 0.3,
        height: h,
        tipDrop: 0.55 + ((b * 13) % 6) / 20, // tall blades stand, some sag hard
        widthFn: (t) => 0.035 * (1 - t * 0.85),
        segments: 7,
        phase: rd.seed + b * 1.31,
        sway: 1,
      })
    }
    // 2-4 broad droopy leaves arching over the water (the reference's
    // foreground leaves that curl right over)
    const leaves = 2 + Math.floor(((rd.seed * 100) % 3))
    for (let l = 0; l < leaves; l++) {
      const a = rd.seed * 3 + (l / leaves) * Math.PI * 2 + 0.7
      const dir = { x: Math.cos(a), z: Math.sin(a) }
      addRibbon(out, base, dir, {
        length: 0.5 + rd.height * 0.35,
        height: rd.height * 0.55,
        tipDrop: 0.12, // sags almost back to the water
        widthFn: (t) => Math.sin(Math.min(1, t * 1.15) * Math.PI) * 0.11 + 0.012,
        cup: -0.25,
        segments: 8,
        phase: rd.seed + 9 + l * 2.7,
        sway: 0.55,
      })
    }

    const mesh = buildMeshFromRibbons(scene, 'tuft', out, bladeMat)
    shadow?.addShadowCaster(mesh)
    tufts.push({
      mesh,
      x: rd.x,
      z: rd.z,
      base: new Float32Array(out.positions),
      sway: out.sway,
      live: new Float32Array(out.positions.length),
    })
  }

  return {
    update(t, ripples) {
      for (const tuft of tufts) {
        // one wave-push sample per tuft, shared by all its vertices
        let push = 0
        for (const r of ripples) {
          const d = Math.hypot(tuft.x - r.x, tuft.z - r.z)
          const off = Math.abs(d - r.radius)
          if (off < 2) push += ripplePower(r.radius, r.peakRadius, r.peakPower) * (1 - off / 2) * 0.45
        }
        const { base, sway, live } = tuft
        for (let v = 0; v < base.length / 3; v++) {
          const wx = sway[v * 3]
          const wz = sway[v * 3 + 1]
          const ph = sway[v * 3 + 2]
          const bend = Math.sin(t * 1.3 + ph) * 0.09 + Math.sin(t * 2.9 + ph * 1.7) * 0.03 + push
          live[v * 3] = base[v * 3] + wx * bend
          live[v * 3 + 1] = base[v * 3 + 1] - Math.abs(bend) * (Math.abs(wx) + Math.abs(wz)) * 0.35
          live[v * 3 + 2] = base[v * 3 + 2] + wz * bend
        }
        tuft.mesh.updateVerticesData('position', live, false, false)
      }
    },
    dispose() {
      for (const tuft of tufts) tuft.mesh.dispose()
      bladeMat.dispose()
    },
  }
}

// ---- water lettuce: rosettes of ribbed fan leaves --------------------------
export function buildLettuces(scene, shadow, lettuces) {
  const mats = [
    pbr(scene, { color: '#9fc45e', rough: 0.75, name: 'lettuceMat0' }),
    pbr(scene, { color: '#84b04a', rough: 0.75, name: 'lettuceMat1' }),
  ]
  for (const m of mats) m.backFaceCulling = false
  const items = []
  for (const L of lettuces) {
    const out = { positions: [], indices: [], sway: [] }
    const leaves = 8 + Math.floor((L.seed * 10) % 4)
    for (let ring = 0; ring < 2; ring++) {
      const n = ring === 0 ? leaves : Math.max(4, leaves - 4)
      for (let i = 0; i < n; i++) {
        const a = L.seed + (i / n) * Math.PI * 2 + ring * 0.45
        const dir = { x: Math.cos(a), z: Math.sin(a) }
        const len = L.scale * (ring === 0 ? 0.42 : 0.26)
        addRibbon(out, { x: 0, z: 0 }, dir, {
          length: len,
          height: len * (ring === 0 ? 0.8 : 1.15), // leaves stand up in a cup
          tipDrop: 0.7, // fan tips round outward
          widthFn: (t) => Math.sin(Math.min(1, t * 1.05) * Math.PI * 0.62) * len * 0.42 + 0.008,
          cup: 0.45, // the lettuce cup
          segments: 6,
          phase: 0,
          sway: 0,
        })
      }
    }
    const mesh = buildMeshFromRibbons(scene, 'lettuce', out, mats[Math.floor((L.seed * 100) % 2)])
    mesh.position.set(L.x, 0.04, L.z)
    mesh.rotation.y = L.seed * 7
    shadow?.addShadowCaster(mesh)
    items.push({ mesh, L })
  }
  return {
    update(t, ripples) {
      for (const it of items) {
        const y = surfaceHeight(it.L.x, it.L.z, ripples, t)
        it.mesh.position.y = 0.04 + y
        it.mesh.rotation.z = y * 0.7
        it.mesh.rotation.x = Math.sin(t * 0.8 + it.L.seed * 9) * 0.02
      }
    },
    dispose() {
      for (const it of items) it.mesh.dispose()
      for (const m of mats) m.dispose()
    },
  }
}

// ---- canna stands: broad upright leaves under an orange bloom spike --------
// Bank plants for the rock garden — they don't ride the water, they just
// breathe in the breeze beside the falls.
export function buildCannas(scene, shadow, cannas) {
  if (!cannas?.length) return { update() {}, dispose() {} }
  const leafMat = pbr(scene, { color: '#3f7d2f', rough: 0.7, name: 'cannaLeaf' })
  leafMat.backFaceCulling = false
  const bloomMat = pbr(scene, { color: '#e8722a', rough: 0.55, name: 'cannaBloom' })
  bloomMat.emissiveColor = Color3.FromHexString('#e8722a').scale(0.16)
  const stemMat = pbr(scene, { color: '#4a7a30', rough: 0.8, name: 'cannaStem' })
  const items = []
  for (const C of cannas) {
    const out = { positions: [], indices: [], sway: [] }
    const leaves = 5 + Math.floor((C.seed * 10) % 2)
    for (let i = 0; i < leaves; i++) {
      const a = C.seed + (i / leaves) * Math.PI * 2 + Math.sin(i * 5.1) * 0.3
      const dir = { x: Math.cos(a), z: Math.sin(a) }
      const h = C.scale * (0.85 + ((i * 31) % 7) / 14)
      addRibbon(out, { x: 0, z: 0 }, dir, {
        length: C.scale * 0.32,
        height: h,
        tipDrop: 0.8, // broad blades stand tall, tips barely nod
        widthFn: (t) => Math.sin(Math.min(1, 0.18 + t * 0.9) * Math.PI) * C.scale * 0.15 + 0.012,
        cup: 0.32,
        segments: 7,
        phase: C.seed + i * 1.7,
        sway: 0,
      })
    }
    const stand = buildMeshFromRibbons(scene, 'canna', out, leafMat)
    stand.position.set(C.x, 0.3, C.z)
    shadow?.addShadowCaster(stand)

    // the bloom spike: a tall stem carrying a cluster of flame-orange florets
    const spikeH = C.scale * 1.35
    const stem = MeshBuilder.CreateCylinder('cannaSpike', { height: spikeH, diameterBottom: 0.045, diameterTop: 0.028, tessellation: 6 }, scene)
    stem.material = stemMat
    stem.parent = stand
    stem.position.y = spikeH / 2
    stem.isPickable = false
    const nF = 3 + (C.blooms || 2)
    for (let i = 0; i < nF; i++) {
      const f = MeshBuilder.CreateSphere('cannaFloret', { diameterX: 0.14 * C.scale, diameterY: 0.2 * C.scale, diameterZ: 0.14 * C.scale, segments: 6 }, scene)
      const fa = C.seed + i * 2.4
      const fr = i === 0 ? 0 : 0.07 * C.scale
      f.position.set(Math.cos(fa) * fr, spikeH + (i / nF) * 0.22 * C.scale, Math.sin(fa) * fr)
      f.material = bloomMat
      f.parent = stand
      f.isPickable = false
    }
    shadow?.addShadowCaster(stem)
    items.push({ stand, C })
  }
  return {
    update(t) {
      for (const it of items) {
        it.stand.rotation.z = Math.sin(t * 0.6 + it.C.seed * 3) * 0.02
        it.stand.rotation.x = Math.sin(t * 0.45 + it.C.seed * 7) * 0.015
      }
    },
    dispose() {
      for (const it of items) it.stand.dispose(false, true)
      leafMat.dispose()
      bloomMat.dispose()
      stemMat.dispose()
    },
  }
}

// ---- water hyacinth: rounded paddle leaves around a violet bloom -----------
export function buildHyacinths(scene, shadow, hyacinths) {
  const leafMat = pbr(scene, { color: '#5d9c3e', rough: 0.6, name: 'hyacinthLeaf' })
  leafMat.backFaceCulling = false
  const bloomMat = pbr(scene, { color: '#9a7fd8', rough: 0.55, name: 'hyacinthBloom' })
  bloomMat.emissiveColor = Color3.FromHexString('#9a7fd8').scale(0.12)
  const stemMat = pbr(scene, { color: '#4c8438', rough: 0.8, name: 'hyacinthStem' })
  const items = []
  for (const H of hyacinths) {
    const out = { positions: [], indices: [], sway: [] }
    const leaves = 6
    for (let i = 0; i < leaves; i++) {
      const a = H.seed + (i / leaves) * Math.PI * 2
      const dir = { x: Math.cos(a), z: Math.sin(a) }
      const len = H.scale * 0.5
      addRibbon(out, { x: 0, z: 0 }, dir, {
        length: len,
        height: len * 0.85,
        tipDrop: 0.6,
        // rounded paddle: near-constant width with a rounded tip
        widthFn: (t) => Math.sin(Math.min(1, 0.25 + t * 0.85) * Math.PI) * len * 0.36 + 0.01,
        cup: 0.18,
        segments: 6,
        phase: 0,
        sway: 0,
      })
    }
    const rosette = buildMeshFromRibbons(scene, 'hyacinth', out, leafMat)
    rosette.position.set(H.x, 0.05, H.z)
    shadow?.addShadowCaster(rosette)

    // the bloom spike: a short stem carrying a cluster of violet florets
    const spikeH = H.scale * 0.55
    const stem = MeshBuilder.CreateCylinder('hyStem', { height: spikeH, diameterBottom: 0.035, diameterTop: 0.022, tessellation: 6 }, scene)
    stem.material = stemMat
    stem.parent = rosette
    stem.position.y = spikeH / 2
    stem.isPickable = false
    const florets = []
    const nF = 5
    for (let i = 0; i < nF; i++) {
      const f = MeshBuilder.CreateSphere('hyFloret', { diameterX: 0.11 * H.scale, diameterY: 0.07 * H.scale, diameterZ: 0.11 * H.scale, segments: 6 }, scene)
      const fa = (i / nF) * Math.PI * 2
      const fr = i === nF - 1 ? 0 : 0.05 * H.scale
      f.position.set(Math.cos(fa) * fr, spikeH + (i / nF) * 0.14 * H.scale, Math.sin(fa) * fr)
      f.material = bloomMat
      f.parent = rosette
      f.isPickable = false
      florets.push(f)
    }
    shadow?.addShadowCaster(stem)
    items.push({ rosette, H })
  }
  return {
    update(t, ripples) {
      for (const it of items) {
        const y = surfaceHeight(it.H.x, it.H.z, ripples, t)
        it.rosette.position.y = 0.05 + y
        it.rosette.rotation.z = y * 0.6
        it.rosette.rotation.y = Math.sin(t * 0.4 + it.H.seed * 5) * 0.05
      }
    },
    dispose() {
      for (const it of items) it.rosette.dispose(false, true)
      leafMat.dispose()
      bloomMat.dispose()
      stemMat.dispose()
    },
  }
}
