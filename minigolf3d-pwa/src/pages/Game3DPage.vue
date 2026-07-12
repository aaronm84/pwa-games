<template>
  <q-page class="game3d">
    <canvas ref="canvasEl" class="stage-canvas" />

    <div class="hud-top">
      <q-btn flat round icon="arrow_back" color="white" @click="goBack" />
      <div class="chips">
        <div class="chip"><span>Hole</span><b>{{ holeNum }}/{{ total }}</b></div>
        <div class="chip"><span>Par</span><b>{{ par }}</b></div>
        <div class="chip"><span>Shot</span><b>{{ strokes }}</b></div>
        <div class="chip"><span>Total</span><b>{{ totalStrokes }}</b></div>
      </div>
      <div class="chip mode">{{ backend }}</div>
    </div>

    <transition name="fade">
      <div v-if="quip" class="quip">{{ quip }}</div>
    </transition>

    <div class="hud-title" v-if="showTitle">
      <div class="t-course">{{ course.name }}</div>
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
        <q-btn unelevated color="green" text-color="white" :label="holeIdx + 1 < total ? 'Next Hole' : 'Scorecard'" @click="advance" />
      </div>
    </transition>

    <transition name="fade">
      <div v-if="state === 'courseComplete'" class="overlay">
        <div class="o-title">Round Complete</div>
        <div class="o-sub big">{{ totalStrokes }} · {{ toParText(totalStrokes - coursePar) }}</div>
        <div class="scorecard">
          <div class="sc-row sc-head"><span>Hole</span><span v-for="n in 9" :key="'h' + n">{{ n }}</span><span>·</span><span v-for="n in 9" :key="'h2' + n">{{ n + 9 }}</span></div>
          <div class="sc-row"><span>You</span><span v-for="i in 9" :key="'s' + i" :class="cls(scores[i - 1], holes[i - 1].par)">{{ scores[i - 1] ?? '–' }}</span><span>·</span><span v-for="i in 9" :key="'s2' + i" :class="cls(scores[i + 8], holes[i + 8].par)">{{ scores[i + 8] ?? '–' }}</span></div>
        </div>
        <div class="row-btns">
          <q-btn unelevated color="green" text-color="white" label="Play Again" @click="newRound" />
          <q-btn flat color="white" label="Menu" @click="goBack" />
        </div>
      </div>
    </transition>

    <div v-if="booting" class="boot">Loading 3D course…</div>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { Stage, initPhysics, makeDynamic, outdoorLight, pbr, Gestures, MeshBuilder, Vector3, Color3, StandardMaterial, ArcRotateCamera } from 'src/engine'
import { courseById, coursePar as parOf } from 'src/game/courses'
import { buildHole3D, xz, BALL_R, CUP_R, S } from 'src/game/hole3d'
import { makeGator, makeUfo } from 'src/game/critters3d'
import { useSettingsStore } from 'src/stores/settings'
import { useHaptics } from 'src/composables/useHaptics'

const router = useRouter()
const settings = useSettingsStore()
const haptics = useHaptics()
const canvasEl = ref(null)

function devParam(k) {
  if (!import.meta.env.DEV) return null
  return new URLSearchParams(location.hash.split('?')[1] || '').get(k)
}
const course = courseById(devParam('course') || settings.settings.selectedCourse)
const holes = course.holes
const total = holes.length
const coursePar = parOf(course)
const theme = course.theme

const booting = ref(true)
const backend = ref('')
const state = ref('aiming')
const holeIdx = ref(0)
const strokes = ref(0)
const scores = ref([])
const showTitle = ref(false)
const quip = ref(null)

const holeNum = computed(() => holeIdx.value + 1)
const holeName = ref('')
const par = ref(3)
const resultLabel = ref('')
const totalStrokes = computed(() => {
  const done = scores.value.reduce((a, b) => a + (b || 0), 0)
  return done + (scores.value[holeIdx.value] != null ? 0 : strokes.value)
})

let stage = null
let scene = null
let cam = null
let shadowGen = null
let hole = null
let ball = null
let ballAgg = null
let aimArrow = null
let gestures = null
let restPos = null
let restFrames = 0
let sunk = false
let curPower = 0
let curDir = null
let titleUntil = 0
let quipUntil = 0
let portalCd = 0
let tickN = 0
let curDef = null

// critters
const events = course.events || []
let gators = []
let ufo = null
let ufoState = null
let nextAlien = 0
let abducted = false

const MAX_IMPULSE = 8
const SINK_SPEED = 2.8
const BASE_DAMP = 0.55

