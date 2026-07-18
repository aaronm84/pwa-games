<template>
  <q-page class="ripples-page" :style="{ background: themeStore.colors.gradient }">
    <canvas ref="gameCanvas" class="game-canvas"></canvas>

    <!-- Game Header -->
    <div class="game-header">
      <q-btn fab-mini flat icon="arrow_back" color="white" @click="goBack" />

      <div class="level-badge">
        <div class="text-caption text-white text-center q-mb-xs">Level {{ currentLevel }}</div>
        <div class="level-stats">
          <div class="stat-item">
            <q-icon name="touch_app" color="white" size="16px" />
            <span class="text-body2 text-white text-weight-bold">{{ tapsRemaining }}</span>
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
            key="refresh"
            fab-mini
            flat
            icon="refresh"
            color="white"
            class="menu-item menu-item-1"
            @click="restartLevel"
          />
          <q-btn
            v-if="showMenu"
            key="help"
            fab-mini
            flat
            icon="help_outline"
            color="white"
            class="menu-item menu-item-2"
            @click="openInstructions"
          />
        </transition-group>
      </div>
    </div>

    <div class="backend-chip" v-if="backend">{{ backend }}</div>

    <!-- Tap to Start Hint -->
    <div v-if="!gameStarted && showTapHint && !booting" class="tap-hint">
      <q-icon name="touch_app" color="white" size="lg" />
      <div class="text-white text-h6 q-mt-sm">Tap to Create Ripples</div>
    </div>

    <!-- Boot overlay -->
    <div v-if="booting" class="boot">
      <div class="boot-ring" />
      <div class="boot-text">Stilling the water…</div>
    </div>

    <!-- Instructions Dialog -->
    <q-dialog v-model="showInstructions">
      <q-card class="instructions-card">
        <q-card-section>
          <div class="text-h6 q-mb-md text-white">How to Play</div>
          <div class="text-body2 text-white">
            <p>• Tap the water to create ripples</p>
            <p>• Ripples must reach lotus flowers to activate them</p>
            <p>• Hold tap longer for stronger ripples</p>
            <p>• Stones reflect ripples</p>
            <p>• Drifting lily pads absorb ripples</p>
            <p>• Multiple ripples combine their power</p>
            <p>• Activate all lotus flowers within the tap limit</p>
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
              <div class="text-caption text-grey-4">Taps Used</div>
              <div class="text-h6 text-white">{{ tapsUsed }}</div>
            </div>
            <div class="stat-item">
              <div class="text-caption text-grey-4">Optimal</div>
              <div class="text-h6 text-white">{{ level?.optimalTaps }}</div>
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
            Activated: {{ activatedCount }}/{{ totalLotus }}
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
// Ripples in real 3D on the shared engine-kit: Stage (WebGL2/WebGPU) renders a
// displaced-vertex pond, Havok drives the drifting lily pads in a gravity-zero
// water world, Gestures times tap holds into wave strengths, and the synth +
// haptics carry the feedback. The wave model itself is pure (src/game/waves).
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
import { createRipple, stepRipples, collideRipples, updateLotus, strengthFor } from 'src/game/waves'
import { generateLevel } from 'src/game/levels'
import { buildPond, paletteFor } from 'src/game/pond3d'
import { buildStones, buildLotuses, buildDriftingPads } from 'src/game/actors3d'
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
const tapsRemaining = ref(3)
const tapsUsed = ref(0)
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

// scene state
let stage = null
let scene = null
let cam = null
let shadow = null
let glow = null
let gestures = null
let pond = null
let stones = null
let lotuses = null
let pads = null
let level = null
let pal = null
let ripples = []
let t = 0
let holdStart = 0
let lastTapAt = -1

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
  pal = paletteFor(themeStore.period.key)
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

  // a gentle cinematic grade — this is a calm pond, not a neon alley
  const ipc = scene.imageProcessingConfiguration
  ipc.contrast = 1.08
  ipc.exposure = 1.05
  ipc.vignetteEnabled = true
  ipc.vignetteWeight = 1.1

  if (settingsStore.settings.glowFx !== false) {
    glow = new GlowLayer('glow', scene, { mainTextureRatio: sharp ? 0.75 : 0.5 })
    glow.intensity = 0.55
  }

  // a fixed contemplative view: steep enough to read the whole pond on a
  // portrait phone, tilted enough that the water reads as a surface
  cam = new ArcRotateCamera('cam', -Math.PI / 2, 0.52, 17.5, new Vector3(0, 0, 0.6), scene)
  cam.fov = 0.85
  if (sharp) {
    const fxaa = new FxaaPostProcess('fxaa', 1.0, cam)
    fxaa.samples = 2
  }

  // a gravity-zero world: everything floats on the water plane, Havok
  // handles the drifting-pad collisions
  await initPhysics(scene, { gravity: 0 })

  buildLevel()

  gestures = new Gestures(gameCanvas.value, {
    onDragStart: () => {
      holdStart = performance.now()
      sfx.unlock()
    },
    onTap: (info) => handleTap(info),
  })

  stage.run((dt) => tick(dt))
  booting.value = false

  showTapHint.value = true
  setTimeout(() => (showTapHint.value = false), 2400)

  // DEV-only state hook so a headless harness can drive and assert the game
  if (import.meta.env.DEV) {
    window.__ripples = () => ({
      level: currentLevel.value,
      taps: tapsRemaining.value,
      ripples: ripples.length,
      lotus: level.lotus.map((l) => ({ x: l.x, z: l.z, on: l.isActivated, sink: l.sinkProgress || 0 })),
      pads: pads.items.map((p) => ({ x: p.mesh.position.x, z: p.mesh.position.z })),
      backend: backend.value,
      won: showWinDialog.value,
      lost: showLoseDialog.value,
      tap: (x, z, strength) => spawnRipple(x, z, strength || 'medium'),
    })
  }
}

