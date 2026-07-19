<template>
  <q-page class="ripples-page" :style="pageStyle">
    <canvas ref="gameCanvas" class="game-canvas"></canvas>

    <!-- Game Header -->
    <div class="game-header">
      <q-btn fab-mini flat icon="arrow_back" color="white" @click="goBack" />

      <div class="level-badge">
        <div class="text-caption text-white text-center q-mb-xs">
          Pond {{ pondNumber }} · Level {{ currentLevel }}
        </div>
        <div class="level-stats">
          <div class="stat-item">
            <q-icon name="lens" color="blue-grey-3" size="14px" />
            <span class="text-body2 text-white text-weight-bold">{{ stonesRemaining }}</span>
          </div>
          <div class="stat-item">
            <q-icon name="stars" color="amber" size="16px" />
            <span class="text-body2 text-white text-weight-bold">{{ totalScore }}</span>
          </div>
        </div>
      </div>

      <div class="header-menu">
        <q-btn
          fab-mini
          flat
          icon="more_vert"
          color="white"
          @click="toggleMenu"
          :class="['menu-button', { 'menu-button-active': showMenu }]"
        />

        <transition-group name="menu-fade" tag="div" class="menu-buttons-container">
          <q-btn
            v-if="showMenu"
            key="levels"
            fab-mini
            flat
            icon="grid_view"
            color="white"
            class="menu-item menu-item-1"
            @click="openLevels"
          />
          <q-btn
            v-if="showMenu"
            key="refresh"
            fab-mini
            flat
            icon="refresh"
            color="white"
            class="menu-item menu-item-2"
            @click="restartLevel"
          />
          <q-btn
            v-if="showMenu"
            key="help"
            fab-mini
            flat
            icon="help_outline"
            color="white"
            class="menu-item menu-item-3"
            @click="openInstructions"
          />
        </transition-group>
      </div>
    </div>

    <div class="backend-chip" v-if="backend">{{ backend }}</div>

    <!-- Throw Hint -->
    <div v-if="!gameStarted && showTapHint && !booting" class="tap-hint">
      <q-icon name="swipe_vertical" color="white" size="lg" />
      <div class="text-white text-subtitle1 q-mt-sm text-center">
        Slide to aim · drag down, snap forward to skip<br />follow through high to lob
      </div>
    </div>

    <!-- Boot overlay: dressed in the pond's own time-of-day palette -->
    <div v-if="booting" class="boot">
      <div class="boot-lotus">🪷</div>
      <div class="boot-ring" />
      <div class="boot-text">Stilling the water…</div>
    </div>

    <!-- Level Select Dialog -->
    <q-dialog v-model="showLevelSelect">
      <q-card class="levels-card">
        <q-card-section>
          <div class="text-h6 q-mb-md text-white">Choose a Pond</div>
          <div class="ponds-list">
            <div v-for="p in pondRows" :key="p.n" class="pond-row">
              <div class="pond-row-label">Pond {{ p.n }}</div>
              <div class="pond-row-chips">
                <q-btn
                  v-for="n in p.levels"
                  :key="n"
                  dense
                  unelevated
                  :label="n <= maxUnlocked ? String(n) : undefined"
                  :icon="n > maxUnlocked ? 'lock' : undefined"
                  :disable="n > maxUnlocked"
                  :class="['level-chip', { 'level-chip-current': n === currentLevel }]"
                  @click="pickLevel(n)"
                />
              </div>
            </div>
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat color="white" label="Close" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Instructions Dialog -->
    <q-dialog v-model="showInstructions">
      <q-card class="instructions-card">
        <q-card-section>
          <div class="text-h6 q-mb-md text-white">How to Play</div>
          <div class="text-body2 text-white">
            <p>• Skip stones across the pond to wake the lotus flowers</p>
            <p>• <b>Slide sideways</b> to aim your line</p>
            <p>• <b>Drag down</b> to wind up, <b>snap forward</b> to throw</p>
            <p>• A short flick skims flat; <b>follow through past where you started</b> to loft the stone — a high lob won't skip, but it plunges exactly where you place it</p>
            <p>• Every skip sends out a ripple — harder skips, bigger ripples</p>
            <p>• A sideways snap bends the stone's flight</p>
            <p>• Stones reflect ripples; drifting lily pads swallow stone and wave alike — though a landed stone still thumps out a muffled wave</p>
            <p>• The calm circle around a flower hushes any skip inside it</p>
            <p>• Wake every flower before you run out of stones</p>
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat color="white" label="Close" @click="showInstructions = false" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Level Complete Dialog -->
    <q-dialog v-model="showWinDialog" persistent>
      <q-card class="win-card">
        <q-card-section class="text-center">
          <div class="text-h4 text-white q-mb-md">Level Complete!</div>

          <div class="stars-container q-mb-md">
            <q-icon
              v-for="star in 3"
              :key="star"
              :name="star <= starsEarned ? 'star' : 'star_outline'"
              :color="star <= starsEarned ? 'amber' : 'grey-5'"
              size="3rem"
            />
          </div>

          <div class="text-h5 text-white q-mb-sm">+{{ levelScore }} points</div>

          <div class="stats-grid q-mt-md">
            <div class="stat-item">
              <div class="text-caption text-grey-4">Stones Used</div>
              <div class="text-h6 text-white">{{ stonesUsed }}</div>
            </div>
            <div class="stat-item">
              <div class="text-caption text-grey-4">Optimal</div>
              <div class="text-h6 text-white">{{ level?.optimalStones }}</div>
            </div>
            <div class="stat-item">
              <div class="text-caption text-grey-4">Total Score</div>
              <div class="text-h6 text-white">{{ totalScore }}</div>
            </div>
          </div>
        </q-card-section>
        <q-card-actions align="center">
          <q-btn unelevated color="primary" label="Next Level" @click="nextLevel" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Level Failed Dialog -->
    <q-dialog v-model="showLoseDialog" persistent>
      <q-card class="lose-card">
        <q-card-section class="text-center">
          <div class="text-h5 text-white q-mb-md">Try Again</div>
          <div class="text-body1 text-white q-mb-sm">
            Awakened: {{ activatedCount }}/{{ totalLotus }}
          </div>
          <div v-if="failureStreak >= 5" class="text-caption text-red-3 q-mt-sm">
            Failure streak: {{ failureStreak }}
            <div class="text-caption">(-1 point every 5 failures)</div>
          </div>
        </q-card-section>
        <q-card-actions align="center">
          <q-btn unelevated color="primary" label="Retry" @click="retryLevel" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
