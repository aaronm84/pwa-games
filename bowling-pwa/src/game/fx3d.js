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
export function makeDiscoBall(scene, x, y, z) {
  const ball = MeshBuilder.CreateSphere('disco', { diameter: 1.1, segments: 32 }, scene)
  const mat = new StandardMaterial('discoMat', scene)
  mat.diffuseColor = Color3.FromHexString('#cfd6e4')
  mat.specularColor = new Color3(1, 1, 1)
  mat.specularPower = 8
  mat.emissiveColor = new Color3(0.12, 0.12, 0.16)
  ball.material = mat
  ball.position.set(x, y, z)
  const rod = MeshBuilder.CreateCylinder('discoRod', { diameter: 0.04, height: 1.6, tessellation: 6 }, scene)
  rod.material = flat(scene, '#444a55')
  rod.position.set(x, y + 1.3, z)
  let flash = 0
  return {
    flash() { flash = 90 },
    update(t) {
      ball.rotation.y = t * 0.01
      if (flash > 0) {
        flash--
        const hue = (t * 9) % 360
        mat.emissiveColor = Color3.FromHSV(hue, 0.85, 0.9)
      } else {
        mat.emissiveColor = new Color3(0.12, 0.12, 0.16)
      }
    },
    dispose() { ball.dispose(); rod.dispose(); mat.dispose() },
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
