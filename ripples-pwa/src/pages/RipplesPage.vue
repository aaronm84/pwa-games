<template>
  <q-page class="ripples-page" :style="{ background: themeStore.colors.gradient }">
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

    <!-- Full Screen Canvas (input handled by engine-kit Gestures) -->
    <canvas ref="gameCanvas" class="game-canvas"></canvas>

    <!-- Tap to Start Hint -->
    <div v-if="!gameStarted && showTapHint" class="tap-hint">
      <q-icon name="touch_app" color="white" size="lg" />
      <div class="text-white text-h6 q-mt-sm">Tap to Create Ripples</div>
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
            <p>• Lily pads absorb ripples</p>
            <p>• Multiple ripples combine their power</p>
            <p>• Activate all lotus flowers within tap limit</p>
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

          <!-- Stars -->
          <div class="stars-container q-mb-md">
            <q-icon
              v-for="star in 3"
              :key="star"
              :name="star <= starsEarned ? 'star' : 'star_outline'"
              :color="star <= starsEarned ? 'amber' : 'grey-5'"
              size="3rem"
            />
          </div>

          <!-- Score -->
          <div class="text-h5 text-white q-mb-sm">+{{ levelScore }} points</div>

          <!-- Stats -->
          <div class="stats-grid q-mt-md">
            <div class="stat-item">
              <div class="text-caption text-grey-4">Taps Used</div>
              <div class="text-h6 text-white">{{ tapsUsed }}</div>
            </div>
            <div class="stat-item">
              <div class="text-caption text-grey-4">Optimal</div>
              <div class="text-h6 text-white">{{ level.optimalTaps }}</div>
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
// Ripples, ported onto the shared engine-kit: Stage2D owns the canvas, loop
// and lifecycle; Gestures turns pointer input into hold-timed taps; the synth
// replaces the old sampled splashes; haptics ride the kit via useHaptics.
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Stage2D, Gestures, createSynth } from '@aaronm84/engine-kit/2d'
import { useThemeStore } from 'src/stores/theme'
import { useProgressStore } from 'src/stores/progress'
import { useSettingsStore } from 'src/stores/settings'
import { useHaptics } from 'src/composables/useHaptics'

const router = useRouter()
const themeStore = useThemeStore()
const progressStore = useProgressStore()
const settingsStore = useSettingsStore()
const haptics = useHaptics()

// Engine-kit pieces
const gameCanvas = ref(null)
let stage = null
let gestures = null
const sfx = createSynth()

// Game state
const currentLevel = ref(progressStore.ripples.currentLevel)
const tapsRemaining = ref(3)
const tapsUsed = ref(0)
const gameStarted = ref(false)
const showTapHint = ref(true)

// Scoring (totals live in the progress store; per-level numbers are local)
const totalScore = computed(() => progressStore.ripples.totalScore)
const levelScore = ref(0)
const starsEarned = ref(0)
const failureStreak = ref(0)

// Animation time for water effects
let animationTime = 0

// Dialogs
const showInstructions = ref(false)
const showWinDialog = ref(false)
const showLoseDialog = ref(false)
const showMenu = ref(false)

// Level data
const level = ref({
  lotusFlowers: [],
  obstacles: [],
  decorations: [],
  tapsAllowed: 3,
  optimalTaps: 2,
})

// Game objects
let ripples = []

// Asset images (Vite resolves these to hashed URLs at build time)
const assetUrls = {
  flowers: import.meta.glob('../assets/images/ripple/flower-*.svg', { eager: true, query: '?url', import: 'default' }),
  lilyPads: import.meta.glob('../assets/images/ripple/lily-pad-*.svg', { eager: true, query: '?url', import: 'default' }),
  rocks: import.meta.glob('../assets/images/ripple/rock-*.svg', { eager: true, query: '?url', import: 'default' }),
  reeds: import.meta.glob('../assets/images/ripple/reed-*.svg', { eager: true, query: '?url', import: 'default' }),
  fish: import.meta.glob('../assets/images/ripple/fish-*.svg', { eager: true, query: '?url', import: 'default' }),
}
const loadedImages = { flowers: [], lilyPads: [], rocks: [], reeds: [], fish: [] }
let imagesLoaded = false

// Tap strength tracking (Gestures reports the tap; we time the hold)
let holdStart = 0
let isProcessingTap = false

// Tap strength configs
const TAP_CONFIGS = {
  light: {
    speed: 2,
    maxRadius: 250,
    peakRadius: 125,
    peakPower: 0.9,
    lineWidth: 2,
    glowIntensity: 15,
  },
  medium: {
    speed: 1.5,
    maxRadius: 350,
    peakRadius: 150,
    peakPower: 1.0,
    lineWidth: 2.5,
    glowIntensity: 20,
  },
  strong: {
    speed: 1.2,
    maxRadius: 450,
    peakRadius: 200,
    peakPower: 1.2,
    lineWidth: 3,
    glowIntensity: 30,
  },
}

// Water colors based on time of day
const waterColors = computed(() => {
  const period = themeStore.period.key

  const colorSchemes = {
    night: {
      base: '#0a1628',
      gradientStart: '#1a2847',
      gradientMid: '#0f1e3a',
      gradientEnd: '#0a1628',
    },
    dawn: {
      base: '#4a2c5e',
      gradientStart: '#7a4c8e',
      gradientMid: '#5a3c7e',
      gradientEnd: '#4a2c5e',
    },
    morning: {
      base: '#1a5f7a',
      gradientStart: '#3a8faa',
      gradientMid: '#2a7f9a',
      gradientEnd: '#1a5f7a',
    },
    midday: {
      base: '#0a3a52',
      gradientStart: '#1a6a8a',
      gradientMid: '#155a7a',
      gradientEnd: '#0a3a52',
    },
    afternoon: {
      base: '#2a5f7a',
      gradientStart: '#4a8faa',
      gradientMid: '#3a7f9a',
      gradientEnd: '#2a5f7a',
    },
    evening: {
      base: '#3a2f52',
      gradientStart: '#5a4f7a',
      gradientMid: '#4a3f6a',
      gradientEnd: '#3a2f52',
    },
    dusk: {
      base: '#2a1f42',
      gradientStart: '#4a3f6a',
      gradientMid: '#3a2f5a',
      gradientEnd: '#2a1f42',
    },
  }

  return colorSchemes[period] || colorSchemes.midday
})

const activatedCount = computed(() => {
  return level.value.lotusFlowers.filter((l) => l.isActivated).length
})

const totalLotus = computed(() => level.value.lotusFlowers.length)

// Keep the synth in sync with the sound settings
watch(
  () => [settingsStore.settings.soundEffectsEnabled, settingsStore.settings.soundEffectsVolume],
  ([on, vol]) => sfx.configure({ on, vol }),
  { immediate: true },
)

onMounted(async () => {
  if (!gameCanvas.value) return

  stage = new Stage2D(gameCanvas.value, { maxDpr: 2 })
  await stage.init()

  await loadAssets()

  gestures = new Gestures(gameCanvas.value, {
    onDragStart: () => {
      holdStart = performance.now()
      sfx.unlock() // autoplay-safe: first user gesture wakes WebAudio
    },
    onTap: (info) => handleTap(info),
  })

  initLevel()

  // Show tap hint on first load, auto-hide after 2 seconds
  showTapHint.value = true
  setTimeout(() => {
    showTapHint.value = false
  }, 2000)

  stage.run((dt) => frame(dt))
})

onUnmounted(() => {
  gestures?.dispose()
  stage?.dispose()
})

async function loadAssets() {
  const loadPromises = []

  for (const [type, urlMap] of Object.entries(assetUrls)) {
    // glob keys sort lexicographically -> flower-1, flower-2, ... stay in order
    const urls = Object.keys(urlMap)
      .sort()
      .map((k) => urlMap[k])
    for (const url of urls) {
      const img = new Image()
      img.src = url
      loadPromises.push(
        new Promise((resolve) => {
          img.onload = () => resolve()
          img.onerror = () => resolve() // don't block the pond on one asset
          setTimeout(() => resolve(), 5000)
        }),
      )
      loadedImages[type].push(img)
    }
  }

  await Promise.all(loadPromises)
  imagesLoaded = true
}

function initLevel() {
  generateLevel(currentLevel.value)

  tapsRemaining.value = level.value.tapsAllowed
  tapsUsed.value = 0
  ripples = []
  gameStarted.value = false
}

