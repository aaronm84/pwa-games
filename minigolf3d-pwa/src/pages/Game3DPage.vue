<template>
  <q-page class="game3d">
    <canvas ref="canvasEl" class="stage-canvas" />

    <!-- HUD -->
    <div class="hud-top">
      <q-btn flat round icon="arrow_back" color="white" @click="goBack" />
      <div class="chips">
        <div class="chip"><span>Hole</span><b>{{ holeNum }}/{{ total }}</b></div>
        <div class="chip"><span>Par</span><b>{{ par }}</b></div>
        <div class="chip"><span>Shot</span><b>{{ strokes }}</b></div>
      </div>
      <div class="chip mode">{{ backend }}</div>
    </div>

    <div class="hud-title" v-if="showTitle">
      <div class="t-name">{{ holeName }}</div>
      <div class="t-par">Par {{ par }}</div>
    </div>

    <div class="hud-hint" v-if="state === 'aiming' && strokes === 0 && !showTitle">
      Drag back from the ball to aim &amp; putt
    </div>

    <transition name="fade">
      <div v-if="state === 'holeComplete'" class="overlay">
        <div class="o-title">{{ resultLabel }}</div>
        <div class="o-sub">{{ strokes }} {{ strokes === 1 ? 'stroke' : 'strokes' }} · par {{ par }}</div>
        <q-btn unelevated color="green" text-color="white" :label="holeIdx + 1 < total ? 'Next Hole' : 'Play Again'" @click="advance" />
      </div>
    </transition>

    <div v-if="booting" class="boot">Loading 3D engine…</div>
  </q-page>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { MeshBuilder, Vector3, Color3, StandardMaterial, ArcRotateCamera } from '@babylonjs/core'
import { Stage, initPhysics, makeDynamic, outdoorLight, pbr, Gestures } from 'src/engine'
import { holes, buildHole, CUP_R } from 'src/game/course3d'
import { useHaptics } from 'src/composables/useHaptics'

const router = useRouter()
const haptics = useHaptics()
const canvasEl = ref(null)

const booting = ref(true)
const backend = ref('')
const state = ref('aiming') // aiming | rolling | holeComplete
const holeIdx = ref(0)
const strokes = ref(0)
const showTitle = ref(false)

const total = holes.length
const holeNum = ref(1)
const holeName = ref('')
const par = ref(3)
const resultLabel = ref('')

let stage = null
let scene = null
let cam = null
let shadowGen = null
let hole = null
let ball = null
let ballAgg = null
let aimArrow = null
let gestures = null

let cupPos = null
let restFrames = 0
let sunk = false
let curPower = 0
let curDir = null
let titleUntil = 0

const MAX_IMPULSE = 13
const SINK_SPEED = 2.6

onMounted(async () => {
  try {
    await boot()
  } catch (e) {
    console.error('[Game3D] boot failed:', e)
    booting.value = false
  }
})
onBeforeUnmount(() => {
  gestures?.dispose()
  stage?.dispose()
})

async function boot() {
  stage = new Stage(canvasEl.value, { clear: [0.55, 0.79, 0.93, 1], webgpu: false })
  await stage.init()
  backend.value = stage.backend.toUpperCase()
  scene = stage.scene

  const rig = outdoorLight(scene)
  shadowGen = rig.shadow

  cam = new ArcRotateCamera('cam', -Math.PI / 2, 0.62, 26, new Vector3(0, 0, 0), scene)

  // ball
  ball = MeshBuilder.CreateSphere('ball', { diameter: 0.5, segments: 20 }, scene)
  ball.material = pbr(scene, { color: '#ffffff', rough: 0.28, name: 'ball' })
  shadowGen.addShadowCaster(ball)

  // aim arrow (a thin emissive bar we scale/rotate to show aim + power)
  aimArrow = MeshBuilder.CreateBox('aim', { width: 0.18, height: 0.05, depth: 1 }, scene)
  const aimMat = new StandardMaterial('aimMat', scene)
  aimMat.emissiveColor = new Color3(0.5, 0.9, 0.4)
  aimMat.disableLighting = true
  aimArrow.material = aimMat
  aimArrow.isVisible = false

  await initPhysics(scene, { gravity: -9.81 })
  ballAgg = makeDynamic(ball, { mass: 0.45, restitution: 0.5, friction: 0.35, linearDamping: 0.55, angularDamping: 0.5 })

  gestures = new Gestures(canvasEl.value, {
    onDragStart: () => {},
    onDrag: (g) => onAim(g),
    onDragEnd: (g) => onRelease(g),
  })

  loadHole()
  stage.run((dt) => tick(dt))
  booting.value = false

  if (import.meta.env.DEV) {
    window.__g3d = () => ({
      backend: stage.backend,
      state: state.value,
      strokes: strokes.value,
      hole: holeIdx.value,
      ball: { x: ball.position.x, z: ball.position.z },
      cup: { x: cupPos.x, z: cupPos.z },
    })
  }
}

