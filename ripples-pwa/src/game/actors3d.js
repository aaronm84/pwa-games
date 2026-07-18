// The pond's gameplay actors, with Havok under the drifting pieces.
//
// This is a gravity-zero water world: everything floats in the x/z plane.
// Drifting lily pads are real dynamic bodies — wavefronts shove them with
// impulses, they collide with stones, each other and the (invisible)
// protection cylinder around every sleeping lotus, and heavy linear damping
// plays the role of water drag. That replaces the hand-rolled circle-vs-
// circle separation code the 2D game needed.
import {
  MeshBuilder,
  Mesh,
  Vector3,
  Color3,
  StandardMaterial,
  pbr,
  makeStatic,
  makeDynamic,
  PhysicsShapeType,
} from 'src/engine'
import { surfaceHeight, ripplePower } from './waves.js'

const PAD_Y = 0.05 // resting height of anything floating on the water

// ---- stones ----------------------------------------------------------------
export function buildStones(scene, shadow, stones) {
  const items = []
  const mats = []
  for (const s of stones) {
    const mat = pbr(scene, { color: '#7d7a74', rough: 0.85, name: `stoneMat_${s.id}` })
    mat.albedoColor = mat.albedoColor.scale(0.85 + ((s.radius * 100) % 30) / 100)
    const m = MeshBuilder.CreateSphere(s.id, { diameter: s.radius * 2, segments: 10 }, scene)
    m.scaling.y = s.squash
    m.position.set(s.x, s.radius * s.squash * 0.35, s.z)
    m.rotation.y = s.rotation
    m.material = mat
    m.isPickable = false
    shadow?.addShadowCaster(m)
    const agg = makeStatic(m, { shape: PhysicsShapeType.SPHERE, friction: 0.4, restitution: 0.5 })
    items.push({ mesh: m, agg })
    mats.push(mat)
  }
  return {
    dispose() {
      for (const it of items) {
        it.agg.dispose()
        it.mesh.dispose()
      }
      for (const m of mats) m.dispose()
    },
  }
}

