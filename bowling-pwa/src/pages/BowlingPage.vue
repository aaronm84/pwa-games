<template>
  <q-page class="bowl" :style="{ background: alley.sky }">
    <canvas ref="canvasEl" class="stage-canvas" />

    <div class="hud-top">
      <q-btn flat round icon="arrow_back" color="white" @click="goBack" />
      <div class="chips">
        <div class="chip"><span>Frame</span><b>{{ frameNum }}/10</b></div>
        <div class="chip"><span>Throw</span><b>{{ throwNum }}</b></div>
        <div class="chip"><span>Score</span><b>{{ runningTotal ?? '–' }}</b></div>
      </div>
      <div class="chip mode">{{ backend }}</div>
    </div>

    <!-- mini per-frame marks strip -->
    <div class="marks">
      <div v-for="(f, i) in framesView" :key="i" class="mark-cell" :class="{ cur: i === curFrame && !gameOver }">
        <span class="m-rolls">{{ f.marks }}</span>
        <span class="m-cum">{{ f.cumulative ?? '' }}</span>
      </div>
    </div>

    <transition name="fade">
      <div v-if="banner" class="banner" :class="bannerKind">{{ banner }}</div>
    </transition>
    <transition name="fade">
      <div v-if="quip" class="quip">{{ quip }}</div>
    </transition>

    <div class="hud-hint" v-if="state === 'aiming' && rolls.length === 0">
      Slide sideways to line up · drag down to wind up, snap forward to bowl
    </div>
    <div class="hud-hint" v-if="state === 'rolling'">⏩ hold to fast-forward</div>

    <!-- ball rack -->
    <button v-if="state === 'aiming' || state === 'rolling'" class="bag-btn" @click="showRack = true" aria-label="Open ball rack">
      <span class="bag-emoji">{{ activeBall.emoji }}</span>
      <span class="bag-label">{{ activeBall.name }}</span>
    </button>

    <transition name="fade">
      <div v-if="showRack" class="bag-overlay" @click.self="showRack = false">
        <div class="bag-sheet">
          <div class="bag-head">
            <span>The rack</span>
            <q-btn flat round dense icon="close" color="white" @click="showRack = false" />
          </div>
          <div class="bag-list">
            <button v-for="b in balls" :key="b.id" class="ball-card" :class="{ active: b.id === activeBallId }" @click="selectBall(b.id)">
              <span class="p-emoji">{{ b.emoji }}</span>
              <span class="p-text">
                <span class="p-name">{{ b.name }}</span>
                <span class="p-blurb">{{ b.blurb }}</span>
              </span>
              <span v-if="b.id === activeBallId" class="p-check">✓</span>
            </button>
          </div>
        </div>
      </div>
    </transition>

    <!-- game over: the full scorecard -->
    <transition name="fade">
      <div v-if="gameOver" class="overlay">
        <div class="o-title">{{ finalLabel }}</div>
        <div class="o-sub big">{{ finalTotal }}</div>
        <div class="scorecard">
          <div class="sc-grid">
            <div v-for="(f, i) in framesView" :key="'f' + i" class="sc-frame">
              <div class="sc-marks">{{ f.marks || '–' }}</div>
              <div class="sc-cum">{{ f.cumulative ?? '' }}</div>
            </div>
          </div>
        </div>
        <div v-if="statLine" class="o-unlock">{{ statLine }}</div>
        <div class="row-btns">
          <q-btn unelevated color="primary" text-color="white" label="Bowl Again" @click="newGame" />
          <q-btn flat color="white" label="Menu" @click="goBack" />
        </div>
      </div>
    </transition>

    <div v-if="booting" class="boot">Polishing the lane…</div>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { Stage, initPhysics, makeDynamic, outdoorLight, pbr, Gestures, MeshBuilder, Mesh, Vector3, Color3, StandardMaterial, ArcRotateCamera, PointLight, SpotLight, GlowLayer } from 'src/engine'
import { buildAlley, makePin, pinSpots, LANE_W, BALL_R, PIN_Z, PIT_Z, START_Z } from 'src/game/lane3d'
import { scoreGame, rollPosition } from 'src/game/scoring'
import { alleyById } from 'src/game/alleys'
import { balls, ballById } from 'src/game/balls'
import { makeDiscoBall, burstConfetti, makeUfo } from 'src/game/fx3d'
import { buildEnvirons } from 'src/game/environs'
import { useSettingsStore } from 'src/stores/settings'
import { useProgressStore } from 'src/stores/progress'
import { useHaptics } from 'src/composables/useHaptics'

const router = useRouter()
const settings = useSettingsStore()
const progress = useProgressStore()
const haptics = useHaptics()
const canvasEl = ref(null)