// Ripples, the stone-skipping pond. Bowling's control language on water:
// slide to line up, drag down to wind up, snap forward to send the stone
// skimming. Each skip is a contact event from the pure flight model
// (src/game/skip.js) that the pond answers with a ripple; the wave model
// (src/game/waves.js) carries those ripples to the lotus flowers. Babylon
// renders the living pond; Havok drives the drifting pads.
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  Stage,
  initPhysics,
  outdoorLight,
  Gestures,
  Vector3,
  Color3,
  ArcRotateCamera,
  GlowLayer,
  FxaaPostProcess,
} from 'src/engine'
import { stepRipples, collideRipples, updateLotus, skipRipple } from 'src/game/waves'
import { throwStone, stepStone, groundStone, stoneHitsRock } from 'src/game/skip'
import { generateLevel } from 'src/game/levels'
import { buildPond, paletteFor } from 'src/game/pond3d'
import { buildStones, buildLotuses, buildDriftingPads, buildSkipper } from 'src/game/actors3d'
import { sfx } from 'src/game/sfx'
import { useThemeStore } from 'src/stores/theme'
import { useProgressStore } from 'src/stores/progress'
import { useSettingsStore } from 'src/stores/settings'
import { useHaptics } from 'src/composables/useHaptics'

const router = useRouter()
const themeStore = useThemeStore()
const progressStore = useProgressStore()
const settingsStore = useSettingsStore()
const haptics = useHaptics()

const gameCanvas = ref(null)

function devParam(k) {
  if (!import.meta.env.DEV) return null
  return new URLSearchParams(location.hash.split('?')[1] || '').get(k)
}