// ---- lotus flowers ---------------------------------------------------------
// A pad, two rings of petals, a golden heart — all procedural. The flower
// bobs on the displaced surface, glows as wave power charges it, flashes
// gold on activation, then slips under with a closing splash ring.
// (the scene's GlowLayer blooms the emissive petals on its own)
export function buildLotuses(scene, shadow, lotusData, pal) {
  const flowers = []

  for (const L of lotusData) {
    const root = MeshBuilder.CreateBox(`${L.id}_root`, { size: 0.001 }, scene)
    root.isVisible = false
    root.position.set(L.x, PAD_Y, L.z)

    const padMat = pbr(scene, { color: '#2f6a2a', rough: 0.75, name: `${L.id}_padMat` })
    const pad = MeshBuilder.CreateCylinder(`${L.id}_pad`, { diameter: L.padRadius * 2, height: 0.07, tessellation: 26 }, scene)
    pad.material = padMat
    pad.parent = root
    shadow?.addShadowCaster(pad)

    // petals: pink by default, tinted per-flower via the level's hue pick
    const base = Color3.FromHexString(pal.petal)
    const tint = new Color3(
      Math.min(1, base.r * (0.92 + L.hue * 0.16)),
      Math.min(1, base.g * (0.88 + L.hue * 0.2)),
      Math.min(1, base.b * (0.95 + (1 - L.hue) * 0.1)),
    )
    const petalMat = pbr(scene, { color: '#ffffff', rough: 0.45, name: `${L.id}_petalMat` })
    petalMat.albedoColor = tint
    const heartMat = pbr(scene, { color: '#ffd54a', rough: 0.4, name: `${L.id}_heartMat` })

    const parts = [pad]
    const mkPetal = (ring, i, n) => {
      const p = MeshBuilder.CreateSphere(`${L.id}_p${ring}_${i}`, { diameter: 1, segments: 8 }, scene)
      const s = L.scale * (ring === 0 ? 1 : 0.62)
      p.scaling.set(0.34 * s, 0.1 * s, 0.6 * s)
      const a = (i / n) * Math.PI * 2 + L.rotation + ring * 0.5
      const rr = (ring === 0 ? 0.34 : 0.18) * L.scale
      p.position.set(Math.cos(a) * rr, 0.1 + ring * 0.07, Math.sin(a) * rr)
      p.rotation.y = -a + Math.PI / 2
      p.rotation.x = -(ring === 0 ? 0.35 : 0.6)
      p.material = petalMat
      p.parent = root
      parts.push(p)
      return p
    }
    for (let i = 0; i < 6; i++) mkPetal(0, i, 6)
    for (let i = 0; i < 5; i++) mkPetal(1, i, 5)

    const heart = MeshBuilder.CreateSphere(`${L.id}_heart`, { diameter: 0.22 * L.scale, segments: 8 }, scene)
    heart.position.y = 0.16
    heart.material = heartMat
    heart.parent = root
    parts.push(heart)
    for (const p of parts) {
      p.isPickable = false
      shadow?.addShadowCaster(p)
    }

    // the invisible wall that keeps drifting pads (and taps) out of the
    // flower's calm circle until it wakes
    const guardMesh = MeshBuilder.CreateCylinder(`${L.id}_guard`, { diameter: L.protectedRadius * 2, height: 0.5, tessellation: 16 }, scene)
    guardMesh.position.set(L.x, PAD_Y, L.z)
    guardMesh.isVisible = false
    const guard = makeStatic(guardMesh, { shape: PhysicsShapeType.CYLINDER, friction: 0.1, restitution: 0.6 })

    // a faint dashed halo so the calm circle is readable in-world
    const halo = MeshBuilder.CreateTorus(`${L.id}_halo`, { diameter: L.protectedRadius * 2, thickness: 0.02, tessellation: 48 }, scene)
    halo.position.set(L.x, PAD_Y + 0.06, L.z)
    halo.isPickable = false
    const haloMat = pbr(scene, { color: '#ffffff', rough: 1, name: `${L.id}_haloMat` })
    haloMat.alpha = 0.1
    haloMat.unlit = true
    halo.material = haloMat

    // activation splash ring (hidden until the moment)
    const splash = MeshBuilder.CreateTorus(`${L.id}_splash`, { diameter: 1, thickness: 0.05, tessellation: 48 }, scene)
    splash.isVisible = false
    splash.isPickable = false
    const splashMat = haloMat.clone(`${L.id}_splashMat`)
    splashMat.alpha = 0
    splash.material = splashMat

    flowers.push({
      data: L,
      root,
      petalMat,
      heartMat,
      padMat,
      haloMat,
      halo,
      guard,
      guardMesh,
      splash,
      splashMat,
      splashT: -1,
      bobPhase: L.rotation * 3,
    })
  }

  return {
    flowers,
    // called once when the wave model reports an activation
    activate(f) {
      f.petalMat.emissiveColor = Color3.FromHexString('#ffca55').scale(0.9)
      f.heartMat.emissiveColor = Color3.FromHexString('#ffe9a8')
      f.splashT = 0
      f.halo.isVisible = false
      f.guard.dispose() // pads may drift over the spot once the flower wakes
      f.guardMesh.dispose()
    },
    update(t, dt, ripples) {
      for (const f of flowers) {
        const L = f.data
        if (!L.isActivated) {
          // ride the displaced surface
          const y = surfaceHeight(L.x, L.z, ripples, t)
          f.root.position.y = PAD_Y + y
          f.root.rotation.z = Math.sin(t * 0.9 + f.bobPhase) * 0.02 + y * 0.6
          f.root.rotation.x = Math.cos(t * 0.7 + f.bobPhase) * 0.02
          // charge glow: the petals light toward gold as power builds
          const charge = Math.min(1, (L.currentPower || 0) / L.threshold)
          const acc = Math.min(1, (L.accumulatedPower || 0) / (L.threshold * 0.8))
          const k = Math.max(charge, acc * 0.85)
          f.petalMat.emissiveColor = new Color3(0.9 * k, 0.62 * k, 0.28 * k).scale(0.55)
          f.heartMat.emissiveColor = new Color3(1, 0.85, 0.4).scale(k * 0.7)
          f.haloMat.alpha = 0.08 + k * 0.12
        } else if (L.sinkProgress < 1) {
          // sink: slide under, shrink a little, splash ring closes over
          L.sinkProgress = Math.min(1, (L.sinkProgress || 0) + dt * 0.5)
          const s = L.sinkProgress
          f.root.position.y = PAD_Y - s * 0.75
          const shrink = 1 - s * 0.25
          f.root.scaling.setAll(shrink)
          f.root.rotation.z += dt * 0.15
          if (f.splashT >= 0) {
            f.splashT += dt
            const st = f.splashT
            f.splash.isVisible = st < 1.2
            f.splash.position.set(L.x, 0.05, L.z)
            const rr = 0.6 + st * 1.8
            f.splash.scaling.set(rr, 1, rr)
            f.splashMat.alpha = Math.max(0, 0.55 * (1 - st / 1.2))
          }
          // the glow fades as it goes under
          const fade = 1 - s * 0.8
          f.petalMat.emissiveColor = Color3.FromHexString('#ffca55').scale(0.9 * fade)
          f.petalMat.alpha = 1 - s * 0.7
          f.padMat.alpha = 1 - s * 0.7
          f.heartMat.alpha = 1 - s * 0.7
        } else {
          f.root.setEnabled(false)
          f.splash.isVisible = false
        }
      }
    },
    dispose() {
      for (const f of flowers) {
        f.guard?.dispose?.()
        f.guardMesh?.dispose?.()
        f.halo.dispose()
        f.haloMat.dispose()
        f.splash.dispose()
        f.splashMat.dispose()
        f.petalMat.dispose()
        f.heartMat.dispose()
        f.padMat.dispose()
        f.root.dispose(false, true)
      }
    },
  }
}

