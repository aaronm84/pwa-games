// Funky celebration hardware: the disco ball, visual-only confetti bursts, and
// the strike-buzzing UFO. All cheap primitives; the page drives their timing.
import { MeshBuilder, Color3, StandardMaterial } from 'src/engine'

function flat(scene, hex, { alpha = 1, emissive } = {}) {
  const m = new StandardMaterial('fx', scene)
  m.diffuseColor = Color3.FromHexString(hex)
  m.specularColor = new Color3(0.1, 0.1, 0.1)
  if (emissive) m.emissiveColor = Color3.FromHexString(emissive)
  m.alpha = alpha
  return m
}

// A mirror ball hanging over the pin deck. Spins forever; flashes on demand.
// Options: cableTop hangs it from a long cable (for the open-backer pit);
// sparkle orbits little light glints around it so it visibly throws light.
export function makeDiscoBall(scene, x, y, z, { cableTop = null, sparkle = false } = {}) {
  const ball = MeshBuilder.CreateSphere('disco', { diameter: 1.1, segments: 32 }, scene)
  ball.convertToFlatShadedMesh() // faceted — each flat tile catches the light on its own
  const mat = new StandardMaterial('discoMat', scene)
  mat.diffuseColor = Color3.FromHexString('#6f7c92') // dark tiles; the SPECULAR is the show
  mat.specularColor = new Color3(1.6, 1.7, 1.9)
  mat.specularPower = 6 // broad hot highlights — whole tiles flash as the ball turns
  mat.emissiveColor = new Color3(0.1, 0.11, 0.15)
  ball.material = mat
  ball.position.set(x, y, z)
  const rodH = cableTop ? Math.max(0.6, cableTop - y) : 1.6
  const rod = MeshBuilder.CreateCylinder('discoRod', { diameter: 0.04, height: rodH, tessellation: 6 }, scene)
  rod.material = flat(scene, '#444a55')
  rod.position.set(x, y + 0.55 + rodH / 2, z)
  // glints: tiny bright squares wheeling around the ball, like the spots a
  // mirror ball throws on the walls — plus faint rays radiating off the ball
  const glints = []
  const beams = []
  let glintMat = null
  let beamMat = null
  if (sparkle) {
    glintMat = new StandardMaterial('discoGlint', scene)
    glintMat.emissiveColor = Color3.FromHexString('#e8f0ff')
    glintMat.disableLighting = true
    for (let i = 0; i < 10; i++) {
      const g = MeshBuilder.CreatePlane('glint', { size: 0.09 + (i % 3) * 0.04 }, scene)
      g.billboardMode = 7
      g.material = glintMat
      g.isPickable = false
      glints.push({ g, seed: i * 1.7, r: 1.0 + (i % 4) * 0.35 })
    }
    // light rays: thin translucent spokes fanning out of the ball in the
    // camera-facing plane, twinkling independently
    beamMat = new StandardMaterial('discoBeam', scene)
    beamMat.emissiveColor = Color3.FromHexString('#cfe0ff')
    beamMat.disableLighting = true
    beamMat.alpha = 0.16
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.35
      const len = 1.7 + (i % 3) * 0.8
      const beam = MeshBuilder.CreateBox('discoRay', { width: 0.045, height: len, depth: 0.01 }, scene)
      beam.position.set(x + Math.cos(a + Math.PI / 2) * (0.62 + len / 2), y + Math.sin(a + Math.PI / 2) * (0.62 + len / 2), z)
      beam.rotation.z = a
      beam.material = beamMat
      beam.isPickable = false
      beam.freezeWorldMatrix()
      beams.push({ beam, seed: i * 2.3 })
    }
  }
  let flash = 0
  return {
    ball,
    flash() { flash = 90 },
    update(t) {
      ball.rotation.y = t * 0.01
      for (const { g, seed, r } of glints) {
        const a = t * 0.012 + seed * 2.4
        g.position.set(
          x + Math.cos(a) * r,
          y + Math.sin(t * 0.017 + seed * 3) * 0.7,
          z + Math.sin(a) * r,
        )
        g.visibility = 0.35 + Math.max(0, Math.sin(t * 0.11 + seed * 5)) * 0.65
      }
      // each ray breathes on its own; the whole fan surges during a flash
      for (const { beam, seed } of beams) {
        beam.visibility = 0.35 + Math.sin(t * 0.035 + seed * 4) * 0.3 + (flash > 0 ? 0.35 : 0)
      }
      if (flash > 0) {
        flash--
        const hue = (t * 9) % 360
        mat.emissiveColor = Color3.FromHSV(hue, 0.85, 0.9)
      } else {
        mat.emissiveColor = new Color3(0.1, 0.11, 0.15)
      }
    },
    dispose() {
      ball.dispose()
      rod.dispose()
      mat.dispose()
      for (const { g } of glints) g.dispose()
      for (const { beam } of beams) beam.dispose()
      glintMat?.dispose()
      beamMat?.dispose()
    },
  }
}

