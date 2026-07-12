// 3D versions of the flat game's critters — built from simple primitives so they
// stay cheap. The controller drives their timing and animation.
import { MeshBuilder, Vector3, Color3, StandardMaterial } from 'src/engine'

function flat(scene, hex, { alpha = 1, emissive } = {}) {
  const m = new StandardMaterial('cm', scene)
  m.diffuseColor = Color3.FromHexString(hex)
  m.specularColor = new Color3(0.05, 0.05, 0.05)
  if (emissive) m.emissiveColor = Color3.FromHexString(emissive)
  m.alpha = alpha
  return m
}

// A gator lurking in a pond: low body just above the water, snout, glowing eyes.
export function makeGator(scene, x, z) {
  const mat = flat(scene, '#2f4a1e')
  const body = MeshBuilder.CreateSphere('gator', { diameterX: 1.7, diameterY: 0.45, diameterZ: 0.95, segments: 8 }, scene)
  body.material = mat
  body.position.set(x, 0.14, z)
  const snout = MeshBuilder.CreateBox('snout', { width: 0.45, height: 0.28, depth: 0.75 }, scene)
  snout.material = mat
  snout.parent = body
  snout.position.set(0, 0, 0.75)
  const eyeMat = flat(scene, '#e8e07a', { emissive: '#4a4410' })
  const e1 = MeshBuilder.CreateSphere('ge', { diameter: 0.2, segments: 6 }, scene)
  e1.material = eyeMat
  e1.parent = body
  e1.position.set(0.24, 0.24, 0.34)
  const e2 = e1.clone('ge2')
  e2.position.set(-0.24, 0.24, 0.34)
  const parts = [body, snout, e1, e2]
  let chomp = 0
  return {
    setChomp() {
      chomp = 34
    },
    update(t) {
      body.position.y = 0.12 + Math.sin(t * 0.04) * 0.04
      body.rotation.y = Math.sin(t * 0.008) * 0.35
      body.scaling.z = chomp > 0 ? 1 + (chomp-- / 34) * 0.5 : 1
    },
    dispose() {
      for (const p of parts) p.dispose()
      mat.dispose()
      eyeMat.dispose()
    },
  }
}

// A UFO that descends, beams the ball up, and leaves. The controller runs the
// state machine and moves it; this just owns the meshes.
export function makeUfo(scene) {
  const mat = flat(scene, '#9aa7b3')
  mat.specularColor = new Color3(0.9, 0.9, 1)
  const saucer = MeshBuilder.CreateSphere('ufo', { diameterX: 3, diameterY: 0.8, diameterZ: 3, segments: 14 }, scene)
  saucer.material = mat
  const dome = MeshBuilder.CreateSphere('dome', { diameter: 1.5, segments: 12 }, scene)
  dome.material = flat(scene, '#bfe8ff', { alpha: 0.7 })
  dome.parent = saucer
  dome.position.y = 0.3
  dome.scaling.y = 0.7
  const beam = MeshBuilder.CreateCylinder('beam', { diameterTop: 0.6, diameterBottom: 2.6, height: 6, tessellation: 16 }, scene)
  beam.material = flat(scene, '#6cf08c', { alpha: 0.22, emissive: '#6cf08c' })
  beam.material.disableLighting = true
  beam.parent = saucer
  beam.position.y = -3.2
  beam.isVisible = false
  saucer.setEnabled(false)
  return {
    setEnabled(b) {
      saucer.setEnabled(b)
    },
    showBeam(b) {
      beam.isVisible = b
    },
    setPos(x, y, z) {
      saucer.position.set(x, y, z)
    },
    pos() {
      return saucer.position
    },
    dispose() {
      saucer.dispose()
      dome.dispose()
      beam.dispose()
    },
  }
}

export { Vector3 }