const LINES = {
  water: ['Splash! +1 penalty.', 'And it’s in the drink. +1.', 'Otto forgot his floaties. +1.'],
  gator: ['CHOMP! A gator got it. +1.', 'Never smile at a crocodile. +1.', 'That one belongs to the swamp now. +1.'],
  portal: ['Wheee!', 'Otto took the shortcut.'],
  alien: ['Otto has been abducted. He’s fine. Probably.', 'The truth is out there. So is your ball.'],
  ace: ['ACE! Chip is speechless. (He isn’t.)', 'Hole in one! Filthy.'],
  under: ['Under par. Chip approves.', 'Birdie business.'],
  par: ['Par. Respectable.', 'Right on the number.'],
  bogey: ['One over. We move on.', 'Bogey. It happens.'],
  bad: ['…we don’t talk about that one.', 'A learning hole.'],
}
const pick = (a) => a[Math.floor(Math.random() * a.length)]

onMounted(async () => {
  try {
    await boot()
  } catch (e) {
    console.error('[Game3D] boot failed:', e)
    booting.value = false
  }
})
onBeforeUnmount(() => {
  for (const g of gators) g.dispose()
  ufo?.dispose()
  gestures?.dispose()
  stage?.dispose()
})

async function boot() {
  stage = new Stage(canvasEl.value, { clear: [0.55, 0.79, 0.93, 1], webgpu: false })
  await stage.init()
  backend.value = stage.backend.toUpperCase()
  scene = stage.scene
  shadowGen = outdoorLight(scene).shadow
  cam = new ArcRotateCamera('cam', Math.PI / 2, 0.62, 30, new Vector3(0, 0, 0), scene)

  ball = MeshBuilder.CreateSphere('ball', { diameter: BALL_R * 2, segments: 20 }, scene)
  ball.material = pbr(scene, { color: '#ffffff', rough: 0.28, name: 'ball' })
  shadowGen.addShadowCaster(ball)

  aimArrow = MeshBuilder.CreateBox('aim', { width: 0.18, height: 0.05, depth: 1 }, scene)
  const am = new StandardMaterial('aimMat', scene)
  am.emissiveColor = new Color3(0.5, 0.9, 0.4)
  am.disableLighting = true
  aimArrow.material = am
  aimArrow.isVisible = false

  await initPhysics(scene, { gravity: -9.81 })
  ballAgg = makeDynamic(ball, { mass: 0.45, restitution: 0.5, friction: 0.35, linearDamping: BASE_DAMP, angularDamping: 0.5 })

  gestures = new Gestures(canvasEl.value, { onDrag: (g) => onAim(g), onDragEnd: (g) => onRelease(g) })

  if (events.includes('alien')) ufo = makeUfo(scene)

  const h = parseInt(devParam('hole'), 10)
  if (h >= 1 && h <= total) holeIdx.value = h - 1
  loadHole()
  stage.run(() => tick())
  booting.value = false

  if (import.meta.env.DEV) {
    window.__g3d = () => ({
      backend: stage.backend,
      state: state.value,
      strokes: strokes.value,
      hole: holeIdx.value,
      ball: { x: ball.position.x, y: ball.position.y, z: ball.position.z },
      cup: { x: hole.cup.pos.x, z: hole.cup.pos.z },
    })
  }
}

function loadHole() {
  const def = holes[holeIdx.value]
  curDef = def
  hole?.dispose()
  hole = buildHole3D(scene, shadowGen, def, theme)
  holeName.value = def.name
  par.value = def.par
  strokes.value = 0
  sunk = false
  restFrames = 0
  portalCd = 0
  state.value = 'aiming'

  // critters
  for (const g of gators) g.dispose()
  gators = []
  if (events.includes('gator')) {
    for (const wp of hole.waterPolys) {
      let cx = 0, cz = 0
      for (const p of wp) { cx += p.x; cz += p.z }
      gators.push(makeGator(scene, cx / wp.length, cz / wp.length))
    }
  }
  abducted = false
  ufoState = null
  ufo?.setEnabled(false)
  nextAlien = tickN + 360 + Math.floor(Math.random() * 420)

  frameCamera(def)
  resetBall(hole.teePos)
  restPos = hole.teePos.clone()
  showTitle.value = true
  titleUntil = tickN + 96
}

function frameCamera(def) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
  for (const p of def.fairway) {
    const w = xz(p)
    minX = Math.min(minX, w.x); maxX = Math.max(maxX, w.x)
    minZ = Math.min(minZ, w.z); maxZ = Math.max(maxZ, w.z)
  }
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2
  cam.setTarget(new Vector3(cx, 0, cz - 1.5))
  cam.alpha = Math.PI / 2
  cam.beta = 0.6
  cam.radius = Math.max(maxX - minX, maxZ - minZ) * 0.95 + 6
}

