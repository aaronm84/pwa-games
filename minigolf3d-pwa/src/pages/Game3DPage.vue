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

    <!-- putter bag: swap putters mid-round -->
    <button
      v-if="state === 'aiming' || state === 'rolling'"
      class="bag-btn"
      @click="showBag = true"
      aria-label="Open putter bag"
    >
      <span class="bag-emoji">{{ activePutter.emoji }}</span>
      <span class="bag-label">{{ activePutter.name }}</span>
    </button>

    <transition name="fade">
      <div v-if="showBag" class="bag-overlay" @click.self="showBag = false">
        <div class="bag-sheet">
          <div class="bag-head">
            <span>Your bag</span>
            <q-btn flat round dense icon="close" color="white" @click="showBag = false" />
          </div>
          <div class="bag-list">
            <button
              v-for="p in bag"
              :key="p.id"
              class="putter-card"
              :class="{ active: p.id === activePutterId, locked: p.locked }"
              :disabled="p.locked"
              @click="!p.locked && selectPutter(p.id)"
            >
              <span class="p-emoji">{{ p.locked ? '🔒' : p.emoji }}</span>
              <span class="p-text">
                <span class="p-name">{{ p.name }}</span>
                <span class="p-blurb">{{ p.locked ? p.unlock.label : p.blurb }}</span>
              </span>
              <span v-if="p.id === activePutterId" class="p-check">✓</span>
            </button>
          </div>
        </div>
      </div>
    </transition>

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
        <div v-if="unlockMsg" class="o-unlock">{{ unlockMsg }}</div>
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
import { Stage, initPhysics, makeDynamic, outdoorLight, pbr, Gestures, MeshBuilder, Vector3, Quaternion, Color3, StandardMaterial, ArcRotateCamera } from 'src/engine'
import { courseById, coursePar as parOf } from 'src/game/courses'
import { buildHole3D, xz, BALL_R, CUP_R, S } from 'src/game/hole3d'
import { makeGator, makeUfo, makeBird, makeSplat, makeBigfoot, makeOttoFace } from 'src/game/critters3d'
import { enhanceFor } from 'src/game/enhance3d'
import { putters, putterById, isUnlocked } from 'src/game/putters'
import { useProgressStore } from 'src/stores/progress'
import { storeToRefs } from 'pinia'
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
const progress = useProgressStore()
const { minigolf: mgStats } = storeToRefs(progress)
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

// equipped putter (swappable mid-round from the bag) + the bag overlay
const activePutterId = ref(devParam('putter') || settings.settings.selectedPutter)
const activePutter = computed(() => putterById(activePutterId.value))
const showBag = ref(false)
const unlockMsg = ref(null)
// the whole set, each flagged locked/unlocked so the bag shows the full collection
const bag = computed(() => putters.map((p) => ({ ...p, locked: !isUnlocked(p, mgStats.value) })))

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
let holeStartTick = 0
let curDef = null

// critters
const events = course.events || []
let gators = []
let ufo = null
let ufoState = null
let nextAlien = 0
let abducted = false
let ottoFace = null
let grabbing = 0 // frames left in a gator grab (ball is held, then reset)
let lipCd = 0 // cooldown so a lip-out deflects once per crossing, not per frame
let bird = null
let nextBird = 0
let splats = []
let bigfoot = null
let nextBigfoot = 0

const MAXV = 20 // total speed cap (safety against fast wall slams)
const VY_CAP = 3.6 // soft cap on upward speed: ramps can climb, wall-launches can't
const SINK_SPEED = 2.5 // max speed at which the ball can drop (lower = harder)

// Base tuning + the equipped putter's modifiers folded in (see game/putters.js).
// Recomputed whenever the player swaps putters from the bag.
let MAX_IMPULSE = 8
let BASE_DAMP = 0.55
let HOMING = 1
function applyPutterMods() {
  const m = activePutter.value.mods
  MAX_IMPULSE = 8 * (m.power || 1)
  BASE_DAMP = 0.55 / (m.friction || 1) // higher friction mod = rolls further
  HOMING = 1 + (m.homing || 0) // multiplies the cup gravity-assist
}
applyPutterMods()
function selectPutter(id) {
  activePutterId.value = id
  settings.updateSetting('selectedPutter', id)
  applyPutterMods()
  showBag.value = false
  haptics.light()
}

