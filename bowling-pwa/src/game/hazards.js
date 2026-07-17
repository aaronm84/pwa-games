// Lane hazards — the junk that ends up on a real (or unreal) lane. Each entry
// builds a little prop with a primitive Havok collider; the page scatters them
// on the lane between racks. Every alley has its own themed catalog, plus a
// shared pool of cross-theme clutter (rogue pins, spilled drinks, lost shoes…)
// that can show up anywhere. Special case: 'patch' hazards (encroaching lava)
// have no collider — they sit ON the lane and drag the ball that crosses them.
import {
  MeshBuilder,
  Mesh,
  Vector3,
  VertexData,
  Color3,
  StandardMaterial,
  pbr,
  makeDynamic,
  PhysicsShapeType,
} from 'src/engine'
import { makePinMesh, LANE_W } from './lane3d'
// the rental shoe is a real decimated 3D model (one shoe of the pair),
// embedded as JSON with its photo atlas baked into vertex colors
import shoeMesh from './shoe-mesh.json'

function glowMat(scene, hex, scale = 1) {
  const m = new StandardMaterial('hzGlow', scene)
  m.emissiveColor = Color3.FromHexString(hex).scale(scale)
  m.disableLighting = true
  return m
}
const lit = (m) => ((m.maxSimultaneousLights = 6), m)

// Classic die-face pip layouts on a unit cube (face → pip offsets in [-1,1]²).
// Exported so the giant set-dressing dice in environs.js get real faces too.
const PIP_LAYOUT = [
  [[0, 0]], // 1
  [[-1, -1], [1, 1]],
  [[-1, -1], [0, 0], [1, 1]],
  [[-1, -1], [-1, 1], [1, -1], [1, 1]],
  [[-1, -1], [-1, 1], [0, 0], [1, -1], [1, 1]],
  [[-1, -1], [-1, 0], [-1, 1], [1, -1], [1, 0], [1, 1]],
]
export function addDiePips(scene, die, size, pipHex = '#1c1c22') {
  // opposite faces sum to 7: +y:1, -y:6, +z:2, -z:5, +x:3, -x:4
  const faces = [
    { n: 1, pos: (u, v) => [u, 0.5, v] },
    { n: 6, pos: (u, v) => [u, -0.5, v] },
    { n: 2, pos: (u, v) => [u, v, 0.5] },
    { n: 5, pos: (u, v) => [u, v, -0.5] },
    { n: 3, pos: (u, v) => [0.5, u, v] },
    { n: 4, pos: (u, v) => [-0.5, u, v] },
  ]
  const bits = []
  for (const f of faces) {
    for (const [u, v] of PIP_LAYOUT[f.n - 1]) {
      const pip = MeshBuilder.CreateSphere('pip', { diameter: size * 0.17, segments: 10 }, scene)
      const [x, y, z] = f.pos(u * 0.27, v * 0.27)
      // embed each pip halfway into the face so it reads as a drilled dot
      pip.position.set(x * size * 1.02, y * size * 1.02, z * size * 1.02)
      pip.scaling.set(Math.abs(x) > 0.4 ? 0.45 : 1, Math.abs(y) > 0.4 ? 0.45 : 1, Math.abs(z) > 0.4 ? 0.45 : 1)
      bits.push(pip)
    }
  }
  const pips = Mesh.MergeMeshes(bits, true, true)
  const mat = lit(pbr(scene, { color: pipHex, rough: 0.35, name: 'pipMat' }))
  pips.material = mat
  pips.parent = die
  pips.isPickable = false
  return { pips, mat }
}

// A capsule lying along local +x — the workhorse for limbs, soles, straps.
function xCapsule(scene, name, radius, length, tessellation = 16) {
  return MeshBuilder.CreateCapsule(name, { radius, height: length, orientation: new Vector3(1, 0, 0), tessellation, capSubdivisions: 6 }, scene)
}

// ---- the catalog ------------------------------------------------------------
// Each builder returns { root, meshes, mats, restY, phys } — root is the
// collider primitive (already shaped/rotated), restY its resting height, phys
// the makeDynamic options. Patch hazards return { patch: r } instead of phys.