// Visual-only confetti: tiny boxes tossed from a point, animated by hand (no
// physics bodies), self-disposing.
export function burstConfetti(scene, x, y, z, palette) {
  const bits = []
  for (let i = 0; i < 42; i++) {
    const b = MeshBuilder.CreateBox('conf', { width: 0.09, height: 0.02, depth: 0.09 }, scene)
    const m = flat(scene, palette[i % palette.length], { emissive: palette[i % palette.length] })
    b.material = m
    b.position.set(x, y, z)
    const a = Math.random() * Math.PI * 2
    const sp = 1.5 + Math.random() * 3
    bits.push({ b, m, vx: Math.cos(a) * sp, vy: 2.5 + Math.random() * 3, vz: Math.sin(a) * sp, rx: Math.random() * 0.3, rz: Math.random() * 0.3, life: 80 + (Math.random() * 30) | 0 })
  }
  return {
    done: false,
    update(dt) {
      let alive = 0
      for (const c of bits) {
        if (c.life <= 0) continue
        alive++
        c.life--
        c.vy -= 7 * dt
        c.b.position.x += c.vx * dt
        c.b.position.y += c.vy * dt
        c.b.position.z += c.vz * dt
        c.b.rotation.x += c.rx
        c.b.rotation.z += c.rz
        if (c.life < 20) c.m.alpha = c.life / 20
        if (c.life <= 0) { c.b.dispose(); c.m.dispose() }
      }
      this.done = alive === 0
    },
    dispose() { for (const c of bits) { if (c.life > 0) { c.b.dispose(); c.m.dispose() } } },
  }
}

// The saucer from next door. Swoops over the pin deck when someone strikes.
export function makeUfo(scene) {
  const mat = flat(scene, '#9aa7b3')
  mat.specularColor = new Color3(0.9, 0.9, 1)
  const saucer = MeshBuilder.CreateSphere('ufo', { diameterX: 1.6, diameterY: 0.45, diameterZ: 1.6, segments: 24 }, scene)
  saucer.material = mat
  const dome = MeshBuilder.CreateSphere('dome', { diameter: 0.8, segments: 20 }, scene)
  dome.material = flat(scene, '#bfe8ff', { alpha: 0.7 })
  dome.parent = saucer
  dome.position.y = 0.18
  dome.scaling.y = 0.7
  saucer.setEnabled(false)
  let t = -1
  return {
    buzz() { t = 0 },
    update() {
      if (t < 0) return
      t++
      saucer.setEnabled(true)
      const k = t / 140
      saucer.position.set(-8 + k * 16, 3.2 + Math.sin(k * Math.PI) * 0.8, -7 + Math.sin(t * 0.1) * 0.5)
      saucer.rotation.z = Math.sin(t * 0.15) * 0.15
      if (t > 140) { t = -1; saucer.setEnabled(false) }
    },
    dispose() { saucer.dispose(); dome.dispose(); mat.dispose() },
  }
}