function resetBall(pos) {
  ballAgg.body.setLinearVelocity(Vector3.Zero())
  ballAgg.body.setAngularVelocity(Vector3.Zero())
  ball.position.copyFrom(pos)
  ball.rotationQuaternion?.set(0, 0, 0, 1)
  ballAgg.body.disablePreStep = false
  scene.onAfterRenderObservable.addOnce(() => { ballAgg.body.disablePreStep = true })
}

// ---- aiming / putting ----
function shotDir(g) {
  const fwd = cam.getTarget().subtract(cam.position)
  fwd.y = 0
  fwd.normalize()
  const right = Vector3.Cross(Vector3.Up(), fwd)
  right.normalize()
  const dir = right.scale(-g.dx).add(fwd.scale(g.dy))
  dir.y = 0
  if (dir.lengthSquared() > 0.0001) dir.normalize()
  return dir
}
function onAim(g) {
  if (state.value !== 'aiming') return
  curDir = shotDir(g)
  curPower = Math.min(g.dist / 150, 1)
  if (curPower < 0.05) { aimArrow.isVisible = false; return }
  const len = 1 + curPower * 5
  aimArrow.isVisible = true
  aimArrow.position.set(ball.position.x + curDir.x * len * 0.5, 0.08, ball.position.z + curDir.z * len * 0.5)
  aimArrow.scaling.z = len
  aimArrow.rotation.y = Math.atan2(curDir.x, curDir.z)
  aimArrow.material.emissiveColor = curPower < 0.5 ? new Color3(0.5, 0.9, 0.4) : curPower < 0.8 ? new Color3(1, 0.7, 0.1) : new Color3(1, 0.32, 0.32)
}
function onRelease(g) {
  aimArrow.isVisible = false
  if (state.value !== 'aiming' || !curDir || curPower < 0.06) return
  const dir = shotDir(g)
  strokes.value++
  restFrames = 0
  ballAgg.body.applyImpulse(dir.scale(curPower * MAX_IMPULSE), ball.getAbsolutePosition())
  state.value = 'rolling'
  haptics.medium()
}

// ---- per-frame ----
function pin(px, pz, poly) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, zi = poly[i].z, xj = poly[j].x, zj = poly[j].z
    if (zi > pz !== zj > pz && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi) inside = !inside
  }
  return inside
}
function tick() {
  tickN++
  if (showTitle.value && tickN > titleUntil) showTitle.value = false
  if (quip.value && tickN > quipUntil) quip.value = null
  if (portalCd > 0) portalCd--

  // spin windmills (visual)
  for (const wm of hole.windmills) {
    wm.angle += wm.speed
    wm.blade.rotation.y = wm.angle
  }
  // move cup (oscillate in the 2D axis, mapped to world XZ)
  const m = hole.cup.move
  if (m) {
    const span = (m.max - m.min) / 2
    const mid = (m.max + m.min) / 2
    const off = Math.sin(tickN * 0.02 * m.speed) * span
    const world =
      m.axis === 'x'
        ? { x: (mid + off - 260) * S, z: hole.cup.base.z }
        : { x: hole.cup.base.x, z: (mid + off - 380) * S }
    hole.cup.setXZ(world.x, world.z)
  }

  // critters
  for (const g of gators) g.update(tickN)
  if (ufo) updateAlien()

  if (state.value !== 'rolling' || sunk) return

  const bx = ball.position.x, bz = ball.position.z
  // water → splash + penalty
  for (const wp of hole.waterPolys) {
    if (pin(bx, bz, wp)) { return splash() }
  }
  // portals
  if (portalCd <= 0) {
    for (const pt of hole.portals) {
      if (Math.hypot(bx - pt.a.x, bz - pt.a.z) < pt.r) return teleport(pt.b)
      if (Math.hypot(bx - pt.b.x, bz - pt.b.z) < pt.r) return teleport(pt.a)
    }
  }
  // sand → extra damping; boost → impulse
  let inSand = false
  for (const sp of hole.sandPolys) if (pin(bx, bz, sp)) inSand = true
  ballAgg.body.setLinearDamping(inSand ? 3.2 : BASE_DAMP)
  for (const bz2 of hole.boostZones) {
    if (pin(bx, bz, bz2.poly)) ballAgg.body.applyImpulse(new Vector3(bz2.dir.x, 0, bz2.dir.z).scale(0.5), ball.getAbsolutePosition())
  }

  // keep the putt grounded — a flat green shouldn't launch the ball over a curb
  const v = ballAgg.body.getLinearVelocity()
  if (v.y > 0.05 || ball.position.y > BALL_R + 0.12) {
    v.y = Math.min(v.y, 0)
    ballAgg.body.setLinearVelocity(v)
  }
  // sink + gravity assist (a slow ball near the cup gets curled in)
  const speed = Math.hypot(v.x, v.z)
  const dcup = Math.hypot(bx - hole.cup.pos.x, bz - hole.cup.pos.z)
  if (dcup < CUP_R && speed < SINK_SPEED && ball.position.y < 0.5) return sink()
  if (dcup < CUP_R * 2.6 && speed < 3) {
    const k = 0.05 * (1 - dcup / (CUP_R * 2.6))
    ballAgg.body.applyImpulse(
      new Vector3(hole.cup.pos.x - bx, 0, hole.cup.pos.z - bz).normalize().scale(k),
      ball.getAbsolutePosition(),
    )
  }
  if (ball.position.y < -3) { resetBall(restPos); state.value = 'aiming'; return }

  if (speed < 0.16) restFrames++
  else restFrames = 0
  if (restFrames > 20) {
    restPos = ball.position.clone()
    state.value = 'aiming'
    restFrames = 0
  }
}