function devParam(k) {
  if (!import.meta.env.DEV) return null
  return new URLSearchParams(location.hash.split('?')[1] || '').get(k)
}
const alley = alleyById(devParam('alley') || settings.settings.selectedAlley)

const booting = ref(true)
const backend = ref('')
const state = ref('aiming') // aiming | rolling | sweep | over
const rolls = ref([])
const quip = ref(null)
const banner = ref(null)
const bannerKind = ref('good')
const showRack = ref(false)
const gameOver = ref(false)
const finalTotal = ref(0)
const finalLabel = ref('')
const statLine = ref(null)

const activeBallId = ref(devParam('ball') || settings.settings.selectedBall)
const activeBall = computed(() => ballById(activeBallId.value))

const score = computed(() => scoreGame(rolls.value))
const framesView = computed(() =>
  score.value.frames.map((f) => ({
    marks: f.rolls.map((r, i) => (r === 10 && (i === 0 || f.rolls[i - 1] === 10 || f.rolls.length === 3) ? 'X' : i > 0 && f.rolls[i - 1] + r === 10 && f.rolls[i - 1] !== 10 ? '/' : r === 0 ? '-' : r)).join(' '),
    cumulative: f.cumulative,
  })),
)
const curFrame = computed(() => rollPosition(rolls.value)?.frame ?? 9)
const frameNum = computed(() => curFrame.value + 1)
const throwNum = computed(() => (rollPosition(rolls.value)?.throw ?? 0) + 1)
const runningTotal = computed(() => {
  let last = null
  for (const f of score.value.frames) if (f.cumulative != null) last = f.cumulative
  return last
})

let stage = null
let scene = null
let cam = null
let shadowGen = null
let laneKit = null
let ball = null
let ballAgg = null
let ballGlowMat = null
let aimArrow = null
let gestures = null
let pins = []
let fading = [] // downed pins fading out
let confetti = []
let disco = null
let ufo = null
let tickN = 0
let quipUntil = 0
let neonL = null
let neonR = null
let deckSpot = null
let ipcRef = null
let glowLayer = null
let strikeFlash = 0
let environs = null
let ffHold = false // hold during a roll to fast-forward
let tracePts = []
let traceMesh = null
// swing state: 'idle' → (horizontal drag = aiming) | (downward drag = 'swinging')
let gestureMode = null
let aimX = 0 // where the bowler stands (lateral)
let swingSamples = [] // {t, dx, dy} — the stroke path, for release velocity
let maxBackswing = 0
let bottomDx = 0 // stroke dx at the deepest point of the backswing
let bottomT = 0 // when the backswing peaked — release speed is measured from here
let guide = null
let lastLaunch = null
let bannerUntil = 0
let thrown = false
let throwTick = 0
let gutterBall = false
let sweepAt = 0
let gutterQuipped = false
let strikesThisGame = 0

const pick = (a) => a[Math.floor(Math.random() * a.length)]

onMounted(async () => {
  try {
    await progress.loadFromStorage()
    await boot()
  } catch (e) {
    console.error('[Bowling] boot failed:', e)
    booting.value = false
  }
})
onBeforeUnmount(() => {
  environs?.dispose()
  traceMesh?.dispose()
  disco?.dispose()
  ufo?.dispose()
  for (const c of confetti) c.dispose()
  gestures?.dispose()
  stage?.dispose()
})

