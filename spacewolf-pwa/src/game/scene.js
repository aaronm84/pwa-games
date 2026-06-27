import {
  Engine,
  Scene,
  Color3,
  Color4,
  Vector3,
  HemisphericLight,
  DirectionalLight,
  ArcRotateCamera,
  MeshBuilder,
  StandardMaterial,
  PointsCloudSystem,
  TransformNode,
  Animation,
  Tools,
} from '@babylonjs/core'

// === Flight tuning ===
const BASE_FORWARD = 30
const TURBO_FORWARD = 60
const STEER_ACCEL = 90
const STEER_DAMP = 6
const MAX_STEER_VEL = 18
const ROLL_TILT = Tools.ToRadians(45)
const ROLL_DODGE_VEL = 26
const ROLL_FRAMES = 32

// === Combat tuning ===
const FIRE_COOLDOWN_MS = 130
const BOLT_SPEED = 140
const BOLT_LIFETIME_MS = 1500
const BOLT_POOL = 24

const ENEMY_POOL = 8
const ENEMY_HP = 2
const ENEMY_FORWARD = 12
const ENEMY_DRIFT_AMPL = 8
const ENEMY_SPAWN_INTERVAL_MS = 2000
const ENEMY_SPAWN_AHEAD = 200
const ENEMY_HIT_RADIUS = 2.4
const SCORE_PER_KILL = 100

const ENEMY_BOLT_POOL = 32
const ENEMY_BOLT_SPEED = 95
const ENEMY_BOLT_LIFETIME_MS = 2000
const ENEMY_FIRE_INTERVAL_MS = 1700
const ENEMY_FIRE_FIRST_DELAY_MS = 900
const ENEMY_FIRE_RANGE = 110
const ENEMY_AIM_INACCURACY = 4.5

const PLAYER_HIT_RADIUS = 2.6
const POST_HIT_INVULN_MS = 1500

const ASTEROID_COUNT = 22
const ASTEROID_SCORE = 25

const SPECIALS = ['bombs', 'lasers', 'missiles']