// Seeded random number generator
function seededRandom(seed) {
  let value = seed
  return () => {
    value = (value * 9301 + 49297) % 233280
    return value / 233280
  }
}

function generateLevel(levelNum) {
  const width = stage.width
  const height = stage.height

  // Use level number as seed for consistent level generation
  const rng = seededRandom(levelNum * 12345)

  // Calculate level difficulty with gentler curve
  const lotusCount = Math.min(2 + Math.floor(levelNum / 4), 5)
  const stoneCount = Math.min(Math.floor((levelNum - 1) / 3), 3)
  const extraLilypadGroupCount = Math.min(Math.floor((levelNum - 2) / 4), 2)

  // Tighter tap allowance - typically just 1-2 taps per lotus
  level.value.tapsAllowed = Math.max(2, Math.ceil(lotusCount * 0.6) + Math.floor(levelNum / 8))
  level.value.optimalTaps = Math.max(1, Math.ceil(lotusCount * 0.5))

  level.value.obstacles = []
  level.value.lotusFlowers = []
  const minSpacing = 150
  const margin = 80
  const topMargin = 180 // Extra margin at top for header + status bar

  // Generate lotus flowers WITH lily pads underneath
  for (let i = 0; i < lotusCount; i++) {
    let attempts = 0
    let position

    while (attempts < 100) {
      position = {
        x: margin + rng() * (width - 2 * margin),
        y: topMargin + rng() * (height - topMargin - margin),
      }

      const tooCloseToLotus = level.value.lotusFlowers.some(
        (lotus) => distance(position, lotus.position) < minSpacing,
      )
      const tooCloseToObstacle = level.value.obstacles.some(
        (obs) => distance(position, obs.position) < 100,
      )

      if (!tooCloseToLotus && !tooCloseToObstacle) break
      attempts++
    }

    // First create the lily pad base (doesn't block waves)
    const lilyPadIndex = loadedImages.lilyPads.length > 0 ? Math.floor(rng() * loadedImages.lilyPads.length) : 0
    const lilyPadRotation = rng() * Math.PI * 2
    const lilyPadScale = 1.2 + rng() * 0.4

    level.value.obstacles.push({
      id: `lilypad_lotus_${i}`,
      type: 'lilypad-base', // Special type that doesn't block waves
      position,
      radius: 50,
      imageIndex: lilyPadIndex,
      rotation: lilyPadRotation,
      scale: lilyPadScale,
    })

    // Then create the lotus flower on top
    level.value.lotusFlowers.push({
      id: `lotus_${i}`,
      position,
      activationThreshold: 0.65 + rng() * 0.15,
      protectedRadius: 50,
      isActivated: false,
      glowIntensity: 0.3,
      currentPower: 0,
      imageIndex: loadedImages.flowers.length > 0 ? Math.floor(rng() * loadedImages.flowers.length) : 0,
      rotation: rng() * Math.PI * 2,
      scale: 0.6 + rng() * 0.3,
    })
  }

  // Stones (block waves) - keep them away from flowers
  for (let i = 0; i < stoneCount; i++) {
    let attempts = 0
    let position

    while (attempts < 100) {
      position = {
        x: margin + rng() * (width - 2 * margin),
        y: topMargin + rng() * (height - topMargin - margin),
      }

      const minDistToLotus = 180
      const minDistToObstacle = 80

      const tooCloseToLotus = level.value.lotusFlowers.some(
        (lotus) => distance(position, lotus.position) < minDistToLotus,
      )
      const tooCloseToObstacle = level.value.obstacles.some(
        (obs) => distance(position, obs.position) < minDistToObstacle,
      )

      // Also ensure stones don't block paths between flowers
      const blocksFlowerPath = level.value.lotusFlowers.some((lotus1, idx1) => {
        return level.value.lotusFlowers.some((lotus2, idx2) => {
          if (idx1 >= idx2) return false
          const lineToFlower = pointToLineDistance(position, lotus1.position, lotus2.position)
          return lineToFlower < 120
        })
      })

      if (!tooCloseToLotus && !tooCloseToObstacle && !blocksFlowerPath) break
      attempts++
    }

    level.value.obstacles.push({
      id: `stone_${i}`,
      type: 'stone',
      position,
      radius: 25 + rng() * 10,
      imageIndex: loadedImages.rocks.length > 0 ? Math.floor(rng() * loadedImages.rocks.length) : 0,
      rotation: rng() * Math.PI * 2,
      scale: 0.8 + rng() * 0.4,
    })
  }

  // Decorative lily pad groups (block waves) - place carefully to not block flowers
  for (let g = 0; g < extraLilypadGroupCount; g++) {
    let groupCenter
    let attempts = 0

    while (attempts < 100) {
      groupCenter = {
        x: margin + rng() * (width - 2 * margin),
        y: topMargin + rng() * (height - topMargin - margin),
      }

      const minDistToLotus = 200 // these move and can block flowers
      const minDistToObstacle = 100

      const tooCloseToLotus = level.value.lotusFlowers.some(
        (lotus) => distance(groupCenter, lotus.position) < minDistToLotus,
      )
      const tooCloseToObstacle = level.value.obstacles.some(
        (obs) => obs.type !== 'lilypad-base' && distance(groupCenter, obs.position) < minDistToObstacle,
      )

      const blocksFlowerPath = level.value.lotusFlowers.some((lotus1, idx1) => {
        return level.value.lotusFlowers.some((lotus2, idx2) => {
          if (idx1 >= idx2) return false
          const lineToFlower = pointToLineDistance(groupCenter, lotus1.position, lotus2.position)
          return lineToFlower < 150
        })
      })

      if (!tooCloseToLotus && !tooCloseToObstacle && !blocksFlowerPath) break
      attempts++
    }

    const groupSize = 2 + Math.floor(rng() * 2)
    const boundsSize = 120 + rng() * 80

    // Calculate bounds that avoid static lily pads
    let boundsCenterX = groupCenter.x
    let boundsCenterY = groupCenter.y

    const staticLilyPads = level.value.obstacles.filter((obs) => obs.type === 'lilypad-base')
    staticLilyPads.forEach((staticPad) => {
      const dx = staticPad.position.x - groupCenter.x
      const dy = staticPad.position.y - groupCenter.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist < boundsSize + 80) {
        const pushDist = boundsSize + 80 - dist
        const angle = Math.atan2(dy, dx)
        boundsCenterX -= Math.cos(angle) * pushDist * 0.5
        boundsCenterY -= Math.sin(angle) * pushDist * 0.5
      }
    })

    for (let i = 0; i < groupSize; i++) {
      const angle = (i / groupSize) * Math.PI * 2 + rng() * 0.5
      const dist = 60 + rng() * 60
      const position = {
        x: groupCenter.x + Math.cos(angle) * dist,
        y: groupCenter.y + Math.sin(angle) * dist,
      }

      // Slow drift, seeded slightly away from the group center to spread out
      const initialAngle = Math.atan2(position.y - groupCenter.y, position.x - groupCenter.x)
      const velocity = {
        x: (rng() - 0.5) * 0.01 + Math.cos(initialAngle) * 0.015,
        y: (rng() - 0.5) * 0.01 + Math.sin(initialAngle) * 0.015,
      }

      level.value.obstacles.push({
        id: `lilypad_group_${g}_${i}`,
        type: 'lilypad',
        position,
        radius: 40 + rng() * 15,
        imageIndex: loadedImages.lilyPads.length > 0 ? Math.floor(rng() * loadedImages.lilyPads.length) : 0,
        rotation: rng() * Math.PI * 2,
        targetRotation: rng() * Math.PI * 2,
        scale: 1.0 + rng() * 0.5,
        rotationSpeed: (rng() - 0.5) * 0.015,
        velocity,
        bounds: {
          minX: boundsCenterX - boundsSize,
          maxX: boundsCenterX + boundsSize,
          minY: boundsCenterY - boundsSize,
          maxY: boundsCenterY + boundsSize,
        },
      })
    }
  }

  // Add decorative reeds and fish
  addDecorativeElements(rng, width, height, margin, topMargin)
}