async function boot() {
  stage = new Stage(canvasEl.value, { clear: hexToRgba(alley.colors.clear), webgpu: false })
  await stage.init()
  backend.value = stage.backend.toUpperCase()
  scene = stage.scene
  shadowGen = outdoorLight(scene, { intensity: 0.5 }).shadow // dim base — the alley lights do the talking
  scene.skipPointerMovePicking = true
  // cinematic grade: gentle contrast + vignette
  const ipc = scene.imageProcessingConfiguration
  ipc.contrast = 1.15
  ipc.exposure = 1.05
  ipc.vignetteEnabled = true
  ipc.vignetteWeight = 1.5
  // bloom on every emissive: the neon strips, guide line and power cue glow
  if (settings.settings.glowFx !== false) {
    glowLayer = new GlowLayer('glow', scene, { mainTextureRatio: 0.5 })
    glowLayer.intensity = 0.8
  }
  // the classic pin-deck spotlight
  deckSpot = new SpotLight('deckSpot', new Vector3(0, 6.2, PIN_Z + 2.2), new Vector3(0, -1, -0.35), Math.PI / 2.6, 8, scene)
  deckSpot.intensity = 1.5
  deckSpot.diffuse = Color3.FromHexString('#fff2dd')
  ipcRef = ipc
  // neon accents washing the lane from each side (hue-cycled in tick)
  neonL = new PointLight('neonL', new Vector3(-2.4, 1.6, 1.5), scene)
  neonR = new PointLight('neonR', new Vector3(2.4, 1.6, -2.5), scene)
  for (const l of [neonL, neonR]) { l.intensity = 0.55; l.range = 13 }
  // flat enough that the ball at the bowler's feet is in frame, high enough to
  // read the whole lane
  cam = new ArcRotateCamera('cam', Math.PI / 2, 1.17, 7.6, new Vector3(0, 0.2, 2.4), scene)

  await initPhysics(scene, { gravity: alley.gravity })
  laneKit = buildAlley(scene, shadowGen, alley.colors, { reflections: settings.settings.reflections !== false })
  environs = buildEnvirons(scene, alley)

  makeBall()
  rackPins()

  // the target line: a subtle DASHED guide from the bowler down the lane —
  // clearly an aiming aid, not a laser through the alley
  {
    const dashes = []
    for (let i = 0; i < 9; i++) {
      const d = MeshBuilder.CreateBox('gd', { width: 0.05, height: 0.012, depth: 0.3 }, scene)
      d.position.set(0, 0.02, START_Z - 1.4 - i * 0.95)
      dashes.push(d)
    }
    guide = Mesh.MergeMeshes(dashes, true, true)
    const gm = new StandardMaterial('guideMat', scene)
    gm.emissiveColor = Color3.FromHexString(alley.colors.arrow).scale(0.7)
    gm.disableLighting = true
    gm.alpha = 0.32
    guide.material = gm
    guide.isPickable = false
    glowLayer?.addExcludedMesh(guide) // an aim guide, not a laser — never bloom it
  }

  // the power cue behind the ball while winding up
  aimArrow = MeshBuilder.CreateBox('aim', { width: 0.14, height: 0.04, depth: 1 }, scene)
  const am = new StandardMaterial('aimMat', scene)
  am.emissiveColor = Color3.FromHexString(alley.colors.arrow)
  am.disableLighting = true
  aimArrow.material = am
  aimArrow.isVisible = false

  if (alley.fx === 'discoball') disco = makeDiscoBall(scene, 0, 4.6, -3)
  if (alley.fx === 'ufo') ufo = makeUfo(scene)

  gestures = new Gestures(canvasEl.value, {
    onDragStart: () => { if (state.value === 'rolling') ffHold = true },
    onDrag: (g) => onAim(g),
    onDragEnd: (g) => { ffHold = false; onRelease(g) },
  })
  stage.run((dt) => tick(dt))
  booting.value = false

  if (import.meta.env.DEV) {
    window.__scene = scene
    window.__bwl = () => ({
      backend: stage.backend,
      state: state.value,
      rolls: [...rolls.value],
      standing: pins.filter((p) => p.isStanding()).length,
      ball: { x: ball.position.x, y: ball.position.y, z: ball.position.z },
      total: runningTotal.value,
      gameOver: gameOver.value,
      alley: alley.id,
      ballId: activeBallId.value,
      aimX,
      lastLaunch,
      selectBall,
      // deterministic throw for headless verification
      devThrow: (speed, x, spin) => {
        if (state.value !== 'aiming') return
        placeBallForThrow(x ?? 0)
        launch(speed ?? 13, spin ?? 0)
      },
    })
  }
}

function hexToRgba(hex) {
  const c = Color3.FromHexString(hex)
  return [c.r, c.g, c.b, 1]
}

function makeBall() {
  ball = MeshBuilder.CreateSphere('ball', { diameter: BALL_R * 2, segments: 48 }, scene)
  applyBallLook()
  shadowGen.addShadowCaster(ball)
  ball.position.set(0, BALL_R, START_Z)
  ballAgg = makeDynamic(ball, { mass: activeBall.value.mods.mass, restitution: 0.2, friction: 0.35, linearDamping: 0.06, angularDamping: 0.4 })
  parkBall()
  refreshMirror()
}
function applyBallLook() {
  ball.material?.dispose()
  ballGlowMat?.dispose()
  const b = activeBall.value
  if (b.glow) {
    const m = new StandardMaterial('ballMat', scene)
    m.diffuseColor = Color3.FromHexString(b.color)
    m.emissiveColor = Color3.FromHexString(b.glow).scale(0.55)
    m.specularColor = new Color3(0.9, 0.9, 0.9)
    ball.material = m
    ballGlowMat = m
  } else {
    ball.material = pbr(scene, { color: b.color, rough: 0.25, name: 'ballMat' })
  }
}
function parkBall() {
  ballAgg.body.setLinearVelocity(Vector3.Zero())
  ballAgg.body.setAngularVelocity(Vector3.Zero())
  ball.position.set(aimX, BALL_R, START_Z) // stay where the bowler stood
  ballAgg.body.disablePreStep = false
  scene.onAfterRenderObservable.addOnce(() => { ballAgg.body.disablePreStep = true })
}
function placeBallForThrow(x) {
  aimX = Math.max(-1.35, Math.min(1.35, x))
  ballAgg.body.setLinearVelocity(Vector3.Zero())
  ballAgg.body.setAngularVelocity(Vector3.Zero())
  ball.position.set(aimX, BALL_R, START_Z)
  ballAgg.body.disablePreStep = false
  scene.onAfterRenderObservable.addOnce(() => { ballAgg.body.disablePreStep = true })
}