function frameCamera(def) {
  // frame from behind the tee looking toward the cup, so the ball sits near the
  // viewer and the flag is ahead in the distance
  const along = def.tee.z > def.cup.z ? 1 : -1
  cam.setTarget(new Vector3(0, 0, along * -2))
  cam.alpha = along > 0 ? Math.PI / 2 : -Math.PI / 2
  cam.beta = 0.6
  cam.radius = Math.max(def.l, def.w) * 1.28
}

function loadHole() {
  const def = holes[holeIdx.value]
  hole?.dispose()
  hole = buildHole(scene, shadowGen, def)
  cupPos = hole.cupPos
  holeName.value = def.name
  par.value = def.par
  holeNum.value = holeIdx.value + 1
  strokes.value = 0
  sunk = false
  restFrames = 0
  state.value = 'aiming'
  frameCamera(def)
  resetBall(hole.teePos)
  showTitle.value = true
  titleUntil = performance.now() + 1600
}

function resetBall(pos) {
  ballAgg.body.setLinearVelocity(Vector3.Zero())
  ballAgg.body.setAngularVelocity(Vector3.Zero())
  ball.position.copyFrom(pos)
  ball.rotationQuaternion?.set(0, 0, 0, 1)
  ballAgg.body.disablePreStep = false
  scene.onAfterRenderObservable.addOnce(() => {
    ballAgg.body.disablePreStep = true
  })
}

// ---- aiming ----
function shotDir(g) {
  const fwd = cam.getTarget().subtract(cam.position)
  fwd.y = 0
  fwd.normalize()
  const right = Vector3.Cross(Vector3.Up(), fwd)
  right.normalize()
  // pull-back: screen-down (g.dy>0) shoots forward (toward cup); screen-right pulls left
  const dir = right.scale(-g.dx).add(fwd.scale(g.dy))
  dir.y = 0
  if (dir.lengthSquared() > 0.0001) dir.normalize()
  return dir
}
function onAim(g) {
  if (state.value !== 'aiming') return
  curDir = shotDir(g)
  curPower = Math.min(g.dist / 150, 1)
  if (curPower < 0.05) {
    aimArrow.isVisible = false
    return
  }
  const len = 1 + curPower * 4
  aimArrow.isVisible = true
  aimArrow.position.set(ball.position.x + curDir.x * len * 0.5, 0.06, ball.position.z + curDir.z * len * 0.5)
  aimArrow.scaling.z = len
  aimArrow.rotation.y = Math.atan2(curDir.x, curDir.z)
  const c = curPower < 0.5 ? new Color3(0.5, 0.9, 0.4) : curPower < 0.8 ? new Color3(1, 0.7, 0.1) : new Color3(1, 0.32, 0.32)
  aimArrow.material.emissiveColor = c
}
function onRelease(g) {
  aimArrow.isVisible = false
  if (state.value !== 'aiming') return
  if (!curDir || curPower < 0.06) return
  const dir = shotDir(g)
  const mag = curPower * MAX_IMPULSE
  strokes.value++
  ballAgg.body.applyImpulse(dir.scale(mag), ball.getAbsolutePosition())
  state.value = 'rolling'
  restFrames = 0
  haptics.medium()
}