function addDecorativeElements(rng, width, height, margin, topMargin) {
  level.value.decorations = []

  const lilyPadObstacles = level.value.obstacles.filter(
    (obs) => obs.type === 'lilypad' || obs.type === 'lilypad-base',
  )
  const lilyPadPositions = lilyPadObstacles.map((obs) => obs.position)

  // Add reeds near lily pads (2-3 reeds per lily pad)
  if (lilyPadPositions.length > 0) {
    const reedsPerPad = 2 + Math.floor(rng() * 2)
    const reedCount = Math.min(lilyPadPositions.length * reedsPerPad, 15)

    for (let i = 0; i < reedCount; i++) {
      let position
      let attempts = 0
      const maxAttempts = 50

      // Find a position whose reed base doesn't overlap a lily pad
      while (attempts < maxAttempts) {
        const nearLilyPad = lilyPadPositions[Math.floor(rng() * lilyPadPositions.length)]

        const angle = rng() * Math.PI * 2
        const dist = 50 + rng() * 70
        position = {
          x: nearLilyPad.x + Math.cos(angle) * dist,
          y: nearLilyPad.y + Math.sin(angle) * dist,
        }

        position.x = Math.max(margin, Math.min(width - margin, position.x))
        position.y = Math.max(topMargin, Math.min(height - margin, position.y))

        // Check if the bottom 50% of the reed overlaps with any lily pad
        const reedSize = 120
        const reedHalfSize = reedSize / 2

        const overlapsBounds = lilyPadObstacles.some((lilyPad) => {
          if (lilyPad.bounds) {
            const reedLeft = position.x - reedHalfSize
            const reedRight = position.x + reedHalfSize
            const reedBottom50Top = position.y
            const reedBottom50Bottom = position.y + reedHalfSize

            return !(
              reedRight < lilyPad.bounds.minX ||
              reedLeft > lilyPad.bounds.maxX ||
              reedBottom50Bottom < lilyPad.bounds.minY ||
              reedBottom50Top > lilyPad.bounds.maxY
            )
          }

          if (lilyPad.type === 'lilypad-base' && lilyPad.radius) {
            const reedLeft = position.x - reedHalfSize
            const reedRight = position.x + reedHalfSize
            const reedBottom50Top = position.y
            const reedBottom50Bottom = position.y + reedHalfSize

            const closestX = Math.max(reedLeft, Math.min(lilyPad.position.x, reedRight))
            const closestY = Math.max(reedBottom50Top, Math.min(lilyPad.position.y, reedBottom50Bottom))

            const distX = lilyPad.position.x - closestX
            const distY = lilyPad.position.y - closestY
            const distanceSquared = distX * distX + distY * distY

            return distanceSquared < lilyPad.radius * lilyPad.radius
          }

          return false
        })

        if (!overlapsBounds) break
        attempts++
      }

      if (attempts < maxAttempts) {
        level.value.decorations.push({
          id: `reed_${i}`,
          type: 'reed',
          position,
          imageIndex: loadedImages.reeds.length > 0 ? Math.floor(rng() * loadedImages.reeds.length) : 0,
          rotation: (rng() - 0.5) * 0.4,
          scale: 0.7 + rng() * 0.5,
        })
      }
    }
  }

  // Add swimming fish
  const fishCount = 1 + Math.floor(rng() * 2)

  for (let i = 0; i < fishCount; i++) {
    const position = {
      x: margin + rng() * (width - 2 * margin),
      y: topMargin + rng() * (height - topMargin - margin),
    }

    const velocity = {
      x: (rng() - 0.5) * 0.3,
      y: (rng() - 0.5) * 0.3,
    }

    level.value.decorations.push({
      id: `fish_${i}`,
      type: 'fish',
      position,
      imageIndex: loadedImages.fish.length > 0 ? Math.floor(rng() * loadedImages.fish.length) : 0,
      rotation: Math.atan2(velocity.y, velocity.x) + Math.PI, // sprite faces backwards
      scale: 0.6 + rng() * 0.3,
      velocity,
      bounds: {
        minX: margin,
        maxX: width - margin,
        minY: margin, // Fish can swim into top area
        maxY: height - margin,
      },
      baseSpeed: Math.sqrt(velocity.x ** 2 + velocity.y ** 2),
      speedMultiplier: 1,
      behaviorState: 'swimming', // swimming, hiding, scurrying
      behaviorTimer: 0,
      opacity: 0.85,
      targetOpacity: 0.85,
    })
  }
}

// A Gestures tap: position from the kit, strength from how long it was held
function handleTap(info) {
  if (tapsRemaining.value <= 0 || isProcessingTap) return
  if (showWinDialog.value || showLoseDialog.value || showInstructions.value) return

  isProcessingTap = true

  const holdDuration = performance.now() - holdStart
  const { x, y } = info

  let strength = 'medium'
  if (holdDuration < 150) {
    strength = 'light'
    haptics.light()
  } else if (holdDuration > 400) {
    strength = 'strong'
    haptics.medium()
  } else {
    haptics.medium()
  }

  showMenu.value = false

  // Check protected zones (only for non-activated flowers)
  for (const lotus of level.value.lotusFlowers) {
    if (lotus.isActivated) continue

    const dist = distance({ x, y }, lotus.position)
    if (dist < lotus.protectedRadius) {
      haptics.warning()
      isProcessingTap = false
      return
    }
  }

  createRipple(x, y, strength)

  tapsRemaining.value--
  tapsUsed.value++
  gameStarted.value = true

  setTimeout(() => {
    isProcessingTap = false
  }, 100)
}

// A water plop from the synth: a filtered noise splash under a sinking tone.
// Deeper and longer the harder the tap — no sample files involved.
function playSplash(strength) {
  const cfg = {
    light: { dur: 0.22, freq: 1300, gain: 0.18, tone: 620 },
    medium: { dur: 0.32, freq: 900, gain: 0.24, tone: 460 },
    strong: { dur: 0.45, freq: 650, gain: 0.3, tone: 330 },
  }[strength]
  sfx.noise(cfg.dur, { freq: cfg.freq, q: 0.7, gain: cfg.gain })
  sfx.tone(cfg.tone, cfg.dur * 0.8, { type: 'sine', gain: 0.12, slide: cfg.tone * 0.35 })
}

// A soft two-note chime when a lotus wakes
function playLotusChime() {
  sfx.tone(523.25, 0.35, { type: 'sine', gain: 0.1 }) // C5
  sfx.tone(783.99, 0.5, { type: 'sine', gain: 0.08, at: 0.09 }) // G5
}

function createRipple(x, y, strength = 'medium') {
  const config = TAP_CONFIGS[strength]

  playSplash(strength)

  const newRipple = {
    id: `ripple_${tapsUsed.value}_${Math.round(animationTime * 1000)}`,
    origin: { x, y },
    radius: 0,
    maxRadius: config.maxRadius,
    speed: config.speed * (0.9 + Math.random() * 0.2),
    peakRadius: config.peakRadius,
    peakPower: config.peakPower,
    lineWidth: config.lineWidth,
    glowIntensity: config.glowIntensity,
    isActive: true,
    absorbedBy: [],
    // Dynamic properties for varied ripple appearance
    wobbleFreq: 3 + Math.random() * 4,
    wobbleAmp: 1 + Math.random() * 2.5,
    phaseOffset: Math.random() * Math.PI * 2,
    ringSpacing: 12 + Math.random() * 8,
  }

  ripples.push(newRipple)
}

// Per-frame callback from Stage2D. The original game moved things in
// per-rAF-frame units tuned at 60fps; k rescales those units by real dt so
// the pond behaves the same at 120Hz or under load (clamped by the stage).
function frame(dt) {
  animationTime += dt
  const k = dt * 60

  const paused = showWinDialog.value || showLoseDialog.value
  if (!paused) {
    updateObstacles(k)
    updateRipples(k)
    handleObstacleCollisions()
    checkLotusActivations(k)
    updateSinkingAnimations(k)
    checkGameState()
  }

  render()
}

