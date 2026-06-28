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

  // === Player ship (Arwing-style fighter, all primitives) ===
  const shipRig = new TransformNode('shipRig', scene)
  const shipTilt = new TransformNode('shipTilt', scene)
  shipTilt.parent = shipRig

  const playerBodyMat = new StandardMaterial('playerBodyMat', scene)
  playerBodyMat.diffuseColor = new Color3(0.82, 0.86, 0.94)
  playerBodyMat.specularColor = new Color3(0.7, 0.7, 0.75)
  playerBodyMat.emissiveColor = new Color3(0.05, 0.07, 0.12)

  const playerAccentMat = new StandardMaterial('playerAccentMat', scene)
  playerAccentMat.diffuseColor = new Color3(0.18, 0.42, 0.95)
  playerAccentMat.emissiveColor = new Color3(0.1, 0.25, 0.6)
  playerAccentMat.specularColor = new Color3(0.4, 0.4, 0.6)

  const playerCockpitMat = new StandardMaterial('playerCockpitMat', scene)
  playerCockpitMat.diffuseColor = new Color3(0.08, 0.14, 0.28)
  playerCockpitMat.emissiveColor = new Color3(0.05, 0.12, 0.3)
  playerCockpitMat.specularColor = new Color3(0.95, 0.95, 1.0)

  const playerEngineGlowMat = new StandardMaterial('playerEngineGlowMat', scene)
  playerEngineGlowMat.diffuseColor = new Color3(0, 0, 0)
  playerEngineGlowMat.emissiveColor = new Color3(0.5, 0.8, 1.0)
  playerEngineGlowMat.disableLighting = true

  // Fuselage — long streamlined body pointing +Z (the flight direction).
  const fuselage = MeshBuilder.CreateCylinder(
    'fuselage',
    { diameterTop: 0.5, diameterBottom: 1.3, height: 3.4, tessellation: 14 },
    scene,
  )
  fuselage.parent = shipTilt
  fuselage.rotation.x = Math.PI / 2
  fuselage.material = playerBodyMat

  // Nose — pointed cone in front of the fuselage.
  const nose = MeshBuilder.CreateCylinder(
    'nose',
    { diameterTop: 0, diameterBottom: 0.55, height: 1.4, tessellation: 14 },
    scene,
  )
  nose.parent = shipTilt
  nose.rotation.x = Math.PI / 2
  nose.position.z = 2.4
  nose.material = playerBodyMat

  // Cockpit canopy — flattened sphere on top of the fuselage.
  const cockpit = MeshBuilder.CreateSphere('cockpit', { diameter: 1, segments: 14 }, scene)
  cockpit.parent = shipTilt
  cockpit.position.set(0, 0.32, 0.55)
  cockpit.scaling.set(0.65, 0.42, 1.15)
  cockpit.material = playerCockpitMat

  // Wings — forward-swept (Arwing-style) angled boxes.
  function createPlayerWing(sideX) {
    const wing = MeshBuilder.CreateBox(
      `playerWing${sideX > 0 ? 'R' : 'L'}`,
      { width: 2.6, height: 0.18, depth: 1.3 },
      scene,
    )
    wing.parent = shipTilt
    wing.position.set(sideX * 1.55, -0.05, -0.3)
    // Slight dihedral up at the tips, forward-sweep along the leading edge.
    wing.rotation.z = sideX * -0.1
    wing.rotation.y = sideX * 0.22
    wing.material = playerBodyMat
    return wing
  }
  const wingL = createPlayerWing(-1)
  const wingR = createPlayerWing(1)

  // Wing-tip laser pods — small boxes at each wing tip in accent blue.
  function createPlayerGun(sideX) {
    const gun = MeshBuilder.CreateBox(
      `playerGun${sideX > 0 ? 'R' : 'L'}`,
      { width: 0.22, height: 0.22, depth: 1.5 },
      scene,
    )
    gun.parent = shipTilt
    gun.position.set(sideX * 2.65, 0, 0.05)
    gun.material = playerAccentMat
    return gun
  }
  const gunL = createPlayerGun(-1)
  const gunR = createPlayerGun(1)

  // Engine pods — twin cylinders at the rear.
  function createPlayerEngine(sideX) {
    const eng = MeshBuilder.CreateCylinder(
      `playerEngine${sideX > 0 ? 'R' : 'L'}`,
      { diameter: 0.55, height: 1.8, tessellation: 10 },
      scene,
    )
    eng.parent = shipTilt
    eng.rotation.x = Math.PI / 2
    eng.position.set(sideX * 0.75, -0.1, -1.5)
    eng.material = playerBodyMat
    return eng
  }
  const engineL = createPlayerEngine(-1)
  const engineR = createPlayerEngine(1)

  // Exhaust glow discs at the back of each engine — strong emissive blue.
  function createPlayerExhaust(sideX) {
    const ex = MeshBuilder.CreateDisc(
      `playerExhaust${sideX > 0 ? 'R' : 'L'}`,
      { radius: 0.26, tessellation: 14 },
      scene,
    )
    ex.parent = shipTilt
    ex.rotation.x = Math.PI / 2
    ex.position.set(sideX * 0.75, -0.1, -2.42)
    ex.material = playerEngineGlowMat
    return ex
  }
  const exhaustL = createPlayerExhaust(-1)
  const exhaustR = createPlayerExhaust(1)

  // A glowing dorsal accent strip running along the top of the fuselage.
  const dorsalAccent = MeshBuilder.CreateBox(
    'dorsalAccent',
    { width: 0.18, height: 0.08, depth: 2.6 },
    scene,
  )
  dorsalAccent.parent = shipTilt
  dorsalAccent.position.set(0, 0.7, -0.1)
  dorsalAccent.material = playerAccentMat

  const playerMeshes = [
    fuselage,
    nose,
    cockpit,
    wingL,
    wingR,
    gunL,
    gunR,
    engineL,
    engineR,
    exhaustL,
    exhaustR,
    dorsalAccent,
  ]

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
  // Pre-mix a few materials so the field looks varied (grey/tan/blue-grey
  // rock tints) without spawning a fresh material per asteroid.
  const asteroidMats = [
    new Color3(0.45, 0.42, 0.5),
    new Color3(0.55, 0.45, 0.4),
    new Color3(0.38, 0.4, 0.5),
    new Color3(0.5, 0.42, 0.38),
  ].map((c, i) => {
    const m = new StandardMaterial(`asteroidMat${i}`, scene)
    m.diffuseColor = c
    m.emissiveColor = c.scale(0.18)
    m.specularColor = new Color3(0.18, 0.18, 0.18)
    return m
  })
  // Babylon polyhedron types 1, 2, 3, 5 give octahedron / dodecahedron /
  // icosahedron / variant respectively — collectively the field reads
  // like proper chunky asteroids rather than 22 identical octahedra.
  const polyTypes = [1, 2, 3, 5]

  const asteroids = []
  for (let i = 0; i < ASTEROID_COUNT; i++) {
    const type = polyTypes[i % polyTypes.length]
    const m = MeshBuilder.CreatePolyhedron(`ast${i}`, { type, size: 1 }, scene)
    m.material = asteroidMats[i % asteroidMats.length]
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

  // === Enemy ships — angular, wider-than-tall wedge fighters ===
  const enemyBodyMat = new StandardMaterial('enemyBodyMat', scene)
  enemyBodyMat.diffuseColor = new Color3(0.65, 0.18, 0.18)
  enemyBodyMat.emissiveColor = new Color3(0.2, 0.04, 0.04)
  enemyBodyMat.specularColor = new Color3(0.3, 0.2, 0.2)

  const enemyAccentMat = new StandardMaterial('enemyAccentMat', scene)
  enemyAccentMat.diffuseColor = new Color3(0.2, 0.05, 0.05)
  enemyAccentMat.emissiveColor = new Color3(0.1, 0.02, 0.02)
  enemyAccentMat.specularColor = new Color3(0.2, 0.1, 0.1)

  const enemyEyeMat = new StandardMaterial('enemyEyeMat', scene)
  enemyEyeMat.diffuseColor = new Color3(0, 0, 0)
  enemyEyeMat.emissiveColor = new Color3(1.0, 0.25, 0.15)
  enemyEyeMat.disableLighting = true

  const enemyEngineGlowMat = new StandardMaterial('enemyEngineGlowMat', scene)
  enemyEngineGlowMat.diffuseColor = new Color3(0, 0, 0)
  enemyEngineGlowMat.emissiveColor = new Color3(1.0, 0.35, 0.2)
  enemyEngineGlowMat.disableLighting = true

  const enemies = []
  for (let i = 0; i < ENEMY_POOL; i++) {
    const rig = new TransformNode(`enemyRig${i}`, scene)

    // Wide wedge body (cone, base facing -Z so the point leads into the
    // player). Squished on the vertical to read as a hawkish wedge, not
    // a cone-on-its-side like the old version.
    const body = MeshBuilder.CreateCylinder(
      `enemyBody${i}`,
      { diameterTop: 0, diameterBottom: 2.2, height: 3.6, tessellation: 8 },
      scene,
    )
    body.parent = rig
    body.rotation.x = -Math.PI / 2
    body.scaling.set(1, 0.55, 1)
    body.material = enemyBodyMat

    // Swept-back wings angled rearward (the opposite sweep direction
    // from the player's forward-swept wings — silhouette reads as
    // aggressive/attacking).
    const wingL = MeshBuilder.CreateBox(
      `enemyWingL${i}`,
      { width: 2.2, height: 0.22, depth: 1.4 },
      scene,
    )
    wingL.parent = rig
    wingL.position.set(-1.6, -0.05, -0.3)
    wingL.rotation.y = -0.25
    wingL.material = enemyBodyMat

    const wingR = MeshBuilder.CreateBox(
      `enemyWingR${i}`,
      { width: 2.2, height: 0.22, depth: 1.4 },
      scene,
    )
    wingR.parent = rig
    wingR.position.set(1.6, -0.05, -0.3)
    wingR.rotation.y = 0.25
    wingR.material = enemyBodyMat

    // Glowing red "eye" at the front of the body — menacing focal point.
    const eye = MeshBuilder.CreateSphere(`enemyEye${i}`, { diameter: 0.5, segments: 8 }, scene)
    eye.parent = rig
    eye.position.set(0, 0.05, 1.05)
    eye.material = enemyEyeMat

    // Dark accent stripe across the wings.
    const stripe = MeshBuilder.CreateBox(
      `enemyStripe${i}`,
      { width: 4.3, height: 0.05, depth: 0.4 },
      scene,
    )
    stripe.parent = rig
    stripe.position.set(0, 0.12, -0.3)
    stripe.material = enemyAccentMat

    // Twin engine glows at the rear — bright orange.
    const engL = MeshBuilder.CreateDisc(
      `enemyEngL${i}`,
      { radius: 0.22, tessellation: 10 },
      scene,
    )
    engL.parent = rig
    engL.rotation.x = Math.PI / 2
    engL.position.set(-0.55, -0.05, -1.85)
    engL.material = enemyEngineGlowMat

    const engR = MeshBuilder.CreateDisc(
      `enemyEngR${i}`,
      { radius: 0.22, tessellation: 10 },
      scene,
    )
    engR.parent = rig
    engR.rotation.x = Math.PI / 2
    engR.position.set(0.55, -0.05, -1.85)
    engR.material = enemyEngineGlowMat

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
