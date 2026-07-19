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
  Quaternion,
  Color3,
  StandardMaterial,
  pbr,
  makeStatic,
  makeDynamic,
  PhysicsShapeType,
} from 'src/engine'
import { surfaceHeight, ripplePower } from './waves.js'
import { warpPadMesh } from './flora.js'

const PAD_Y = 0.05 // resting height of anything floating on the water

// ---- stones ----------------------------------------------------------------
export function buildStones(scene, shadow, stones) {
  const items = []
  const mats = []
  for (const s of stones) {
    const mat = pbr(scene, { color: '#7d7a74', rough: 0.85, name: `stoneMat_${s.id}` })
    mat.albedoColor = mat.albedoColor.scale(0.85 + ((s.radius * 100) % 30) / 100)
    const m = MeshBuilder.CreateIcoSphere(s.id, { radius: s.radius, subdivisions: 2 }, scene)
    m.scaling.set(1 + (s.rotation % 0.3), s.squash, 1 + ((s.rotation * 1.7) % 0.25))
    m.position.set(s.x, s.radius * s.squash * 0.35, s.z)
    m.rotation.y = s.rotation
    m.convertToFlatShadedMesh() // faceted like a river boulder
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

    // some pads run green, some flush burgundy like the reference lilies
    const burgundy = L.hue > 0.78
    const padMat = pbr(scene, { color: burgundy ? '#5a3a34' : '#2f6a2a', rough: 0.75, name: `${L.id}_padMat` })
    if (!burgundy) padMat.albedoColor = padMat.albedoColor.scale(0.85 + L.hue * 0.35)
    const pad = MeshBuilder.CreateCylinder(`${L.id}_pad`, { diameter: L.padRadius * 2, height: 0.07, tessellation: 28, arc: 0.92, enclose: true }, scene)
    warpPadMesh(pad, L.rotation, 0.05)
    pad.rotation.y = L.rotation
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
      const p = MeshBuilder.CreateSphere(`${L.id}_p${ring}_${i}`, { diameter: 1, segments: 10 }, scene)
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
    for (let i = 0; i < 8; i++) mkPetal(0, i, 8)
    for (let i = 0; i < 6; i++) mkPetal(1, i, 6)

    const heart = MeshBuilder.CreateSphere(`${L.id}_heart`, { diameter: 0.22 * L.scale, segments: 8 }, scene)
    heart.position.y = 0.16
    heart.material = heartMat
    heart.parent = root
    parts.push(heart)
    // a ring of stamens around the heart
    for (let i = 0; i < 6; i++) {
      const st = MeshBuilder.CreateSphere(`${L.id}_st${i}`, { diameter: 0.05 * L.scale, segments: 5 }, scene)
      const sa = (i / 6) * Math.PI * 2
      st.position.set(Math.cos(sa) * 0.13 * L.scale, 0.185, Math.sin(sa) * 0.13 * L.scale)
      st.material = heartMat
      st.parent = root
      parts.push(st)
    }
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
          f.root.scaling.setAll(1 + Math.sin(t * 0.7 + f.bobPhase) * 0.01) // breathing, not frozen
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
  const stone = MeshBuilder.CreateIcoSphere('skipStone', { radius: 0.23, subdivisions: 2 }, scene)
  stone.scaling.set(1, 0.38, 0.85)
  stone.convertToFlatShadedMesh() // a flat river pebble, not a marble
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
    // each splash carries a handful of droplets that pop up and fall back
    const drops = []
    for (let d = 0; d < 4; d++) {
      const dm = MeshBuilder.CreateSphere(`drop${i}_${d}`, { diameter: 0.05, segments: 4 }, scene)
      dm.material = m.material
      dm.isVisible = false
      dm.isPickable = false
      drops.push({ mesh: dm, vx: 0, vy: 0, vz: 0 })
    }
    splashes.push({ mesh: m, drops, t: -1, k: 1 })
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
      for (const dr of free.drops) {
        const a = Math.random() * Math.PI * 2
        const sp = 0.6 + Math.random() * 0.9 * free.k
        dr.mesh.position.set(x, 0.06, z)
        dr.vx = Math.cos(a) * sp * 0.5
        dr.vz = Math.sin(a) * sp * 0.5
        dr.vy = 1.2 + Math.random() * 1.4 * free.k
      }
    },
    update(dt) {
      for (const sp of splashes) {
        if (sp.t < 0) continue
        sp.t += dt
        const life = 0.55
        if (sp.t >= life) {
          sp.t = -1
          sp.mesh.isVisible = false
          for (const dr of sp.drops) dr.mesh.isVisible = false
          continue
        }
        const p = sp.t / life
        sp.mesh.isVisible = true
        const r = (0.35 + p * 1.6) * sp.k
        sp.mesh.scaling.set(r, 1, r)
        sp.mesh.material.alpha = 0.6 * (1 - p) * sp.k
        for (const dr of sp.drops) {
          dr.vy -= 9.8 * dt
          const dp = dr.mesh.position
          dp.x += dr.vx * dt
          dp.y += dr.vy * dt
          dp.z += dr.vz * dt
          dr.mesh.isVisible = dp.y > 0.02
        }
      }
    },
    dispose() {
      stone.dispose()
      stoneMat.dispose()
      guide.material.dispose()
      guide.dispose()
      splashMat.dispose()
      for (const sp of splashes) {
        for (const dr of sp.drops) dr.mesh.dispose()
        sp.mesh.material.dispose()
        sp.mesh.dispose()
      }
    },
  }
}