function updateObstacles(k) {
  level.value.obstacles.forEach((obstacle) => {
    // Lily pads float naturally like inanimate objects
    if (obstacle.type === 'lilypad' && obstacle.velocity) {
      // Ripples push lily pads around
      ripples.forEach((ripple) => {
        const dist = distance(ripple.origin, obstacle.position)

        if (dist < ripple.radius + 80 && dist > ripple.radius - 80) {
          const power = calculateRipplePower(ripple.radius, ripple.peakRadius, ripple.peakPower)
          const angle = Math.atan2(
            obstacle.position.y - ripple.origin.y,
            obstacle.position.x - ripple.origin.x,
          )

          const distFromEdge = Math.abs(dist - ripple.radius)
          const proximityFactor = 1 - distFromEdge / 80

          const pushForce = power * proximityFactor * 0.5
          obstacle.velocity.x += Math.cos(angle) * pushForce * 0.08 * k
          obstacle.velocity.y += Math.sin(angle) * pushForce * 0.08 * k

          if (obstacle.rotationSpeed !== undefined) {
            obstacle.rotationSpeed += (Math.random() - 0.5) * pushForce * 0.003 * k
          }
        }
      })

      // Cap maximum velocity, keep a minimum drift so pads never get stuck
      const maxVelocity = 0.3
      const minVelocity = 0.02
      const currentSpeed = Math.sqrt(obstacle.velocity.x ** 2 + obstacle.velocity.y ** 2)

      if (currentSpeed > maxVelocity) {
        const scale = maxVelocity / currentSpeed
        obstacle.velocity.x *= scale
        obstacle.velocity.y *= scale
      } else if (currentSpeed > 0.05) {
        const damp = Math.pow(0.97, k)
        obstacle.velocity.x *= damp
        obstacle.velocity.y *= damp
      } else if (currentSpeed < minVelocity) {
        const angle = Math.random() * Math.PI * 2
        obstacle.velocity.x += Math.cos(angle) * 0.015
        obstacle.velocity.y += Math.sin(angle) * 0.015
      }

      // Subtle flow field for organic, non-retracing movement
      const flowFieldScale = 0.008
      const flowFieldFreq = 0.002
      const flowAngle =
        Math.sin(obstacle.position.x * flowFieldFreq + animationTime * 0.3) * 2 +
        Math.cos(obstacle.position.y * flowFieldFreq + animationTime * 0.2) * 2

      obstacle.velocity.x += Math.cos(flowAngle) * flowFieldScale * k
      obstacle.velocity.y += Math.sin(flowAngle) * flowFieldScale * k

      obstacle.position.x += obstacle.velocity.x * k
      obstacle.position.y += obstacle.velocity.y * k

      // Very slow passive rotation (like floating on water)
      if (obstacle.rotationSpeed) {
        obstacle.rotation += obstacle.rotationSpeed * 0.1 * k
        obstacle.rotationSpeed *= Math.pow(0.998, k)
      }

      // Bounce off bounds with varied angles so pads don't retrace their path
      if (obstacle.position.x <= obstacle.bounds.minX || obstacle.position.x >= obstacle.bounds.maxX) {
        obstacle.velocity.x *= -(0.8 + Math.random() * 0.3)
        obstacle.velocity.y += (Math.random() - 0.5) * 0.06
        obstacle.velocity.x += (Math.random() - 0.5) * 0.03
      }
      if (obstacle.position.y <= obstacle.bounds.minY || obstacle.position.y >= obstacle.bounds.maxY) {
        obstacle.velocity.y *= -(0.8 + Math.random() * 0.3)
        obstacle.velocity.x += (Math.random() - 0.5) * 0.06
        obstacle.velocity.y += (Math.random() - 0.5) * 0.03
      }

      // Don't overlap other lily pads or stones
      level.value.obstacles.forEach((other) => {
        if (other.type === 'lilypad' && other.id !== obstacle.id) {
          const dx = other.position.x - obstacle.position.x
          const dy = other.position.y - obstacle.position.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          const minDist = (obstacle.radius + other.radius) * 1.3

          if (dist < minDist && dist > 0) {
            const separationForce = (minDist - dist) / minDist
            const pushX = (dx / dist) * (minDist - dist)
            const pushY = (dy / dist) * (minDist - dist)

            obstacle.position.x -= pushX * 0.6
            obstacle.position.y -= pushY * 0.6
            other.position.x += pushX * 0.6
            other.position.y += pushY * 0.6

            const repulsionStrength = 0.08 * separationForce
            obstacle.velocity.x -= (dx / dist) * repulsionStrength
            obstacle.velocity.y -= (dy / dist) * repulsionStrength
            other.velocity.x += (dx / dist) * repulsionStrength
            other.velocity.y += (dy / dist) * repulsionStrength

            // Tangential nudge so pads slide past instead of sticking
            const tangentX = -dy / dist
            const tangentY = dx / dist
            const slideForce = (Math.random() - 0.5) * 0.03
            obstacle.velocity.x += tangentX * slideForce
            obstacle.velocity.y += tangentY * slideForce
          }
        }

        // Lily pads bounce off stones and static lily pad bases
        if (other.type === 'stone' || other.type === 'lilypad-base') {
          const dx = other.position.x - obstacle.position.x
          const dy = other.position.y - obstacle.position.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          const minDist = obstacle.radius + other.radius

          if (dist < minDist && dist > 0) {
            const pushX = (dx / dist) * (minDist - dist)
            const pushY = (dy / dist) * (minDist - dist)

            obstacle.position.x -= pushX
            obstacle.position.y -= pushY

            const dotProduct = obstacle.velocity.x * dx + obstacle.velocity.y * dy
            obstacle.velocity.x -= (2 * dotProduct * dx) / (dist * dist)
            obstacle.velocity.y -= (2 * dotProduct * dy) / (dist * dist)

            obstacle.velocity.x += (Math.random() - 0.5) * 0.02
            obstacle.velocity.y += (Math.random() - 0.5) * 0.02
          }
        }
      })

      // Keep clear of non-activated lotus flowers' protected zones
      level.value.lotusFlowers.forEach((lotus) => {
        if (!lotus.isActivated) {
          const dx = lotus.position.x - obstacle.position.x
          const dy = lotus.position.y - obstacle.position.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          const minDist = obstacle.radius + lotus.protectedRadius

          if (dist < minDist && dist > 0) {
            const pushX = (dx / dist) * (minDist - dist)
            const pushY = (dy / dist) * (minDist - dist)

            obstacle.position.x -= pushX * 1.2
            obstacle.position.y -= pushY * 1.2

            const repulsionStrength = 0.15
            obstacle.velocity.x -= (dx / dist) * repulsionStrength
            obstacle.velocity.y -= (dy / dist) * repulsionStrength

            // Perpendicular "flow" so pads slide around the flower instead of
            // bouncing back and forth against it
            const tangentX = -dy / dist
            const tangentY = dx / dist
            const flowForce = 0.08
            obstacle.velocity.x += tangentX * flowForce
            obstacle.velocity.y += tangentY * flowForce

            obstacle.velocity.x += (Math.random() - 0.5) * 0.05
            obstacle.velocity.y += (Math.random() - 0.5) * 0.05
          }
        }
      })
    }
  })

  // Fish swim about, and scurry when a wavefront passes them
  if (level.value.decorations) {
    level.value.decorations.forEach((decoration) => {
      if (decoration.type === 'fish' && decoration.velocity) {
        decoration.behaviorTimer += k

        let scaredByWave = false
        ripples.forEach((ripple) => {
          const dist = distance(ripple.origin, decoration.position)
          if (dist < ripple.radius + 100 && dist > ripple.radius - 100) {
            scaredByWave = true
          }
        })

        if (scaredByWave && decoration.behaviorState !== 'scurrying') {
          decoration.behaviorState = 'scurrying'
          decoration.speedMultiplier = 3.5
          decoration.targetOpacity = 0.95
          decoration.behaviorTimer = 0
        } else if (decoration.behaviorState === 'scurrying' && decoration.behaviorTimer > 60) {
          decoration.behaviorState = 'swimming'
          decoration.speedMultiplier = 1
          decoration.targetOpacity = 0.85
          decoration.behaviorTimer = 0
        } else if (decoration.behaviorState === 'swimming') {
          if (Math.random() < 0.005 * k) {
            decoration.behaviorState = 'fast'
            decoration.speedMultiplier = 2
            decoration.targetOpacity = 0.9
            decoration.behaviorTimer = 0
          } else if (Math.random() < 0.008 * k) {
            decoration.behaviorState = 'slow'
            decoration.speedMultiplier = 0.4
            decoration.targetOpacity = 0.75
            decoration.behaviorTimer = 0
          }
        } else if (decoration.behaviorState === 'slow' && decoration.behaviorTimer > 50) {
          decoration.behaviorState = 'swimming'
          decoration.speedMultiplier = 1
          decoration.targetOpacity = 0.85
          decoration.behaviorTimer = 0
        } else if (decoration.behaviorState === 'fast' && decoration.behaviorTimer > 40) {
          decoration.behaviorState = 'swimming'
          decoration.speedMultiplier = 1
          decoration.targetOpacity = 0.85
          decoration.behaviorTimer = 0
        }

        // Ease speed and opacity toward the behavior targets
        const currentSpeed = Math.sqrt(decoration.velocity.x ** 2 + decoration.velocity.y ** 2)
        const targetSpeed = decoration.baseSpeed * decoration.speedMultiplier
        if (currentSpeed < targetSpeed) {
          const speedIncrease = Math.pow(1.05, k)
          decoration.velocity.x *= speedIncrease
          decoration.velocity.y *= speedIncrease
        } else if (currentSpeed > targetSpeed) {
          const speedDecrease = Math.pow(0.95, k)
          decoration.velocity.x *= speedDecrease
          decoration.velocity.y *= speedDecrease
        }

        decoration.opacity += (decoration.targetOpacity - decoration.opacity) * Math.min(1, 0.05 * k)

        // Fish steer around stones
        level.value.obstacles.forEach((obstacle) => {
          if (obstacle.type === 'stone') {
            const dx = obstacle.position.x - decoration.position.x
            const dy = obstacle.position.y - decoration.position.y
            const dist = Math.sqrt(dx * dx + dy * dy)
            const fishRadius = 30
            const minDist = obstacle.radius + fishRadius

            if (dist < minDist && dist > 0) {
              const pushX = (dx / dist) * (minDist - dist)
              const pushY = (dy / dist) * (minDist - dist)

              decoration.position.x -= pushX
              decoration.position.y -= pushY

              const dotProduct = decoration.velocity.x * dx + decoration.velocity.y * dy
              decoration.velocity.x -= (2 * dotProduct * dx) / (dist * dist)
              decoration.velocity.y -= (2 * dotProduct * dy) / (dist * dist)

              decoration.rotation = Math.atan2(decoration.velocity.y, decoration.velocity.x) + Math.PI
            }
          }
        })

        decoration.position.x += decoration.velocity.x * k
        decoration.position.y += decoration.velocity.y * k

        if (decoration.position.x <= decoration.bounds.minX || decoration.position.x >= decoration.bounds.maxX) {
          decoration.velocity.x *= -1
          decoration.rotation = Math.atan2(decoration.velocity.y, decoration.velocity.x) + Math.PI
        }
        if (decoration.position.y <= decoration.bounds.minY || decoration.position.y >= decoration.bounds.maxY) {
          decoration.velocity.y *= -1
          decoration.rotation = Math.atan2(decoration.velocity.y, decoration.velocity.x) + Math.PI
        }
      }
    })
  }
}