const CATALOG = {
  // -- shared clutter: at home on every lane -------------------------------
  roguepin: {
    name: 'a rogue pin from lane 12',
    build(scene) {
      const { body, stripes, mats } = makePinMesh(scene, { pin: '#f4f0ff', pinStripe: '#e33a4a' }, 'hzPin')
      body.rotation.z = Math.PI / 2 // lying on its side
      return { root: body, meshes: [body, ...stripes], mats, restY: 0.13, phys: { shape: PhysicsShapeType.CONVEX_HULL, mass: 1.5, restitution: 0.25, friction: 0.5 } }
    },
  },
  spilleddrink: {
    name: 'somebody’s spilled soda',
    build(scene) {
      // invisible box collider; the tipped cup and its puddle hang off it so
      // the puddle stays flat on the boards no matter how the cup lies
      const col = MeshBuilder.CreateBox('hzDrink', { width: 0.4, height: 0.24, depth: 0.26 }, scene)
      col.isVisible = false
      const cup = MeshBuilder.CreateCylinder('hzCup', { diameterTop: 0.24, diameterBottom: 0.18, height: 0.32, tessellation: 22 }, scene)
      cup.rotation.z = 1.45 // tipped over
      const cupMat = lit(pbr(scene, { color: '#e8342f', rough: 0.5, name: 'hzCupMat' }))
      cup.material = cupMat
      cup.parent = col
      const lid = MeshBuilder.CreateCylinder('hzLid', { diameter: 0.25, height: 0.025, tessellation: 22 }, scene)
      const lidMat = lit(pbr(scene, { color: '#f4f0e8', rough: 0.6, name: 'hzLidMat' }))
      lid.material = lidMat
      lid.parent = cup
      lid.position.y = 0.17
      const straw = MeshBuilder.CreateCylinder('hzStraw', { diameter: 0.025, height: 0.24, tessellation: 8 }, scene)
      straw.material = lidMat
      straw.parent = cup
      straw.position.set(0.03, 0.27, 0)
      straw.rotation.z = 0.25
      // the spill: a big puddle and a smaller splash blob, flat on the lane
      const pudMat = new StandardMaterial('hzPud', scene)
      pudMat.diffuseColor = Color3.FromHexString('#5a2a18')
      pudMat.alpha = 0.55
      const puddle = MeshBuilder.CreateCylinder('hzPuddle', { diameter: 0.5, height: 0.012, tessellation: 26 }, scene)
      puddle.material = pudMat
      puddle.parent = col
      puddle.position.set(-0.28, -0.105, 0)
      const splash = MeshBuilder.CreateCylinder('hzSplash', { diameter: 0.2, height: 0.012, tessellation: 18 }, scene)
      splash.material = pudMat
      splash.parent = col
      splash.position.set(-0.5, -0.105, 0.12)
      return { root: col, meshes: [col, cup, lid, straw, puddle, splash], mats: [cupMat, lidMat, pudMat], restY: 0.12, phys: { shape: PhysicsShapeType.BOX, mass: 0.8, restitution: 0.3, friction: 0.6 } }
    },
  },
  rogueball: {
    name: 'a runaway house ball',
    build(scene) {
      const colors = ['#3a7ab0', '#b04a3a', '#3fa060', '#8a5ab8']
      const b = MeshBuilder.CreateSphere('hzBall', { diameter: 0.44, segments: 28 }, scene)
      const mat = lit(pbr(scene, { color: colors[Math.floor(Math.random() * colors.length)], rough: 0.25, name: 'hzBallMat' }))
      b.material = mat
      // finger holes: three dark dots clustered near the top
      const holeMat = lit(pbr(scene, { color: '#12141a', rough: 0.7, name: 'hzHoleMat' }))
      const holes = []
      for (const [hx, hz] of [[0, 0.062], [-0.055, -0.035], [0.055, -0.035]]) {
        const hole = MeshBuilder.CreateSphere('hzHole', { diameter: 0.06, segments: 8 }, scene)
        const len = Math.hypot(hx, 0.205, hz)
        hole.position.set((hx / len) * 0.215, (0.205 / len) * 0.215, (hz / len) * 0.215)
        hole.scaling.y = 0.4
        hole.material = holeMat
        hole.parent = b
        holes.push(hole)
      }
      return { root: b, meshes: [b, ...holes], mats: [mat, holeMat], restY: 0.22, phys: { shape: PhysicsShapeType.SPHERE, mass: 6, restitution: 0.2, friction: 0.35 } }
    },
  },
  shoe: {
    name: 'a lost rental shoe',
    build(scene, { platform = false, tint = null } = {}) {
      // the real deal: a decimated 3D shoe model (~7k tris) with its photo
      // atlas baked into vertex colors at build time — no runtime texture.
      // The disco variant rides a platform sole with a magenta tint.
      const soleLift = platform ? 0.09 : 0
      const H = 0.18 + soleLift
      const col = MeshBuilder.CreateBox('hzShoe', { width: 0.46, height: H, depth: 0.18 }, scene)
      col.isVisible = false
      const meshes = [col]
      const mats = []
      const y0 = -H / 2
      const shoe = new Mesh('hzShoeMesh', scene)
      const vd = new VertexData()
      vd.positions = shoeMesh.positions
      vd.indices = shoeMesh.indices
      const cols = new Float32Array((shoeMesh.colors.length / 3) * 4)
      for (let i = 0, j = 0; i < shoeMesh.colors.length; i += 3, j += 4) {
        cols[j] = shoeMesh.colors[i] / 255
        cols[j + 1] = shoeMesh.colors[i + 1] / 255
        cols[j + 2] = shoeMesh.colors[i + 2] / 255
        cols[j + 3] = 1
      }
      vd.colors = cols
      const normals = []
      VertexData.ComputeNormals(shoeMesh.positions, shoeMesh.indices, normals)
      vd.normals = normals
      vd.applyToMesh(shoe)
      const mat = new StandardMaterial('hzShoeMat', scene)
      mat.diffuseColor = Color3.White() // the baked vertex colors carry the leather
      mat.specularColor = new Color3(0.14, 0.14, 0.14)
      mat.maxSimultaneousLights = 6
      mat.emissiveColor = new Color3(0.08, 0.08, 0.08) // readable on the dark lanes
      if (tint) {
        mat.diffuseColor = Color3.FromHexString(tint)
        mat.emissiveColor = Color3.FromHexString(tint).scale(0.12)
      }
      mats.push(mat)
      shoe.material = mat
      shoe.scaling.setAll(0.42) // model length 1 -> lane scale
      shoe.position.y = y0 + soleLift + 0.002
      shoe.parent = col
      meshes.push(shoe)
      if (platform) {
        // the disco build: a chunky gold platform under the real shoe
        const slab = xCapsule(scene, 'hzPlatform', 0.075, 0.4, 16)
        slab.scaling.y = soleLift / 0.075
        const slabMat = lit(pbr(scene, { color: '#e8c400', rough: 0.3, name: 'hzSlabMat' }))
        slab.material = slabMat
        slab.position.y = y0 + soleLift / 2
        slab.parent = col
        meshes.push(slab)
        mats.push(slabMat)
      }
      return { root: col, meshes, mats, restY: H / 2 + 0.005, phys: { shape: PhysicsShapeType.BOX, mass: 1.1, restitution: 0.3, friction: 0.6 } }
    },
  },

  // -- Disco Nova ------------------------------------------------------------
  mirrorball: {
    name: 'a rogue mirror ball',
    build(scene) {
      // low segment count on purpose: the flat facets ARE the mirror tiles
      const b = MeshBuilder.CreateSphere('hzMirror', { diameter: 0.5, segments: 14 }, scene)
      b.convertToFlatShadedMesh()
      const mat = lit(pbr(scene, { color: '#cfd6e4', rough: 0.12, metal: 0.85, name: 'hzMirrorMat' }))
      b.material = mat
      return { root: b, meshes: [b], mats: [mat], restY: 0.25, phys: { shape: PhysicsShapeType.SPHERE, mass: 3, restitution: 0.4, friction: 0.4 } }
    },
  },
  discoshoe: {
    name: 'a platform disco shoe',
    build(scene) {
      return CATALOG.shoe.build(scene, { platform: true, tint: '#ff5ae8' })
    },
  },

  // -- Lava Lanes --------------------------------------------------------------
  lavapatch: {
    name: 'encroaching lava',
    build(scene) {
      // a molten tongue creeping in from the gutter — no collider; the ball
      // that crosses it sizzles and slows (the page applies the drag).
      // Two overlapping blobs so the edge reads irregular, not stamped.
      const blob = MeshBuilder.CreateSphere('hzLava', { diameterX: 1.0, diameterY: 0.07, diameterZ: 0.72, segments: 20 }, scene)
      const mat = glowMat(scene, '#ff6a1f', 1.15)
      blob.material = mat
      const lobe = MeshBuilder.CreateSphere('hzLavaLobe', { diameterX: 0.55, diameterY: 0.06, diameterZ: 0.4, segments: 14 }, scene)
      lobe.material = mat
      lobe.position.set(0.3, 0, 0.24)
      lobe.parent = blob
      const core = MeshBuilder.CreateSphere('hzLavaCore', { diameterX: 0.55, diameterY: 0.085, diameterZ: 0.4, segments: 14 }, scene)
      const coreMat = glowMat(scene, '#ffd23f', 1.3)
      core.material = coreMat
      core.parent = blob
      const crust = MeshBuilder.CreateTorus('hzCrust', { diameter: 0.9, thickness: 0.06, tessellation: 26 }, scene)
      const crustMat = lit(pbr(scene, { color: '#241a14', rough: 1, name: 'hzCrustMat' }))
      crust.material = crustMat
      crust.scaling.z = 0.75
      crust.parent = blob
      return { root: blob, meshes: [blob, lobe, core, crust], mats: [mat, coreMat, crustMat], restY: 0.02, patch: 0.48, edge: true }
    },
  },
  boulder: {
    name: 'a basalt boulder',
    build(scene) {
      // three fused lumps read as one craggy rock
      const bits = []
      for (const [dx, dy, dz, d] of [[0, 0, 0, 0.44], [0.13, 0.06, 0.08, 0.3], [-0.11, 0.04, -0.09, 0.26]]) {
        const lump = MeshBuilder.CreateSphere('hzLump', { diameterX: d, diameterY: d * 0.85, diameterZ: d * 0.92, segments: 9 }, scene)
        lump.position.set(dx, dy, dz)
        bits.push(lump)
      }
      const rock = Mesh.MergeMeshes(bits, true, true)
      rock.convertToFlatShadedMesh() // faceted like fractured basalt
      const mat = lit(pbr(scene, { color: '#3a3230', rough: 0.95, name: 'hzRockMat' }))
      rock.material = mat
      return { root: rock, meshes: [rock], mats: [mat], restY: 0.2, phys: { shape: PhysicsShapeType.SPHERE, mass: 5, restitution: 0.2, friction: 0.7 } }
    },
  },

  // -- Zero-G ------------------------------------------------------------------
  saucer: {
    name: 'a crash-landed saucer',
    build(scene) {
      const hull = MeshBuilder.CreateCylinder('hzSaucer', { diameterTop: 0.5, diameterBottom: 0.85, height: 0.16, tessellation: 32 }, scene)
      const hullMat = lit(pbr(scene, { color: '#9aa4b2', rough: 0.35, metal: 0.6, name: 'hzSaucerMat' }))
      hull.material = hullMat
      const dome = MeshBuilder.CreateSphere('hzDome', { diameter: 0.36, segments: 18, slice: 0.5 }, scene)
      const domeMat = lit(pbr(scene, { color: '#4dff9d', rough: 0.2, name: 'hzDomeMat' }))
      domeMat.alpha = 0.85
      dome.material = domeMat
      dome.position.y = 0.08
      dome.parent = hull
      const ringMat = glowMat(scene, '#4d9dff', 0.9)
      const ring = MeshBuilder.CreateTorus('hzRing', { diameter: 0.72, thickness: 0.03, tessellation: 32 }, scene)
      ring.material = ringMat
      ring.parent = hull
      // running lights dotted around the rim
      const meshes = [hull, dome, ring]
      const lightMat = glowMat(scene, '#ffd23f', 1.1)
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2
        const dot = MeshBuilder.CreateSphere('hzDot', { diameter: 0.05, segments: 8 }, scene)
        dot.position.set(Math.cos(a) * 0.36, 0.02, Math.sin(a) * 0.36)
        dot.material = lightMat
        dot.parent = hull
        meshes.push(dot)
      }
      hull.rotation.z = 0.3 // nose-down in the lane, like it just hit
      return { root: hull, meshes, mats: [hullMat, domeMat, ringMat, lightMat], restY: 0.16, phys: { shape: PhysicsShapeType.CYLINDER, mass: 12, restitution: 0.25, friction: 0.6 } }
    },
  },
  alien: {
    name: 'a passed-out alien',
    build(scene) {
      // the classic inflatable party alien, flat on its back on the boards:
      // all shiny green vinyl, an oversized teardrop head with giant black
      // almond eyes staring at the ceiling, a thin little mouth, splayed
      // skinny limbs with mitten hands. Poor guy.
      const col = MeshBuilder.CreateBox('hzAlien', { width: 0.66, height: 0.16, depth: 0.46 }, scene)
      col.isVisible = false
      const skin = lit(pbr(scene, { color: '#58cb66', rough: 0.32, name: 'hzAlienMat' })) // glossy like vinyl
      const meshes = [col]
      const y0 = -0.08 // the collider's floor
      // torso: a slim green capsule — the head is the star here
      const torso = xCapsule(scene, 'hzTorso', 0.075, 0.26, 18)
      torso.position.set(-0.06, y0 + 0.075, 0)
      torso.material = skin
      torso.parent = col
      meshes.push(torso)
      // head: a big flattened teardrop, face to the sky — wide cranium away
      // from the body, narrow chin at the neck
      const head = MeshBuilder.CreateSphere('hzHead', { diameterX: 0.32, diameterY: 0.15, diameterZ: 0.28, segments: 24 }, scene)
      head.position.set(0.2, y0 + 0.08, 0)
      head.material = skin
      head.parent = col
      meshes.push(head)
      const chin = MeshBuilder.CreateSphere('hzChin', { diameterX: 0.16, diameterY: 0.11, diameterZ: 0.14, segments: 16 }, scene)
      chin.position.set(0.08, y0 + 0.07, 0)
      chin.material = skin
      chin.parent = col
      meshes.push(chin)
      // GIANT black almond eyes on the upturned face, slanted toward the
      // chin, each with a little white glint
      const eyeMat = lit(pbr(scene, { color: '#0c0f12', rough: 0.12, name: 'hzEyeMat' }))
      const glintMat = lit(pbr(scene, { color: '#dfe8ea', rough: 0.3, name: 'hzGlintMat' }))
      for (const s of [-1, 1]) {
        const eye = MeshBuilder.CreateSphere('hzEye', { diameterX: 0.13, diameterY: 0.025, diameterZ: 0.07, segments: 14 }, scene)
        eye.position.set(0.2, y0 + 0.145, s * 0.065)
        eye.rotation.y = s * 0.55 // slanted like the classic almond
        eye.material = eyeMat
        eye.parent = col
        meshes.push(eye)
        const glint = MeshBuilder.CreateSphere('hzGlint', { diameterX: 0.035, diameterY: 0.012, diameterZ: 0.02, segments: 8 }, scene)
        glint.position.set(0.23, y0 + 0.157, s * 0.045)
        glint.material = glintMat
        glint.parent = col
        meshes.push(glint)
      }
      // the deadpan little mouth: a thin dark bar low on the face
      const mouth = MeshBuilder.CreateBox('hzMouth', { width: 0.005, height: 0.004, depth: 0.05 }, scene)
      mouth.position.set(0.1, y0 + 0.125, 0)
      mouth.material = eyeMat
      mouth.parent = col
      meshes.push(mouth)
      // arms: long skinny capsules flopped outward, mitten hands at the tips.
      // A capsule along +x rotated by yaw θ extends toward (cosθ, 0, -sinθ).
      for (const s of [-1, 1]) {
        const yaw = -s * 0.95 // outward: +z side arm flops toward +z
        const dir = { x: Math.cos(yaw), z: -Math.sin(yaw) }
        const shoulder = { x: 0.04, z: s * 0.06 }
        const armLen = 0.24
        const arm = xCapsule(scene, 'hzArm', 0.024, armLen, 12)
        arm.position.set(shoulder.x + dir.x * armLen * 0.5, y0 + 0.028, shoulder.z + dir.z * armLen * 0.5)
        arm.rotation.y = yaw
        arm.material = skin
        arm.parent = col
        meshes.push(arm)
        const hand = MeshBuilder.CreateSphere('hzHand', { diameterX: 0.09, diameterY: 0.035, diameterZ: 0.07, segments: 12 }, scene)
        hand.position.set(shoulder.x + dir.x * (armLen * 0.5 + 0.11), y0 + 0.025, shoulder.z + dir.z * (armLen * 0.5 + 0.11))
        hand.rotation.y = yaw
        hand.material = skin
        hand.parent = col
        meshes.push(hand)
      }
      // legs: long, splayed from the hips, pointed inflatable feet
      for (const s of [-1, 1]) {
        const yaw = Math.PI + s * 0.32 // extends toward -x, splayed outward
        const dir = { x: Math.cos(yaw), z: -Math.sin(yaw) }
        const hip = { x: -0.16, z: s * 0.045 }
        const legLen = 0.28
        const leg = xCapsule(scene, 'hzLeg', 0.028, legLen, 12)
        leg.position.set(hip.x + dir.x * legLen * 0.5, y0 + 0.032, hip.z + dir.z * legLen * 0.5)
        leg.rotation.y = yaw
        leg.material = skin
        leg.parent = col
        meshes.push(leg)
        const foot = MeshBuilder.CreateSphere('hzFoot', { diameterX: 0.14, diameterY: 0.045, diameterZ: 0.055, segments: 12 }, scene)
        foot.position.set(hip.x + dir.x * (legLen * 0.5 + 0.12), y0 + 0.025, hip.z + dir.z * (legLen * 0.5 + 0.12))
        foot.rotation.y = yaw
        foot.material = skin
        foot.parent = col
        meshes.push(foot)
      }
      return { root: col, meshes, mats: [skin, eyeMat, glintMat], restY: 0.08, phys: { shape: PhysicsShapeType.BOX, mass: 1.5, restitution: 0.3, friction: 0.6 } }
    },
  },

  // -- Tiki Grove ----------------------------------------------------------------
  coconut: {
    name: 'a fallen coconut',
    build(scene) {
      const c = MeshBuilder.CreateSphere('hzCoco', { diameterX: 0.34, diameterY: 0.31, diameterZ: 0.33, segments: 18 }, scene)
      const mat = lit(pbr(scene, { color: '#6b4a2b', rough: 0.9, name: 'hzCocoMat' }))
      c.material = mat
      // the three germination "eyes"
      const eyeMat = lit(pbr(scene, { color: '#2e1e10', rough: 0.9, name: 'hzCocoEye' }))
      const meshes = [c]
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2
        const eye = MeshBuilder.CreateSphere('hzCEye', { diameter: 0.045, segments: 8 }, scene)
        eye.position.set(Math.cos(a) * 0.045, 0.15, Math.sin(a) * 0.045)
        eye.scaling.y = 0.4
        eye.material = eyeMat
        eye.parent = c
        meshes.push(eye)
      }
      return { root: c, meshes, mats: [mat, eyeMat], restY: 0.16, phys: { shape: PhysicsShapeType.SPHERE, mass: 2, restitution: 0.35, friction: 0.6 } }
    },
  },
  pineapple: {
    name: 'a wayward pineapple',
    build(scene) {
      const fruit = MeshBuilder.CreateSphere('hzPine', { diameterX: 0.32, diameterY: 0.42, diameterZ: 0.32, segments: 18 }, scene)
      const mat = lit(pbr(scene, { color: '#d8a12f', rough: 0.85, name: 'hzPineMat' }))
      fruit.material = mat
      const leafMat = lit(pbr(scene, { color: '#2e8b57', rough: 0.8, name: 'hzLeafMat' }))
      const meshes = [fruit]
      // a proper crown: two rings of curved fronds
      for (let i = 0; i < 7; i++) {
        const inner = i < 3
        const leaf = MeshBuilder.CreateCapsule('hzLeafC', { radius: 0.018, height: inner ? 0.2 : 0.24, orientation: new Vector3(0, 1, 0), tessellation: 8, capSubdivisions: 4 }, scene)
        leaf.scaling.z = 2.2 // flatten into a blade
        leaf.position.y = 0.26
        leaf.rotation.y = (i / (inner ? 3 : 4)) * Math.PI * 2
        leaf.rotation.x = inner ? 0.18 : 0.55
        leaf.material = leafMat
        leaf.parent = fruit
        meshes.push(leaf)
      }
      return { root: fruit, meshes, mats: [mat, leafMat], restY: 0.21, phys: { shape: PhysicsShapeType.SPHERE, mass: 2, restitution: 0.3, friction: 0.7 } }
    },
  },
  tikidrink: {
    name: 'an abandoned mai tai',
    build(scene) {
      const cup = MeshBuilder.CreateCylinder('hzTiki', { diameterTop: 0.22, diameterBottom: 0.16, height: 0.3, tessellation: 22 }, scene)
      const cupMat = lit(pbr(scene, { color: '#7a4a22', rough: 0.7, name: 'hzTikiMat' }))
      cup.material = cupMat
      const drink = MeshBuilder.CreateCylinder('hzJuice', { diameter: 0.2, height: 0.02, tessellation: 18 }, scene)
      const juiceMat = lit(pbr(scene, { color: '#e8481c', rough: 0.3, name: 'hzJuiceMat' }))
      drink.material = juiceMat
      drink.position.y = 0.16
      drink.parent = cup
      const brella = MeshBuilder.CreateCylinder('hzBrella', { diameterTop: 0, diameterBottom: 0.26, height: 0.08, tessellation: 16 }, scene)
      const brMat = lit(pbr(scene, { color: '#ffd23f', rough: 0.6, name: 'hzBrMat' }))
      brella.material = brMat
      brella.position.set(0.06, 0.3, 0)
      brella.rotation.z = -0.4
      brella.parent = cup
      const stick = MeshBuilder.CreateCylinder('hzStick', { diameter: 0.012, height: 0.16, tessellation: 6 }, scene)
      const stickMat = lit(pbr(scene, { color: '#f2e8d8', rough: 0.8, name: 'hzStickMat' }))
      stick.material = stickMat
      stick.position.set(0.06, 0.22, 0)
      stick.rotation.z = -0.4
      stick.parent = cup
      const straw = MeshBuilder.CreateCylinder('hzTStraw', { diameter: 0.022, height: 0.2, tessellation: 8 }, scene)
      const strawMat = lit(pbr(scene, { color: '#59c26a', rough: 0.5, name: 'hzStrawMat' }))
      straw.material = strawMat
      straw.position.set(-0.06, 0.24, 0.03)
      straw.rotation.z = 0.3
      straw.parent = cup
      return { root: cup, meshes: [cup, drink, brella, stick, straw], mats: [cupMat, juiceMat, brMat, stickMat, strawMat], restY: 0.16, phys: { shape: PhysicsShapeType.CYLINDER, mass: 0.9, restitution: 0.3, friction: 0.6 } }
    },
  },
  fallentorch: {
    name: 'a fallen tiki torch',
    build(scene) {
      const pole = MeshBuilder.CreateCylinder('hzTorch', { diameter: 0.1, height: 0.95, tessellation: 14 }, scene)
      pole.rotation.z = Math.PI / 2 // lying across the boards
      const poleMat = lit(pbr(scene, { color: '#5a3a1e', rough: 0.9, name: 'hzTorchMat' }))
      pole.material = poleMat
      // the wrapped head the flame comes out of
      const wrap = MeshBuilder.CreateCylinder('hzWrap', { diameter: 0.14, height: 0.16, tessellation: 14 }, scene)
      const wrapMat = lit(pbr(scene, { color: '#8a6a3a', rough: 0.95, name: 'hzWrapMat' }))
      wrap.material = wrapMat
      wrap.position.y = 0.42
      wrap.parent = pole
      const flame = MeshBuilder.CreateSphere('hzFlame', { diameterX: 0.16, diameterY: 0.26, diameterZ: 0.16, segments: 12 }, scene)
      const flameMat = glowMat(scene, '#ffab3a', 1.35)
      flame.material = flameMat
      flame.position.y = 0.56 // local +y = world +x once the pole is lying
      flame.parent = pole
      const flameCore = MeshBuilder.CreateSphere('hzFlameCore', { diameterX: 0.08, diameterY: 0.14, diameterZ: 0.08, segments: 10 }, scene)
      flameCore.material = glowMat(scene, '#ffe28a', 1.5)
      flameCore.position.y = 0.54
      flameCore.parent = pole
      return { root: pole, meshes: [pole, wrap, flame, flameCore], mats: [poleMat, wrapMat, flameMat, flameCore.material], restY: 0.06, phys: { shape: PhysicsShapeType.CYLINDER, mass: 1.4, restitution: 0.25, friction: 0.6 } }
    },
  },

  // -- High Roller -----------------------------------------------------------------
  die: {
    name: 'a giant die',
    build(scene) {
      const die = MeshBuilder.CreateBox('hzDie', { size: 0.4 }, scene)
      const mat = lit(pbr(scene, { color: '#f2ede4', rough: 0.3, name: 'hzDieMat' }))
      die.material = mat
      const { pips, mat: pipMat } = addDiePips(scene, die, 0.4, '#a01a2e')
      return { root: die, meshes: [die, pips], mats: [mat, pipMat], restY: 0.2, phys: { shape: PhysicsShapeType.BOX, mass: 3, restitution: 0.35, friction: 0.5 } }
    },
  },
  chipstack: {
    name: 'a stack of chips',
    build(scene) {
      const stack = MeshBuilder.CreateCylinder('hzChips', { diameter: 0.28, height: 0.2, tessellation: 26 }, scene)
      const mat = lit(pbr(scene, { color: '#a01a2e', rough: 0.4, name: 'hzChipMat' }))
      stack.material = mat
      const bandMat = lit(pbr(scene, { color: '#f2ede4', rough: 0.4, name: 'hzChipBand' }))
      const meshes = [stack]
      for (const y of [-0.05, 0.03]) {
        const band = MeshBuilder.CreateCylinder('hzChipB', { diameter: 0.285, height: 0.024, tessellation: 26 }, scene)
        band.position.y = y
        band.material = bandMat
        band.parent = stack
        meshes.push(band)
      }
      const top = MeshBuilder.CreateCylinder('hzChipT', { diameter: 0.27, height: 0.02, tessellation: 26 }, scene)
      const topMat = lit(pbr(scene, { color: '#ffd23f', rough: 0.35, name: 'hzChipTop' }))
      top.position.y = 0.1
      top.material = topMat
      top.parent = stack
      meshes.push(top)
      // a couple of loose chips scattered where the stack toppled
      for (const [lx, lz] of [[0.2, 0.08], [0.16, -0.14]]) {
        const loose = MeshBuilder.CreateCylinder('hzChipL', { diameter: 0.13, height: 0.022, tessellation: 20 }, scene)
        loose.position.set(lx, -0.088, lz)
        loose.material = topMat
        loose.parent = stack
        meshes.push(loose)
      }
      return { root: stack, meshes, mats: [mat, bandMat, topMat], restY: 0.11, phys: { shape: PhysicsShapeType.CYLINDER, mass: 1, restitution: 0.3, friction: 0.6 } }
    },
  },
  cocktail: {
    name: 'a stray martini',
    build(scene) {
      // invisible collider; the glass itself is all thin geometry
      const col = MeshBuilder.CreateCylinder('hzMartini', { diameter: 0.3, height: 0.42, tessellation: 12 }, scene)
      col.isVisible = false
      const glassMat = lit(pbr(scene, { color: '#e8f0f8', rough: 0.12, name: 'hzGlassMat' }))
      glassMat.alpha = 0.65
      const cup = MeshBuilder.CreateCylinder('hzCupV', { diameterTop: 0.3, diameterBottom: 0.02, height: 0.16, tessellation: 24 }, scene)
      cup.position.y = 0.12
      cup.material = glassMat
      cup.parent = col
      // the drink itself — a pale-gold surface so the glass reads on dark lanes
      const gin = MeshBuilder.CreateCylinder('hzGin', { diameter: 0.26, height: 0.014, tessellation: 22 }, scene)
      const ginMat = new StandardMaterial('hzGinMat', scene)
      ginMat.diffuseColor = Color3.FromHexString('#e8d48a')
      ginMat.emissiveColor = Color3.FromHexString('#e8d48a').scale(0.25)
      ginMat.alpha = 0.9
      gin.material = ginMat
      gin.position.y = 0.17
      gin.parent = col
      const stem = MeshBuilder.CreateCylinder('hzStem', { diameter: 0.035, height: 0.16, tessellation: 12 }, scene)
      stem.position.y = -0.02
      stem.material = glassMat
      stem.parent = col
      const base = MeshBuilder.CreateCylinder('hzBase', { diameter: 0.16, height: 0.02, tessellation: 20 }, scene)
      base.position.y = -0.1
      base.material = glassMat
      base.parent = col
      const olive = MeshBuilder.CreateSphere('hzOlive', { diameter: 0.07, segments: 12 }, scene)
      const oliveMat = lit(pbr(scene, { color: '#7a9c3a', rough: 0.5, name: 'hzOliveMat' }))
      olive.position.set(0.03, 0.15, 0)
      olive.material = oliveMat
      olive.parent = col
      // the toothpick through the olive
      const pick = MeshBuilder.CreateCylinder('hzPick', { diameter: 0.01, height: 0.16, tessellation: 6 }, scene)
      const pickMat = lit(pbr(scene, { color: '#f2e8d8', rough: 0.8, name: 'hzPickMat' }))
      pick.material = pickMat
      pick.position.set(0.05, 0.18, 0)
      pick.rotation.z = -0.5
      pick.parent = col
      return { root: col, meshes: [col, cup, stem, base, olive, pick], mats: [glassMat, oliveMat, pickMat], restY: 0.21, phys: { shape: PhysicsShapeType.CYLINDER, mass: 0.7, restitution: 0.3, friction: 0.5 } }
    },
  },

  // -- Poolside ------------------------------------------------------------------
  beachball: {
    name: 'a beach ball',
    build(scene) {
      // a real beach ball is SMOOTH: six vertical gores (sphere wedges) that
      // together form one perfect sphere — nothing protrudes. The root is the
      // white base sphere (also the collider); colored wedges lie flush on it.
      const b = MeshBuilder.CreateSphere('hzBeach', { diameter: 0.6, segments: 28 }, scene)
      const mat = lit(pbr(scene, { color: '#f4f0e8', rough: 0.35, name: 'hzBeachMat' }))
      b.material = mat
      const meshes = [b]
      const stripeMats = []
      const cols = ['#ff5e5e', '#29b5d8', '#ffd23f'] // alternating with white
      cols.forEach((c, i) => {
        const gore = MeshBuilder.CreateSphere('hzGore', { diameter: 0.602, segments: 28, arc: 1 / 6 }, scene)
        const gm = lit(pbr(scene, { color: c, rough: 0.35, name: 'hzGoreMat' }))
        gore.material = gm
        gore.rotation.y = i * (Math.PI * 2 / 3) // every second sixth is colored
        gore.parent = b
        meshes.push(gore)
        stripeMats.push(gm)
      })
      // the little white valve cap at the pole
      const capMat = lit(pbr(scene, { color: '#dfd8ca', rough: 0.5, name: 'hzCapMat' }))
      const cap = MeshBuilder.CreateCylinder('hzValve', { diameter: 0.07, height: 0.012, tessellation: 14 }, scene)
      cap.position.y = 0.3
      cap.material = capMat
      cap.parent = b
      meshes.push(cap)
      return { root: b, meshes, mats: [mat, ...stripeMats, capMat], restY: 0.3, phys: { shape: PhysicsShapeType.SPHERE, mass: 0.8, restitution: 0.6, friction: 0.4 } }
    },
  },
  floaty: {
    name: 'a pool floaty',
    build(scene) {
      const ring = MeshBuilder.CreateTorus('hzFloaty', { diameter: 0.66, thickness: 0.2, tessellation: 30 }, scene)
      const mat = lit(pbr(scene, { color: '#ff8ac2', rough: 0.45, name: 'hzFloatyMat' }))
      ring.material = mat
      // white safety panels around the tube, like a classic swim ring
      const panelMat = lit(pbr(scene, { color: '#f4f0e8', rough: 0.5, name: 'hzPanelMat' }))
      const meshes = [ring]
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4
        const panel = MeshBuilder.CreateSphere('hzPanel', { diameterX: 0.22, diameterY: 0.205, diameterZ: 0.22, segments: 12 }, scene)
        panel.position.set(Math.cos(a) * 0.33, 0, Math.sin(a) * 0.33)
        panel.material = panelMat
        panel.parent = ring
        meshes.push(panel)
      }
      return { root: ring, meshes, mats: [mat, panelMat], restY: 0.11, phys: { shape: PhysicsShapeType.CYLINDER, mass: 0.6, restitution: 0.5, friction: 0.5 } }
    },
  },
  sunglasses: {
    name: 'somebody’s sunglasses',
    build(scene) {
      const col = MeshBuilder.CreateBox('hzShades', { width: 0.46, height: 0.06, depth: 0.34 }, scene)
      col.isVisible = false
      const dark = lit(pbr(scene, { color: '#14181f', rough: 0.2, name: 'hzShadeMat' }))
      const frameMat = lit(pbr(scene, { color: '#e8342f', rough: 0.4, name: 'hzFrameMat' }))
      const meshes = [col]
      for (const s of [-1, 1]) {
        const rim = MeshBuilder.CreateTorus('hzRim', { diameter: 0.19, thickness: 0.02, tessellation: 24 }, scene)
        rim.position.set(s * 0.115, 0, 0.08)
        rim.material = frameMat
        rim.parent = col
        const lens = MeshBuilder.CreateCylinder('hzLens', { diameter: 0.18, height: 0.018, tessellation: 24 }, scene)
        lens.position.set(s * 0.115, 0, 0.08)
        lens.material = dark
        lens.parent = col
        // temple arms folded back
        const arm = xCapsule(scene, 'hzTArm', 0.011, 0.26, 8)
        arm.position.set(s * 0.21, 0.005, -0.06)
        arm.rotation.y = Math.PI / 2
        arm.material = frameMat
        arm.parent = col
        meshes.push(rim, lens, arm)
      }
      const bridge = MeshBuilder.CreateCapsule('hzBridge', { radius: 0.012, height: 0.08, orientation: new Vector3(1, 0, 0), tessellation: 8, capSubdivisions: 4 }, scene)
      bridge.position.set(0, 0.008, 0.08)
      bridge.material = frameMat
      bridge.parent = col
      meshes.push(bridge)
      return { root: col, meshes, mats: [dark, frameMat], restY: 0.035, phys: { shape: PhysicsShapeType.BOX, mass: 0.4, restitution: 0.3, friction: 0.6 } }
    },
  },
  towel: {
    name: 'a dropped beach towel',
    build(scene) {
      const base = MeshBuilder.CreateBox('hzTowel', { width: 0.62, height: 0.035, depth: 0.42 }, scene)
      const mat = lit(pbr(scene, { color: '#29b5d8', rough: 0.95, name: 'hzTowelMat' }))
      base.material = mat
      const stripeMat = lit(pbr(scene, { color: '#f4f0e8', rough: 0.95, name: 'hzTowelStripe' }))
      const meshes = [base]
      for (const x of [-0.18, 0.18]) {
        const s = MeshBuilder.CreateBox('hzTStripe', { width: 0.09, height: 0.037, depth: 0.42 }, scene)
        s.position.set(x, 0.001, 0)
        s.material = stripeMat
        s.parent = base
        meshes.push(s)
      }
      // one edge flopped into a soft roll — towels don't lie perfectly flat
      const roll = MeshBuilder.CreateCapsule('hzRoll', { radius: 0.032, height: 0.4, orientation: new Vector3(0, 0, 1), tessellation: 14, capSubdivisions: 6 }, scene)
      roll.position.set(0.29, 0.02, 0)
      roll.material = mat
      roll.parent = base
      meshes.push(roll)
      return { root: base, meshes, mats: [mat, stripeMat], restY: 0.02, phys: { shape: PhysicsShapeType.BOX, mass: 2, restitution: 0.1, friction: 0.9 } }
    },
  },
  sandal: {
    name: 'a flip-flop',
    build(scene) {
      // rounded footbed with a proper Y-strap and toe post
      const col = MeshBuilder.CreateBox('hzSandal', { width: 0.36, height: 0.09, depth: 0.16 }, scene)
      col.isVisible = false
      const mat = lit(pbr(scene, { color: '#ffd23f', rough: 0.7, name: 'hzSandalMat' }))
      const sole = xCapsule(scene, 'hzSoleF', 0.075, 0.34, 16)
      sole.scaling.y = 0.35
      sole.position.y = -0.02
      sole.material = mat
      sole.parent = col
      const strapMat = lit(pbr(scene, { color: '#e8342f', rough: 0.6, name: 'hzStrapMat' }))
      const meshes = [col, sole]
      // toe post + the two strap arms of the Y
      const post = MeshBuilder.CreateCylinder('hzPost', { diameter: 0.02, height: 0.05, tessellation: 8 }, scene)
      post.position.set(0.1, 0.02, 0)
      post.material = strapMat
      post.parent = col
      meshes.push(post)
      for (const s of [-1, 1]) {
        const strap = MeshBuilder.CreateCapsule('hzStrapArm', { radius: 0.012, height: 0.14, orientation: new Vector3(-0.8, 0.25, s * 0.55), tessellation: 8, capSubdivisions: 4 }, scene)
        strap.position.set(0.045, 0.035, s * 0.035)
        strap.material = strapMat
        strap.parent = col
        meshes.push(strap)
      }
      return { root: col, meshes, mats: [mat, strapMat], restY: 0.045, phys: { shape: PhysicsShapeType.BOX, mass: 0.5, restitution: 0.3, friction: 0.7 } }
    },
  },
}