// ---- drifting lily pads (Havok dynamic bodies) -----------------------------
// Havok moves the pads in the water plane (drift, shoves, collisions), but a
// gravity-zero world has nothing to right a pad a hard contact tips or lifts
// — left alone they wedge at odd angles hovering over the water. So each
// frame we RE-SEAT the pad: yaw survives, tilt and height are handed back to
// the water (glued to the displaced surface, leaning with its slope).
// disablePreStep = false lets those transform writes reach the physics body
// (the kit's kinematic-body lesson, pointed the other way).
export function buildDriftingPads(scene, shadow, pads, R) {
  const items = []
  const padMat = pbr(scene, { color: '#397630', rough: 0.8, name: 'driftPadMat' })
  const padMats = [padMat]
  for (const P of pads) {
    // the physics PROXY: an invisible collider Havok fully owns. We never
    // write its transform (no feedback loop with the solver), only nudge it
    // with impulses and velocity clamps.
    const proxy = MeshBuilder.CreateCylinder(`${P.id}_body`, { diameter: P.radius * 2, height: 0.07, tessellation: 14 }, scene)
    proxy.position.set(P.x, PAD_Y, P.z)
    proxy.isVisible = false
    const agg = makeDynamic(proxy, {
      shape: PhysicsShapeType.CYLINDER,
      mass: 0.8,
      friction: 0.2,
      restitution: 0.2, // calm nudges, not pinball
      linearDamping: 0.9, // water drag
      angularDamping: 2.5,
    })
    // a lazy initial drift
    agg.body.setLinearVelocity(new Vector3(Math.cos(P.driftAngle) * 0.25, 0, Math.sin(P.driftAngle) * 0.25))

    // the VISIBLE pad: no physics — it follows the proxy across the plane
    // and takes its height and lean from the displaced water
    const m = MeshBuilder.CreateCylinder(P.id, { diameter: P.radius * 2, height: 0.07, tessellation: 24, arc: 0.9, enclose: true }, scene)
    warpPadMesh(m, P.rotation, 0.055)
    m.position.set(P.x, PAD_Y, P.z)
    // every pad its own shade; the odd one flushes red-brown
    const tint = padMat.clone(`${P.id}_mat`)
    tint.albedoColor = ((P.rotation * 100) % 7 < 1)
      ? Color3.FromHexString('#5f4034')
      : Color3.FromHexString('#397630').scale(0.8 + ((P.rotation * 50) % 4) / 10)
    padMats.push(tint)
    m.material = tint
    m.isPickable = false
    shadow?.addShadowCaster(m)

    items.push({ mesh: m, proxy, agg, data: P, yaw: P.rotation, unstick: 0 })
  }

  const tmp = new Vector3()
  return {
    items,
    update(dt, ripples, t = 0) {
      for (const it of items) {
        const body = it.agg.body
        const p = it.proxy.position
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
        // this is a water plane: kill any vertical drift collisions impart,
        // and let angular motion carry yaw only
        const v = body.getLinearVelocity()
        if (v.y !== 0) {
          v.y = 0
          body.setLinearVelocity(v)
        }
        const av = body.getAngularVelocity()
        if (av.x !== 0 || av.z !== 0) {
          av.x = 0
          av.z = 0
          body.setAngularVelocity(av)
        }
        // a floor drift speed so pads never go fully still (matches 2D feel)
        const speed = Math.hypot(v.x, v.z)
        if (speed < 0.06) {
          const a = Math.random() * Math.PI * 2
          tmp.set(Math.cos(a) * 0.08 * dt, 0, Math.sin(a) * 0.08 * dt)
          body.applyImpulse(tmp, p)
        }
        // escape hatch: if a contact ever lofts the proxy off the plane, put
        // it back with the one-frame disablePreStep dance (kit lesson 4) —
        // never every frame, so the solver has nothing to fight
        if (it.unstick > 0) {
          it.unstick--
          if (it.unstick === 0) body.disablePreStep = true
        } else if (Math.abs(p.y - PAD_Y) > 0.35) {
          body.disablePreStep = false
          p.y = PAD_Y
          it.unstick = 2
        }

        // the visible pad: proxy's spot in the plane, the water's height and
        // lean — Havok never sees these writes, so nothing quivers
        it.yaw += av.y * dt
        const h = surfaceHeight(p.x, p.z, ripples, t)
        const hx = surfaceHeight(p.x + 0.4, p.z, ripples, t)
        const hz = surfaceHeight(p.x, p.z + 0.4, ripples, t)
        it.mesh.position.set(p.x, PAD_Y + h, p.z)
        const tiltZ = Math.max(-0.2, Math.min(0.2, (h - hx) * 1.6))
        const tiltX = Math.max(-0.2, Math.min(0.2, (hz - h) * 1.6))
        it.mesh.rotationQuaternion = Quaternion.RotationYawPitchRoll(it.yaw, tiltX, tiltZ)
      }
    },
    dispose() {
      for (const it of items) {
        it.agg.dispose()
        it.proxy.dispose()
        it.mesh.dispose()
      }
      for (const m of padMats) m.dispose()
    },
  }
}