// UI state
const booting = ref(true)
const backend = ref('')
const currentLevel = ref(Number(devParam('lv')) || progressStore.ripples.currentLevel)
const stonesRemaining = ref(3)
const stonesUsed = ref(0)
const gameStarted = ref(false)
const showTapHint = ref(true)
const totalScore = computed(() => progressStore.ripples.totalScore)
const levelScore = ref(0)
const starsEarned = ref(0)
const failureStreak = ref(0)
const showInstructions = ref(false)
const showWinDialog = ref(false)
const showLoseDialog = ref(false)
const showMenu = ref(false)
const showLevelSelect = ref(false)

// the pond's palette leaks into the chrome: loading screen, dialogs and
// level picker all wear the current time-of-day colors as CSS variables
const palUi = ref(paletteFor(themeStore.period.key))
const pageStyle = computed(() => ({
  background: themeStore.colors.gradient,
  '--pond-top': palUi.value.skyTop,
  '--pond-horizon': palUi.value.skyHorizon,
  '--pond-water': palUi.value.water,
  '--pond-deep': palUi.value.deep,
  '--pond-ring': palUi.value.ring,
}))
// Quasar teleports dialogs to <body>, outside the page element — so the
// palette vars must also live on the document root for them to be themed
watch(
  palUi,
  (p) => {
    const root = document.documentElement.style
    root.setProperty('--pond-top', p.skyTop)
    root.setProperty('--pond-horizon', p.skyHorizon)
    root.setProperty('--pond-water', p.water)
    root.setProperty('--pond-deep', p.deep)
    root.setProperty('--pond-ring', p.ring)
  },
  { immediate: true },
)

const maxUnlocked = computed(() => Math.max(progressStore.ripples.currentLevel, currentLevel.value))
const levelChoices = computed(() => maxUnlocked.value + 4) // a peek past the frontier
const pondNumber = computed(() => Math.floor((currentLevel.value - 1) / 3) + 1)
// the picker groups levels three to a pond, matching the world structure
const pondRows = computed(() => {
  const rows = []
  for (let start = 1; start <= levelChoices.value; start += 3) {
    rows.push({
      n: Math.floor((start - 1) / 3) + 1,
      levels: [start, start + 1, start + 2].filter((l) => l <= levelChoices.value),
    })
  }
  return rows
})

// scene state
let stage = null
let scene = null
let cam = null
let shadow = null
let glow = null
let gestures = null
let pond = null
let stones3d = null
let lotuses = null
let pads = null
let skipper = null
let level = null
let pal = null
let thrower = { x: 0, z: 0 }
let ripples = []
let flyingStone = null
let t = 0

// swing state (the bowling pattern): slide = aim, drag down = wind up,
// snap forward = release
let gestureMode = null // null | 'aim' | 'swing'
let aimAngle = 0
let aimAtSwingStart = 0
let windupK = 0
let swingSamples = []

const activatedCount = computed(() => level?.lotus.filter((l) => l.isActivated).length ?? 0)
const totalLotus = computed(() => level?.lotus.length ?? 0)

watch(
  () => [settingsStore.settings.soundEffectsEnabled, settingsStore.settings.soundEffectsVolume],
  ([on, vol]) => sfx.configure({ on, vol }),
  { immediate: true },
)

onMounted(async () => {
  try {
    await boot()
  } catch (e) {
    console.error('[Ripples] boot failed:', e)
    booting.value = false
  }
})

onBeforeUnmount(() => {
  gestures?.dispose()
  disposeLevel()
  stage?.dispose()
})