const SHARED = ['roguepin', 'spilleddrink', 'rogueball', 'shoe']

export function hazardName(id) {
  return CATALOG[id]?.name || 'something odd'
}

// Choose which hazards land on this rack. Level: 'off' | 'light' | 'wild'.
// Light = sometimes one; wild = always at least one, often a mess.
export function pickHazards(alley, level, forceId = null) {
  if (level !== 'light' && level !== 'wild') return []
  let count
  if (level === 'light') count = Math.random() < 0.5 ? 1 : 0
  else count = 1 + (Math.random() < 0.55 ? 1 : 0) + (Math.random() < 0.18 ? 1 : 0)
  if (forceId && CATALOG[forceId]) count = Math.max(1, count)
  const themed = (alley.hazards || []).filter((id) => CATALOG[id])
  const ids = []
  for (let i = 0; i < count; i++) {
    if (forceId && i === 0) { ids.push(forceId); continue }
    const pool = themed.length && Math.random() < 0.7 ? themed : SHARED
    ids.push(pool[Math.floor(Math.random() * pool.length)])
  }
  // at most one lane-patch per rack — two puddles of lava is a lake
  let patchSeen = false
  return ids.filter((id) => {
    if (!CATALOG[id].build) return false
    const isPatch = id === 'lavapatch'
    if (isPatch && patchSeen) return false
    if (isPatch) patchSeen = true
    return true
  })
}