// ---- the skipping stone ----------------------------------------------------
// The stone in your hand, the dashed aim guide (the bowling-lane pattern),
// and a little pool of splash rings for each skip. Flight state lives in the
// pure skip.js model; this just draws it.
export function buildSkipper(scene, shadow, pal, thrower) {
  const stoneMat = pbr(scene, { color: '#8a857c', rough: 0.6, name: 'skipStoneMat' })
  const stone = MeshBuilder.CreateSphere('skipStone', { diameterX: 0.46, diameterY: 0.17, diameterZ: 0.38, segments: 10 }, scene)
  stone.material = stoneMat
  stone.isPickable = false
  shadow?.addShadowCaster(stone)

  // dashed guide out over the water — an aiming aid, not a laser
  const dashes = []
  for (let i = 0; i < 12; i++) {
    const d = MeshBuilder.CreateBox('gd', { width: 0.06, height: 0.014, depth: 0.38 }, scene)
    d.position.set(0, 0.12, -3.6 - i * 0.9)
    dashes.push(d)
  }
  const guide = Mesh.MergeMeshes(dashes, true, true)
  const guideMat = new StandardMaterial('guideMat', scene)
  // palette-independent: the aim line must read on every water color
  guideMat.emissiveColor = new Color3(1, 1, 1)
  guideMat.disableLighting = true
  guideMat.fogEnabled = false
  guideMat.alpha = 1
  guide.material = guideMat
  guide.isPickable = false
  guide.position.set(thrower.x, 0, thrower.z)

  // splash rings for each skip
  const splashMat = new StandardMaterial('skipSplashMat', scene)
  splashMat.emissiveColor = new Color3(0.95, 0.99, 1)
  splashMat.disableLighting = true
  splashMat.alpha = 0
  const splashes = []
  for (let i = 0; i < 8; i++) {
    const m = MeshBuilder.CreateTorus(`skipSplash${i}`, { diameter: 0.5, thickness: 0.05, tessellation: 32 }, scene)
    m.material = splashMat.clone(`skipSplashMat${i}`)
    m.isVisible = false
    m.isPickable = false
    splashes.push({ mesh: m, t: -1, k: 1 })
  }

  return {
    stone,
    guideMesh: guide, // exposed so the page can exclude it from the GlowLayer
    // stone resting in the hand, guide showing the line
    rest(aimX, angle) {
      stone.setEnabled(true)
      // ahead of the thrower so it clears the camera near-plane — you can
      // see the stone you're about to throw
      stone.position.set(thrower.x + aimX, 0.34, thrower.z - 3.1)
      stone.rotation.set(0, 0, 0)
      guide.position.x = thrower.x + aimX
      // LH yaw: rotation.y = +angle points the dashes at (-sin a) while the
      // stone flies at (+sin a) — negate so the guide shows the real line
      guide.rotation.y = -angle
    },
    setAiming(on, windup = 0) {
      guide.setEnabled(on)
      guideMat.alpha = 0.5 + windup * 0.35
    },
    // pull the stone back and low while winding up
    windup(aimX, k) {
      stone.position.set(thrower.x + aimX, 0.34 - k * 0.12, thrower.z - 3.1 + k * 1.3)
    },
    // draw the in-flight stone from the pure model's state
    flight(s, dt) {
      stone.position.set(s.x, Math.max(s.y, 0) + 0.075, s.z)
      stone.rotation.x -= s.spin * dt
    },
    sunk() {
      stone.setEnabled(false)
    },
    splashAt(x, z, speed) {
      const free = splashes.find((sp) => sp.t < 0)
      if (!free) return
      free.t = 0
      free.k = Math.min(1.2, 0.5 + speed / 14)
      free.mesh.position.set(x, 0.05, z)
    },
    update(dt) {
      for (const sp of splashes) {
        if (sp.t < 0) continue
        sp.t += dt
        const life = 0.55
        if (sp.t >= life) {
          sp.t = -1
          sp.mesh.isVisible = false
          continue
        }
        const p = sp.t / life
        sp.mesh.isVisible = true
        const r = (0.35 + p * 1.6) * sp.k
        sp.mesh.scaling.set(r, 1, r)
        sp.mesh.material.alpha = 0.6 * (1 - p) * sp.k
      }
    },
    dispose() {
      stone.dispose()
      stoneMat.dispose()
      guide.material.dispose()
      guide.dispose()
      splashMat.dispose()
      for (const sp of splashes) {
        sp.mesh.material.dispose()
        sp.mesh.dispose()
      }
    },
  }
}