async function boot() {
  pal = paletteFor(devParam('theme') || themeStore.period.key)
  palUi.value = pal
  const sharp = settingsStore.settings.sharpRender !== false
  stage = new Stage(gameCanvas.value, { clear: hexToRgba(pal.clear), webgpu: false, maxDpr: sharp ? 3 : 2 })
  await stage.init()
  backend.value = stage.backend.toUpperCase()
  scene = stage.scene
  scene.skipPointerMovePicking = true

  const rig = outdoorLight(scene, { intensity: pal.sunIntensity, shadowSize: sharp ? 2048 : 1024 })
  shadow = rig.shadow
  rig.sun.diffuse = Color3.FromHexString(pal.sun)
  rig.hemi.diffuse = Color3.FromHexString(pal.sun).scale(0.9)

  const ipc = scene.imageProcessingConfiguration
  ipc.contrast = 1.08
  ipc.exposure = pal.exposure ?? 1.05
  ipc.vignetteEnabled = true
  ipc.vignetteWeight = 1.1

  if (settingsStore.settings.glowFx !== false) {
    glow = new GlowLayer('glow', scene, { mainTextureRatio: sharp ? 0.75 : 0.5 })
    glow.intensity = 0.55
  }

  // the bowling view, on water: low behind the thrower on the near bank,
  // looking out across the pond into the haze
  cam = new ArcRotateCamera('cam', Math.PI / 2, 1.2, 13.2, new Vector3(0, 0.6, 2.6), scene)
  cam.fov = 0.92
  if (sharp) {
    const fxaa = new FxaaPostProcess('fxaa', 1.0, cam)
    fxaa.samples = 2
  }

  await initPhysics(scene, { gravity: 0 })

  buildLevel()

  gestures = new Gestures(gameCanvas.value, {
    onDragStart: () => {
      sfx.unlock()
      gestureMode = null
      windupK = 0
      swingSamples = []
      aimAtSwingStart = aimAngle
    },
    onDrag: (g) => onSwing(g),
    onDragEnd: (g) => onRelease(g),
  })

  stage.run((dt) => tick(dt))
  booting.value = false

  showTapHint.value = true
  setTimeout(() => (showTapHint.value = false), 3500)

  if (import.meta.env.DEV) {
    window.__ripples = () => ({
      level: currentLevel.value,
      stones: stonesRemaining.value,
      ripples: ripples.length,
      flying: !!flyingStone && !flyingStone.done,
      skips: flyingStone?.skips ?? 0,
      lotus: level.lotus.map((l) => ({ x: l.x, z: l.z, on: l.isActivated, sink: l.sinkProgress || 0 })),
      pads: pads.items.map((p) => {
        const q = p.mesh.rotationQuaternion
        // tilt = angle between the pad's up axis and world up
        const upY = q ? 1 - 2 * (q.x * q.x + q.z * q.z) : 1
        return { x: p.mesh.position.x, z: p.mesh.position.z, y: p.mesh.position.y, tiltDeg: +((Math.acos(Math.max(-1, Math.min(1, upY))) * 180) / Math.PI).toFixed(1) }
      }),
      backend: backend.value,
      aim: aimAngle,
      rocks: level.stones.map((s) => ({ x: s.x, z: s.z, r: s.radius })),
      won: showWinDialog.value,
      lost: showLoseDialog.value,
      throw: (power, angle, curve, loft) => doThrow(power ?? 0.8, angle ?? 0, curve ?? 0, loft ?? 0),
    })
  }
}

function buildLevel() {
  level = generateLevel(currentLevel.value)
  thrower = { x: 0, z: level.R - 0.8 }
  stonesRemaining.value = level.stonesAllowed
  stonesUsed.value = 0
  ripples = []
  flyingStone = null
  aimAngle = 0
  gameStarted.value = false

  pond = buildPond(scene, shadow, level, pal)
  // clouds and the waterfall are emissive (unlit) but must not bloom like
  // the sun does — the falls should read as water, not as a light source
  if (glow) for (const m of scene.meshes) if (m.name === 'cloud' || m.name.startsWith('falls')) glow.addExcludedMesh(m)
  if (level.waterfall) sfx.fallsStart()
  stones3d = buildStones(scene, shadow, level.stones)
  lotuses = buildLotuses(scene, shadow, level.lotus, pal)
  pads = buildDriftingPads(scene, shadow, level.pads, level.R)
  skipper = buildSkipper(scene, shadow, pal, thrower)
  glow?.addExcludedMesh(skipper.guideMesh) // an aim guide, not a laser
  skipper.rest(0, aimAngle)
  skipper.setAiming(true, 0)
}

function disposeLevel() {
  sfx.fallsStop()
  pond?.dispose()
  stones3d?.dispose()
  lotuses?.dispose()
  pads?.dispose()
  skipper?.dispose()
  pond = stones3d = lotuses = pads = skipper = null
}

function resetLevel() {
  disposeLevel()
  buildLevel()
}

// ---- the swing --------------------------------------------------------------

function canThrow() {
  return (
    !booting.value &&
    !showWinDialog.value &&
    !showLoseDialog.value &&
    !showInstructions.value &&
    !showLevelSelect.value &&
    stonesRemaining.value > 0 &&
    (!flyingStone || flyingStone.done)
  )
}

