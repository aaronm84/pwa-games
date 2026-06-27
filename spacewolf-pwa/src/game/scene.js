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

export function createGameScene(canvas, inputStore) {
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
  scene.fogEnd = 240

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
  // Disable orbital input so user can't drag the camera
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

  // Some obstacle cubes scattered ahead so motion is visible
  const obstacles = []
  for (let i = 0; i < 40; i++) {
    const o = MeshBuilder.CreateBox(`obs${i}`, { size: 2 + Math.random() * 3 }, scene)
    o.position.set(
      (Math.random() - 0.5) * 40,
      (Math.random() - 0.5) * 20,
      i * 30 + 40,
    )
    const m = new StandardMaterial(`obsMat${i}`, scene)
    m.diffuseColor = new Color3(0.3 + Math.random() * 0.3, 0.4, 0.6)
    m.emissiveColor = m.diffuseColor.scale(0.2)
    o.material = m
    obstacles.push(o)
  }

  // State
  const state = {
    lateralVel: 0,
    forwardSpeed: BASE_FORWARD,
    turboUntil: 0,
    rollDir: 0, // -1 = rolling left, +1 = rolling right, 0 = not rolling
  }

  function triggerBarrelRoll(dir) {
    if (state.rollDir !== 0) return
    if (dir !== -1 && dir !== 1) return
    state.rollDir = dir
    // Lunge sideways immediately so the roll actually dodges incoming fire.
    state.lateralVel = dir * ROLL_DODGE_VEL
    const start = shipTilt.rotation.z
    const anim = new Animation(
      'roll',
      'rotation.z',
      60,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT,
    )
    // Spin in the dodge direction: rolling right turns the ship CW from the
    // pilot's POV, which is -Z rotation in Babylon's right-handed coords.
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
    console.log('[Special] now', inputStore.activeSpecial)
  }

  function triggerTurbo() {
    state.turboUntil = performance.now() + 1500
  }

  scene.onBeforeRenderObservable.add(() => {
    const dt = engine.getDeltaTime() / 1000

    // Barrel roll pulse — start before reading steer so the dodge takes over
    // immediately even if a steer arrow is also held this frame.
    const rollPulse = inputStore.consumeBarrelRoll()
    if (rollPulse) triggerBarrelRoll(rollPulse)

    if (state.rollDir !== 0) {
      // During a roll: ignore steer input, keep dodge velocity locked.
      state.lateralVel = state.rollDir * ROLL_DODGE_VEL
    } else {
      // Steering: left/right from HUD held flags
      const steerIn =
        (inputStore.held.steerLeft ? -1 : 0) + (inputStore.held.steerRight ? 1 : 0)
      state.lateralVel += steerIn * STEER_ACCEL * dt
      if (steerIn === 0) {
        const damp = Math.exp(-STEER_DAMP * dt)
        state.lateralVel *= damp
      }
      state.lateralVel = Math.max(-MAX_STEER_VEL, Math.min(MAX_STEER_VEL, state.lateralVel))
    }

    // Turbo (boost forward briefly)
    if (inputStore.consumeTurbo()) triggerTurbo()
    const turboActive = performance.now() < state.turboUntil
    state.forwardSpeed = turboActive ? TURBO_FORWARD : BASE_FORWARD

    // Move ship rig
    shipRig.position.x += state.lateralVel * dt
    shipRig.position.z += state.forwardSpeed * dt

    // Keep ship within a lane
    const lane = 24
    if (shipRig.position.x > lane) {
      shipRig.position.x = lane
      if (state.rollDir === 0) state.lateralVel = 0
    } else if (shipRig.position.x < -lane) {
      shipRig.position.x = -lane
      if (state.rollDir === 0) state.lateralVel = 0
    }

    // Tilt visual: bank into steering when not in a barrel roll (the roll's
    // own animation owns the rotation.z channel for its duration).
    if (state.rollDir === 0) {
      const targetTilt = (state.lateralVel / MAX_STEER_VEL) * ROLL_TILT
      shipTilt.rotation.z += (targetTilt - shipTilt.rotation.z) * Math.min(1, 8 * dt)
    }

    // Special / cycle pulses (stubbed for now)
    if (inputStore.consumeCycleSpecial()) cycleSpecial()
    if (inputStore.consumeSpecial()) {
      console.log('[Special] fire', inputStore.activeSpecial)
    }

    // Main cannon fire (held) — stubbed
    if (inputStore.held.fire) {
      // throttle so we don't log every frame
      if (!state._lastFireLog || performance.now() - state._lastFireLog > 200) {
        state._lastFireLog = performance.now()
        console.log('[Fire] cannon')
      }
    }

    // Recycle obstacles that pass behind the ship
    for (const o of obstacles) {
      if (o.position.z < shipRig.position.z - 30) {
        o.position.z += obstacles.length * 30
        o.position.x = (Math.random() - 0.5) * 40
        o.position.y = (Math.random() - 0.5) * 20
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
    dispose() {
      window.removeEventListener('resize', onResize)
      engine.stopRenderLoop()
      scene.dispose()
      engine.dispose()
    },
  }
}