const LINES = {
  water: ['Splash! +1 penalty.', 'And it’s in the drink. +1.', 'Otto forgot his floaties. +1.'],
  gator: ['CHOMP! A gator got it. +1.', 'Never smile at a crocodile. +1.', 'That one belongs to the swamp now. +1.'],
  portal: ['Wheee!', 'Otto took the shortcut.'],
  alien: ['Otto has been abducted. He’s fine. Probably.', 'The truth is out there. So is your ball.'],
  bird: ['A bird just… editorialized on the green.', 'Splat. Nature’s hazard.', 'Incoming! …too late.'],
  lip: ['Lipped out! Cruel game.', 'Rimmed it. Chip felt that one.', 'The cup said no.'],
  geyser: ['Thar she blows!', 'The green just sneezed.', 'Otto caught air. Otto did not enjoy it.'],
  bigfoot: ['Was that… Bigfoot?', 'Somebody big just crossed the tree line.', 'Chip swears he saw something hairy.'],
  ace: ['ACE! Chip is speechless. (He isn’t.)', 'Hole in one! Filthy.'],
  under: ['Under par. Chip approves.', 'Birdie business.'],
  par: ['Par. Respectable.', 'Right on the number.'],
  bogey: ['One over. We move on.', 'Bogey. It happens.'],
  bad: ['…we don’t talk about that one.', 'A learning hole.'],
}
const pick = (a) => a[Math.floor(Math.random() * a.length)]