function onSwing(g) {
  if (!canThrow()) return
  if (!gestureMode) {
    if (Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy)) gestureMode = 'aim'
    else if (g.dy > 16) {
      gestureMode = 'swing'
      aimAtSwingStart = aimAngle
    }
  }
  if (gestureMode === 'aim') {
    // slide to sweep the line across the pond
    // screen-right is world -x in this view, so the finger's dx is negated:
    // slide right, aim right, stone goes right
    aimAngle = Math.max(-0.45, Math.min(0.45, aimAtSwingStart - g.ndx * 1.5))
    skipper.rest(0, aimAngle)
  } else if (gestureMode === 'swing') {
    windupK = Math.max(0, Math.min(1, g.dy / 240))
    skipper.windup(0, windupK)
    skipper.setAiming(true, windupK)
    swingSamples.push({ t: performance.now(), dx: g.dx, dy: g.dy })
    if (swingSamples.length > 60) swingSamples.shift()
  }
}

function onRelease() {
  const mode = gestureMode
  gestureMode = null
  if (import.meta.env.DEV) {
    window.__swingDebug = { mode, samples: swingSamples.length, canThrow: canThrow() }
  }
  if (mode !== 'swing' || !canThrow() || swingSamples.length < 2) {
    skipper?.rest(0, aimAngle)
    skipper?.setAiming(canThrow(), 0)
    windupK = 0
    return
  }

  // the bowling release: find the bottom of the backswing, then measure the
  // forward snap from there — backswing × snap speed = power
  let bottom = swingSamples[0]
  for (const s of swingSamples) if (s.dy >= bottom.dy) bottom = s
  const end = swingSamples[swingSamples.length - 1]
  const snapPx = bottom.dy - end.dy
  const snapMs = Math.max(1, end.t - bottom.t)
  const snapSpeed = snapPx / snapMs // px per ms, upward

  if (import.meta.env.DEV) {
    Object.assign(window.__swingDebug, { snapPx, snapMs, snapSpeed, bottomDy: bottom.dy, endDy: end.dy })
  }
  // the gate is DISTANCE (a real forward stroke), not speed — a slow device
  // or a deliberate finger still gets its throw. Speed adds power on top.
  if (snapPx < 40) {
    // no forward snap — the stone stays in hand
    skipper.rest(0, aimAngle)
    skipper.setAiming(true, 0)
    windupK = 0
    return
  }

  const backswing = Math.max(0, Math.min(1, bottom.dy / 260))
  const power = Math.max(
    0.15,
    Math.min(1, backswing * 0.5 + Math.min(1, snapPx / 300) * 0.3 + Math.min(1, snapSpeed / 1.5) * 0.35),
  )
  // lateral drift during the snap bends the flight
  const curve = Math.max(-3, Math.min(3, (-(end.dx - bottom.dx) / snapMs) * 4)) // snap right bends right
  // FOLLOW-THROUGH sets the vertical angle: a flick that stops near where
  // the drag began stays flat and skims; carrying the snap well PAST the
  // start point lofts the stone into a high lob that plunges where it lands
  const loft = Math.max(0, Math.min(1, -end.dy / 220))
  if (import.meta.env.DEV) Object.assign(window.__swingDebug, { loft })

  doThrow(power, aimAngle, curve, loft)
}

function doThrow(power, angle, curve, loft = 0) {
  if (!canThrow()) return
  flyingStone = throwStone(thrower.x, thrower.z - 3.0, { angle, power, curve, loft })
  flyingStone.group = `throw_${stonesUsed.value}`
  stonesRemaining.value--
  stonesUsed.value++
  gameStarted.value = true
  windupK = 0
  skipper.setAiming(false, 0)
  sfx.whoosh(power)
  haptics.medium()
}

// what the pond says about a stone touching down at (x, z)
function contactContext(x, z) {
  for (const L of level.lotus) {
    if (!L.isActivated && Math.hypot(x - L.x, z - L.z) < L.protectedRadius) return 'calm'
  }
  for (const it of pads.items) {
    const p = it.mesh.position
    if (Math.hypot(x - p.x, z - p.z) < it.data.radius * 0.9) return 'pad'
  }
  for (const s of level.stones) {
    if (Math.hypot(x - s.x, z - s.z) < s.radius + 0.15) return 'rock'
  }
  if (Math.hypot(x, z) > level.R - 0.35) return 'bank'
  return 'water'
}