function rackPins() {
  for (const p of pins) p.dispose()
  pins = pinSpots().map((s) => makePin(scene, shadowGen, s.x, s.z, alley.colors))
  refreshMirror()
}
// keep the lane's mirror reflecting the things that matter (and only those)
function refreshMirror() {
  if (!laneKit?.mirror) return
  laneKit.mirror.renderList = [
    ...pins.map((p) => p.body),
    ...(ball ? [ball] : []),
    ...laneKit.edges.map((e) => e.mesh),
    laneKit.sweep,
  ]
}
// keep the standing pins where they are, clear the deadwood (with a shrink-out)
function clearDeadwood() {
  const keep = []
  for (const p of pins) {
    if (p.isStanding()) keep.push(p)
    else {
      p.freeze() // collider off immediately; the mesh fades out
      fading.push({ p, t: 18 })
    }
  }
  pins = keep
}

function selectBall(id) {
  activeBallId.value = id
  settings.updateSetting('selectedBall', id)
  applyBallLook()
  ballAgg.body.setMassProperties({ mass: ballById(id).mods.mass })
  showRack.value = false
  haptics.light()
}

// ---- the swing (Switch-bowling style) ----
// A sideways drag walks the bowler along the approach (aim — you can line up
// anything from the pocket to the gutter). A downward drag starts the swing:
// the ball visibly winds back and up behind you; snapping the drag forward and
// RELEASING WHILE MOVING throws it. Power = backswing depth × release snap
// speed; drifting the forward stroke sideways puts hook on the ball. A limp
// release dribbles the ball down the lane. Timing is the skill.
function onAim(g) {
  if (state.value !== 'aiming') return
  if (!gestureMode && g.dist > 12) {
    gestureMode = Math.abs(g.dx) > Math.abs(g.dy) ? 'aim' : g.dy > 0 ? 'swing' : null
    if (gestureMode === 'aim') gestureMode = { kind: 'aim', fromX: aimX }
    else if (gestureMode === 'swing') gestureMode = { kind: 'swing' }
  }
  if (!gestureMode) return

  if (gestureMode.kind === 'aim') {
    aimX = Math.max(-1.35, Math.min(1.35, gestureMode.fromX + g.dx / 130))
    ball.position.set(aimX, BALL_R, START_Z)
    syncBallBody()
    return
  }

  // swing: sample the stroke and animate the ball back along the pendulum
  swingSamples.push({ t: performance.now(), dx: g.dx, dy: g.dy })
  if (swingSamples.length > 40) swingSamples.shift()
  if (g.dy >= maxBackswing) { maxBackswing = g.dy; bottomDx = g.dx; bottomT = performance.now() }
  // pendulum: the ball lifts visibly into frame as you wind up
  const p = Math.max(0, Math.min(1.15, g.dy / 230))
  ball.position.set(aimX + g.dx / 600, BALL_R + p * 1.6, START_Z + p * 0.4)
  syncBallBody()
  // power cue
  const pw = Math.min(maxBackswing / 230, 1)
  aimArrow.isVisible = pw > 0.05
  aimArrow.scaling.z = 1 + pw * 3
  aimArrow.rotation.y = 0
  aimArrow.position.set(aimX, 0.05, START_Z - 1 - pw * 1.5)
  aimArrow.material.emissiveColor = pw < 0.5 ? Color3.FromHexString(alley.colors.arrow) : pw < 0.85 ? new Color3(1, 0.7, 0.1) : new Color3(1, 0.32, 0.32)
}
function syncBallBody() {
  ballAgg.body.setLinearVelocity(Vector3.Zero())
  ballAgg.body.disablePreStep = false
}
function onRelease(g) {
  aimArrow.isVisible = false
  const mode = gestureMode
  gestureMode = null
  if (state.value !== 'aiming' || !mode) return
  if (mode.kind === 'aim') {
    scene.onAfterRenderObservable.addOnce(() => { ballAgg.body.disablePreStep = true })
    return
  }

  // release: the forward stroke is measured from the deepest point of the
  // backswing to the release — average speed over the whole snap, so it's
  // immune to pointer-event coalescing on janky frames
  const now = performance.now()
  const forwardTravel = maxBackswing - g.dy // px swung back toward the pins
  const strokeDt = Math.max(0.03, (now - bottomT) / 1000)
  const upSpeed = forwardTravel / strokeDt
  const backswing = Math.min(maxBackswing / 230, 1)
  const swungForward = forwardTravel > maxBackswing * 0.45
  swingSamples = []
  const hadWindup = maxBackswing > 30
  maxBackswing = 0

  if (!hadWindup) { resetSwingBall(); return } // never wound up — not a throw
  if (import.meta.env.DEV) window.__swingDebug = { forwardTravel, strokeDt, upSpeed, backswing, swungForward, endDy: g.dy }
  const mods = activeBall.value.mods
  if (!swungForward) { resetSwingBall(); return } // let go mid-backswing = cancel, not a throw
  if (upSpeed < 260) {
    // limp release: the ball plops out of your hand and trickles
    launch(3.2 * mods.power, 0, 0)
    setQuip('…a gentle lay-up. The pins are unbothered.')
    haptics.light()
    return
  }
  const powerSens = settings.settings.powerSens || 1
  const hookSens = settings.settings.hookSens || 1
  const snap = Math.min(upSpeed / 2400, 1)
  const power = snap * (0.45 + 0.55 * backswing)
  const spin = Math.max(-1.2, Math.min(1.2, ((g.dx - bottomDx) / 130) * hookSens)) * mods.hook
  launch((4.5 + 11.5 * power) * mods.power * powerSens, spin, spin * 0.7)
  haptics.medium()
}
function resetSwingBall() {
  ball.position.set(aimX, BALL_R, START_Z)
  syncBallBody()
  scene.onAfterRenderObservable.addOnce(() => { ballAgg.body.disablePreStep = true })
}
function launch(speed, spin, vx0 = 0) {
  traceMesh?.dispose()
  traceMesh = null
  tracePts = []
  spin = Math.max(-1.6, Math.min(1.6, spin))
  lastLaunch = { speed, spin }
  thrown = true
  throwTick = tickN
  gutterBall = false
  gutterQuipped = false
  state.value = 'rolling'
  ball.position.set(Math.max(-1.35, Math.min(1.35, ball.position.x)), BALL_R, START_Z)
  ballAgg.body.disablePreStep = false
  scene.onAfterRenderObservable.addOnce(() => {
    ballAgg.body.setLinearVelocity(new Vector3(vx0, 0, -speed))
    ballAgg.body.setAngularVelocity(new Vector3(-speed / BALL_R, 0, 0))
    ballAgg.body.disablePreStep = true
  })
  ball.__spin = spin
}