onMounted(async () => {
  try {
    await progress.loadFromStorage() // bag lock states + unlock thresholds
    await boot()
  } catch (e) {
    console.error('[Game3D] boot failed:', e)
    booting.value = false
  }
})
onBeforeUnmount(() => {
  for (const g of gators) g.dispose()
  for (const s of splats) s.dispose()
  bird?.dispose()
  bigfoot?.dispose()
  ottoFace?.dispose()
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
  ottoFace = makeOttoFace(scene)

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

  // Round-spanning sighting clocks (rare, but guaranteed to come around during a
  // full round: bird ~10–25s, bigfoot ~25–60s, alien ~20–50s at 60fps).
  nextBird = tickN + 600 + Math.floor(Math.random() * 900)
  nextBigfoot = tickN + 1500 + Math.floor(Math.random() * 2100)
  nextAlien = tickN + 1200 + Math.floor(Math.random() * 1800)

  const h = parseInt(devParam('hole'), 10)
  if (h >= 1 && h <= total) holeIdx.value = h - 1
  loadHole()
  stage.run((dt) => tick(dt))
  booting.value = false

  if (import.meta.env.DEV) {
    window.__g3d = () => ({
      backend: stage.backend,
      state: state.value,
      strokes: strokes.value,
      hole: holeIdx.value,
      ball: { x: ball.position.x, y: ball.position.y, z: ball.position.z },
      cup: { x: hole.cup.pos.x, z: hole.cup.pos.z },
      putter: activePutterId.value,
      grabbing,
      camRadius: cam.radius,
      windmillYaw: hole.windmills[0]?.blade.rotationQuaternion?.toEulerAngles().y ?? null,
      timers: { nextBird, nextBigfoot, nextAlien },
      aces: mgStats.value.holesInOne,
      breaks: hole.breaks.map((b) => ({ x: b.x, z: b.z, sigma: b.sigma, amp: b.amp })),
      geysers: hole.geysers.map((g) => ({ x: g.x, z: g.z, r: g.r })),
      anomalies: hole.anomalies.map((a) => ({ x: a.x, z: a.z, r: a.r })),
      selectPutter,
      // dev spawners (cameos are deliberately rare in play)
      spawnBigfoot: () => { bigfoot?.dispose(); bigfoot = makeBigfoot(scene, true, 0, theme.cryptid); for (let i = 0; i < 250; i++) bigfoot.step(i) },
      spawnGatorGrab: () => { if (gators[0]) grabbing = gators[0].lunge(gators[0].x + 1, gators[0].z + 1) },
      // place the ball at (x,z) moving at (vx,vz) — probes break/anomaly forces
      devSetBall: (x, z, vx, vz) => {
        ballAgg.body.setLinearVelocity(Vector3.Zero())
        ball.position.set(x, BALL_R + 0.05, z)
        ballAgg.body.disablePreStep = false
        sunk = false; restFrames = 0
        state.value = 'rolling'
        scene.onAfterRenderObservable.addOnce(() => {
          ballAgg.body.setLinearVelocity(new Vector3(vx, 0, vz))
          ballAgg.body.disablePreStep = true
        })
      },
      // fire a straight putt from `dist` short of the cup at exactly `speed` — a
      // clean, aim-free probe of the sink window
      devPutt: (dist, speed) => {
        const cx = hole.cup.pos.x, cz = hole.cup.pos.z
        ballAgg.body.setLinearVelocity(Vector3.Zero())
        ballAgg.body.setAngularVelocity(Vector3.Zero())
        ball.position.set(cx, BALL_R + 0.05, cz + dist)
        ballAgg.body.disablePreStep = false
        sunk = false; restFrames = 0; strokes.value++
        state.value = 'rolling'
        scene.onAfterRenderObservable.addOnce(() => {
          ballAgg.body.setLinearVelocity(new Vector3(0, 0, -speed))
          ballAgg.body.disablePreStep = true
        })
      },
    })
  }
}

function loadHole() {
  const def = holes[holeIdx.value]
  curDef = def
  hole?.dispose()
  hole = buildHole3D(scene, shadowGen, def, theme, enhanceFor(course.id, holeIdx.value))
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
      cx /= wp.length; cz /= wp.length
      const g = makeGator(scene, cx, cz)
      // reach = pond radius + a lunge margin, so a ball skirting the bank is fair game
      let maxR = 0
      for (const p of wp) maxR = Math.max(maxR, Math.hypot(p.x - cx, p.z - cz))
      g.grabR = maxR + BALL_R + 0.7
      g.armed = false
      gators.push(g)
    }
  }
  grabbing = 0
  lipCd = 0
  holeStartTick = tickN
  abducted = false
  ufoState = null
  ufo?.setEnabled(false)

  // clear any active cameo actors, but leave the sighting timers running — they
  // span the whole round (resetting them each hole meant windows longer than a
  // hole never fired, and Bigfoot/UFO were effectively never seen)
  bird?.dispose(); bird = null
  bigfoot?.dispose(); bigfoot = null
  for (const s of splats) s.dispose()
  splats = []

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
  cam.setTarget(new Vector3(cx, 0, cz - 1))
  cam.alpha = Math.PI / 2
  // a touch more overhead + more pull-back so the whole hole (and the ball) always
  // stays in frame, never hidden behind a curb or hill
  cam.beta = 0.52
  cam.radius = Math.max(maxX - minX, maxZ - minZ) * 1.25 + 11
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
function tick(dt = 1 / 60) {
  tickN++
  dt = Math.min(Math.max(dt || 1 / 60, 0.001), 0.05) // clamp tab-resume spikes, keep slow-frame time real
  if (showTitle.value && tickN > titleUntil) showTitle.value = false
  if (quip.value && tickN > quipUntil) quip.value = null
  if (portalCd > 0) portalCd--

  // spin windmills. The blade's Havok body switched the mesh to quaternion
  // rotation, so Euler .rotation is ignored — drive the quaternion directly.
  for (const wm of hole.windmills) {
    wm.angle += wm.speed
    if (!wm.blade.rotationQuaternion) wm.blade.rotationQuaternion = Quaternion.Identity()
    Quaternion.RotationYawPitchRollToRef(wm.angle, 0, 0, wm.blade.rotationQuaternion)
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
  updateCameos()
  updateGeysers()
  for (const an of hole.anomalies) an.ring.scaling.setAll(1 + Math.sin(tickN * 0.06) * 0.06)

  // Otto's eyes follow the ball and squint over water
  if (ottoFace) {
    ottoFace.update(ball.position)
    let overWater = false
    for (const wp of hole.waterPolys) if (pin(ball.position.x, ball.position.z, wp)) overWater = true
    ottoFace.setWorried(overWater)
  }

  // gator lunge — a chance to be grabbed when the ball skirts a pond (see checkGators)
  if (grabbing === 0 && !sunk) checkGators()
  if (grabbing > 0) {
    grabbing--
    ballAgg.body.setLinearVelocity(Vector3.Zero())
    if (grabbing === 0) {
      strokes.value++ // penalty
      resetBall(restPos)
      state.value = 'aiming'
      setQuip(pick(LINES.gator))
      haptics.medium()
    }
    return
  }

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
  let onSplat = false
  for (const s of splats) if (Math.hypot(bx - s.x, bz - s.z) < s.r) onSplat = true
  ballAgg.body.setLinearDamping(inSand ? 3.2 : onSplat ? 1.8 : BASE_DAMP)
  for (const bz2 of hole.boostZones) {
    if (pin(bx, bz, bz2.poly)) ballAgg.body.applyImpulse(new Vector3(bz2.dir.x, 0, bz2.dir.z).scale(0.5), ball.getAbsolutePosition())
  }

  // green breaks — the gentle mounds/dips printed on the green pull the rolling
  // ball downhill (away from a mound, into a dip), exactly as the contour rings
  // read. Gaussian slope: peak pull at one sigma from the centre.
  if (ball.position.y < 0.4) {
    for (const bk of hole.breaks) {
      const dx = bx - bk.x, dz = bz - bk.z
      const d = Math.hypot(dx, dz)
      if (d > 0.02 && d < bk.sigma * 3) {
        const a = 2.6 * bk.amp * (d / bk.sigma) * Math.exp(-(d * d) / (2 * bk.sigma * bk.sigma))
        const imp = 0.45 * a * dt // mass * accel * dt
        ballAgg.body.applyImpulse(new Vector3((dx / d) * imp, 0, (dz / d) * imp), ball.getAbsolutePosition())
      }
    }
    // anomalies swirl the ball sideways while it crosses the ring
    for (const an of hole.anomalies) {
      const dx = bx - an.x, dz = bz - an.z
      const d = Math.hypot(dx, dz)
      if (d > 0.02 && d < an.r) {
        const imp = 0.45 * 3.2 * dt
        ballAgg.body.applyImpulse(new Vector3((-dz / d) * an.dir * imp, 0, (dx / d) * an.dir * imp), ball.getAbsolutePosition())
      }
    }
  }

  // Let the ball ride ramps/hills but never launch off a curb: soft-cap upward
  // speed and cap the total speed. (Taller, softer curbs do the rest.)
  const v = ballAgg.body.getLinearVelocity()
  let vChanged = false
  const sp3 = Math.hypot(v.x, v.y, v.z)
  if (sp3 > MAXV) { const k = MAXV / sp3; v.x *= k; v.y *= k; v.z *= k; vChanged = true }
  if (v.y > VY_CAP) { v.y = VY_CAP; vChanged = true }
  if (vChanged) ballAgg.body.setLinearVelocity(v)
  // sink + gravity assist. The ball has to be genuinely over the cup and not
  // moving too fast — a glancing pass lips out. (A slow, well-placed ball still
  // drops, and the magnet putter's homing widens the window.)
  const speed = Math.hypot(v.x, v.z)
  const dcup = Math.hypot(bx - hole.cup.pos.x, bz - hole.cup.pos.z)
  const captureR = CUP_R * (0.82 + 0.14 * (HOMING - 1)) // a bit tighter than the visible cup
  if (lipCd > 0) lipCd-- // a just-lipped ball is briefly immune while it exits
  if (dcup < captureR && speed < SINK_SPEED && ball.position.y < 0.5 && lipCd === 0) return sink()
  // Too fast over the hole: the ball can never glide across untouched — it rattles
  // off the far rim. Reflect the radial velocity component back out (shaved), which
  // reads as a real lip-out, and hold the sink-immunity while it escapes.
  if (dcup < CUP_R && speed >= SINK_SPEED && ball.position.y < 0.4 && lipCd === 0) {
    lipCd = 26
    let nx = bx - hole.cup.pos.x, nz = bz - hole.cup.pos.z
    const nl = Math.hypot(nx, nz) || 1
    nx /= nl; nz /= nl
    const dot = v.x * nx + v.z * nz
    ballAgg.body.setLinearVelocity(new Vector3((v.x - 2 * dot * nx) * 0.68, Math.min(v.y, 0.5), (v.z - 2 * dot * nz) * 0.68))
    if (Math.random() < 0.6) setQuip(pick(LINES.lip))
    haptics.light()
  }
  // a slow ball near the rim gets a gentle curl toward the cup (much weaker than
  // before, so a mere graze no longer vacuums in — you have to earn it)
  if (dcup < CUP_R * 2 && speed < 2.2) {
    const k = 0.035 * HOMING * (1 - dcup / (CUP_R * 2))
    ballAgg.body.applyImpulse(
      new Vector3(hole.cup.pos.x - bx, 0, hole.cup.pos.z - bz).normalize().scale(k),
      ball.getAbsolutePosition(),
    )
  }
  if (ball.position.y < -3) { resetBall(restPos); state.value = 'aiming'; return }

  if (speed < 0.16) restFrames++
  else restFrames = 0
  if (restFrames > 20) {
    // insurance: if the ball somehow came to rest inside a hedge (or anywhere
    // unplayable), rescue it instead of soft-locking the hole
    if (hole.wallPolys.some((w) => pin(bx, bz, w))) {
      const restBad = hole.wallPolys.some((w) => pin(restPos.x, restPos.z, w))
      resetBall(restBad ? hole.teePos : restPos)
    } else {
      restPos = ball.position.clone()
    }
    state.value = 'aiming'
    restFrames = 0
  }
}

function splash() {
  strokes.value++ // penalty
  progress.recordSplash()
  resetBall(restPos)
  state.value = 'aiming'
  if (gators.length) {
    for (const g of gators) g.setChomp()
    setQuip(pick(LINES.gator))
  } else {
    setQuip(pick(course.splash || LINES.water)) // lava/ice courses bring their own lines
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

// Geysers erupt on a fixed cycle (~7s, staggered by phase). A ball caught over a
// venting geyser gets tossed up and sideways — even a parked one.
function updateGeysers() {
  for (const gy of hole.geysers) {
    const ph = (tickN + gy.offset) % 420
    const bursting = ph < 42
    gy.col.setEnabled(bursting)
    if (bursting) {
      gy.col.scaling.y = 0.35 + (ph / 42) * 0.85
      gy.col.scaling.x = gy.col.scaling.z = 0.8 + Math.sin(ph * 0.5) * 0.15
    }
    if (gy.cd > 0) gy.cd--
    if (
      bursting && gy.cd === 0 && grabbing === 0 && !sunk &&
      state.value !== 'holeComplete' && state.value !== 'courseComplete' &&
      ball.position.y < 0.5 && Math.hypot(ball.position.x - gy.x, ball.position.z - gy.z) < gy.r + BALL_R
    ) {
      gy.cd = 120
      const v = ballAgg.body.getLinearVelocity()
      ballAgg.body.setLinearVelocity(new Vector3(v.x + (Math.random() - 0.5) * 2.6, 3.4, v.z + (Math.random() - 0.5) * 2.6))
      if (state.value === 'aiming') { state.value = 'rolling'; restFrames = 0 }
      setQuip(pick(LINES.geyser))
      haptics.medium()
    }
  }
}

// A gator gets one chance to snatch the ball each time it enters a pond's reach —
// not every pass, and armed only after the ball has been clear of the water, so it
// never grabs off the tee. Rolls once per approach.
const GRAB_CHANCE = 0.4
function checkGators() {
  const bx = ball.position.x, bz = ball.position.z
  for (const g of gators) {
    if (g.grabR == null) continue
    const d = Math.hypot(bx - g.x, bz - g.z)
    if (d > g.grabR) { g.armed = true; continue }
    if (g.armed && grabbing === 0) {
      g.armed = false
      if (Math.random() < GRAB_CHANCE) {
        grabbing = g.lunge(bx, bz)
        return
      }
    }
  }
}

// ---- ambient cameos: bird flyovers (+ splats) and Bigfoot sightings ----
function fairwayWorld() {
  return curDef.fairway.map((p) => xz(p))
}
function updateCameos() {
  // bird — flaps across, maybe leaves a splat on the green
  if (events.includes('bird')) {
    if (!bird && tickN > nextBird) {
      const fromLeft = Math.random() < 0.5
      bird = makeBird(scene, fromLeft, 4 + Math.random() * 4, -12 + Math.random() * 24)
      bird.dropX = -6 + Math.random() * 12
      bird.dropped = false
      nextBird = tickN + 900 + Math.floor(Math.random() * 1200)
    }
    if (bird) {
      const gone = bird.step(tickN)
      const bp = bird.pos()
      if (!bird.dropped && Math.abs(bp.x - bird.dropX) < 0.3) {
        bird.dropped = true
        if (pin(bp.x, bp.z, fairwayWorld()) && splats.length < 5) {
          splats.push(makeSplat(scene, bp.x, bp.z))
          setQuip(pick(LINES.bird))
        }
      }
      if (gone) { bird.dispose(); bird = null }
    }
  }
  // splats slowly fade and expire
  for (let i = splats.length - 1; i >= 0; i--) {
    const s = splats[i]
    s.life = (s.life ?? 420) - 1
    s.fade(Math.max(0, s.life) / 420)
    if (s.life <= 0) { s.dispose(); splats.splice(i, 1) }
  }
  // bigfoot — a shaggy silhouette strides across; rare and purely cosmetic. A
  // probability gate on top of the long timer keeps it from ever feeling scheduled.
  if (events.includes('bigfoot')) {
    if (!bigfoot && tickN > nextBigfoot) {
      if (Math.random() < 0.6) {
        bigfoot = makeBigfoot(scene, Math.random() < 0.5, -13 + Math.random() * 26, theme.cryptid)
        setQuip('👀 Was that…?')
      }
      nextBigfoot = tickN + 1500 + Math.floor(Math.random() * 2100) // re-arm either way
    }
    if (bigfoot) {
      const gone = bigfoot.step(tickN)
      if (gone) {
        bigfoot.dispose(); bigfoot = null
        if (Math.random() < 0.6) setQuip(pick(LINES.bigfoot))
      }
    }
  }
}

// ---- alien abduction (Area 51) ----
function updateAlien() {
  if (!ufoState) {
    const v = ballAgg.body.getLinearVelocity()
    // never at the top of a hole: the player must be mid-hole (has putted, and the
    // hole has been running a few seconds) so an abduction interrupts a round in
    // progress instead of ambushing every fresh tee
    if (!abducted && tickN > nextAlien && strokes.value > 0 && tickN > holeStartTick + 300 && Math.hypot(v.x, v.z) < 0.5 && !sunk && state.value === 'aiming') {
      if (Math.random() < 0.6) {
        ufoState = { phase: 'descend', t: 0 }
        ufo.setEnabled(true)
        ufo.setPos(ball.position.x, 12, ball.position.z)
      } else {
        nextAlien = tickN + 1200 + Math.floor(Math.random() * 1800) // skip; try later
      }
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
      progress.recordAbduction()
      // re-arm the clock — without this, an expired timer stayed expired and the
      // UFO came back at the start of every following hole
      nextAlien = tickN + 1200 + Math.floor(Math.random() * 1800)
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
// Is (x,z) a safe spot to place the ball? On the fairway, and clear of water,
// hedges (with a margin — a ball dropped inside a hedge collider is unplayable),
// bumpers, windmill hubs, and the cup itself.
function safeSpot(x, z, fw) {
  if (!pin(x, z, fw)) return false
  for (const wp of hole.waterPolys) if (pin(x, z, wp)) return false
  for (const w of hole.wallPolys) {
    if (pin(x, z, w)) return false
    for (let a = 0; a < 6.3; a += 1.55) if (pin(x + Math.cos(a) * 0.45, z + Math.sin(a) * 0.45, w)) return false
  }
  for (const b of hole.bumpers) if (Math.hypot(x - b.x, z - b.z) < b.r + 0.4) return false
  for (const wm of curDef.windmills || []) {
    const c = xz(wm)
    if (Math.hypot(x - c.x, z - c.z) < wm.hub * S + 0.5) return false
  }
  if (Math.hypot(x - hole.cup.pos.x, z - hole.cup.pos.z) < CUP_R * 1.6) return false
  return true
}
function relocateBall() {
  const fw = curDef.fairway.map((p) => xz(p))
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
  for (const p of fw) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z) }
  for (let i = 0; i < 90; i++) {
    const x = minX + Math.random() * (maxX - minX)
    const z = minZ + Math.random() * (maxZ - minZ)
    if (safeSpot(x, z, fw)) {
      resetBall(new Vector3(x, BALL_R + 0.05, z))
      restPos = new Vector3(x, BALL_R + 0.05, z)
      return
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
  if (strokes.value === 1) progress.recordHoleInOne()
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
  else {
    // record the round — this is what unlocks putters — and surface anything new
    const wasUnlocked = new Set(putters.filter((p) => isUnlocked(p, mgStats.value)).map((p) => p.id))
    progress.recordCourse(course.id, scores.value.reduce((a, b) => a + (b || 0), 0), coursePar)
    const fresh = putters.filter((p) => !wasUnlocked.has(p.id) && isUnlocked(p, mgStats.value))
    unlockMsg.value = fresh.length ? `🔓 New putter unlocked: ${fresh.map((p) => `${p.emoji} ${p.name}`).join(', ')}` : null
    state.value = 'courseComplete'
  }
}
function newRound() {
  haptics.light()
  holeIdx.value = 0
  scores.value = []
  unlockMsg.value = null
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
.o-unlock { background: rgba(76,175,80,0.22); border: 1px solid rgba(110,224,122,0.5); border-radius: 999px; padding: 6px 16px; font-size: 0.85rem; font-weight: 600; }
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
/* putter bag button */
.bag-btn { position: absolute; right: 10px; bottom: max(16px, env(safe-area-inset-bottom)); z-index: 3; display: flex; align-items: center; gap: 7px; padding: 8px 13px 8px 10px; border: 1px solid rgba(255,255,255,0.22); border-radius: 999px; background: rgba(0,0,0,0.4); color: #fff; backdrop-filter: blur(6px); cursor: pointer; }
.bag-btn:active { transform: scale(0.96); }
.bag-emoji { font-size: 1.25rem; line-height: 1; }
.bag-label { font-size: 0.78rem; font-weight: 600; }
/* bag overlay sheet */
.bag-overlay { position: absolute; inset: 0; z-index: 6; background: rgba(0,0,0,0.5); backdrop-filter: blur(3px); display: flex; align-items: flex-end; }
.bag-sheet { width: 100%; background: #1c2530; border-radius: 18px 18px 0 0; padding: 12px 14px max(18px, env(safe-area-inset-bottom)); color: #fff; box-shadow: 0 -8px 30px rgba(0,0,0,0.4); }
.bag-head { display: flex; align-items: center; justify-content: space-between; font-size: 1.05rem; font-weight: 700; margin-bottom: 8px; padding-left: 4px; }
.bag-list { display: flex; flex-direction: column; gap: 8px; max-height: 52vh; overflow-y: auto; }
.putter-card { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; padding: 11px 12px; border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; background: rgba(255,255,255,0.05); color: #fff; cursor: pointer; }
.putter-card.active { border-color: #4caf50; background: rgba(76,175,80,0.16); }
.putter-card.locked { opacity: 0.5; cursor: default; }
.putter-card:not(.locked):active { transform: scale(0.99); }
.p-emoji { font-size: 1.7rem; line-height: 1; flex-shrink: 0; }
.p-text { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.p-name { font-weight: 700; font-size: 0.95rem; }
.p-blurb { font-size: 0.75rem; opacity: 0.72; line-height: 1.25; }
.p-check { color: #6ee07a; font-weight: 800; font-size: 1.1rem; }
</style>