function buildLevel() {
  level = generateLevel(currentLevel.value)
  tapsRemaining.value = level.tapsAllowed
  tapsUsed.value = 0
  ripples = []
  gameStarted.value = false

  pond = buildPond(scene, shadow, level, pal)
  stones = buildStones(scene, shadow, level.stones)
  lotuses = buildLotuses(scene, shadow, level.lotus, pal)
  pads = buildDriftingPads(scene, shadow, level.pads, level.R)
}

function disposeLevel() {
  pond?.dispose()
  stones?.dispose()
  lotuses?.dispose()
  pads?.dispose()
  pond = stones = lotuses = pads = null
}

function resetLevel() {
  disposeLevel()
  buildLevel()
}

// tap → a point on the water plane: an analytic ray/plane hit, so the
// displaced water mesh never confuses picking. Gestures reports CSS px;
// the picking ray wants render px, so convert through the engine scaling.
function handleTap(info) {
  if (booting.value || showWinDialog.value || showLoseDialog.value || showInstructions.value) return
  if (tapsRemaining.value <= 0) return
  if (performance.now() - lastTapAt < 120) return

  const scaling = stage.engine.getHardwareScalingLevel()
  const dpr = (window.devicePixelRatio || 1) / scaling
  const ray = scene.createPickingRay(info.x * dpr, info.y * dpr, null, cam)
  if (Math.abs(ray.direction.y) < 1e-6) return
  const tHit = -ray.origin.y / ray.direction.y
  if (tHit <= 0) return
  const x = ray.origin.x + ray.direction.x * tHit
  const z = ray.origin.z + ray.direction.z * tHit

  // must land on the water
  if (Math.hypot(x, z) > level.R - 0.2) return

  // the calm circle around a sleeping lotus rejects taps
  for (const L of level.lotus) {
    if (!L.isActivated && Math.hypot(x - L.x, z - L.z) < L.protectedRadius) {
      haptics.warning()
      sfx.deny()
      return
    }
  }

  lastTapAt = performance.now()
  const strength = strengthFor(performance.now() - holdStart)
  haptics[strength === 'light' ? 'light' : 'medium']()
  showMenu.value = false

  spawnRipple(x, z, strength)
  tapsRemaining.value--
  tapsUsed.value++
  gameStarted.value = true
}

function spawnRipple(x, z, strength) {
  sfx.splash(strength)
  ripples.push(createRipple(x, z, strength))
}

function tick(dt) {
  dt = Math.min(Math.max(dt || 1 / 60, 0.001), 0.05)
  t += dt

  const paused = showWinDialog.value || showLoseDialog.value

  if (!paused) {
    // advance the wave model against the LIVE pad positions (Havok moves them)
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

    // lotus charging + activation
    for (const f of lotuses.flowers) {
      if (updateLotus(f.data, ripples, dt)) {
        lotuses.activate(f)
        sfx.lotusChime()
        sfx.sink()
        haptics.success()
      }
    }

    pads.update(dt, ripples)
    checkGameState()
  }

  // visuals always breathe, even behind a dialog
  pond.update(t, dt, ripples)
  lotuses.update(t, dt, ripples)
}

function checkGameState() {
  if (showWinDialog.value || showLoseDialog.value) return
  if (!level.lotus.length) return

  const allActivated = level.lotus.every((l) => l.isActivated)
  const allSunk = level.lotus.every((l) => !l.isActivated || (l.sinkProgress || 0) >= 1)

  if (allActivated && allSunk) {
    calculateScore()
    failureStreak.value = 0
    const isPerfect = tapsUsed.value <= level.optimalTaps
    progressStore.recordLevelComplete(currentLevel.value + 1, levelScore.value, isPerfect)
    sfx.win(starsEarned.value)
    showWinDialog.value = true
  } else if (tapsRemaining.value === 0 && ripples.length === 0 && !allActivated) {
    failureStreak.value++
    if (failureStreak.value % 5 === 0) progressStore.recordFailurePenalty()
    sfx.lose()
    showLoseDialog.value = true
  }
}

function calculateScore() {
  const optimal = level.optimalTaps
  const used = tapsUsed.value
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
  cursor: crosshair;
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
    transition-delay: 0ms;
  }
}

.menu-fade-move {
  transition: transform 0.2s ease;
}

.tap-hint {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
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
    transform: translate(-50%, -50%) scale(1);
  }
  50% {
    opacity: 0.7;
    transform: translate(-50%, -50%) scale(0.95);
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
  background: rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(6px);
}

.boot-ring {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: 3px solid rgba(255, 255, 255, 0.25);
  border-top-color: rgba(255, 255, 255, 0.9);
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
.lose-card {
  min-width: 300px;
  max-width: 400px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.08);

  :deep(*) {
    color: white !important;
  }
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