// ---- per-frame ----
function tick(dt = 1 / 60) {
  dt = Math.min(Math.max(dt || 1 / 60, 0.001), 0.05)
  tickN++
  if (quip.value && tickN > quipUntil) quip.value = null
  if (banner.value && tickN > bannerUntil) banner.value = null

  // neon edge color cycling + alley fx
  // the room's mood drifts as the round progresses (each frame shifts the base
  // hue), and the tenth frame goes clutch: dimmer neon, hotter deck spotlight
  const clutch = curFrame.value === 9 && !gameOver.value && rolls.value.length > 0
  const hue = (curFrame.value * 36 + tickN * (strikeFlash > 0 ? 4.5 : 1.2)) % 360
  if (strikeFlash > 0) strikeFlash--
  if (neonL) {
    const base = clutch ? 0.32 : 0.55
    const boost = strikeFlash > 0 ? (strikeFlash / 90) * 1.9 : 0
    neonL.intensity += (base + boost - neonL.intensity) * 0.05
    neonR.intensity = neonL.intensity
    neonL.diffuse = Color3.FromHSV(hue, 0.7, 1)
    neonR.diffuse = Color3.FromHSV((hue + 140) % 360, 0.7, 1)
  }
  if (deckSpot) deckSpot.intensity += ((clutch ? 2.3 : 1.5) - deckSpot.intensity) * 0.04
  if (ipcRef) ipcRef.vignetteWeight += ((clutch ? 2.2 : 1.5) - ipcRef.vignetteWeight) * 0.04
  if (laneKit) {
    laneKit.edges[0].mat.emissiveColor = Color3.FromHSV(hue, 0.85, 0.85)
    laneKit.edges[1].mat.emissiveColor = Color3.FromHSV((hue + 140) % 360, 0.85, 0.85)
    if (laneKit.gutterMat) {
      const pulse = 0.5 + Math.sin(tickN * 0.05) * 0.3
      laneKit.gutterMat.emissiveColor = Color3.FromHexString(alley.colors.gutterGlow).scale(pulse)
    }
  }
  if (guide) {
    guide.isVisible = state.value === 'aiming'
    guide.position.x = aimX
  }
  // the pinsetter sweep drops while the deck is being serviced, lifts to reveal
  // the fresh rack
  if (laneKit?.sweep) {
    const target = state.value === 'sweep' || fading.length ? laneKit.sweepDownY : laneKit.sweepUpY
    laneKit.sweep.position.y += (target - laneKit.sweep.position.y) * (settings.settings.snappySweep ? 0.16 : 0.09)
  }
  disco?.update(tickN)
  ufo?.update()
  environs?.update(tickN)
  // hold-to-fast-forward: double the physics clock while the finger is down
  const pe = scene?.getPhysicsEngine?.()
  if (pe) pe.setTimeStep(ffHold && state.value === 'rolling' ? 1 / 30 : 1 / 60)
  for (let i = confetti.length - 1; i >= 0; i--) {
    confetti[i].update(dt)
    if (confetti[i].done) confetti.splice(i, 1)
  }
  for (let i = fading.length - 1; i >= 0; i--) {
    const f = fading[i]
    f.t--
    f.p.body.scaling.setAll(Math.max(0.01, f.t / 18))
    if (f.t <= 0) { f.p.dispose(); fading.splice(i, 1) }
  }

  if (state.value === 'rolling' && thrown) {
    if (settings.settings.showTrace !== false && tickN % 3 === 0 && tracePts.length < 220 && ball.position.y > -0.3) {
      tracePts.push(ball.position.clone().add(new Vector3(0, 0.02 - BALL_R + 0.03, 0)))
    }
    const v = ballAgg.body.getLinearVelocity()
    // hook: side-spin bends the ball harder as it travels down the oiled lane
    const onLane = ball.position.z > PIN_Z + 0.5 && Math.abs(ball.position.x) < LANE_W / 2 && !gutterBall
    if (onLane && ball.__spin) {
      const progress = Math.min(1, (START_Z - ball.position.z) / 14)
      const a = ball.__spin * 4.6 * progress
      ballAgg.body.applyImpulse(new Vector3(a * activeBall.value.mods.mass * dt, 0, 0), ball.getAbsolutePosition())
    }
    // gutter
    if (!gutterBall && Math.abs(ball.position.x) > LANE_W / 2 + 0.05 && ball.position.z > PIN_Z + 0.9) {
      gutterBall = true
      if (!gutterQuipped) {
        gutterQuipped = true
        setBanner('GUTTER.', 'bad')
        setQuip(pick(alley.lines.gutter))
      }
    }
    // follow cam
    cam.target.z += (Math.max(ball.position.z * 0.55, -4.2) + 1.6 - cam.target.z) * 0.05
    cam.radius += (6.4 - cam.radius) * 0.03

    const speed = Math.hypot(v.x, v.y, v.z)
    const done = ball.position.z < PIT_Z || ball.position.y < -0.35 || (speed < 0.35 && tickN - throwTick > 40) || tickN - throwTick > 420
    if (done) {
      thrown = false
      state.value = 'sweep'
      sweepAt = tickN + 95 // pins finish falling while the sweep bar drops
    }
  } else if (state.value === 'sweep') {
    cam.target.z += (-3.5 - cam.target.z) * 0.04 // linger on the pin deck
    // count only when every pin has stopped wobbling — a pin that falls late
    // must fall BEFORE the count, not after (hard timeout keeps it moving)
    if (tickN >= sweepAt && (!pins.some((p) => p.isMoving()) || tickN >= sweepAt + (settings.settings.snappySweep ? 100 : 180))) settleThrow()
  } else {
    // ease camera home
    cam.target.z += (2.4 - cam.target.z) * 0.06
    cam.radius += (7.6 - cam.radius) * 0.04
    // late fallers: a pin counted standing that topples while you aim gets
    // swept as deadwood and credited to the throw that felled it
    if (state.value === 'aiming' && !gameOver.value && tickN % 10 === 0) {
      const fallen = pins.filter((p) => !p.isStanding())
      if (fallen.length) {
        for (const p of fallen) {
          p.freeze()
          fading.push({ p, t: 18 })
        }
        pins = pins.filter((p) => p.isStanding())
        const pos = rollPosition(rolls.value)
        if (pos && pos.throw > 0) {
          const r = [...rolls.value]
          r[r.length - 1] += fallen.length
          rolls.value = r
          const next = rollPosition(rolls.value)
          if (!next) return endGame()
          if (next.standing === 10) rackPins() // the credit completed the rack
        }
      }
    }
  }
}