// ---- per-frame ----
function tick() {
  if (showTitle.value && performance.now() > titleUntil) showTitle.value = false

  if (state.value === 'rolling' && !sunk) {
    const v = ballAgg.body.getLinearVelocity()
    const speed = Math.hypot(v.x, v.y, v.z)
    const dx = ball.position.x - cupPos.x
    const dz = ball.position.z - cupPos.z
    const distXZ = Math.hypot(dx, dz)

    if (distXZ < CUP_R && speed < SINK_SPEED && ball.position.y < 0.6) {
      return sink()
    }
    if (ball.position.y < -3) {
      resetBall(hole.teePos) // safety: fell out of the world
      state.value = 'aiming'
      return
    }
    if (speed < 0.16) restFrames++
    else restFrames = 0
    if (restFrames > 20) {
      state.value = 'aiming'
      restFrames = 0
    }
  }
}

function sink() {
  sunk = true
  ballAgg.body.setLinearVelocity(Vector3.Zero())
  ballAgg.body.setAngularVelocity(Vector3.Zero())
  ball.position.set(cupPos.x, -0.1, cupPos.z)
  ballAgg.body.disablePreStep = false
  resultLabel.value = scoreName(strokes.value, par.value)
  state.value = 'holeComplete'
  haptics.success()
}

function advance() {
  haptics.light()
  if (holeIdx.value + 1 < total) holeIdx.value++
  else holeIdx.value = 0
  loadHole()
}

function scoreName(s, p) {
  if (s === 1) return 'Hole in One!'
  const d = s - p
  if (d <= -2) return 'Eagle!'
  if (d === -1) return 'Birdie'
  if (d === 0) return 'Par'
  if (d === 1) return 'Bogey'
  return `+${d}`
}

function goBack() {
  router.push({ name: 'menu' })
}
</script>

<style scoped>
.game3d { position: relative; width: 100%; height: 100vh; overflow: hidden; background: #8ec9ec; }
.stage-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; outline: none; touch-action: none; }

.hud-top {
  position: absolute;
  top: max(12px, env(safe-area-inset-top));
  left: 8px; right: 8px;
  display: flex; align-items: center; gap: 8px;
  z-index: 3;
}
.chips { flex: 1; display: flex; justify-content: center; gap: 6px; }
.chip {
  display: flex; flex-direction: column; align-items: center;
  min-width: 48px; padding: 3px 8px; border-radius: 10px;
  background: rgba(0,0,0,0.32); color: #fff; backdrop-filter: blur(6px);
}
.chip span { font-size: 0.55rem; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.75; }
.chip b { font-size: 1rem; line-height: 1.1; }
.chip.mode { font-size: 0.6rem; font-weight: 700; padding: 6px 8px; }

.hud-title {
  position: absolute; top: 30%; left: 0; right: 0; text-align: center; z-index: 2;
  color: #fff; text-shadow: 0 3px 12px rgba(0,0,0,0.5); pointer-events: none;
}
.t-name { font-size: 2rem; font-weight: 800; }
.t-par { font-size: 1rem; opacity: 0.9; }

.hud-hint {
  position: absolute; bottom: max(24px, env(safe-area-inset-bottom)); left: 0; right: 0;
  text-align: center; color: #fff; font-size: 0.85rem; z-index: 2;
  text-shadow: 0 2px 8px rgba(0,0,0,0.5); pointer-events: none;
}
.overlay {
  position: absolute; inset: 0; z-index: 4;
  background: rgba(0,0,0,0.5); backdrop-filter: blur(3px);
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px;
  color: #fff;
}
.o-title { font-size: 2rem; font-weight: 800; }
.o-sub { opacity: 0.85; margin-top: -6px; }
.fade-enter-active { transition: opacity 0.3s ease; }
.fade-enter-from { opacity: 0; }
.boot { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 1rem; z-index: 5; }
</style>
