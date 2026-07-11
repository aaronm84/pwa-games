// 3D Mini Golf course content + a hole builder.
//
// Holes are simple data (a green rectangle, a tee, a cup, and optional inner
// wall "bars"). buildHole turns a definition into meshes + static physics bodies
// and returns the tee/cup world positions for the controller.
import { makeStatic, pbr, MeshBuilder, Vector3, Color3, StandardMaterial } from 'src/engine'

export const CUP_R = 0.55 // world radius at which a slow ball drops in
const WALL_H = 0.7
const WALL_T = 0.5

export const holes = [
  { name: 'The Opener', par: 2, w: 8, l: 22, tee: { x: 0, z: 9 }, cup: { x: 0, z: -9 }, bars: [] },
  {
    name: 'Sidestep',
    par: 3,
    w: 11,
    l: 22,
    tee: { x: -3, z: 9 },
    cup: { x: 3, z: -9 },
    bars: [{ x: 0, z: 0, w: 6.5, l: 1.1 }],
  },
  {
    name: 'The Slalom',
    par: 3,
    w: 10,
    l: 24,
    tee: { x: 0, z: 10 },
    cup: { x: 0, z: -10 },
    bars: [
      { x: -1.6, z: 3.5, w: 6.8, l: 1 },
      { x: 1.6, z: -3.5, w: 6.8, l: 1 },
    ],
  },
]

export function buildHole(scene, shadow, def) {
  const meshes = []
  const grassMat = pbr(scene, { color: '#3fa24c', rough: 0.95, name: 'grass' })
  const wallMat = pbr(scene, { color: '#e9edf2', rough: 0.6, name: 'curb' })

  // green
  const ground = MeshBuilder.CreateBox('green', { width: def.w, height: 0.5, depth: def.l }, scene)
  ground.position.y = -0.25
  ground.material = grassMat
  ground.receiveShadows = true
  makeStatic(ground, { shape: undefined, friction: 0.8, restitution: 0.25 })
  meshes.push(ground)

  // perimeter curbs
  const hw = def.w / 2
  const hl = def.l / 2
  const curbs = [
    { x: 0, z: hl + WALL_T / 2, w: def.w + WALL_T * 2, l: WALL_T },
    { x: 0, z: -hl - WALL_T / 2, w: def.w + WALL_T * 2, l: WALL_T },
    { x: hw + WALL_T / 2, z: 0, w: WALL_T, l: def.l },
    { x: -hw - WALL_T / 2, z: 0, w: WALL_T, l: def.l },
  ]
  for (const c of [...curbs, ...(def.bars || [])]) {
    const wall = MeshBuilder.CreateBox('wall', { width: c.w, height: WALL_H, depth: c.l }, scene)
    wall.position.set(c.x, WALL_H / 2 - 0.1, c.z)
    wall.material = wallMat
    wall.receiveShadows = true
    shadow.addShadowCaster(wall)
    makeStatic(wall, { friction: 0.5, restitution: 0.55 })
    meshes.push(wall)
  }

  // cup: a dark recessed disc + a flag
  const cup = MeshBuilder.CreateCylinder('cup', { diameter: CUP_R * 2, height: 0.35, tessellation: 24 }, scene)
  cup.position.set(def.cup.x, -0.16, def.cup.z)
  const cupMat = new StandardMaterial('cupMat', scene)
  cupMat.diffuseColor = new Color3(0.05, 0.09, 0.06)
  cupMat.specularColor = new Color3(0, 0, 0)
  cup.material = cupMat
  meshes.push(cup)

  const pole = MeshBuilder.CreateCylinder('pole', { diameter: 0.06, height: 2.4, tessellation: 8 }, scene)
  pole.position.set(def.cup.x, 1.1, def.cup.z)
  const poleMat = new StandardMaterial('poleMat', scene)
  poleMat.diffuseColor = new Color3(0.9, 0.9, 0.9)
  pole.material = poleMat
  shadow.addShadowCaster(pole)
  meshes.push(pole)

  const flag = MeshBuilder.CreatePlane('flag', { width: 1, height: 0.6 }, scene)
  flag.position.set(def.cup.x + 0.5, 1.9, def.cup.z)
  const flagMat = new StandardMaterial('flagMat', scene)
  flagMat.diffuseColor = new Color3(0.9, 0.15, 0.15)
  flagMat.emissiveColor = new Color3(0.35, 0.03, 0.03)
  flagMat.backFaceCulling = false
  flag.material = flagMat
  meshes.push(flag)

  // tee marker
  const tee = MeshBuilder.CreateCylinder('tee', { diameter: 0.7, height: 0.04, tessellation: 20 }, scene)
  tee.position.set(def.tee.x, 0.02, def.tee.z)
  const teeMat = new StandardMaterial('teeMat', scene)
  teeMat.diffuseColor = new Color3(0.85, 0.85, 0.9)
  teeMat.alpha = 0.5
  tee.material = teeMat
  meshes.push(tee)

  return {
    cupPos: new Vector3(def.cup.x, 0, def.cup.z),
    teePos: new Vector3(def.tee.x, 0.3, def.tee.z),
    dispose() {
      for (const m of meshes) m.dispose()
      grassMat.dispose()
      wallMat.dispose()
    },
  }
}