// ---- drifting lily pads (Havok dynamic bodies) -----------------------------
export function buildDriftingPads(scene, shadow, pads, R) {
  const items = []
  const padMat = pbr(scene, { color: '#397630', rough: 0.8, name: 'driftPadMat' })
  for (const P of pads) {
    const m = MeshBuilder.CreateCylinder(P.id, { diameter: P.radius * 2, height: 0.07, tessellation: 22 }, scene)
    m.position.set(P.x, PAD_Y, P.z)
    m.rotation.y = P.rotation
    m.material = padMat
    m.isPickable = false
    shadow?.addShadowCaster(m)
    const agg = makeDynamic(m, {
      shape: PhysicsShapeType.CYLINDER,
      mass: 0.8,
      friction: 0.2,
      restitution: 0.6,
      linearDamping: 0.9, // water drag
      angularDamping: 2.5,
    })
    // a lazy initial drift
    agg.body.setLinearVelocity(new Vector3(Math.cos(P.driftAngle) * 0.25, 0, Math.sin(P.driftAngle) * 0.25))
    items.push({ mesh: m, agg, data: P })
  }

  const tmp = new Vector3()
  return {
    items,
    update(dt, ripples) {
      for (const it of items) {
        const body = it.agg.body
        const p = it.mesh.position
        // wavefront shove: an outward impulse while the ring passes under
        for (const r of ripples) {
          const d = Math.hypot(p.x - r.x, p.z - r.z)
          const off = Math.abs(d - r.radius)
          if (off < 2 && d > 0.01) {
            const power = ripplePower(r.radius, r.peakRadius, r.peakPower)
            const k = power * (1 - off / 2) * 2.4 * dt
            tmp.set(((p.x - r.x) / d) * k, 0, ((p.z - r.z) / d) * k)
            body.applyImpulse(tmp, p)
          }
        }
        // keep the pad in the pond: a gentle inward spring near the bank
        const rr = Math.hypot(p.x, p.z)
        if (rr > R - 1.3) {
          const k = (rr - (R - 1.3)) * 1.6 * dt
          tmp.set((-p.x / rr) * k, 0, (-p.z / rr) * k)
          body.applyImpulse(tmp, p)
        }
        // this is a water plane: kill any vertical drift collisions impart
        const v = body.getLinearVelocity()
        if (v.y !== 0) {
          v.y = 0
          body.setLinearVelocity(v)
        }
        // a floor drift speed so pads never go fully still (matches 2D feel)
        const speed = Math.hypot(v.x, v.z)
        if (speed < 0.06) {
          const a = Math.random() * Math.PI * 2
          tmp.set(Math.cos(a) * 0.08 * dt, 0, Math.sin(a) * 0.08 * dt)
          body.applyImpulse(tmp, p)
        }
      }
    },
    dispose() {
      for (const it of items) {
        it.agg.dispose()
        it.mesh.dispose()
      }
      padMat.dispose()
    },
  }
}
