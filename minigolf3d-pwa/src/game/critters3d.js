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

// A bird that flaps across the sky and may drop a splat. The controller decides
// when to spawn it and whether the drop lands on the fairway.
export function makeBird(scene, fromLeft, y, z) {
  const mat = flat(scene, '#222')
  const body = MeshBuilder.CreateSphere('bird', { diameterX: 0.5, diameterY: 0.4, diameterZ: 0.7, segments: 6 }, scene)
  body.material = mat
  const wingL = MeshBuilder.CreatePlane('wingL', { width: 1.1, height: 0.5 }, scene)
  const wingR = MeshBuilder.CreatePlane('wingR', { width: 1.1, height: 0.5 }, scene)
  for (const w of [wingL, wingR]) { w.material = mat; w.material.backFaceCulling = false; w.parent = body; w.rotation.x = Math.PI / 2 }
  wingL.position.x = -0.55
  wingR.position.x = 0.55
  const dir = fromLeft ? 1 : -1
  body.position.set(fromLeft ? -14 : 14, y, z)
  body.rotation.y = fromLeft ? 0 : Math.PI
  return {
    body,
    step(t) {
      body.position.x += dir * 0.14
      const flap = Math.sin(t * 0.4) * 0.7
      wingL.rotation.y = flap
      wingR.rotation.y = -flap
      return body.position.x < -16 || body.position.x > 16 // gone?
    },
    pos() { return body.position },
    dispose() { body.dispose(); wingL.dispose(); wingR.dispose(); mat.dispose() },
  }
}

// A bird splat on the green — a dark patch that adds drag, and fades over time.
export function makeSplat(scene, x, z) {
  const disc = MeshBuilder.CreateDisc('splat', { radius: 0.55, tessellation: 12 }, scene)
  disc.rotation.x = Math.PI / 2
  disc.position.set(x, 0.03, z)
  const m = flat(scene, '#3d4a1d', { alpha: 0.85 })
  disc.material = m
  return {
    x, z, r: 0.55,
    fade(k) { m.alpha = 0.85 * k; disc.scaling.setAll(0.6 + 0.4 * k) },
    dispose() { disc.dispose(); m.dispose() },
  }
}

// Bigfoot: a big hairy silhouette that shuffles across the tree line. Cosmetic.
export function makeBigfoot(scene, fromLeft, z) {
  const mat = flat(scene, '#3b2a1c')
  const body = MeshBuilder.CreateSphere('bf', { diameterX: 1.3, diameterY: 2.1, diameterZ: 1, segments: 8 }, scene)
  body.material = mat
  const head = MeshBuilder.CreateSphere('bfh', { diameter: 1, segments: 8 }, scene)
  head.material = mat
  head.parent = body
  head.position.y = 1.35
  const legL = MeshBuilder.CreateBox('bfl', { width: 0.4, height: 1.1, depth: 0.4 }, scene)
  const legR = legL.clone('bfr')
  for (const l of [legL, legR]) { l.material = mat; l.parent = body }
  legL.position.set(-0.35, -1.4, 0)
  legR.position.set(0.35, -1.4, 0)
  const dir = fromLeft ? 1 : -1
  body.position.set(fromLeft ? -16 : 16, 1.6, z)
  return {
    step(t) {
      body.position.x += dir * 0.05
      const sw = Math.sin(t * 0.3) * 0.35
      legL.rotation.x = sw
      legR.rotation.x = -sw
      body.rotation.z = Math.sin(t * 0.3) * 0.04
      return body.position.x < -18 || body.position.x > 18
    },
    dispose() { for (const p of [body, head, legL, legR]) p.dispose(); mat.dispose() },
  }
}

// Otto's face — two googly eyes that always face the camera (a billboard root so
// they read from any angle) and squint when worried near water.
export function makeOttoFace(scene) {
  const root = MeshBuilder.CreatePlane('face', { size: 0.01 }, scene)
  root.isVisible = false
  root.billboardMode = 7 // BILLBOARDMODE_ALL
  const white = flat(scene, '#ffffff')
  const black = flat(scene, '#181818')
  const eyes = []
  for (const sx of [-1, 1]) {
    const w = MeshBuilder.CreateSphere('eyeW', { diameter: 0.12, segments: 6 }, scene)
    w.material = white
    w.parent = root
    w.position.set(sx * 0.08, 0.03, 0.13)
    const p = MeshBuilder.CreateSphere('eyeP', { diameter: 0.06, segments: 6 }, scene)
    p.material = black
    p.parent = root
    p.position.set(sx * 0.08, 0.03, 0.18)
    eyes.push({ w, p })
  }
  return {
    update(bpos) { root.position.set(bpos.x, bpos.y + 0.02, bpos.z) },
    setWorried(b) { for (const e of eyes) e.w.scaling.y = b ? 0.5 : 1 },
    dispose() { root.dispose(); for (const e of eyes) { e.w.dispose(); e.p.dispose() } white.dispose(); black.dispose() },
  }
}

export { Vector3 }