function stepFlight(dt) {
  if (!flyingStone || flyingStone.done) return
  // substep for crisp contact detection at speed
  for (let i = 0; i < 2 && !flyingStone.done; i++) {
    const events = stepStone(flyingStone, dt / 2)
    for (const e of events) handleContact(e)
    if (flyingStone.done) break
    // rocks are solid at flight height too — no sailing through one
    const rock = stoneHitsRock(flyingStone, level.stones)
    if (rock) {
      const speed = Math.hypot(flyingStone.vx, flyingStone.vy, flyingStone.vz)
      if (import.meta.env.DEV) {
        ;(window.__skipLog = window.__skipLog || []).push({ type: 'clack', ctx: 'rock-flight', x: flyingStone.x, z: flyingStone.z, speed })
      }
      groundStone(flyingStone)
      sfx.clack()
      haptics.medium()
      skipper.splashAt(flyingStone.x, flyingStone.z, speed * 0.5)
      ripples.push(skipRipple(flyingStone.x, flyingStone.z, speed * 0.5, flyingStone.group))
      skipper.sunk()
      break
    }
    const ctx = contactContext(flyingStone.x, flyingStone.z)
    if (ctx === 'bank' && flyingStone.y < 0.6) {
      groundStone(flyingStone)
      sfx.thud()
      skipper.sunk()
    }
  }
  if (!flyingStone.done) skipper.flight(flyingStone, dt)
}

function handleContact(e) {
  const ctx = contactContext(e.x, e.z)
  if (import.meta.env.DEV) {
    ;(window.__skipLog = window.__skipLog || []).push({ ...e, ctx })
  }
  if (ctx === 'pad') {
    // the pad swallows the stone, but the THUMP still stirs the water: the
    // pad dips and drifts from the blow, and a muffled wave rolls out from
    // under it — a stone landed on a pad is never a total loss
    const padHit = pads.thump(e.x, e.z, e.speed, flyingStone.vx, flyingStone.vz)
    groundStone(flyingStone)
    const r = skipRipple(e.x, e.z, e.speed * 0.55, flyingStone.group)
    if (padHit) r.absorbedBy.push(padHit.data.id) // born under this pad — don't muffle twice
    ripples.push(r)
    skipper.splashAt(e.x, e.z, e.speed * 0.35)
    sfx.thud()
    haptics.light()
    skipper.sunk()
    return
  }
  if (ctx === 'rock') {
    groundStone(flyingStone)
    sfx.clack()
    haptics.medium()
    skipper.splashAt(e.x, e.z, e.speed * 0.5)
    ripples.push(skipRipple(e.x, e.z, e.speed * 0.5, flyingStone.group))
    skipper.sunk()
    return
  }
  if (ctx === 'calm') {
    // the flower's calm circle hushes the skip: the stone travels on, but
    // the water refuses to ripple
    if (e.type === 'sink') skipper.sunk()
    haptics.warning()
    sfx.deny()
    return
  }
  if (e.type === 'skip') {
    ripples.push(skipRipple(e.x, e.z, e.speed, flyingStone.group))
    skipper.splashAt(e.x, e.z, e.speed)
    sfx.skip(e.speed)
    haptics.light()
  } else {
    ripples.push(skipRipple(e.x, e.z, e.speed * 0.8, flyingStone.group))
    skipper.splashAt(e.x, e.z, e.speed * 0.7)
    sfx.sink()
    skipper.sunk()
  }
}

// ---- the frame --------------------------------------------------------------

