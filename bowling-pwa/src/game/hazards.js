// Lane hazards — the junk that ends up on a real (or unreal) lane. Each entry
// builds a little prop with a primitive Havok collider; the page scatters them
// on the lane between racks. Every alley has its own themed catalog, plus a
// shared pool of cross-theme clutter (rogue pins, spilled drinks, lost shoes…)
// that can show up anywhere. Special case: 'patch' hazards (encroaching lava)
// have no collider — they sit ON the lane and drag the ball that crosses them.
import {
  MeshBuilder,
  Mesh,
  Color3,
  StandardMaterial,
  pbr,
  makeDynamic,
  PhysicsShapeType,
} from 'src/engine'
import { makePinMesh, LANE_W } from './lane3d'

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
      const pip = MeshBuilder.CreateSphere('pip', { diameter: size * 0.17, segments: 6 }, scene)
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
      const cup = MeshBuilder.CreateCylinder('hzCup', { diameterTop: 0.24, diameterBottom: 0.18, height: 0.32, tessellation: 14 }, scene)
      cup.rotation.z = 1.45 // tipped over
      const cupMat = lit(pbr(scene, { color: '#e8342f', rough: 0.5, name: 'hzCupMat' }))
      cup.material = cupMat
      cup.parent = col
      const puddle = MeshBuilder.CreateCylinder('hzPuddle', { diameter: 0.5, height: 0.012, tessellation: 18 }, scene)
      const pudMat = new StandardMaterial('hzPud', scene)
      pudMat.diffuseColor = Color3.FromHexString('#5a2a18')
      pudMat.alpha = 0.55
      puddle.material = pudMat
      puddle.parent = col
      puddle.position.set(-0.28, -0.105, 0) // beside the cup mouth, on the lane
      return { root: col, meshes: [col, cup, puddle], mats: [cupMat, pudMat], restY: 0.12, phys: { shape: PhysicsShapeType.BOX, mass: 0.8, restitution: 0.3, friction: 0.6 } }
    },
  },
  rogueball: {
    name: 'a runaway house ball',
    build(scene) {
      const colors = ['#3a7ab0', '#b04a3a', '#3fa060', '#8a5ab8']
      const b = MeshBuilder.CreateSphere('hzBall', { diameter: 0.44, segments: 20 }, scene)
      const mat = lit(pbr(scene, { color: colors[Math.floor(Math.random() * colors.length)], rough: 0.25, name: 'hzBallMat' }))
      b.material = mat
      return { root: b, meshes: [b], mats: [mat], restY: 0.22, phys: { shape: PhysicsShapeType.SPHERE, mass: 6, restitution: 0.2, friction: 0.35 } }
    },
  },
  shoe: {
    name: 'a lost rental shoe',
    build(scene, { platform = false, color = '#b04a3a', accent = '#f2ede4' } = {}) {
      const soleH = platform ? 0.16 : 0.07
      const sole = MeshBuilder.CreateBox('hzSole', { width: 0.52, height: soleH, depth: 0.2 }, scene)
      const soleMat = lit(pbr(scene, { color: platform ? '#e8c400' : '#3a2c22', rough: 0.7, name: 'hzSoleMat' }))
      sole.material = soleMat
      const upper = MeshBuilder.CreateBox('hzUpper', { width: 0.3, height: 0.14, depth: 0.19 }, scene)
      upper.position.set(-0.08, soleH / 2 + 0.07, 0)
      const upMat = lit(pbr(scene, { color, rough: platform ? 0.3 : 0.6, name: 'hzUpMat' }))
      upper.material = upMat
      upper.parent = sole
      const toe = MeshBuilder.CreateSphere('hzToe', { diameterX: 0.2, diameterY: 0.13, diameterZ: 0.19, segments: 10 }, scene)
      toe.position.set(0.18, soleH / 2 + 0.04, 0)
      toe.material = upMat
      toe.parent = sole
      const lace = MeshBuilder.CreateBox('hzLace', { width: 0.14, height: 0.02, depth: 0.2 }, scene)
      lace.position.set(-0.04, soleH / 2 + 0.145, 0)
      const laceMat = lit(pbr(scene, { color: accent, rough: 0.8, name: 'hzLaceMat' }))
      lace.material = laceMat
      lace.parent = sole
      return { root: sole, meshes: [sole, upper, toe, lace], mats: [soleMat, upMat, laceMat], restY: soleH / 2 + 0.01, phys: { shape: PhysicsShapeType.BOX, mass: 1.1, restitution: 0.3, friction: 0.6 } }
    },
  },

  // -- Disco Nova ------------------------------------------------------------
  mirrorball: {
    name: 'a rogue mirror ball',
    build(scene) {
      const b = MeshBuilder.CreateSphere('hzMirror', { diameter: 0.5, segments: 12 }, scene)
      const mat = lit(pbr(scene, { color: '#cfd6e4', rough: 0.12, metal: 0.85, name: 'hzMirrorMat' }))
      b.material = mat
      return { root: b, meshes: [b], mats: [mat], restY: 0.25, phys: { shape: PhysicsShapeType.SPHERE, mass: 3, restitution: 0.4, friction: 0.4 } }
    },
  },
  discoshoe: {
    name: 'a platform disco shoe',
    build(scene) {
      return CATALOG.shoe.build(scene, { platform: true, color: '#ff3df0', accent: '#28d7fe' })
    },
  },

  // -- Lava Lanes --------------------------------------------------------------
  lavapatch: {
    name: 'encroaching lava',
    build(scene) {
      // a molten tongue creeping in from the gutter — no collider; the ball
      // that crosses it sizzles and slows (the page applies the drag)
      const blob = MeshBuilder.CreateSphere('hzLava', { diameterX: 1.0, diameterY: 0.07, diameterZ: 0.72, segments: 14 }, scene)
      const mat = glowMat(scene, '#ff6a1f', 1.15)
      blob.material = mat
      const core = MeshBuilder.CreateSphere('hzLavaCore', { diameterX: 0.55, diameterY: 0.085, diameterZ: 0.4, segments: 10 }, scene)
      const coreMat = glowMat(scene, '#ffd23f', 1.3)
      core.material = coreMat
      core.parent = blob
      const crust = MeshBuilder.CreateTorus('hzCrust', { diameter: 0.9, thickness: 0.06, tessellation: 18 }, scene)
      const crustMat = lit(pbr(scene, { color: '#241a14', rough: 1, name: 'hzCrustMat' }))
      crust.material = crustMat
      crust.scaling.z = 0.75
      crust.parent = blob
      return { root: blob, meshes: [blob, core, crust], mats: [mat, coreMat, crustMat], restY: 0.02, patch: 0.48, edge: true }
    },
  },
  boulder: {
    name: 'a basalt boulder',
    build(scene) {
      const b = MeshBuilder.CreateSphere('hzRock', { diameterX: 0.46, diameterY: 0.4, diameterZ: 0.42, segments: 7 }, scene)
      const mat = lit(pbr(scene, { color: '#3a3230', rough: 0.95, name: 'hzRockMat' }))
      b.material = mat
      return { root: b, meshes: [b], mats: [mat], restY: 0.2, phys: { shape: PhysicsShapeType.SPHERE, mass: 5, restitution: 0.2, friction: 0.7 } }
    },
  },

  // -- Zero-G ------------------------------------------------------------------
  saucer: {
    name: 'a crash-landed saucer',
    build(scene) {
      const hull = MeshBuilder.CreateCylinder('hzSaucer', { diameterTop: 0.5, diameterBottom: 0.85, height: 0.16, tessellation: 20 }, scene)
      const hullMat = lit(pbr(scene, { color: '#9aa4b2', rough: 0.35, metal: 0.6, name: 'hzSaucerMat' }))
      hull.material = hullMat
      const dome = MeshBuilder.CreateSphere('hzDome', { diameter: 0.36, segments: 12, slice: 0.5 }, scene)
      const domeMat = lit(pbr(scene, { color: '#4dff9d', rough: 0.2, name: 'hzDomeMat' }))
      domeMat.alpha = 0.85
      dome.material = domeMat
      dome.position.y = 0.08
      dome.parent = hull
      const ring = MeshBuilder.CreateTorus('hzRing', { diameter: 0.72, thickness: 0.03, tessellation: 20 }, scene)
      ring.material = glowMat(scene, '#4d9dff', 0.9)
      ring.parent = hull
      hull.rotation.z = 0.3 // nose-down in the lane, like it just hit
      return { root: hull, meshes: [hull, dome, ring], mats: [hullMat, domeMat, ring.material], restY: 0.16, phys: { shape: PhysicsShapeType.CYLINDER, mass: 12, restitution: 0.25, friction: 0.6 } }
    },
  },
  alien: {
    name: 'a passed-out alien',
    build(scene) {
      const body = MeshBuilder.CreateSphere('hzAlien', { diameterX: 0.5, diameterY: 0.17, diameterZ: 0.24, segments: 12 }, scene)
      const skin = lit(pbr(scene, { color: '#4fc46a', rough: 0.55, name: 'hzAlienMat' }))
      body.material = skin
      const head = MeshBuilder.CreateSphere('hzHead', { diameterX: 0.24, diameterY: 0.2, diameterZ: 0.22, segments: 12 }, scene)
      head.position.set(0.3, 0.03, 0)
      head.material = skin
      head.parent = body
      const eyeMat = lit(pbr(scene, { color: '#101418', rough: 0.2, name: 'hzEyeMat' }))
      for (const s of [-1, 1]) {
        const eye = MeshBuilder.CreateSphere('hzEye', { diameterX: 0.05, diameterY: 0.07, diameterZ: 0.03, segments: 6 }, scene)
        eye.position.set(0.36, 0.08, s * 0.05)
        eye.material = eyeMat
        eye.parent = body
      }
      return { root: body, meshes: [body], mats: [skin, eyeMat], restY: 0.09, phys: { shape: PhysicsShapeType.BOX, mass: 1.5, restitution: 0.3, friction: 0.6 } }
    },
  },

  // -- Tiki Grove ----------------------------------------------------------------
  coconut: {
    name: 'a fallen coconut',
    build(scene) {
      const c = MeshBuilder.CreateSphere('hzCoco', { diameter: 0.34, segments: 10 }, scene)
      const mat = lit(pbr(scene, { color: '#6b4a2b', rough: 0.9, name: 'hzCocoMat' }))
      c.material = mat
      return { root: c, meshes: [c], mats: [mat], restY: 0.17, phys: { shape: PhysicsShapeType.SPHERE, mass: 2, restitution: 0.35, friction: 0.6 } }
    },
  },
  pineapple: {
    name: 'a wayward pineapple',
    build(scene) {
      const fruit = MeshBuilder.CreateSphere('hzPine', { diameterX: 0.32, diameterY: 0.42, diameterZ: 0.32, segments: 10 }, scene)
      const mat = lit(pbr(scene, { color: '#d8a12f', rough: 0.85, name: 'hzPineMat' }))
      fruit.material = mat
      const leafMat = lit(pbr(scene, { color: '#2e8b57', rough: 0.8, name: 'hzLeafMat' }))
      const leaves = []
      for (let i = 0; i < 4; i++) {
        const leaf = MeshBuilder.CreateBox('hzLeaf', { width: 0.05, height: 0.22, depth: 0.02 }, scene)
        leaf.position.y = 0.28
        leaf.rotation.y = (i / 4) * Math.PI
        leaf.rotation.x = 0.35
        leaf.material = leafMat
        leaf.parent = fruit
        leaves.push(leaf)
      }
      return { root: fruit, meshes: [fruit, ...leaves], mats: [mat, leafMat], restY: 0.21, phys: { shape: PhysicsShapeType.SPHERE, mass: 2, restitution: 0.3, friction: 0.7 } }
    },
  },
  tikidrink: {
    name: 'an abandoned mai tai',
    build(scene) {
      const cup = MeshBuilder.CreateCylinder('hzTiki', { diameterTop: 0.22, diameterBottom: 0.16, height: 0.3, tessellation: 12 }, scene)
      const cupMat = lit(pbr(scene, { color: '#7a4a22', rough: 0.7, name: 'hzTikiMat' }))
      cup.material = cupMat
      const drink = MeshBuilder.CreateCylinder('hzJuice', { diameter: 0.2, height: 0.02, tessellation: 12 }, scene)
      const juiceMat = lit(pbr(scene, { color: '#e8481c', rough: 0.3, name: 'hzJuiceMat' }))
      drink.material = juiceMat
      drink.position.y = 0.16
      drink.parent = cup
      const brella = MeshBuilder.CreateCylinder('hzBrella', { diameterTop: 0, diameterBottom: 0.26, height: 0.08, tessellation: 10 }, scene)
      const brMat = lit(pbr(scene, { color: '#ffd23f', rough: 0.6, name: 'hzBrMat' }))
      brella.material = brMat
      brella.position.set(0.06, 0.3, 0)
      brella.rotation.z = -0.4
      brella.parent = cup
      return { root: cup, meshes: [cup, drink, brella], mats: [cupMat, juiceMat, brMat], restY: 0.16, phys: { shape: PhysicsShapeType.CYLINDER, mass: 0.9, restitution: 0.3, friction: 0.6 } }
    },
  },
  fallentorch: {
    name: 'a fallen tiki torch',
    build(scene) {
      const pole = MeshBuilder.CreateCylinder('hzTorch', { diameter: 0.1, height: 0.95, tessellation: 10 }, scene)
      pole.rotation.z = Math.PI / 2 // lying across the boards
      const poleMat = lit(pbr(scene, { color: '#5a3a1e', rough: 0.9, name: 'hzTorchMat' }))
      pole.material = poleMat
      const flame = MeshBuilder.CreateSphere('hzFlame', { diameterX: 0.18, diameterY: 0.24, diameterZ: 0.18, segments: 8 }, scene)
      const flameMat = glowMat(scene, '#ffab3a', 1.35)
      flame.material = flameMat
      flame.position.y = 0.52 // local +y = world +x once the pole is lying
      flame.parent = pole
      return { root: pole, meshes: [pole, flame], mats: [poleMat, flameMat], restY: 0.06, phys: { shape: PhysicsShapeType.CYLINDER, mass: 1.4, restitution: 0.25, friction: 0.6 } }
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
      const stack = MeshBuilder.CreateCylinder('hzChips', { diameter: 0.28, height: 0.2, tessellation: 16 }, scene)
      const mat = lit(pbr(scene, { color: '#a01a2e', rough: 0.4, name: 'hzChipMat' }))
      stack.material = mat
      const bandMat = lit(pbr(scene, { color: '#f2ede4', rough: 0.4, name: 'hzChipBand' }))
      const bands = []
      for (const y of [-0.05, 0.03]) {
        const band = MeshBuilder.CreateCylinder('hzChipB', { diameter: 0.285, height: 0.024, tessellation: 16 }, scene)
        band.position.y = y
        band.material = bandMat
        band.parent = stack
        bands.push(band)
      }
      const top = MeshBuilder.CreateCylinder('hzChipT', { diameter: 0.27, height: 0.02, tessellation: 16 }, scene)
      const topMat = lit(pbr(scene, { color: '#ffd23f', rough: 0.35, name: 'hzChipTop' }))
      top.position.y = 0.1
      top.material = topMat
      top.parent = stack
      return { root: stack, meshes: [stack, ...bands, top], mats: [mat, bandMat, topMat], restY: 0.11, phys: { shape: PhysicsShapeType.CYLINDER, mass: 1, restitution: 0.3, friction: 0.6 } }
    },
  },
  cocktail: {
    name: 'a stray martini',
    build(scene) {
      // invisible collider; the glass itself is all thin geometry
      const col = MeshBuilder.CreateCylinder('hzMartini', { diameter: 0.3, height: 0.42, tessellation: 10 }, scene)
      col.isVisible = false
      const glassMat = lit(pbr(scene, { color: '#cfd6e4', rough: 0.15, name: 'hzGlassMat' }))
      glassMat.alpha = 0.5
      const cup = MeshBuilder.CreateCylinder('hzCupV', { diameterTop: 0.3, diameterBottom: 0.02, height: 0.16, tessellation: 14 }, scene)
      cup.position.y = 0.12
      cup.material = glassMat
      cup.parent = col
      const stem = MeshBuilder.CreateCylinder('hzStem', { diameter: 0.035, height: 0.16, tessellation: 8 }, scene)
      stem.position.y = -0.02
      stem.material = glassMat
      stem.parent = col
      const base = MeshBuilder.CreateCylinder('hzBase', { diameter: 0.16, height: 0.02, tessellation: 12 }, scene)
      base.position.y = -0.1
      base.material = glassMat
      base.parent = col
      const olive = MeshBuilder.CreateSphere('hzOlive', { diameter: 0.07, segments: 8 }, scene)
      const oliveMat = lit(pbr(scene, { color: '#7a9c3a', rough: 0.5, name: 'hzOliveMat' }))
      olive.position.y = 0.14
      olive.material = oliveMat
      olive.parent = col
      return { root: col, meshes: [col, cup, stem, base, olive], mats: [glassMat, oliveMat], restY: 0.21, phys: { shape: PhysicsShapeType.CYLINDER, mass: 0.7, restitution: 0.3, friction: 0.5 } }
    },
  },

  // -- Poolside ------------------------------------------------------------------
  beachball: {
    name: 'a beach ball',
    build(scene) {
      const b = MeshBuilder.CreateSphere('hzBeach', { diameter: 0.6, segments: 20 }, scene)
      const mat = lit(pbr(scene, { color: '#f4f0e8', rough: 0.4, name: 'hzBeachMat' }))
      b.material = mat
      const stripeMats = []
      const stripes = []
      ;['#ff5e5e', '#29b5d8', '#ffd23f'].forEach((c, i) => {
        const s = MeshBuilder.CreateTorus('hzStripe', { diameter: 0.56 - i * 0.02, thickness: 0.06, tessellation: 20 }, scene)
        const sm = lit(pbr(scene, { color: c, rough: 0.4, name: 'hzStripeMat' }))
        s.material = sm
        s.position.y = (i - 1) * 0.16
        s.scaling.setAll(Math.sqrt(Math.max(0.1, 1 - ((i - 1) * 0.55) ** 2)))
        s.parent = b
        stripes.push(s)
        stripeMats.push(sm)
      })
      return { root: b, meshes: [b, ...stripes], mats: [mat, ...stripeMats], restY: 0.3, phys: { shape: PhysicsShapeType.SPHERE, mass: 0.8, restitution: 0.6, friction: 0.4 } }
    },
  },
  floaty: {
    name: 'a pool floaty',
    build(scene) {
      const ring = MeshBuilder.CreateTorus('hzFloaty', { diameter: 0.66, thickness: 0.2, tessellation: 20 }, scene)
      const mat = lit(pbr(scene, { color: '#ff8ac2', rough: 0.45, name: 'hzFloatyMat' }))
      ring.material = mat
      return { root: ring, meshes: [ring], mats: [mat], restY: 0.11, phys: { shape: PhysicsShapeType.CYLINDER, mass: 0.6, restitution: 0.5, friction: 0.5 } }
    },
  },
  sunglasses: {
    name: 'somebody’s sunglasses',
    build(scene) {
      const col = MeshBuilder.CreateBox('hzShades', { width: 0.46, height: 0.06, depth: 0.2 }, scene)
      col.isVisible = false
      const dark = lit(pbr(scene, { color: '#14181f', rough: 0.2, name: 'hzShadeMat' }))
      const meshes = [col]
      for (const s of [-1, 1]) {
        const lens = MeshBuilder.CreateCylinder('hzLens', { diameter: 0.19, height: 0.03, tessellation: 14 }, scene)
        lens.position.set(s * 0.115, 0, 0)
        lens.material = dark
        lens.parent = col
        meshes.push(lens)
      }
      const bridge = MeshBuilder.CreateBox('hzBridge', { width: 0.06, height: 0.025, depth: 0.03 }, scene)
      bridge.position.set(0, 0, -0.06)
      bridge.material = dark
      bridge.parent = col
      meshes.push(bridge)
      return { root: col, meshes, mats: [dark], restY: 0.035, phys: { shape: PhysicsShapeType.BOX, mass: 0.4, restitution: 0.3, friction: 0.6 } }
    },
  },
  towel: {
    name: 'a dropped beach towel',
    build(scene) {
      const base = MeshBuilder.CreateBox('hzTowel', { width: 0.62, height: 0.035, depth: 0.42 }, scene)
      const mat = lit(pbr(scene, { color: '#29b5d8', rough: 0.95, name: 'hzTowelMat' }))
      base.material = mat
      const stripeMat = lit(pbr(scene, { color: '#f4f0e8', rough: 0.95, name: 'hzTowelStripe' }))
      const stripes = []
      for (const x of [-0.18, 0.18]) {
        const s = MeshBuilder.CreateBox('hzTStripe', { width: 0.09, height: 0.037, depth: 0.42 }, scene)
        s.position.set(x, 0.001, 0)
        s.material = stripeMat
        s.parent = base
        stripes.push(s)
      }
      return { root: base, meshes: [base, ...stripes], mats: [mat, stripeMat], restY: 0.02, phys: { shape: PhysicsShapeType.BOX, mass: 2, restitution: 0.1, friction: 0.9 } }
    },
  },
  sandal: {
    name: 'a flip-flop',
    build(scene) {
      const sole = MeshBuilder.CreateBox('hzSandal', { width: 0.34, height: 0.045, depth: 0.15 }, scene)
      const mat = lit(pbr(scene, { color: '#ffd23f', rough: 0.7, name: 'hzSandalMat' }))
      sole.material = mat
      const strapMat = lit(pbr(scene, { color: '#e8342f', rough: 0.6, name: 'hzStrapMat' }))
      const strap = MeshBuilder.CreateTorus('hzStrap', { diameter: 0.13, thickness: 0.02, tessellation: 12 }, scene)
      strap.position.set(0.06, 0.03, 0)
      strap.rotation.z = Math.PI / 2
      strap.material = strapMat
      strap.parent = sole
      return { root: sole, meshes: [sole, strap], mats: [mat, strapMat], restY: 0.025, phys: { shape: PhysicsShapeType.BOX, mass: 0.5, restitution: 0.3, friction: 0.7 } }
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