function settleThrow() {
  // draw the path the ball just took, so you can read your own hook
  if (settings.settings.showTrace !== false && tracePts.length > 1) {
    traceMesh = MeshBuilder.CreateLines('trace', { points: tracePts }, scene)
    traceMesh.color = Color3.FromHexString(alley.colors.arrow)
    traceMesh.alpha = 0.5
    traceMesh.isPickable = false
  }
  const standingNow = pins.filter((p) => p.isStanding()).length
  const pos = rollPosition(rolls.value)
  // measured against the rack the scorecard expects, so a pin that toppled
  // between throws can never come back as a phantom
  const knocked = Math.max(0, Math.min(pos.standing, pos.standing - standingNow))
  rolls.value = [...rolls.value, knocked]

  // celebrate — a 10 off a fresh rack is a strike even on the tenth's bonus balls
  const isStrike = knocked === 10 && pos.standing === 10
  const isSpare = !isStrike && pos.throw > 0 && knocked === pos.standing && knocked > 0
  if (isStrike) {
    strikesThisGame++
    setBanner('STRIKE!', 'good')
    setQuip(pick(alley.lines.strike))
    celebrate()
    haptics.success()
  } else if (isSpare) {
    setBanner('SPARE!', 'good')
    setQuip(pick(alley.lines.spare))
    celebrate()
    haptics.success()
  } else if (knocked === 0 && !gutterBall) {
    setQuip(pick(alley.lines.open))
  } else if (pos.throw === 0 && knocked > 0 && knocked < 10 && isSplit()) {
    setQuip(pick(alley.lines.split))
  }
  if (knocked > 0 && !isStrike && !isSpare) haptics.crash(knocked / 10) // pin-crash buzz

  const next = rollPosition(rolls.value)
  if (!next) return endGame()

  // fresh rack when the next throw starts a new frame (or a tenth-frame re-rack)
  if (next.standing === 10) rackPins()
  else clearDeadwood()
  parkBall()
  state.value = 'aiming'
}