function tick(dt) {
  dt = Math.min(Math.max(dt || 1 / 60, 0.001), 0.05)
  t += dt

  const paused = showWinDialog.value || showLoseDialog.value || showLevelSelect.value

  if (!paused) {
    stepFlight(dt)

    ripples = stepRipples(ripples, dt)
    const padCircles = pads.items.map((p) => ({
      id: p.data.id,
      x: p.mesh.position.x,
      z: p.mesh.position.z,
      radius: p.data.radius,
    }))
    const born = collideRipples(ripples, level.stones, padCircles)
    if (born.length) {
      ripples.push(...born)
      sfx.stoneTick()
    }

    for (const f of lotuses.flowers) {
      if (updateLotus(f.data, ripples, dt)) {
        lotuses.activate(f)
        sfx.lotusChime()
        sfx.sink()
        haptics.success()
      }
    }

    pads.update(dt, ripples, t)

    // when the pond has gone quiet, the next stone appears in hand
    if ((!flyingStone || flyingStone.done) && stonesRemaining.value > 0 && gestureMode !== 'swing') {
      skipper.rest(0, aimAngle)
      skipper.setAiming(true, windupK)
    }

    checkGameState()
  }

  // the camera leans out after the stone, then settles home
  const followZ = flyingStone && !flyingStone.done ? Math.max(-2, flyingStone.z * 0.35) : 4
  cam.target.z += (followZ - cam.target.z) * Math.min(1, dt * 2.2)

  pond.update(t, dt, ripples)
  lotuses.update(t, dt, ripples)
  skipper.update(dt)
}

function checkGameState() {
  if (showWinDialog.value || showLoseDialog.value) return
  if (!level.lotus.length) return

  const allActivated = level.lotus.every((l) => l.isActivated)
  const allSunk = level.lotus.every((l) => !l.isActivated || (l.sinkProgress || 0) >= 1)
  const stoneSettled = !flyingStone || flyingStone.done

  if (allActivated && allSunk) {
    calculateScore()
    failureStreak.value = 0
    const isPerfect = stonesUsed.value <= level.optimalStones
    progressStore.recordLevelComplete(currentLevel.value + 1, levelScore.value, isPerfect)
    sfx.win(starsEarned.value)
    showWinDialog.value = true
  } else if (stonesRemaining.value === 0 && stoneSettled && ripples.length === 0 && !allActivated) {
    failureStreak.value++
    if (failureStreak.value % 5 === 0) progressStore.recordFailurePenalty()
    sfx.lose()
    showLoseDialog.value = true
  }
}

function calculateScore() {
  const optimal = level.optimalStones
  const used = stonesUsed.value
  const stars = used <= optimal ? 3 : used <= optimal + 1 ? 2 : 1
  levelScore.value = stars
  starsEarned.value = stars
}

function hexToRgba(hex) {
  const c = Color3.FromHexString(hex)
  return [c.r, c.g, c.b, 1]
}

function goBack() {
  haptics.light()
  router.back()
}

function toggleMenu() {
  haptics.light()
  showMenu.value = !showMenu.value
}

function restartLevel() {
  haptics.light()
  showMenu.value = false
  resetLevel()
}

function nextLevel() {
  haptics.light()
  showWinDialog.value = false
  currentLevel.value++
  resetLevel()
}

function retryLevel() {
  haptics.light()
  showLoseDialog.value = false
  resetLevel()
}

function openInstructions() {
  haptics.light()
  showMenu.value = false
  showInstructions.value = true
}

function openLevels() {
  haptics.light()
  showMenu.value = false
  showLevelSelect.value = true
}

function pickLevel(n) {
  if (n > maxUnlocked.value) return
  haptics.light()
  showLevelSelect.value = false
  if (n !== currentLevel.value) {
    currentLevel.value = n
    resetLevel()
  }
}
</script>

<style lang="scss" scoped>
.ripples-page {
  min-height: 100vh;
  position: relative;
  overflow: hidden;
  transition: background 2s ease;
}

.game-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  touch-action: none;
  outline: none;
}

.game-header {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
  padding: 16px;
  padding-top: max(56px, calc(env(safe-area-inset-top) + 16px));
  padding-left: max(16px, env(safe-area-inset-left));
  padding-right: max(16px, env(safe-area-inset-right));
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  pointer-events: none;

  > * {
    pointer-events: all;
  }
}

.level-badge {
  background: rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(10px);
  padding: 8px 16px;
  border-radius: 20px;
  min-width: 140px;
}

.level-stats {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;

  .stat-item {
    display: flex;
    align-items: center;
    gap: 4px;
  }
}

.backend-chip {
  position: absolute;
  bottom: max(10px, env(safe-area-inset-bottom));
  right: 12px;
  z-index: 5;
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.5);
  background: rgba(0, 0, 0, 0.18);
  padding: 3px 8px;
  border-radius: 8px;
  pointer-events: none;
}