function updateRipples(k) {
  ripples.forEach((ripple) => {
    if (!ripple.isActive) return

    ripple.radius += ripple.speed * k

    if (ripple.radius >= ripple.maxRadius) {
      ripple.isActive = false
    }
  })

  ripples = ripples.filter((r) => r.isActive)
}

function handleObstacleCollisions() {
  ripples.forEach((ripple) => {
    if (!ripple.isActive) return

    level.value.obstacles.forEach((obstacle) => {
      // Skip lily-pad bases (they don't block waves, only hold flowers)
      if (obstacle.type === 'lilypad-base') return

      const dist = distance(ripple.origin, obstacle.position)

      if (Math.abs(dist - ripple.radius) <= obstacle.radius) {
        if (obstacle.type === 'stone') {
          // Stone reflects - spawn a new ripple from the impact point, once
          const angle = Math.atan2(
            obstacle.position.y - ripple.origin.y,
            obstacle.position.x - ripple.origin.x,
          )
          const reflectionPoint = {
            x: obstacle.position.x + Math.cos(angle) * obstacle.radius,
            y: obstacle.position.y + Math.sin(angle) * obstacle.radius,
          }

          if (!ripple.reflectedFrom?.includes(obstacle.id)) {
            if (!ripple.reflectedFrom) ripple.reflectedFrom = []
            ripple.reflectedFrom.push(obstacle.id)

            const reflectedRipple = {
              id: `ripple_reflected_${obstacle.id}_${Math.round(animationTime * 1000)}`,
              origin: reflectionPoint,
              radius: 0,
              maxRadius: ripple.maxRadius - ripple.radius,
              speed: ripple.speed,
              peakRadius: ripple.peakRadius,
              peakPower: ripple.peakPower * 0.7, // reflection costs power
              lineWidth: ripple.lineWidth,
              glowIntensity: ripple.glowIntensity * 0.7,
              isActive: true,
              absorbedBy: [],
              wobbleFreq: ripple.wobbleFreq,
              wobbleAmp: ripple.wobbleAmp,
              phaseOffset: Math.random() * Math.PI * 2,
              ringSpacing: ripple.ringSpacing,
              reflectedFrom: [obstacle.id],
            }
            ripples.push(reflectedRipple)
          }
        } else if (obstacle.type === 'lilypad') {
          // Lily pad absorbs - halve the ripple's power, once per pad
          if (!ripple.absorbedBy?.includes(obstacle.id)) {
            if (!ripple.absorbedBy) ripple.absorbedBy = []
            ripple.absorbedBy.push(obstacle.id)
            ripple.peakPower *= 0.5
          }
        }
      }
    })
  })
}

function checkLotusActivations(k) {
  level.value.lotusFlowers.forEach((lotus) => {
    if (lotus.isActivated) return

    if (lotus.accumulatedPower === undefined) {
      lotus.accumulatedPower = 0
    }

    // Combined power from all touching ripples (wave interference)
    let combinedPower = 0
    let touchingCount = 0

    for (const ripple of ripples) {
      const dist = distance(ripple.origin, lotus.position)
      const tolerance = 15

      if (Math.abs(dist - ripple.radius) <= tolerance) {
        combinedPower += calculateRipplePower(ripple.radius, ripple.peakRadius, ripple.peakPower)
        touchingCount++
      }
    }

    // Constructive interference: bonus for simultaneous waves
    if (touchingCount > 1) {
      const interferenceBonus = Math.min(0.3, (touchingCount - 1) * 0.15)
      combinedPower *= 1 + interferenceBonus
    }

    // Accumulate power over time (with slow decay) so repeated weak waves
    // can still wake a flower
    if (combinedPower > 0) {
      lotus.accumulatedPower += combinedPower * 0.02 * k
      lotus.accumulatedPower = Math.min(lotus.accumulatedPower, 1.5)
    } else {
      lotus.accumulatedPower *= Math.pow(0.995, k)
    }

    const shouldActivate =
      combinedPower >= lotus.activationThreshold ||
      lotus.accumulatedPower >= lotus.activationThreshold * 0.8

    if (shouldActivate && !lotus.isActivated) {
      lotus.isActivated = true
      lotus.glowIntensity = 1.0
      lotus.sinkProgress = 0
      playLotusChime()
      haptics.success()
    }

    // Track current power for the glow visual (smooth decay)
    if (combinedPower > (lotus.currentPower || 0)) {
      lotus.currentPower = Math.min(combinedPower, 1.5)
    } else {
      lotus.currentPower = (lotus.currentPower || 0) * Math.pow(0.85, k)
      if (lotus.currentPower < 0.01) lotus.currentPower = 0
    }
  })
}

function updateSinkingAnimations(k) {
  level.value.lotusFlowers.forEach((lotus) => {
    if (lotus.isActivated && lotus.sinkProgress !== undefined && lotus.sinkProgress < 1) {
      lotus.sinkProgress += 0.008 * k // sink over ~2 seconds
    }
  })
}

function checkGameState() {
  if (showWinDialog.value || showLoseDialog.value) return

  const allActivated = level.value.lotusFlowers.every((l) => l.isActivated)
  const allFullySunk = level.value.lotusFlowers.every(
    (l) => !l.isActivated || (l.sinkProgress || 0) >= 1,
  )

  // Win only when every flower is activated AND fully sunk
  if (allActivated && allFullySunk && level.value.lotusFlowers.length > 0) {
    calculateScore()
    failureStreak.value = 0

    const isPerfect = tapsUsed.value <= level.value.optimalTaps
    progressStore.recordLevelComplete(currentLevel.value + 1, levelScore.value, isPerfect)

    showWinDialog.value = true
  } else if (tapsRemaining.value === 0 && ripples.length === 0 && !allActivated) {
    handleFailure()
    showLoseDialog.value = true
  }
}

function handleFailure() {
  failureStreak.value++

  // Lose 1 point for every 5 consecutive failures
  if (failureStreak.value % 5 === 0) {
    progressStore.recordFailurePenalty()
  }
}

