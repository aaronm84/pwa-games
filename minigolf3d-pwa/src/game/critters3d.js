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

// A gator lurking in a pond: mostly submerged, it idly drifts — but can lunge,
// rising and snapping its jaws toward a point (the ball) before sinking back.
export function makeGator(scene, x, z) {
  const mat = flat(scene, '#2f4a1e')
  const root = MeshBuilder.CreateSphere('gator', { diameterX: 1.7, diameterY: 0.45, diameterZ: 0.95, segments: 8 }, scene)
  root.material = mat
  root.position.set(x, 0.14, z)
  const snout = MeshBuilder.CreateBox('snout', { width: 0.45, height: 0.28, depth: 0.75 }, scene)
  snout.material = mat
  snout.parent = root
  snout.position.set(0, 0, 0.75)
  // lower jaw hinges open on a chomp
  const jaw = MeshBuilder.CreateBox('jaw', { width: 0.42, height: 0.14, depth: 0.7 }, scene)
  jaw.material = mat
  jaw.parent = root
  jaw.position.set(0, -0.16, 0.75)
  const eyeMat = flat(scene, '#e8e07a', { emissive: '#4a4410' })
  const e1 = MeshBuilder.CreateSphere('ge', { diameter: 0.2, segments: 6 }, scene)
  e1.material = eyeMat
  e1.parent = root
  e1.position.set(0.24, 0.24, 0.34)
  const e2 = e1.clone('ge2')
  e2.position.set(-0.24, 0.24, 0.34)
  const parts = [root, snout, jaw, e1, e2]
  const baseY = 0.12
  let chomp = 0
  let lungeT = 0 // frames remaining in a lunge
  let lungeTarget = null
  return {
    x, z,
    setChomp() {
      chomp = 34
    },
    // rise up and snap toward (tx,tz); returns the frames the grab takes
    lunge(tx, tz) {
      lungeTarget = { x: tx, z: tz }
      lungeT = 30
      chomp = 34
      return 30
    },
    update(t) {
      if (lungeT > 0) {
        lungeT--
        const k = Math.sin((1 - lungeT / 30) * Math.PI) // 0→1→0 arc
        root.position.y = baseY + k * 0.9
        if (lungeTarget) root.rotation.y = Math.atan2(lungeTarget.x - x, lungeTarget.z - z)
      } else {
        root.position.y = baseY + Math.sin(t * 0.04) * 0.04
        root.rotation.y = Math.sin(t * 0.008) * 0.35
      }
      // jaw gape while chomping
      jaw.rotation.x = chomp > 0 ? (chomp-- / 34) * 0.6 : 0
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

// Bigfoot: a shaggy upright cryptid that strides across the tree line with a real
// walk cycle (arms swing opposite the legs, the body bobs on each pass), based on
// the classic 6-beat reference. Built from primitives so it stays cheap; cosmetic.
export function makeBigfoot(scene, fromLeft, z) {
  const fur = flat(scene, '#4a3423')
  const furDark = flat(scene, '#3a2818')
  const skin = flat(scene, '#c8975a')
  const dir = fromLeft ? 1 : -1

  // torso is the root; it yaws to face the direction of travel so the stride
  // reads as forward/back rather than sideways.
  const torso = MeshBuilder.CreateSphere('bf', { diameterX: 1.05, diameterY: 1.7, diameterZ: 0.85, segments: 8 }, scene)
  torso.material = fur
  const baseY = 1.75
  torso.position.set(fromLeft ? -16 : 16, baseY, z)
  torso.rotation.y = fromLeft ? Math.PI / 2 : -Math.PI / 2

  const head = MeshBuilder.CreateSphere('bfh', { diameterX: 0.8, diameterY: 0.85, diameterZ: 0.8, segments: 8 }, scene)
  head.material = fur
  head.parent = torso
  head.position.set(0, 1.15, 0.02)
  // tan face patch, tucked into the front of the head
  const face = MeshBuilder.CreateSphere('bff', { diameterX: 0.42, diameterY: 0.5, diameterZ: 0.3, segments: 6 }, scene)
  face.material = skin
  face.parent = head
  face.position.set(0, -0.05, 0.34)
  const eyeMat = flat(scene, '#241a12')
  const eyes = []
  for (const sx of [-1, 1]) {
    const e = MeshBuilder.CreateSphere('bfe', { diameter: 0.08, segments: 6 }, scene)
    e.material = eyeMat
    e.parent = head
    e.position.set(sx * 0.12, 0.05, 0.46)
    eyes.push(e)
  }

  // limbs pivot from shoulders/hips: build each as a group whose pivot is at top.
  function limb(name, isArm, side) {
    const pivot = MeshBuilder.CreateSphere(name + 'p', { diameter: 0.34, segments: 6 }, scene)
    pivot.material = fur
    pivot.parent = torso
    pivot.position.set(side * (isArm ? 0.62 : 0.28), isArm ? 0.55 : -0.75, 0)
    const seg = MeshBuilder.CreateCylinder(name, { diameterTop: 0.32, diameterBottom: 0.38, height: isArm ? 1.05 : 1.15, tessellation: 8 }, scene)
    seg.material = isArm ? fur : furDark
    seg.parent = pivot
    seg.position.y = -(isArm ? 0.55 : 0.6) // hang below the pivot
    // tan hand / foot at the end
    const end = isArm
      ? MeshBuilder.CreateSphere(name + 'h', { diameterX: 0.34, diameterY: 0.3, diameterZ: 0.34, segments: 6 }, scene)
      : MeshBuilder.CreateBox(name + 'f', { width: 0.36, height: 0.22, depth: 0.6 }, scene)
    end.material = skin
    end.parent = pivot
    end.position.set(0, -(isArm ? 1.05 : 1.15), isArm ? 0 : 0.14)
    return pivot
  }
  const armL = limb('bfaL', true, -1)
  const armR = limb('bfaR', true, 1)
  const legL = limb('bflL', false, -1)
  const legR = limb('bflR', false, 1)

  const parts = [torso, head, face, ...eyes, armL, armR, legL, legR]
  return {
    step(t) {
      torso.position.x += dir * 0.05
      const ph = t * 0.16 // gait phase
      const sw = Math.sin(ph)
      legL.rotation.x = sw * 0.6
      legR.rotation.x = -sw * 0.6
      armL.rotation.x = -sw * 0.5 // arms counter-swing the legs
      armR.rotation.x = sw * 0.5
      // body bobs down on each passing pose (twice per stride) + a slight lean
      torso.position.y = baseY - Math.abs(Math.cos(ph)) * 0.12
      torso.rotation.x = 0.08 + Math.sin(ph * 2) * 0.03
      return torso.position.x < -18 || torso.position.x > 18
    },
    dispose() {
      for (const p of parts) p.dispose()
      fur.dispose(); furDark.dispose(); skin.dispose(); eyeMat.dispose()
    },
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