// Build + place one hazard on the lane. Returns everything the page needs to
// render, reflect, and dispose it.
export function spawnHazard(scene, id, { x = null, z = null } = {}) {
  const entry = CATALOG[id]
  if (!entry) return null
  const built = entry.build(scene)
  const px = built.edge
    ? (Math.random() < 0.5 ? -1 : 1) * (LANE_W / 2 - 0.3) // patches creep in from a gutter
    : x ?? -0.85 + Math.random() * 1.7
  const pz = z ?? -0.5 - Math.random() * 4
  built.root.position.set(px, built.restY, pz)
  if (!built.edge) built.root.rotation.y = (built.root.rotation.y || 0) + Math.random() * Math.PI * 2
  let agg = null
  if (built.phys) {
    agg = makeDynamic(built.root, { ...built.phys, linearDamping: 0.4, angularDamping: 0.4 })
  } else {
    built.root.freezeWorldMatrix()
  }
  return {
    id,
    name: entry.name,
    root: built.root,
    meshes: built.meshes,
    mats: built.mats,
    agg,
    patch: built.patch ? { x: px, z: pz, r: built.patch } : null,
    dispose() {
      agg?.dispose()
      for (const m of built.meshes) m.dispose()
      for (const m of built.mats) m.dispose()
    },
  }
}