export function createGameScene(canvas, inputStore, gameStateStore) {
  const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: false,
    stencil: false,
    powerPreference: 'high-performance',
  })

  const scene = new Scene(engine)
  scene.clearColor = new Color4(0.02, 0.03, 0.1, 1)
  scene.fogMode = Scene.FOGMODE_LINEAR
  scene.fogColor = new Color3(0.02, 0.03, 0.1)
  scene.fogStart = 80
  scene.fogEnd = 260

  // === Lights ===
  const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene)
  hemi.intensity = 0.45
  hemi.diffuse = new Color3(0.7, 0.8, 1.0)
  hemi.groundColor = new Color3(0.1, 0.05, 0.2)

  const sun = new DirectionalLight('sun', new Vector3(-0.4, -0.6, 0.7), scene)
  sun.intensity = 0.8

  // === Player ship ===
  const shipRig = new TransformNode('shipRig', scene)
  const shipTilt = new TransformNode('shipTilt', scene)
  shipTilt.parent = shipRig

  const shipBody = MeshBuilder.CreateCylinder(
    'shipBody',
    { diameterTop: 0, diameterBottom: 1.6, height: 3, tessellation: 12 },
    scene,
  )
  shipBody.parent = shipTilt
  shipBody.rotation.x = Math.PI / 2

  const shipMat = new StandardMaterial('shipMat', scene)
  shipMat.diffuseColor = new Color3(0.7, 0.8, 1.0)
  shipMat.emissiveColor = new Color3(0.1, 0.15, 0.3)
  shipMat.specularColor = new Color3(0.6, 0.6, 0.6)
  shipBody.material = shipMat

  const wingL = MeshBuilder.CreateBox('wingL', { width: 2.4, height: 0.2, depth: 1 }, scene)
  wingL.parent = shipTilt
  wingL.position.set(-1.6, 0, -0.3)
  wingL.material = shipMat

  const wingR = wingL.clone('wingR')
  wingR.position.x = 1.6

  const playerMeshes = [shipBody, wingL, wingR]

  // === Camera ===
  const camera = new ArcRotateCamera(
    'chase',
    -Math.PI / 2,
    Math.PI / 2 - 0.35,
    18,
    new Vector3(0, 0, 0),
    scene,
  )
  camera.lockedTarget = shipRig
  camera.inputs.clear()

  // === Starfield ===
  const stars = new PointsCloudSystem('stars', 2, scene)
  stars.addPoints(2000, (particle) => {
    particle.position = new Vector3(
      (Math.random() - 0.5) * 400,
      (Math.random() - 0.5) * 200,
      (Math.random() - 0.5) * 800,
    )
    particle.color = new Color4(
      0.7 + Math.random() * 0.3,
      0.7 + Math.random() * 0.3,
      0.9 + Math.random() * 0.1,
      1,
    )
  })
  stars.buildMeshAsync()

  // === Particle pools (mesh-based, no texture needed) ===
  function createParticlePool(name, color, count) {
    const mat = new StandardMaterial(`${name}Mat`, scene)
    mat.diffuseColor = new Color3(0, 0, 0)
    mat.emissiveColor = color
    mat.specularColor = new Color3(0, 0, 0)
    mat.disableLighting = true

    const pool = []
    for (let i = 0; i < count; i++) {
      const m = MeshBuilder.CreateSphere(`${name}${i}`, { diameter: 0.5, segments: 4 }, scene)
      m.material = mat
      m.setEnabled(false)
      pool.push({ mesh: m, alive: false, life: 0, total: 0, vel: new Vector3() })
    }
    return pool
  }

  const sparkPool = createParticlePool('spark', new Color3(1.0, 0.95, 0.4), 40)
  const explosionPool = createParticlePool('explosion', new Color3(1.0, 0.5, 0.1), 80)
  const damagePool = createParticlePool('damage', new Color3(1.0, 0.2, 0.2), 32)

  function emit(pool, position, count, speed, life) {
    let emitted = 0
    for (const p of pool) {
      if (p.alive) continue
      if (emitted >= count) break
      p.alive = true
      p.life = 0
      p.total = life * (0.8 + Math.random() * 0.4)
      p.vel.set(
        (Math.random() - 0.5) * 2 * speed,
        (Math.random() - 0.5) * 2 * speed,
        (Math.random() - 0.5) * 2 * speed,
      )
      p.mesh.position.copyFrom(position)
      p.mesh.scaling.setAll(1)
      p.mesh.setEnabled(true)
      emitted++
    }
  }

  const emitSpark = (pos) => emit(sparkPool, pos, 8, 14, 0.3)
  const emitExplosion = (pos) => emit(explosionPool, pos, 28, 22, 0.6)
  const emitDamageFlash = (pos) => emit(damagePool, pos, 18, 12, 0.45)

  function updateParticles(dt) {
    for (const pool of [sparkPool, explosionPool, damagePool]) {
      for (const p of pool) {
        if (!p.alive) continue
        p.life += dt
        if (p.life >= p.total) {
          p.alive = false
          p.mesh.setEnabled(false)
          continue
        }
        p.mesh.position.x += p.vel.x * dt
        p.mesh.position.y += p.vel.y * dt
        p.mesh.position.z += p.vel.z * dt
        const t = p.life / p.total
        p.mesh.scaling.setAll(Math.max(0.05, 1 - t * 0.85))
      }
    }
  }

  // === Asteroid hazards (collidable backdrop) ===
  const asteroidMat = new StandardMaterial('asteroidMat', scene)
  asteroidMat.diffuseColor = new Color3(0.45, 0.42, 0.5)
  asteroidMat.emissiveColor = new Color3(0.06, 0.06, 0.1)
  asteroidMat.specularColor = new Color3(0.2, 0.2, 0.2)

  const asteroids = []
  for (let i = 0; i < ASTEROID_COUNT; i++) {
    // Polyhedron type 1 (octahedron) reads as a chunky asteroid.
    const m = MeshBuilder.CreatePolyhedron(`ast${i}`, { type: 1, size: 1 }, scene)
    m.material = asteroidMat
    m.setEnabled(false)
    asteroids.push({
      mesh: m,
      alive: false,
      hp: 1,
      radius: 1,
      rotVel: new Vector3(),
    })
  }

  function recycleAsteroid(a, ahead = true) {
    const size = 1.6 + Math.random() * 2.4
    a.mesh.scaling.setAll(size)
    a.radius = size * 1.2 // visual half-size
    a.mesh.position.set(
      (Math.random() - 0.5) * 36,
      (Math.random() - 0.5) * 14,
      ahead
        ? shipRig.position.z + 120 + Math.random() * 420
        : shipRig.position.z - 50, // off-screen behind, will be recycled on next pass
    )
    a.mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI)
    a.rotVel.set(
      (Math.random() - 0.5) * 0.8,
      (Math.random() - 0.5) * 0.8,
      (Math.random() - 0.5) * 0.8,
    )
    a.hp = size > 3 ? 2 : 1 // big ones take an extra hit
    a.alive = true
    a.mesh.setEnabled(true)
  }

  function destroyAsteroid(a) {
    emitExplosion(a.mesh.position)
    a.alive = false
    a.mesh.setEnabled(false)
  }

  // === Player projectiles ===
  const boltMat = new StandardMaterial('boltMat', scene)
  boltMat.diffuseColor = new Color3(0, 0, 0)
  boltMat.emissiveColor = new Color3(0.9, 1.0, 0.3)
  boltMat.specularColor = new Color3(0, 0, 0)
  boltMat.disableLighting = true

  const bolts = []
  for (let i = 0; i < BOLT_POOL; i++) {
    const m = MeshBuilder.CreateCylinder(
      `bolt${i}`,
      { diameter: 0.25, height: 2.2, tessellation: 6 },
      scene,
    )
    m.material = boltMat
    m.rotation.x = Math.PI / 2
    m.setEnabled(false)
    bolts.push({ mesh: m, alive: false, spawnedAt: 0, vz: 0 })
  }

  // === Enemy ships ===
  const enemyMat = new StandardMaterial('enemyMat', scene)
  enemyMat.diffuseColor = new Color3(1.0, 0.3, 0.25)
  enemyMat.emissiveColor = new Color3(0.4, 0.05, 0.05)
  enemyMat.specularColor = new Color3(0.4, 0.2, 0.2)

  const enemies = []
  for (let i = 0; i < ENEMY_POOL; i++) {
    const rig = new TransformNode(`enemyRig${i}`, scene)
    const body = MeshBuilder.CreateCylinder(
      `enemyBody${i}`,
      { diameterTop: 0, diameterBottom: 2, height: 3.5, tessellation: 8 },
      scene,
    )
    body.parent = rig
    body.rotation.x = -Math.PI / 2
    body.material = enemyMat

    const w = MeshBuilder.CreateBox(`enemyWing${i}`, { width: 3, height: 0.25, depth: 1.1 }, scene)
    w.parent = rig
    w.material = enemyMat

    rig.setEnabled(false)
    enemies.push({
      rig,
      alive: false,
      hp: ENEMY_HP,
      t: 0,
      seedX: 0,
      phase: 0,
      lastFiredAt: 0,
    })
  }

  // === Enemy projectiles ===
  const enemyBoltMat = new StandardMaterial('enemyBoltMat', scene)
  enemyBoltMat.diffuseColor = new Color3(0, 0, 0)
  enemyBoltMat.emissiveColor = new Color3(1.0, 0.25, 0.25)
  enemyBoltMat.specularColor = new Color3(0, 0, 0)
  enemyBoltMat.disableLighting = true

  const enemyBolts = []
  for (let i = 0; i < ENEMY_BOLT_POOL; i++) {
    const m = MeshBuilder.CreateCylinder(
      `ebolt${i}`,
      { diameter: 0.28, height: 1.8, tessellation: 6 },
      scene,
    )
    m.material = enemyBoltMat
    m.setEnabled(false)
    enemyBolts.push({ mesh: m, alive: false, spawnedAt: 0, vel: new Vector3() })
  }

  // === Combat state ===
  const state = {
    lateralVel: 0,
    forwardSpeed: BASE_FORWARD,
    turboUntil: 0,
    rollDir: 0,
    invulnUntil: 0,
    lastFiredAt: 0,
    lastEnemySpawnAt: 0,
  }

  function isPlayerInvuln(now) {
    return state.rollDir !== 0 || now < state.invulnUntil
  }

  function damagePlayer(now, sourcePos) {
    if (isPlayerInvuln(now)) return
    emitDamageFlash(sourcePos || shipRig.position)
    gameStateStore.loseLife()
    state.invulnUntil = now + POST_HIT_INVULN_MS
  }

  // === Player flight controls (rolls/turbo) ===
  function triggerBarrelRoll(dir) {
    if (state.rollDir !== 0) return
    if (dir !== -1 && dir !== 1) return
    state.rollDir = dir
    state.lateralVel = dir * ROLL_DODGE_VEL
    const start = shipTilt.rotation.z
    const anim = new Animation(
      'roll',
      'rotation.z',
      60,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT,
    )
    anim.setKeys([
      { frame: 0, value: start },
      { frame: ROLL_FRAMES, value: start - dir * Math.PI * 2 },
    ])
    scene.beginDirectAnimation(shipTilt, [anim], 0, ROLL_FRAMES, false, 1, () => {
      state.rollDir = 0
      shipTilt.rotation.z = 0
    })
  }

  function cycleSpecial() {
    const idx = SPECIALS.indexOf(inputStore.activeSpecial)
    inputStore.activeSpecial = SPECIALS[(idx + 1) % SPECIALS.length]
  }

  function triggerTurbo() {
    state.turboUntil = performance.now() + 1500
  }

  // === Firing ===
  function fireCannon(now) {
    if (now - state.lastFiredAt < FIRE_COOLDOWN_MS) return
    let lb = null
    let rb = null
    for (const b of bolts) {
      if (!b.alive) {
        if (!lb) lb = b
        else {
          rb = b
          break
        }
      }
    }
    if (!lb || !rb) return
    state.lastFiredAt = now
    for (const [b, sideX] of [
      [lb, -1.6],
      [rb, 1.6],
    ]) {
      b.alive = true
      b.spawnedAt = now
      b.mesh.position.set(
        shipRig.position.x + sideX,
        shipRig.position.y,
        shipRig.position.z + 2,
      )
      b.vz = BOLT_SPEED
      b.mesh.setEnabled(true)
    }
  }

  function enemyFire(e, now) {
    let b = null
    for (const eb of enemyBolts) {
      if (!eb.alive) {
        b = eb
        break
      }
    }
    if (!b) return

    // Aim at player position + small inaccuracy + a touch of lead
    const tx = shipRig.position.x + (Math.random() - 0.5) * ENEMY_AIM_INACCURACY
    const ty = shipRig.position.y + (Math.random() - 0.5) * ENEMY_AIM_INACCURACY
    const tz = shipRig.position.z + state.forwardSpeed * 0.35

    const dx = tx - e.rig.position.x
    const dy = ty - e.rig.position.y
    const dz = tz - e.rig.position.z
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1

    b.alive = true
    b.spawnedAt = now
    b.mesh.position.copyFrom(e.rig.position)
    b.vel.set(
      (dx / d) * ENEMY_BOLT_SPEED,
      (dy / d) * ENEMY_BOLT_SPEED,
      (dz / d) * ENEMY_BOLT_SPEED,
    )
    b.mesh.setEnabled(true)
  }

  // === Enemy spawn ===
  function spawnEnemyIfNeeded(now) {
    if (now - state.lastEnemySpawnAt < ENEMY_SPAWN_INTERVAL_MS) return
    const e = enemies.find((en) => !en.alive)
    if (!e) return
    state.lastEnemySpawnAt = now
    e.alive = true
    e.hp = ENEMY_HP
    e.t = 0
    e.seedX = (Math.random() - 0.5) * 30
    e.phase = Math.random() * Math.PI * 2
    e.lastFiredAt = now + ENEMY_FIRE_FIRST_DELAY_MS
    e.rig.position.set(
      e.seedX,
      (Math.random() - 0.5) * 10,
      shipRig.position.z + ENEMY_SPAWN_AHEAD + Math.random() * 60,
    )
    e.rig.rotation.z = 0
    e.rig.setEnabled(true)
  }

  // === Despawn helpers ===
  const despawnEnemy = (e) => {
    e.alive = false
    e.rig.setEnabled(false)
  }
  const despawnBolt = (b) => {
    b.alive = false
    b.mesh.setEnabled(false)
  }
  const despawnEnemyBolt = (b) => {
    b.alive = false
    b.mesh.setEnabled(false)
  }

  // === Per-frame updates ===
  function updateBolts(dt, now) {
    for (const b of bolts) {
      if (!b.alive) continue
      b.mesh.position.z += b.vz * dt
      if (now - b.spawnedAt > BOLT_LIFETIME_MS) despawnBolt(b)
    }
  }

  function updateEnemyBolts(dt, now) {
    for (const b of enemyBolts) {
      if (!b.alive) continue
      b.mesh.position.x += b.vel.x * dt
      b.mesh.position.y += b.vel.y * dt
      b.mesh.position.z += b.vel.z * dt
      if (now - b.spawnedAt > ENEMY_BOLT_LIFETIME_MS) despawnEnemyBolt(b)
    }
  }

  function updateEnemies(dt, now) {
    for (const e of enemies) {
      if (!e.alive) continue
      e.t += dt
      e.rig.position.x = e.seedX + Math.sin(e.t * 1.4 + e.phase) * ENEMY_DRIFT_AMPL
      e.rig.position.z -= ENEMY_FORWARD * dt
      e.rig.rotation.z = Math.cos(e.t * 1.4 + e.phase) * 0.3

      const dz = e.rig.position.z - shipRig.position.z
      if (dz < -10) {
        despawnEnemy(e)
        continue
      }
      // Ram check
      if (Math.abs(dz) < PLAYER_HIT_RADIUS + 1) {
        const dx = e.rig.position.x - shipRig.position.x
        const dy = e.rig.position.y - shipRig.position.y
        if (dx * dx + dy * dy < PLAYER_HIT_RADIUS * PLAYER_HIT_RADIUS) {
          emitExplosion(e.rig.position)
          if (!isPlayerInvuln(now)) damagePlayer(now, e.rig.position)
          despawnEnemy(e)
          continue
        }
      }
      // Fire at player when within range
      if (dz > 0 && dz < ENEMY_FIRE_RANGE && now - e.lastFiredAt > ENEMY_FIRE_INTERVAL_MS) {
        enemyFire(e, now)
        e.lastFiredAt = now
      }
    }
  }

  function updateAsteroids(dt, now) {
    for (const a of asteroids) {
      if (!a.alive) continue
      a.mesh.rotation.x += a.rotVel.x * dt
      a.mesh.rotation.y += a.rotVel.y * dt
      a.mesh.rotation.z += a.rotVel.z * dt

      if (a.mesh.position.z < shipRig.position.z - 40) {
        recycleAsteroid(a)
        continue
      }

      // Player crash
      const dz = a.mesh.position.z - shipRig.position.z
      if (Math.abs(dz) < a.radius + 1) {
        const dx = a.mesh.position.x - shipRig.position.x
        const dy = a.mesh.position.y - shipRig.position.y
        const r = a.radius + 1.4
        if (dx * dx + dy * dy < r * r) {
          if (!isPlayerInvuln(now)) {
            damagePlayer(now, a.mesh.position)
            destroyAsteroid(a)
            recycleAsteroid(a)
            continue
          } else {
            // During roll/invuln, glance off — just spark and shove away.
            emitSpark(shipRig.position)
          }
        }
      }
    }
  }

  function checkBoltVsEnemy() {
    const r2 = ENEMY_HIT_RADIUS * ENEMY_HIT_RADIUS
    for (const b of bolts) {
      if (!b.alive) continue
      for (const e of enemies) {
        if (!e.alive) continue
        const dz = b.mesh.position.z - e.rig.position.z
        if (Math.abs(dz) > 6) continue
        const dx = b.mesh.position.x - e.rig.position.x
        const dy = b.mesh.position.y - e.rig.position.y
        if (dx * dx + dy * dy + dz * dz < r2) {
          emitSpark(b.mesh.position)
          despawnBolt(b)
          e.hp -= 1
          if (e.hp <= 0) {
            emitExplosion(e.rig.position)
            despawnEnemy(e)
            gameStateStore.addScore(SCORE_PER_KILL)
          }
          break
        }
      }
    }
  }

  function checkBoltVsAsteroid() {
    for (const b of bolts) {
      if (!b.alive) continue
      for (const a of asteroids) {
        if (!a.alive) continue
        const dz = b.mesh.position.z - a.mesh.position.z
        if (Math.abs(dz) > a.radius + 2) continue
        const dx = b.mesh.position.x - a.mesh.position.x
        const dy = b.mesh.position.y - a.mesh.position.y
        const r = a.radius + 0.4
        if (dx * dx + dy * dy + dz * dz < r * r) {
          emitSpark(b.mesh.position)
          despawnBolt(b)
          a.hp -= 1
          if (a.hp <= 0) {
            destroyAsteroid(a)
            recycleAsteroid(a)
            gameStateStore.addScore(ASTEROID_SCORE)
          }
          break
        }
      }
    }
  }

  function checkEnemyBoltVsPlayer(now) {
    const r2 = PLAYER_HIT_RADIUS * PLAYER_HIT_RADIUS
    for (const b of enemyBolts) {
      if (!b.alive) continue
      const dx = b.mesh.position.x - shipRig.position.x
      const dy = b.mesh.position.y - shipRig.position.y
      const dz = b.mesh.position.z - shipRig.position.z
      if (dx * dx + dy * dy + dz * dz < r2) {
        if (isPlayerInvuln(now)) {
          emitSpark(b.mesh.position) // deflected!
        } else {
          damagePlayer(now, b.mesh.position)
        }
        despawnEnemyBolt(b)
      }
    }
  }

  function updateInvulnVisual(now) {
    const invuln = isPlayerInvuln(now)
    // While invulnerable (rolling or post-hit), flicker the ship at 12Hz.
    const visible = !invuln || Math.floor(now / 80) % 2 === 0
    for (const m of playerMeshes) m.isVisible = visible
  }

  function clearCombat() {
    for (const b of bolts) despawnBolt(b)
    for (const b of enemyBolts) despawnEnemyBolt(b)
    for (const e of enemies) despawnEnemy(e)
    for (const a of asteroids) {
      a.alive = false
      a.mesh.setEnabled(false)
    }
    // Re-seed asteroids spread along the lane ahead
    for (const a of asteroids) recycleAsteroid(a)
    state.lastFiredAt = 0
    state.lastEnemySpawnAt = 0
    state.invulnUntil = 0
  }

  // === Main loop ===
  scene.onBeforeRenderObservable.add(() => {
    const dt = engine.getDeltaTime() / 1000
    const now = performance.now()
    const playing = gameStateStore.status === 'playing'

    // Barrel roll pulse — process before steer so it takes priority
    const rollPulse = inputStore.consumeBarrelRoll()
    if (rollPulse) triggerBarrelRoll(rollPulse)

    if (state.rollDir !== 0) {
      state.lateralVel = state.rollDir * ROLL_DODGE_VEL
    } else {
      const steerIn =
        (inputStore.held.steerLeft ? -1 : 0) + (inputStore.held.steerRight ? 1 : 0)
      state.lateralVel += steerIn * STEER_ACCEL * dt
      if (steerIn === 0) {
        const damp = Math.exp(-STEER_DAMP * dt)
        state.lateralVel *= damp
      }
      state.lateralVel = Math.max(-MAX_STEER_VEL, Math.min(MAX_STEER_VEL, state.lateralVel))
    }

    if (inputStore.consumeTurbo()) triggerTurbo()
    state.forwardSpeed = now < state.turboUntil ? TURBO_FORWARD : BASE_FORWARD

    shipRig.position.x += state.lateralVel * dt
    shipRig.position.z += state.forwardSpeed * dt

    const lane = 24
    if (shipRig.position.x > lane) {
      shipRig.position.x = lane
      if (state.rollDir === 0) state.lateralVel = 0
    } else if (shipRig.position.x < -lane) {
      shipRig.position.x = -lane
      if (state.rollDir === 0) state.lateralVel = 0
    }

    if (state.rollDir === 0) {
      const targetTilt = (state.lateralVel / MAX_STEER_VEL) * ROLL_TILT
      shipTilt.rotation.z += (targetTilt - shipTilt.rotation.z) * Math.min(1, 8 * dt)
    }

    // Combat tick — active while playing
    if (playing) {
      if (inputStore.consumeCycleSpecial()) cycleSpecial()
      if (inputStore.consumeSpecial()) {
        // Special weapons not implemented yet
      }
      if (inputStore.held.fire) fireCannon(now)

      spawnEnemyIfNeeded(now)
      updateBolts(dt, now)
      updateEnemyBolts(dt, now)
      updateEnemies(dt, now)
      updateAsteroids(dt, now)
      checkBoltVsEnemy()
      checkBoltVsAsteroid()
      checkEnemyBoltVsPlayer(now)
    } else {
      // Game over: keep things coasting, no spawns, no damage.
      updateBolts(dt, now)
      updateEnemyBolts(dt, now)
      for (const e of enemies) {
        if (!e.alive) continue
        e.t += dt
        e.rig.position.z -= ENEMY_FORWARD * dt
        if (e.rig.position.z - shipRig.position.z < -30) despawnEnemy(e)
      }
      for (const a of asteroids) {
        if (!a.alive) continue
        a.mesh.rotation.y += a.rotVel.y * dt
        if (a.mesh.position.z < shipRig.position.z - 40) recycleAsteroid(a)
      }
    }

    updateParticles(dt)
    updateInvulnVisual(now)
  })

  engine.runRenderLoop(() => {
    scene.render()
  })

  const onResize = () => engine.resize()
  window.addEventListener('resize', onResize)

  return {
    engine,
    scene,
    startRun() {
      shipRig.position.set(0, 0, 0)
      state.lateralVel = 0
      state.turboUntil = 0
      state.rollDir = 0
      state.invulnUntil = 0
      shipTilt.rotation.z = 0
      clearCombat()
      gameStateStore.startRun()
    },
    dispose() {
      window.removeEventListener('resize', onResize)
      engine.stopRenderLoop()
      scene.dispose()
      engine.dispose()
    },
  }
}