function calculateScore() {
  const optimalTaps = level.value.optimalTaps
  const actualTaps = tapsUsed.value

  if (actualTaps <= optimalTaps) {
    levelScore.value = 3
    starsEarned.value = 3
  } else if (actualTaps <= optimalTaps + 1) {
    levelScore.value = 2
    starsEarned.value = 2
  } else {
    levelScore.value = 1
    starsEarned.value = 1
  }
}

function calculateRipplePower(radius, peakRadius = 150, peakPower = 1.0) {
  const r = radius
  const birthZone = peakRadius * 0.33
  const riseZone = peakRadius * 0.67
  const peakZone = peakRadius * 1.33
  const fadeZone = peakRadius * 2.0
  const deathZone = peakRadius * 2.33

  // Zone 1: Birth
  if (r < birthZone) {
    return (r / birthZone) * (peakPower * 0.4)
  }

  // Zone 2: Rise
  if (r < riseZone) {
    return peakPower * 0.4 + ((r - birthZone) / (riseZone - birthZone)) * (peakPower * 0.4)
  }

  // Zone 3: Peak
  if (r < peakZone) {
    const distFromPeak = Math.abs(r - peakRadius)
    return peakPower - (distFromPeak / (peakZone - peakRadius)) * (peakPower * 0.2)
  }

  // Zone 4: Fade
  if (r < fadeZone) {
    return peakPower * 0.8 - ((r - peakZone) / (fadeZone - peakZone)) * (peakPower * 0.4)
  }

  // Zone 5: Death
  if (r < deathZone) {
    return peakPower * 0.4 - ((r - fadeZone) / (deathZone - fadeZone)) * (peakPower * 0.3)
  }

  return 0
}

function getRippleColor(radius) {
  const r = radius

  if (r < 50) return 'rgba(255, 100, 100, 0.6)'
  if (r < 100) return 'rgba(255, 255, 100, 0.7)'
  if (r < 200) return 'rgba(100, 255, 200, 0.8)'
  if (r < 300) return 'rgba(255, 255, 100, 0.6)'
  return 'rgba(255, 100, 100, 0.4)'
}