// a split-ish read: head pin down, survivors far apart
function isSplit() {
  const up = pins.filter((p) => p.isStanding())
  if (up.length < 2) return false
  const head = pins.find((p) => Math.abs(p.home.x) < 0.01 && Math.abs(p.home.z - PIN_Z) < 0.01)
  if (head && head.isStanding()) return false
  let maxGap = 0
  for (const a of up) for (const b of up) maxGap = Math.max(maxGap, Math.abs(a.home.x - b.home.x))
  return maxGap > 1.1
}

function celebrate() {
  strikeFlash = 90
  disco?.flash()
  ufo?.buzz()
  const palette = [alley.colors.laneEdgeA, alley.colors.laneEdgeB, '#ffffff', alley.colors.pinStripe]
  confetti.push(burstConfetti(scene, 0, 2.2, PIN_Z - 0.4, palette))
}

function endGame() {
  const total = score.value.total ?? 0
  finalTotal.value = total
  finalLabel.value = total === 300 ? 'PERFECT GAME!' : total >= 200 ? 'On Fire!' : total >= 150 ? 'Great Game' : total >= 100 ? 'Solid Game' : 'Game Over'
  const rec = progress.recordGame(total, strikesThisGame)
  statLine.value = rec.newBest ? `🏆 New best game: ${total}` : null
  gameOver.value = true
  state.value = 'over'
  haptics.success()
}

function newGame() {
  rolls.value = []
  strikesThisGame = 0
  gameOver.value = false
  statLine.value = null
  rackPins()
  parkBall()
  state.value = 'aiming'
  haptics.light()
}

function setQuip(t) { quip.value = t; quipUntil = tickN + 200 }
function setBanner(t, kind) { banner.value = t; bannerKind.value = kind; bannerUntil = tickN + 110 }
function goBack() { router.push({ name: 'menu' }) }
</script>

