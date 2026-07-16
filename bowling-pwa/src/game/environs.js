// Per-alley set dressing — the world beyond the lane. Everything static is
// merged into single meshes and frozen so the whole environment costs a few
// draw calls; only the small animated bits (embers, asteroids) tick.
import { MeshBuilder, Mesh, Color3, StandardMaterial, pbr } from 'src/engine'

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

export function buildEnvirons(scene, alley) {
  const meshes = []
  const mats = []
  const track = (m) => (meshes.push(m), m)
  const tmat = (m) => (mats.push(m), m)
  const animated = []

  if (alley.fx === 'discoball') {
    // Disco Nova: a starfield and three neon arches spanning the lane
    const starMat = tmat(emissiveMat(scene, '#cdd3ff', { scale: 0.8 }))
    track(starfield(scene, 70, starMat))
    const archAMat = tmat(emissiveMat(scene, alley.colors.laneEdgeA, { scale: 0.65 }))
    const archBMat = tmat(emissiveMat(scene, alley.colors.laneEdgeB, { scale: 0.65 }))
    for (let i = 0; i < 3; i++) {
      const arch = MeshBuilder.CreateTorus('arch', { diameter: 7 - i * 0.6, thickness: 0.09, tessellation: 40 }, scene)
      arch.rotation.x = Math.PI / 2
      arch.rotation.z = Math.PI / 2
      arch.position.set(0, 0.4, -1.5 - i * 2.6)
      arch.material = i % 2 ? archAMat : archBMat
      arch.isPickable = false
      arch.freezeWorldMatrix()
      track(arch)
    }
  } else if (alley.fx === 'lava') {
    // Lava Lanes: canyon walls, a glowing volcano on the horizon, drifting embers
    const rockMat = tmat(pbr(scene, { color: '#241a14', rough: 0.95, name: 'rock' }))
    for (const side of [-1, 1]) {
      const wallBits = []
      for (let i = 0; i < 6; i++) {
        const w = MeshBuilder.CreateBox('crag', { width: 1.4 + (i % 3) * 0.5, height: 2.2 + ((i * 2.7) % 2.4), depth: 3.2 }, scene)
        w.position.set(side * (4.2 + (i % 2) * 0.9), 0.8, 4 - i * 3.1)
        w.rotation.y = side * 0.12 * (i % 3)
        wallBits.push(w)
      }
      const wall = Mesh.MergeMeshes(wallBits, true, true)
      wall.material = rockMat
      wall.isPickable = false
      wall.freezeWorldMatrix()
      track(wall)
    }
    const cone = MeshBuilder.CreateCylinder('volcano', { diameterTop: 2.2, diameterBottom: 8, height: 6, tessellation: 24 }, scene)
    cone.position.set(-6.5, 2.5, -22)
    cone.material = rockMat
    cone.isPickable = false
    cone.freezeWorldMatrix()
    track(cone)
    const crater = MeshBuilder.CreateTorus('crater', { diameter: 2.3, thickness: 0.35, tessellation: 28 }, scene)
    crater.position.set(-6.5, 5.55, -22)
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
          Math.sin(seed * 3.3) * 5 + Math.sin(t * 0.01 + seed) * 0.6,
          phase * 1.4 - 0.5,
          -2 - ((seed * 2.9) % 8),
        )
        e.visibility = phase < 5 ? 1 : Math.max(0, 6 - phase)
      })
    }
  } else if (alley.fx === 'ufo') {
    // Zero-G: deep starfield, a big slow planet, drifting asteroids, a truss
    const starMat = tmat(emissiveMat(scene, '#dfe8ff', { scale: 0.9 }))
    track(starfield(scene, 90, starMat, 1.31))
    const planetMat = tmat(pbr(scene, { color: '#3d6fb5', rough: 0.75, name: 'planet' }))
    planetMat.emissiveColor = Color3.FromHexString('#16304f')
    const planet = MeshBuilder.CreateSphere('planet', { diameter: 10, segments: 32 }, scene)
    planet.position.set(7.5, 6, -26)
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
        a.position.set(Math.sin(t * 0.002 + seed) * (6 + i), 2.5 + Math.sin(t * 0.003 + seed * 2) * 1.2, -10 - i * 3)
        a.rotation.y = t * 0.004 + seed
        a.rotation.x = t * 0.003
      })
    }
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