.header-menu {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-end;

  .menu-button {
    background: transparent;
    transition: background 0.2s ease;
  }

  .menu-button-active {
    background: rgba(255, 255, 255, 0.15) !important;
    backdrop-filter: blur(10px);
  }

  .menu-buttons-container {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 20;
  }

  .menu-buttons-container:has(.menu-item) {
    padding: 8px;
    background: rgba(0, 0, 0, 0.2);
    backdrop-filter: blur(10px);
    border-radius: 12px;
  }

  .menu-item {
    background: rgba(0, 0, 0, 0.15);
    backdrop-filter: blur(10px);
  }
}

// Menu fade transitions
.menu-fade-enter-active {
  transition: all 0.2s ease-out;
}

.menu-fade-leave-active {
  transition: all 0.15s ease-in;
}

.menu-fade-enter-from {
  opacity: 0;
  transform: translateY(-10px) scale(0.8);
}

.menu-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.8);
}

.menu-item-1 {
  &.menu-fade-enter-active {
    transition-delay: 0ms;
  }
  &.menu-fade-leave-active {
    transition-delay: 50ms;
  }
}

.menu-item-2 {
  &.menu-fade-enter-active {
    transition-delay: 50ms;
  }
  &.menu-fade-leave-active {
    transition-delay: 50ms;
  }
}

.menu-item-3 {
  &.menu-fade-enter-active {
    transition-delay: 100ms;
  }
  &.menu-fade-leave-active {
    transition-delay: 0ms;
  }
}

.menu-fade-move {
  transition: transform 0.2s ease;
}

.tap-hint {
  position: absolute;
  bottom: 18%;
  left: 50%;
  transform: translateX(-50%);
  z-index: 5;
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: none;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.65;
  }
}

.boot {
  position: absolute;
  inset: 0;
  z-index: 30;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  background: linear-gradient(
    180deg,
    var(--pond-top, #2a7fd4) 0%,
    var(--pond-horizon, #bfe4ee) 52%,
    var(--pond-water, #1a6a8a) 78%,
    var(--pond-deep, #062435) 100%
  );
}

.boot-lotus {
  font-size: 2.6rem;
  animation: pulse 2.4s ease-in-out infinite;
}

.boot-ring {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: 3px solid rgba(255, 255, 255, 0.25);
  border-top-color: var(--pond-ring, rgba(255, 255, 255, 0.9));
  animation: spin 1.1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.boot-text {
  color: rgba(255, 255, 255, 0.85);
  font-size: 1rem;
  letter-spacing: 0.03em;
}

.instructions-card,
.win-card,
.lose-card,
.levels-card {
  min-width: 300px;
  max-width: 400px;
  border-radius: 16px;
  // pond-tinted glass: the dialogs wear the same dusk/dawn/midday colors
  // as the water behind them
  background: linear-gradient(168deg, var(--pond-top, #234), var(--pond-water, #135) 65%, var(--pond-deep, #012));
  background: linear-gradient(
    168deg,
    color-mix(in srgb, var(--pond-top, #234) 82%, transparent),
    color-mix(in srgb, var(--pond-water, #135) 86%, transparent) 65%,
    color-mix(in srgb, var(--pond-deep, #012) 88%, transparent)
  );
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.14);

  :deep(*) {
    color: white !important;
  }
}

.ponds-list {
  max-height: 46vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pond-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.pond-row-label {
  width: 62px;
  flex-shrink: 0;
  font-size: 0.78rem;
  opacity: 0.75;
}

.pond-row-chips {
  display: flex;
  gap: 8px;
  flex: 1;

  .level-chip {
    flex: 1;
  }
}

.level-chip {
  min-height: 44px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.12);
  font-weight: 600;

  &.disabled {
    opacity: 0.35 !important;
  }
}

.level-chip-current {
  background: color-mix(in srgb, var(--pond-ring, #9fd8ff) 35%, transparent);
  border-color: var(--pond-ring, #9fd8ff);
}

.stars-container {
  display: flex;
  justify-content: center;
  gap: 8px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  padding: 16px 0;
}

.stat-item {
  text-align: center;
}
</style>
