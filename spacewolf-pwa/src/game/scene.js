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

// Forward auto-flight speed in world units / second
const BASE_FORWARD = 30
const TURBO_FORWARD = 60
const STEER_ACCEL = 90
const STEER_DAMP = 6
const MAX_STEER_VEL = 18
const ROLL_TILT = Tools.ToRadians(45)
// Barrel roll: lateral dodge speed and animation frames at 60fps
const ROLL_DODGE_VEL = 26
const ROLL_FRAMES = 32
const SPECIALS = ['bombs', 'lasers', 'missiles']

// Combat tuning
const FIRE_COOLDOWN_MS = 130
const BOLT_SPEED = 140
const BOLT_LIFETIME_MS = 1500
const BOLT_POOL = 24
const ENEMY_POOL = 8
const ENEMY_HP = 2
const ENEMY_FORWARD = 12 // speed they fly toward the player (in -Z relative to player)
const ENEMY_DRIFT_AMPL = 8
const ENEMY_SPAWN_INTERVAL_MS = 2000
const ENEMY_SPAWN_AHEAD = 200
const ENEMY_HIT_RADIUS = 2.4
const PLAYER_HIT_RADIUS = 2.6
const SCORE_PER_KILL = 100

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

  // Lights
  const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene)
  hemi.intensity = 0.45
  hemi.diffuse = new Color3(0.7, 0.8, 1.0)
  hemi.groundColor = new Color3(0.1, 0.05, 0.2)

  const sun = new DirectionalLight('sun', new Vector3(-0.4, -0.6, 0.7), scene)
  sun.intensity = 0.8

  // Ship rig: outer node holds world position, inner mesh holds roll/pitch tilt
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

  // Chase camera (3/4 view)
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

  // Starfield (point cloud streaming behind the ship)
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

  // Faint asteroid-like backdrop (no collision) — gives depth & motion cues.
  const obstacles = []
  for (let i = 0; i < 30; i++) {
    const o = MeshBuilder.CreateBox(`obs${i}`, { size: 2 + Math.random() * 3 }, scene)
    o.position.set(
      (Math.random() - 0.5) * 60,
      (Math.random() - 0.5) * 30,
      i * 32 + 60,
    )
    const m = new StandardMaterial(`obsMat${i}`, scene)
    m.diffuseColor = new Color3(0.25 + Math.random() * 0.2, 0.3, 0.5)
    m.emissiveColor = m.diffuseColor.scale(0.15)
    o.material = m
    obstacles.push(o)
  }

  // === Projectile pool ===
  const boltMat = new StandardMaterial('boltMat', scene)
  boltMat.diffuseColor = new Color3(0, 0, 0)
  boltMat.emissiveColor = new Color3(0.9, 1.0, 0.3)
  boltMat.specularColor = new Color3(0, 0, 0)

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

  // === Enemy pool ===
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
    // Point the cone toward -Z so it faces the player as it approaches.
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
    })
  }

  // === Combat state ===
  const state = {
    lateralVel: 0,
    forwardSpeed: BASE_FORWARD,
    turboUntil: 0,
    rollDir: 0,
    lastFiredAt: 0,
    lastEnemySpawnAt: 0,
  }

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

  function fireCannon(now) {
    if (now - state.lastFiredAt < FIRE_COOLDOWN_MS) return
    // Find two free bolts (one per wing).
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
    if (!lb || !rb) return // pool exhausted; skip this shot
    state.lastFiredAt = now
    const wingOffsets = [
      [lb, -1.6],
      [rb, 1.6],
    ]
    for (const [b, sideX] of wingOffsets) {
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
    e.rig.position.set(
      e.seedX,
      (Math.random() - 0.5) * 10,
      shipRig.position.z + ENEMY_SPAWN_AHEAD + Math.random() * 60,
    )
    e.rig.setEnabled(true)
  }

  function despawnEnemy(e) {
    e.alive = false
    e.rig.setEnabled(false)
  }

  function despawnBolt(b) {
    b.alive = false
    b.mesh.setEnabled(false)
  }

  function updateBolts(dt, now) {
    for (const b of bolts) {
      if (!b.alive) continue
      b.mesh.position.z += b.vz * dt
      if (now - b.spawnedAt > BOLT_LIFETIME_MS) {
        despawnBolt(b)
      }
    }
  }

  function updateEnemies(dt) {
    for (const e of enemies) {
      if (!e.alive) continue
      e.t += dt
      // Sin-wave lateral drift around the spawn seedX
      e.rig.position.x = e.seedX + Math.sin(e.t * 1.4 + e.phase) * ENEMY_DRIFT_AMPL
      // Approach the player (move toward -Z relative to ship, which means
      // their Z decreases relative to the ship's z; but the ship is also
      // advancing, so enemies move at ENEMY_FORWARD toward -Z in world.)
      e.rig.position.z -= ENEMY_FORWARD * dt
      // Bank visually toward the drift direction (a touch of personality)
      const bank = Math.cos(e.t * 1.4 + e.phase) * 0.3
      e.rig.rotation.z = bank

      const dz = e.rig.position.z - shipRig.position.z
      if (dz < -10) {
        // Passed behind the player without being shot — no cost (they "got away")
        despawnEnemy(e)
        continue
      }
      if (Math.abs(dz) < PLAYER_HIT_RADIUS + 1) {
        const dx = e.rig.position.x - shipRig.position.x
        const dy = e.rig.position.y - shipRig.position.y
        if (dx * dx + dy * dy < PLAYER_HIT_RADIUS * PLAYER_HIT_RADIUS) {
          // Rammed the player — cost a life, despawn.
          despawnEnemy(e)
          gameStateStore.loseLife()
        }
      }
    }
  }

  function checkBoltHits() {
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
          despawnBolt(b)
          e.hp -= 1
          if (e.hp <= 0) {
            despawnEnemy(e)
            gameStateStore.addScore(SCORE_PER_KILL)
          }
          break // bolt consumed
        }
      }
    }
  }

  function clearCombat() {
    for (const b of bolts) despawnBolt(b)
    for (const e of enemies) despawnEnemy(e)
    state.lastFiredAt = 0
    state.lastEnemySpawnAt = 0
  }

  scene.onBeforeRenderObservable.add(() => {
    const dt = engine.getDeltaTime() / 1000
    const now = performance.now()
    const playing = gameStateStore.status === 'playing'

    // Barrel roll pulse — even when game is over, lets the player keep
    // toying with the controls while the overlay is up.
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
    const turboActive = now < state.turboUntil
    state.forwardSpeed = turboActive ? TURBO_FORWARD : BASE_FORWARD

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

    // Combat — only ticks while playing
    if (playing) {
      if (inputStore.consumeCycleSpecial()) cycleSpecial()
      if (inputStore.consumeSpecial()) {
        // Special weapons not implemented yet
      }
      if (inputStore.held.fire) fireCannon(now)
      spawnEnemyIfNeeded(now)
      updateBolts(dt, now)
      updateEnemies(dt)
      checkBoltHits()
    } else {
      // Game over: keep bolts/enemies coasting visually but don't spawn new
      // enemies and don't apply damage. The player can still steer/roll.
      updateBolts(dt, now)
      for (const e of enemies) {
        if (!e.alive) continue
        e.t += dt
        e.rig.position.z -= ENEMY_FORWARD * dt
        if (e.rig.position.z - shipRig.position.z < -30) despawnEnemy(e)
      }
    }

    // Recycle backdrop asteroids
    for (const o of obstacles) {
      if (o.position.z < shipRig.position.z - 40) {
        o.position.z += obstacles.length * 32
        o.position.x = (Math.random() - 0.5) * 60
        o.position.y = (Math.random() - 0.5) * 30
      }
    }
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
      clearCombat()
      shipRig.position.set(0, 0, 0)
      state.lateralVel = 0
      state.turboUntil = 0
      state.rollDir = 0
      shipTilt.rotation.z = 0
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