function render() {
  const ctx = stage?.ctx
  if (!ctx) return

  const width = stage.width
  const height = stage.height

  // Clear canvas with water color
  ctx.fillStyle = waterColors.value.base
  ctx.fillRect(0, 0, width, height)

  // Animated water gradient with subtle drift
  const gradient = ctx.createRadialGradient(
    width / 2 + Math.sin(animationTime * 0.5) * 20,
    height / 2 + Math.cos(animationTime * 0.3) * 20,
    0,
    width / 2,
    height / 2,
    Math.max(width, height),
  )
  gradient.addColorStop(0, waterColors.value.gradientStart)
  gradient.addColorStop(0.5, waterColors.value.gradientMid)
  gradient.addColorStop(1, waterColors.value.gradientEnd)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  drawWaterSurface(ctx, width, height)

  // Fish swim in the background (underwater)
  if (level.value.decorations && imagesLoaded) {
    level.value.decorations.forEach((decoration) => {
      if (decoration.type === 'fish') {
        drawDecoration(ctx, decoration)
      }
    })
  }

  // Bottom of reeds (can be covered by lily pads)
  if (level.value.decorations && imagesLoaded) {
    level.value.decorations.forEach((decoration) => {
      if (decoration.type === 'reed') {
        drawDecorationClipped(ctx, decoration, 'bottom')
      }
    })
  }

  // Moving lily pads (before flowers and stones)
  level.value.obstacles.forEach((obstacle) => {
    if (obstacle.type === 'lilypad') {
      if (imagesLoaded) {
        drawObstacleImageWithDisplacement(ctx, obstacle)
      } else {
        drawObstacle(ctx, obstacle)
      }
    }
  })

  // Stones (under lotus flowers)
  level.value.obstacles.forEach((obstacle) => {
    if (obstacle.type === 'stone') {
      if (imagesLoaded) {
        drawObstacleImageWithDisplacement(ctx, obstacle)
      } else {
        drawObstacle(ctx, obstacle)
      }
    }
  })

  // Lotus flowers WITH their lily pad bases (combined sinking effect)
  level.value.lotusFlowers.forEach((lotus) => {
    const lilyPadBase = level.value.obstacles.find(
      (obs) =>
        obs.type === 'lilypad-base' &&
        obs.position.x === lotus.position.x &&
        obs.position.y === lotus.position.y,
    )

    if (!lotus.isActivated || (lotus.sinkProgress || 0) < 1) {
      if (imagesLoaded) {
        drawLotusWithLilyPadSinking(ctx, lotus, lilyPadBase)
      } else {
        drawLotus(ctx, lotus)
      }
    }
  })

  // Top of reeds last (always on top)
  if (level.value.decorations && imagesLoaded) {
    level.value.decorations.forEach((decoration) => {
      if (decoration.type === 'reed') {
        drawDecorationClipped(ctx, decoration, 'top')
      }
    })
  }

  // Protected zones (subtle)
  level.value.lotusFlowers.forEach((lotus) => {
    if (lotus.isActivated) return

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
    ctx.lineWidth = 1
    ctx.setLineDash([5, 5])
    ctx.beginPath()
    ctx.arc(lotus.position.x, lotus.position.y, lotus.protectedRadius, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
  })

  ripples.forEach((ripple) => {
    drawRipple(ctx, ripple)
  })
}

function drawWaterSurface(ctx, width, height) {
  // Subtle animated waves on the surface
  ctx.globalAlpha = 0.03

  for (let i = 0; i < 3; i++) {
    const offset = i * 80
    const waveY = Math.sin(animationTime * 0.8 + offset) * 3

    ctx.beginPath()
    for (let x = 0; x < width; x += 10) {
      const y = height / 3 + Math.sin(x * 0.02 + animationTime + offset) * 15 + waveY
      if (x === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    }
    ctx.lineTo(width, height)
    ctx.lineTo(0, height)
    ctx.closePath()
    ctx.fillStyle = '#3a9aba'
    ctx.fill()
  }

  ctx.globalAlpha = 1.0
}

function drawRipple(ctx, ripple) {
  const color = getRippleColor(ripple.radius)

  const ringCount = 3 + Math.floor(Math.random() * 2)

  for (let ring = 0; ring < ringCount; ring++) {
    const ringOffset = ring * ripple.ringSpacing
    const currentRadius = ripple.radius - ringOffset

    if (currentRadius <= 0) continue

    const ringPower = calculateRipplePower(currentRadius, ripple.peakRadius, ripple.peakPower)
    const ringAlpha = (1 - ring / ringCount) * ringPower

    if (ringAlpha <= 0.05) continue

    ctx.save()
    ctx.beginPath()

    const segments = 32
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2

      // Each ripple wobbles with its own frequency/amplitude/phase
      const wobble1 =
        Math.sin(angle * ripple.wobbleFreq + animationTime * 3 + ripple.phaseOffset) * ripple.wobbleAmp
      const wobble2 =
        Math.cos(angle * (ripple.wobbleFreq * 0.7) + animationTime * 2.5) * (ripple.wobbleAmp * 0.6)

      const distortedRadius = currentRadius + wobble1 + wobble2

      const asymmetry = Math.sin(angle * 2 + ripple.phaseOffset) * (ripple.wobbleAmp * 0.3)

      const x = ripple.origin.x + Math.cos(angle) * (distortedRadius + asymmetry)
      const y = ripple.origin.y + Math.sin(angle) * (distortedRadius + asymmetry)

      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    }

    ctx.closePath()

    const glowVariation = 0.8 + Math.sin(animationTime * 2 + ring + ripple.phaseOffset) * 0.2
    ctx.shadowBlur = ripple.glowIntensity * ringPower * glowVariation
    ctx.shadowColor = color

    const rgbaColor = color.replace(')', `, ${ringAlpha})`)
    ctx.strokeStyle = rgbaColor
    const lineWidthVariation = 0.9 + Math.sin(animationTime + ring * 0.5) * 0.1
    ctx.lineWidth = ripple.lineWidth * (1 - (ring / ringCount) * 0.5) * lineWidthVariation
    ctx.stroke()

    ctx.shadowBlur = 0
    ctx.restore()
  }
}

function drawObstacle(ctx, obstacle) {
  const { x, y } = obstacle.position

  if (obstacle.type === 'stone') {
    ctx.beginPath()
    ctx.arc(x, y, obstacle.radius, 0, Math.PI * 2)

    const gradient = ctx.createRadialGradient(
      x - obstacle.radius * 0.3,
      y - obstacle.radius * 0.3,
      0,
      x,
      y,
      obstacle.radius,
    )
    gradient.addColorStop(0, '#999999')
    gradient.addColorStop(1, '#444444')
    ctx.fillStyle = gradient
    ctx.fill()

    ctx.strokeStyle = '#222222'
    ctx.lineWidth = 2
    ctx.stroke()
  } else if (obstacle.type === 'lilypad' || obstacle.type === 'lilypad-base') {
    ctx.beginPath()
    ctx.arc(x, y, obstacle.radius, 0, Math.PI * 2)
    ctx.fillStyle = '#2d5016'
    ctx.fill()

    ctx.strokeStyle = '#1a3009'
    ctx.lineWidth = 2
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(x, y - obstacle.radius)
    ctx.lineTo(x, y + obstacle.radius)
    ctx.strokeStyle = '#1a3009'
    ctx.lineWidth = 1
    ctx.stroke()
  }
}

function drawObstacleImage(ctx, obstacle) {
  const { x, y } = obstacle.position
  let img

  if (obstacle.type === 'stone') {
    img = loadedImages.rocks[obstacle.imageIndex]
  } else if (obstacle.type === 'lilypad' || obstacle.type === 'lilypad-base') {
    img = loadedImages.lilyPads[obstacle.imageIndex]
  }

  if (!img || !img.complete) {
    drawObstacle(ctx, obstacle)
    return
  }

  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(obstacle.rotation)
  ctx.scale(obstacle.scale, obstacle.scale)

  const imgSize = obstacle.radius * 2
  ctx.drawImage(img, -imgSize / 2, -imgSize / 2, imgSize, imgSize)

  ctx.restore()
}

function drawObstacleImageWithDisplacement(ctx, obstacle) {
  // Stones don't move with waves
  if (obstacle.type === 'stone') {
    drawObstacleImage(ctx, obstacle)
    return
  }

  // Smooth wave displacement with circular motion
  let displacement = { x: 0, y: 0 }
  let totalRotation = 0

  ripples.forEach((ripple) => {
    const dist = distance(ripple.origin, obstacle.position)

    if (dist < ripple.radius + 80 && dist > ripple.radius - 80) {
      const power = calculateRipplePower(ripple.radius, ripple.peakRadius, ripple.peakPower)
      const angle = Math.atan2(
        obstacle.position.y - ripple.origin.y,
        obstacle.position.x - ripple.origin.x,
      )

      const distFromEdge = Math.abs(dist - ripple.radius)
      const proximityFactor = 1 - distFromEdge / 80

      // Circular bob as the wave passes under
      const wavePhase = (dist - ripple.radius) / 20
      const verticalMove = Math.sin(wavePhase) * power * proximityFactor * 4
      const horizontalMove = Math.cos(wavePhase) * power * proximityFactor * 2

      const moveAmount = power * proximityFactor * (obstacle.type === 'lilypad-base' ? 2 : 1.5)
      displacement.x += Math.cos(angle) * moveAmount + horizontalMove
      displacement.y += Math.sin(angle) * moveAmount + verticalMove

      totalRotation += Math.sin(wavePhase) * power * proximityFactor * 0.05
    }
  })

  const { x, y } = obstacle.position
  let img

  if (obstacle.type === 'lilypad' || obstacle.type === 'lilypad-base') {
    img = loadedImages.lilyPads[obstacle.imageIndex]
  }

  if (!img || !img.complete) {
    drawObstacle(ctx, obstacle)
    return
  }

  ctx.save()
  ctx.translate(x + displacement.x, y + displacement.y)
  ctx.rotate(obstacle.rotation + totalRotation)
  ctx.scale(obstacle.scale, obstacle.scale)

  const imgSize = obstacle.radius * 2
  ctx.drawImage(img, -imgSize / 2, -imgSize / 2, imgSize, imgSize)

  ctx.restore()
}

function drawLotusWithLilyPadSinking(ctx, lotus, lilyPadBase) {
  const { x, y } = lotus.position
  const flowerImg = loadedImages.flowers[lotus.imageIndex]
  const lilyPadImg = lilyPadBase && loadedImages.lilyPads[lilyPadBase.imageIndex]

  if (!flowerImg || !flowerImg.complete) {
    drawLotus(ctx, lotus)
    return
  }

  const sinkProgress = lotus.sinkProgress || 0

  // Wave displacement (only while floating)
  let displacement = { x: 0, y: 0 }
  let totalRotation = 0

  if (!lotus.isActivated || sinkProgress < 0.1) {
    ripples.forEach((ripple) => {
      const dist = distance(ripple.origin, lotus.position)

      if (dist < ripple.radius + 80 && dist > ripple.radius - 80) {
        const power = calculateRipplePower(ripple.radius, ripple.peakRadius, ripple.peakPower)
        const angle = Math.atan2(lotus.position.y - ripple.origin.y, lotus.position.x - ripple.origin.x)

        const distFromEdge = Math.abs(dist - ripple.radius)
        const proximityFactor = 1 - distFromEdge / 80

        const wavePhase = (dist - ripple.radius) / 20
        const verticalMove = Math.sin(wavePhase) * power * proximityFactor * 3
        const horizontalMove = Math.cos(wavePhase) * power * proximityFactor * 1.5

        const moveAmount = power * proximityFactor * 1.5

        const displacementFactor = lotus.isActivated ? 1 - sinkProgress * 10 : 1
        displacement.x += (Math.cos(angle) * moveAmount + horizontalMove) * displacementFactor
        displacement.y += (Math.sin(angle) * moveAmount + verticalMove) * displacementFactor

        totalRotation += Math.sin(wavePhase) * power * proximityFactor * 0.08 * displacementFactor
      }
    })
  }

  // Power glow while charging up
  if (!lotus.isActivated && lotus.currentPower > 0) {
    const glowIntensity = Math.min(lotus.currentPower / lotus.activationThreshold, 1)
    ctx.shadowBlur = 20 * glowIntensity
    const glowColor = waterColors.value.gradientStart
    const r = parseInt(glowColor.slice(1, 3), 16)
    const g = parseInt(glowColor.slice(3, 5), 16)
    const b = parseInt(glowColor.slice(5, 7), 16)
    ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${glowIntensity * 0.6})`
  }

  // Splash rings right after activation
  if (lotus.isActivated && sinkProgress < 0.3) {
    ctx.save()
    const splashAlpha = 0.8 * (1 - sinkProgress / 0.3)

    const splashColor = waterColors.value.gradientStart
    const r = parseInt(splashColor.slice(1, 3), 16)
    const g = parseInt(splashColor.slice(3, 5), 16)
    const b = parseInt(splashColor.slice(5, 7), 16)

    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${splashAlpha})`
    ctx.lineWidth = 3
    const splashRadius = 40 + sinkProgress * 60
    ctx.beginPath()
    ctx.arc(x, y, splashRadius, 0, Math.PI * 2)
    ctx.stroke()

    const innerR = Math.min(255, r + 50)
    const innerG = Math.min(255, g + 20)
    const innerB = Math.min(255, b + 55)
    ctx.strokeStyle = `rgba(${innerR}, ${innerG}, ${innerB}, ${splashAlpha * 0.6})`
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(x, y, splashRadius * 0.6, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  // Lily pad base
  if (lilyPadBase && lilyPadImg && lilyPadImg.complete) {
    ctx.save()
    ctx.translate(x + displacement.x, y + displacement.y)
    ctx.rotate(lilyPadBase.rotation + totalRotation)
    ctx.scale(lilyPadBase.scale, lilyPadBase.scale)

    if (lotus.isActivated && sinkProgress > 0) {
      ctx.globalAlpha = 1 - sinkProgress
      const shrinkScale = 1 - sinkProgress * 0.3
      ctx.scale(shrinkScale, shrinkScale)
    }

    const lilyPadSize = lilyPadBase.radius * 2
    ctx.drawImage(lilyPadImg, -lilyPadSize / 2, -lilyPadSize / 2, lilyPadSize, lilyPadSize)
    ctx.restore()
  }

  // Flower
  ctx.save()
  ctx.translate(x + displacement.x, y + displacement.y)
  ctx.rotate(lotus.rotation + totalRotation)
  ctx.scale(lotus.scale, lotus.scale)

  if (lotus.isActivated && sinkProgress > 0) {
    ctx.globalAlpha = 1 - sinkProgress
    const shrinkScale = 1 - sinkProgress * 0.3
    ctx.scale(shrinkScale, shrinkScale)
  }

  const flowerSize = 60
  ctx.drawImage(flowerImg, -flowerSize / 2, -flowerSize / 2, flowerSize, flowerSize)
  ctx.restore()

  // Water closing in over the sinking flower
  if (lotus.isActivated && sinkProgress > 0.1 && sinkProgress < 1) {
    ctx.save()
    ctx.translate(x, y)

    const maxRadius = 70
    const waterRadius = maxRadius * sinkProgress

    const waterAlpha = Math.min(0.6, sinkProgress * 0.6)
    const baseColor = waterColors.value.gradientMid
    const r = parseInt(baseColor.slice(1, 3), 16)
    const g = parseInt(baseColor.slice(3, 5), 16)
    const b = parseInt(baseColor.slice(5, 7), 16)
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${waterAlpha})`
    ctx.beginPath()
    ctx.arc(0, 0, waterRadius, 0, Math.PI * 2)
    ctx.fill()

    const edgeColor = waterColors.value.gradientStart
    const r2 = parseInt(edgeColor.slice(1, 3), 16)
    const g2 = parseInt(edgeColor.slice(3, 5), 16)
    const b2 = parseInt(edgeColor.slice(5, 7), 16)
    ctx.strokeStyle = `rgba(${r2}, ${g2}, ${b2}, ${0.7 * sinkProgress})`
    ctx.lineWidth = 2
    ctx.shadowBlur = 6
    ctx.shadowColor = `rgba(${r2}, ${g2}, ${b2}, 0.5)`

    ctx.beginPath()
    const segments = 24
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2
      const wave = Math.sin(i * 0.7 + animationTime * 5) * 1.5
      const rr = waterRadius + wave
      const xPos = Math.cos(angle) * rr
      const yPos = Math.sin(angle) * rr

      if (i === 0) {
        ctx.moveTo(xPos, yPos)
      } else {
        ctx.lineTo(xPos, yPos)
      }
    }
    ctx.closePath()
    ctx.stroke()

    ctx.restore()
  }

  ctx.shadowBlur = 0
}

function drawLotus(ctx, lotus) {
  const { x, y } = lotus.position
  const size = 30

  if (lotus.isActivated) {
    ctx.shadowBlur = 30
    ctx.shadowColor = 'rgba(255, 215, 0, 0.8)'
  } else if (lotus.currentPower > 0) {
    const glowIntensity = Math.min(lotus.currentPower / lotus.activationThreshold, 1)
    ctx.shadowBlur = 20 * glowIntensity
    const glowColor = waterColors.value.gradientStart
    const r = parseInt(glowColor.slice(1, 3), 16)
    const g = parseInt(glowColor.slice(3, 5), 16)
    const b = parseInt(glowColor.slice(5, 7), 16)
    ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${glowIntensity * 0.6})`
  }

  const petalCount = 8
  let petalColor = lotus.isActivated ? '#FFD700' : '#FFB6C1'

  if (!lotus.isActivated && lotus.currentPower > 0) {
    const powerRatio = Math.min(lotus.currentPower / lotus.activationThreshold, 1)
    const r = Math.floor(255 * (1 - powerRatio * 0.3))
    const g = Math.floor(182 + 73 * powerRatio)
    const b = Math.floor(193 + 62 * powerRatio)
    petalColor = `rgb(${r}, ${g}, ${b})`
  }

  for (let i = 0; i < petalCount; i++) {
    const angle = ((Math.PI * 2) / petalCount) * i
    const px = x + Math.cos(angle) * size * 0.7
    const py = y + Math.sin(angle) * size * 0.7

    ctx.save()
    ctx.translate(px, py)
    ctx.rotate(angle)

    ctx.beginPath()
    ctx.ellipse(0, 0, size * 0.3, size * 0.5, 0, 0, Math.PI * 2)
    ctx.fillStyle = petalColor
    ctx.fill()

    ctx.restore()
  }

  ctx.beginPath()
  ctx.arc(x, y, size * 0.3, 0, Math.PI * 2)
  ctx.fillStyle = '#FFEB3B'
  ctx.fill()

  ctx.shadowBlur = 0
}

function drawDecoration(ctx, decoration) {
  const { x, y } = decoration.position
  let img

  if (decoration.type === 'reed') {
    img = loadedImages.reeds[decoration.imageIndex]
  } else if (decoration.type === 'fish') {
    img = loadedImages.fish[decoration.imageIndex]
  }

  if (!img || !img.complete) return

  ctx.save()

  if (decoration.type === 'reed') {
    ctx.globalAlpha = 0.7
  } else if (decoration.type === 'fish') {
    ctx.globalAlpha = decoration.opacity || 0.85
  }

  ctx.translate(x, y)
  ctx.rotate(decoration.rotation)
  ctx.scale(decoration.scale, decoration.scale)

  const imgSize = decoration.type === 'reed' ? 120 : 60
  ctx.drawImage(img, -imgSize / 2, -imgSize / 2, imgSize, imgSize)

  ctx.restore()
}

function drawDecorationClipped(ctx, decoration, half) {
  const { x, y } = decoration.position
  let img

  if (decoration.type === 'reed') {
    img = loadedImages.reeds[decoration.imageIndex]
  } else if (decoration.type === 'fish') {
    img = loadedImages.fish[decoration.imageIndex]
  }

  if (!img || !img.complete) return

  // Reeds sway gently as wavefronts pass
  let displacement = { x: 0, y: 0 }
  let totalRotation = 0

  if (decoration.type === 'reed') {
    ripples.forEach((ripple) => {
      const dist = distance(ripple.origin, decoration.position)

      if (dist < ripple.radius + 80 && dist > ripple.radius - 80) {
        const power = calculateRipplePower(ripple.radius, ripple.peakRadius, ripple.peakPower)
        const angle = Math.atan2(
          decoration.position.y - ripple.origin.y,
          decoration.position.x - ripple.origin.x,
        )

        const distFromEdge = Math.abs(dist - ripple.radius)
        const proximityFactor = 1 - distFromEdge / 80

        const wavePhase = (dist - ripple.radius) / 20
        const verticalMove = Math.sin(wavePhase) * power * proximityFactor * 2
        const horizontalMove = Math.cos(wavePhase) * power * proximityFactor * 1

        const moveAmount = power * proximityFactor * 0.8
        displacement.x += Math.cos(angle) * moveAmount + horizontalMove
        displacement.y += Math.sin(angle) * moveAmount + verticalMove

        totalRotation += Math.sin(wavePhase) * power * proximityFactor * 0.06
      }
    })
  }

  ctx.save()

  if (decoration.type === 'fish') {
    ctx.globalAlpha = 0.85
  }

  ctx.translate(x + displacement.x, y + displacement.y)
  ctx.rotate(decoration.rotation + totalRotation)
  ctx.scale(decoration.scale, decoration.scale)

  const imgSize = decoration.type === 'reed' ? 120 : 60

  // Clip to top 75% / bottom 25% so lily pads can drift over a reed's base
  // while its stalk stays in front
  ctx.beginPath()
  if (half === 'bottom') {
    ctx.rect(-imgSize / 2, imgSize / 4, imgSize, imgSize / 4)
  } else {
    ctx.rect(-imgSize / 2, -imgSize / 2, imgSize, imgSize * 0.75)
  }
  ctx.clip()

  ctx.drawImage(img, -imgSize / 2, -imgSize / 2, imgSize, imgSize)

  ctx.restore()
}

function distance(p1, p2) {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  return Math.sqrt(dx * dx + dy * dy)
}

// Distance from a point to a line segment
function pointToLineDistance(point, lineStart, lineEnd) {
  const dx = lineEnd.x - lineStart.x
  const dy = lineEnd.y - lineStart.y
  const lengthSquared = dx * dx + dy * dy

  if (lengthSquared === 0) return distance(point, lineStart)

  const t = Math.max(
    0,
    Math.min(1, ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSquared),
  )

  const closestPoint = {
    x: lineStart.x + t * dx,
    y: lineStart.y + t * dy,
  }

  return distance(point, closestPoint)
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
  initLevel()
}

function nextLevel() {
  haptics.light()
  showWinDialog.value = false
  currentLevel.value++
  initLevel()
}

function retryLevel() {
  haptics.light()
  showLoseDialog.value = false
  initLevel()
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