function splash() {
  strokes.value++ // penalty
  resetBall(restPos)
  state.value = 'aiming'
  if (gators.length) {
    for (const g of gators) g.setChomp()
    setQuip(pick(LINES.gator))
  } else {
    setQuip(pick(LINES.water))
  }
  haptics.medium()
}
function teleport(dest) {
  const v = ballAgg.body.getLinearVelocity()
  const sp = Math.hypot(v.x, v.z) || 1
  resetBall(new Vector3(dest.x + (v.x / sp) * (BALL_R + 0.8), BALL_R + 0.05, dest.z + (v.z / sp) * (BALL_R + 0.8)))
  ballAgg.body.setLinearVelocity(new Vector3(v.x * 0.7, 0, v.z * 0.7))
  portalCd = 20
  setQuip(pick(LINES.portal))
}

// ---- alien abduction (Area 51) ----
function updateAlien() {
  if (!ufoState) {
    const v = ballAgg.body.getLinearVelocity()
    if (!abducted && tickN > nextAlien && Math.hypot(v.x, v.z) < 0.5 && !sunk && state.value === 'aiming') {
      ufoState = { phase: 'descend', t: 0 }
      ufo.setEnabled(true)
      ufo.setPos(ball.position.x, 12, ball.position.z)
    }
    return
  }
  ufoState.t++
  const u = ufo.pos()
  if (ufoState.phase === 'descend') {
    ufo.setPos(u.x + (ball.position.x - u.x) * 0.1, u.y + (5.5 - u.y) * 0.1, u.z + (ball.position.z - u.z) * 0.1)
    if (ufoState.t > 40) { ufoState.phase = 'beam'; ufoState.t = 0; ufo.showBeam(true) }
  } else if (ufoState.phase === 'beam') {
    ballAgg.body.setLinearVelocity(Vector3.Zero())
    ball.position.x += (u.x - ball.position.x) * 0.15
    ball.position.z += (u.z - ball.position.z) * 0.15
    ball.position.y += (u.y - 1.5 - ball.position.y) * 0.15
    ballAgg.body.disablePreStep = false
    if (ufoState.t > 44) {
      ufo.showBeam(false)
      relocateBall()
      abducted = true
      ufoState.phase = 'leave'
      ufoState.t = 0
      setQuip(pick(LINES.alien))
    }
  } else if (ufoState.phase === 'leave') {
    ufo.setPos(u.x + 0.3, u.y + 0.25, u.z)
    if (u.y > 14) { ufo.setEnabled(false); ufoState = null }
  }
}
function relocateBall() {
  const fw = curDef.fairway.map((p) => xz(p))
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
  for (const p of fw) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z) }
  for (let i = 0; i < 60; i++) {
    const x = minX + Math.random() * (maxX - minX)
    const z = minZ + Math.random() * (maxZ - minZ)
    if (pin(x, z, fw)) {
      let inWater = false
      for (const wp of hole.waterPolys) if (pin(x, z, wp)) inWater = true
      if (!inWater) { resetBall(new Vector3(x, BALL_R + 0.05, z)); restPos = new Vector3(x, BALL_R + 0.05, z); return }
    }
  }
  resetBall(restPos)
}
function sink() {
  sunk = true
  ballAgg.body.setLinearVelocity(Vector3.Zero())
  ballAgg.body.setAngularVelocity(Vector3.Zero())
  ball.position.set(hole.cup.pos.x, -0.1, hole.cup.pos.z)
  ballAgg.body.disablePreStep = false
  scores.value[holeIdx.value] = strokes.value
  resultLabel.value = scoreName(strokes.value, par.value)
  const d = strokes.value - par.value
  quip.value = strokes.value === 1 ? pick(LINES.ace) : d < 0 ? pick(LINES.under) : d === 0 ? pick(LINES.par) : d === 1 ? pick(LINES.bogey) : pick(LINES.bad)
  quipUntil = tickN + 400
  state.value = 'holeComplete'
  haptics.success()
}