<style scoped>
.bowl { position: relative; width: 100%; height: 100vh; overflow: hidden; }
.stage-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; outline: none; touch-action: none; }
.hud-top { position: absolute; top: max(12px, env(safe-area-inset-top)); left: 8px; right: 8px; display: flex; align-items: center; gap: 8px; z-index: 3; }
.chips { flex: 1; display: flex; justify-content: center; gap: 6px; }
.chip { display: flex; flex-direction: column; align-items: center; min-width: 52px; padding: 3px 8px; border-radius: 10px; background: rgba(0,0,0,0.38); color: #fff; backdrop-filter: blur(6px); }
.chip span { font-size: 0.52rem; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.75; }
.chip b { font-size: 0.95rem; line-height: 1.1; }
.chip.mode { font-size: 0.55rem; font-weight: 700; padding: 6px 7px; }
.marks { position: absolute; top: calc(max(12px, env(safe-area-inset-top)) + 52px); left: 50%; transform: translateX(-50%); display: flex; gap: 2px; z-index: 3; }
.mark-cell { display: flex; flex-direction: column; align-items: center; min-width: 26px; padding: 2px 3px; border-radius: 6px; background: rgba(0,0,0,0.3); color: #fff; }
.mark-cell.cur { outline: 1px solid rgba(255,255,255,0.55); }
.m-rolls { font-size: 0.6rem; font-weight: 700; min-height: 0.8rem; }
.m-cum { font-size: 0.55rem; opacity: 0.75; min-height: 0.7rem; }
.banner { position: absolute; top: 34%; left: 0; right: 0; text-align: center; font-size: 3rem; font-weight: 900; letter-spacing: 0.06em; z-index: 3; pointer-events: none; text-shadow: 0 4px 18px rgba(0,0,0,0.6); }
.banner.good { color: #7dffb0; }
.banner.bad { color: #ff8f7d; }
.quip { position: absolute; top: 26%; left: 50%; transform: translateX(-50%); max-width: 86%; text-align: center; background: rgba(0,0,0,0.45); color: #fff; padding: 5px 14px; border-radius: 999px; font-size: 0.85rem; z-index: 3; }
.hud-hint { position: absolute; bottom: max(24px, env(safe-area-inset-bottom)); left: 0; right: 0; text-align: center; color: #fff; font-size: 0.85rem; z-index: 2; text-shadow: 0 2px 8px rgba(0,0,0,0.5); pointer-events: none; }
.bag-btn { position: absolute; right: 10px; bottom: max(16px, env(safe-area-inset-bottom)); z-index: 3; display: flex; align-items: center; gap: 7px; padding: 8px 13px 8px 10px; border: 1px solid rgba(255,255,255,0.22); border-radius: 999px; background: rgba(0,0,0,0.4); color: #fff; backdrop-filter: blur(6px); cursor: pointer; }
.bag-btn:active { transform: scale(0.96); }
.bag-emoji { font-size: 1.25rem; line-height: 1; }
.bag-label { font-size: 0.78rem; font-weight: 600; }
.bag-overlay { position: absolute; inset: 0; z-index: 6; background: rgba(0,0,0,0.5); backdrop-filter: blur(3px); display: flex; align-items: flex-end; }
.bag-sheet { width: 100%; background: #1c2530; border-radius: 18px 18px 0 0; padding: 12px 14px max(18px, env(safe-area-inset-bottom)); color: #fff; box-shadow: 0 -8px 30px rgba(0,0,0,0.4); }
.bag-head { display: flex; align-items: center; justify-content: space-between; font-size: 1.05rem; font-weight: 700; margin-bottom: 8px; padding-left: 4px; }
.bag-list { display: flex; flex-direction: column; gap: 8px; max-height: 52vh; overflow-y: auto; }
.ball-card { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; padding: 11px 12px; border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; background: rgba(255,255,255,0.05); color: #fff; cursor: pointer; }
.ball-card.active { border-color: #4caf50; background: rgba(76,175,80,0.16); }
.ball-card:active { transform: scale(0.99); }
.p-emoji { font-size: 1.7rem; line-height: 1; flex-shrink: 0; }
.p-text { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.p-name { font-weight: 700; font-size: 0.95rem; }
.p-blurb { font-size: 0.75rem; opacity: 0.72; line-height: 1.25; }
.p-check { color: #6ee07a; font-weight: 800; font-size: 1.1rem; }
.overlay { position: absolute; inset: 0; z-index: 4; background: rgba(0,0,0,0.6); backdrop-filter: blur(3px); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; color: #fff; padding: 16px; }
.o-title { font-size: 2rem; font-weight: 800; }
.o-sub.big { font-size: 2.4rem; font-weight: 900; margin-top: -8px; }
.o-unlock { background: rgba(76,175,80,0.22); border: 1px solid rgba(110,224,122,0.5); border-radius: 999px; padding: 6px 16px; font-size: 0.85rem; font-weight: 600; }
.scorecard { max-width: 96vw; overflow-x: auto; }
.sc-grid { display: flex; gap: 3px; }
.sc-frame { display: flex; flex-direction: column; align-items: center; min-width: 32px; padding: 4px 3px; border-radius: 6px; background: rgba(255,255,255,0.08); }
.sc-marks { font-size: 0.72rem; font-weight: 700; min-height: 1rem; }
.sc-cum { font-size: 0.68rem; opacity: 0.8; min-height: 0.9rem; }
.row-btns { display: flex; gap: 10px; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.boot { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #fff; z-index: 5; }
</style>