function advance() {
  haptics.light()
  if (holeIdx.value + 1 < total) { holeIdx.value++; loadHole() }
  else state.value = 'courseComplete'
}
function newRound() {
  haptics.light()
  holeIdx.value = 0
  scores.value = []
  loadHole()
}

function setQuip(t) { quip.value = t; quipUntil = tickN + 130 }
function scoreName(s, p) {
  if (s === 1) return 'Hole in One!'
  const d = s - p
  if (d <= -2) return 'Eagle!'
  if (d === -1) return 'Birdie'
  if (d === 0) return 'Par'
  if (d === 1) return 'Bogey'
  return `+${d}`
}
function cls(s, p) { if (s == null) return ''; const d = s - p; return d < 0 ? 'u' : d > 0 ? 'o' : '' }
function toParText(t) { return t === 0 ? 'Even' : t > 0 ? `+${t}` : `${t}` }
function goBack() { router.push({ name: 'menu' }) }
</script>

<style scoped>
.game3d { position: relative; width: 100%; height: 100vh; overflow: hidden; background: #8ec9ec; }
.stage-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; outline: none; touch-action: none; }
.hud-top { position: absolute; top: max(12px, env(safe-area-inset-top)); left: 8px; right: 8px; display: flex; align-items: center; gap: 8px; z-index: 3; }
.chips { flex: 1; display: flex; justify-content: center; gap: 6px; }
.chip { display: flex; flex-direction: column; align-items: center; min-width: 46px; padding: 3px 7px; border-radius: 10px; background: rgba(0,0,0,0.32); color: #fff; backdrop-filter: blur(6px); }
.chip span { font-size: 0.52rem; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.75; }
.chip b { font-size: 0.95rem; line-height: 1.1; }
.chip.mode { font-size: 0.55rem; font-weight: 700; padding: 6px 7px; }
.quip { position: absolute; top: 12%; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.45); color: #fff; padding: 5px 14px; border-radius: 999px; font-size: 0.85rem; z-index: 3; }
.hud-title { position: absolute; top: 26%; left: 0; right: 0; text-align: center; z-index: 2; color: #fff; text-shadow: 0 3px 12px rgba(0,0,0,0.6); pointer-events: none; }
.t-course { font-size: 0.85rem; opacity: 0.85; text-transform: uppercase; letter-spacing: 0.08em; }
.t-name { font-size: 2rem; font-weight: 800; }
.t-par { font-size: 1rem; opacity: 0.9; }
.hud-hint { position: absolute; bottom: max(24px, env(safe-area-inset-bottom)); left: 0; right: 0; text-align: center; color: #fff; font-size: 0.85rem; z-index: 2; text-shadow: 0 2px 8px rgba(0,0,0,0.5); pointer-events: none; }
.overlay { position: absolute; inset: 0; z-index: 4; background: rgba(0,0,0,0.55); backdrop-filter: blur(3px); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; color: #fff; padding: 16px; }
.o-title { font-size: 2rem; font-weight: 800; }
.o-sub { opacity: 0.9; margin-top: -6px; }
.o-sub.big { font-size: 1.2rem; font-weight: 700; }
.scorecard { display: flex; flex-direction: column; gap: 3px; font-size: 0.7rem; }
.sc-row { display: grid; grid-template-columns: 2rem repeat(9, 1fr) 0.6rem repeat(9, 1fr); gap: 2px; text-align: center; align-items: center; }
.sc-row > span:first-child { text-align: left; opacity: 0.7; }
.sc-head { opacity: 0.6; }
.u { color: #a5d6a7; font-weight: 800; }
.o { color: #ffab91; }
.row-btns { display: flex; gap: 10px; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.boot { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #fff; z-index: 5; }
</style>
