<template>
  <q-page class="dots-page">
    <DotBackground />

    <!-- Header -->
    <div class="game-header">
      <q-btn fab-mini flat icon="arrow_back" color="white" @click="goBack" />
      <div class="scores">
        <template v-if="mode === 'challenge'">
          <div class="score-box"><div class="score-label">Level</div><div class="score-value">{{ level }}</div></div>
          <div class="score-box"><div class="score-label">Moves</div><div class="score-value" :class="{ low: movesLeft <= 3 }">{{ movesLeft }}</div></div>
          <div class="score-box"><div class="score-label">Score</div><div class="score-value">{{ score }}<span class="target">/{{ target }}</span></div></div>
        </template>
        <template v-else-if="mode === 'blitz'">
          <div class="score-box"><div class="score-label">Time</div><div class="score-value" :class="{ low: timeLeft <= 10 }">{{ Math.ceil(timeLeft) }}s</div></div>
          <div class="score-box"><div class="score-label">Score</div><div class="score-value">{{ score }}</div></div>
          <div class="score-box"><div class="score-label">Best</div><div class="score-value">{{ blitzBest }}</div></div>
        </template>
        <template v-else>
          <div class="score-box"><div class="score-label">Score</div><div class="score-value">{{ score }}</div></div>
          <div class="score-box"><div class="score-label">Best</div><div class="score-value">{{ zenBest }}</div></div>
        </template>
      </div>
      <div class="header-menu">
        <q-btn fab-mini flat icon="refresh" color="white" @click="restart" />
        <q-btn fab-mini flat icon="help_outline" color="white" @click="howToPlay" />
      </div>
    </div>

    <!-- Challenge progress bar -->
    <div v-if="mode === 'challenge'" class="progress-track">
      <div class="progress-fill" :style="{ width: Math.min(100, (score / target) * 100) + '%' }"></div>
    </div>

    <!-- Board -->
    <div class="board-wrap">
      <div
        ref="boardEl"
        class="board"
        :style="{ '--cols': COLS, '--rows': ROWS }"
        @pointerdown="onDown"
        @pointermove="onMove"
        @pointerup="onUp"
        @pointercancel="onUp"
      >
        <svg class="link" :viewBox="`0 0 ${COLS} ${ROWS}`" preserveAspectRatio="none">
          <polyline
            v-if="pathPoints"
            :points="pathPoints"
            fill="none"
            :stroke="activeStroke"
            stroke-width="0.22"
            stroke-linecap="round"
            stroke-linejoin="round"
            :opacity="loopFound ? 1 : 0.8"
          />
        </svg>

        <div
          v-for="dot in dots"
          :key="dot.id"
          class="dot"
          :class="{ inpath: pathIds.has(dot.id), spawn: dot.spawn }"
          :style="{ '--r': dot.row, '--c': dot.col }"
        >
          <span class="disc" :style="{ background: COLORS[dot.color] }"></span>
        </div>

        <transition name="overlay-fade">
          <div v-if="overlay === 'levelClear'" class="board-overlay">
            <div class="overlay-text">Level {{ level }} cleared! ✨</div>
            <div class="overlay-sub">{{ score }} / {{ target }}</div>
            <q-btn unelevated color="primary" text-color="white" label="Next Level" @click="nextLevel" />
          </div>
          <div v-else-if="overlay === 'over'" class="board-overlay">
            <div class="overlay-text">{{ overText }}</div>
            <div class="overlay-sub">{{ overSub }}</div>
            <div class="overlay-actions">
              <q-btn unelevated color="primary" text-color="white" :label="mode === 'challenge' ? 'Retry Level' : 'Play Again'" @click="restart" />
              <q-btn flat color="white" label="Modes" @click="goBack" />
            </div>
          </div>
        </transition>
      </div>
    </div>

    <p class="hint">{{ hint }}</p>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useProgressStore } from 'src/stores/progress'
import { useHaptics } from 'src/composables/useHaptics'
import DotBackground from 'src/components/DotBackground.vue'

const COLS = 6
const ROWS = 6
const COLORS = ['#ef5350', '#42a5f5', '#66bb6a', '#ffca28', '#ab47bc']
const BLITZ_START = 60
const BLITZ_CAP = 90

const router = useRouter()
const route = useRoute()
const progressStore = useProgressStore()
const { dots: stats } = storeToRefs(progressStore)
const haptics = useHaptics()

const mode = ['zen', 'challenge', 'blitz'].includes(route.query.mode) ? route.query.mode : 'zen'
const startLevel = Math.max(1, parseInt(route.query.level, 10) || 1)

const boardEl = ref(null)
const dots = ref([])
const score = ref(0)
const movesLeft = ref(30)
const level = ref(startLevel)
const target = ref(0)
const timeLeft = ref(BLITZ_START)
const overlay = ref(null) // null | 'levelClear' | 'over'
const overText = ref('')
const overSub = ref('')

const path = ref([]) // array of dot objects
const loopFound = ref(false)
let dragging = false
let nextId = 1
let blitzTimer = null

const zenBest = computed(() => Math.max(stats.value.zenBest, mode === 'zen' ? score.value : 0))
const blitzBest = computed(() => Math.max(stats.value.blitzBest, mode === 'blitz' ? score.value : 0))
const hint = computed(() => {
  if (mode === 'challenge') return 'Hit the target score before you run out of moves'
  if (mode === 'blitz') return 'Connect fast — every clear adds time, loops add more!'
  return 'Relax and connect — Zen mode never ends. Close a loop to clear a colour'
})

const pathIds = computed(() => new Set(path.value.map((d) => d.id)))
const activeStroke = computed(() => (path.value.length ? COLORS[path.value[0].color] : '#fff'))
const pathPoints = computed(() => {
  if (path.value.length < 2) return ''
  const pts = path.value.map((d) => `${d.col + 0.5},${d.row + 0.5}`)
  if (loopFound.value) pts.push(pts[0])
  return pts.join(' ')
})

function dotAt(row, col) {
  return dots.value.find((d) => d.row === row && d.col === col) || null
}
function randColor() {
  return Math.floor(Math.random() * COLORS.length)
}
function fillBoard() {
  dots.value = []
  nextId = 1
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      dots.value.push({ id: nextId++, color: randColor(), row: r, col: c, spawn: false })
}

// ---------- challenge config ----------
function challengeConfig(lvl) {
  return {
    target: 60 + (lvl - 1) * 45,
    moves: Math.max(10, 18 - Math.floor((lvl - 1) / 3)),
  }
}

function startMode() {
  haptics.light()
  fillBoard()
  score.value = 0
  overlay.value = null
  path.value = []
  loopFound.value = false
  dragging = false
  stopBlitz()
  if (mode === 'challenge') {
    const cfg = challengeConfig(level.value)
    target.value = cfg.target
    movesLeft.value = cfg.moves
    progressStore.saveChallengeLevel(level.value)
  } else if (mode === 'blitz') {
    timeLeft.value = BLITZ_START
    startBlitz()
  }
}
function restart() {
  startMode()
}
function nextLevel() {
  level.value++
  startMode()
}

// ---------- blitz timer ----------
function startBlitz() {
  stopBlitz()
  blitzTimer = setInterval(() => {
    if (overlay.value) return
    timeLeft.value -= 0.1
    if (timeLeft.value <= 0) {
      timeLeft.value = 0
      endBlitz()
    }
  }, 100)
}
function stopBlitz() {
  if (blitzTimer) { clearInterval(blitzTimer); blitzTimer = null }
}
function addTime(s) {
  timeLeft.value = Math.min(BLITZ_CAP, timeLeft.value + s)
}
function endBlitz() {
  stopBlitz()
  const isBest = score.value > stats.value.blitzBest
  progressStore.recordDots('blitz', { score: score.value })
  overText.value = "Time's up!"
  overSub.value = `Score ${score.value}${isBest && score.value > 0 ? ' · new best!' : ''}`
  overlay.value = 'over'
}

// ---------- pointer ----------
function cellFromPoint(e) {
  const el = boardEl.value
  if (!el) return null
  const rect = el.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null
  const c = Math.min(COLS - 1, Math.max(0, Math.floor((x / rect.width) * COLS)))
  const r = Math.min(ROWS - 1, Math.max(0, Math.floor((y / rect.height) * ROWS)))
  return dotAt(r, c)
}
function orthAdjacent(a, b) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1
}
function onDown(e) {
  if (overlay.value) return
  const d = cellFromPoint(e)
  if (!d) return
  dragging = true
  boardEl.value.setPointerCapture?.(e.pointerId)
  path.value = [d]
  loopFound.value = false
  haptics.light()
}
function onMove(e) {
  if (!dragging || loopFound.value) return
  e.preventDefault()
  const d = cellFromPoint(e)
  if (!d) return
  const last = path.value[path.value.length - 1]
  if (d.id === last.id) return
  if (path.value.length >= 2 && d.id === path.value[path.value.length - 2].id) {
    path.value.pop()
    return
  }
  if (d.color !== last.color) return
  if (!orthAdjacent(d, last)) return
  if (pathIds.value.has(d.id)) {
    loopFound.value = true
    haptics.medium()
    return
  }
  path.value.push(d)
  haptics.light()
}
function onUp() {
  if (!dragging) return
  dragging = false
  if (path.value.length >= 2) commit()
  path.value = []
  loopFound.value = false
}

function commit() {
  const color = path.value[0].color
  let toRemove
  if (loopFound.value) toRemove = dots.value.filter((d) => d.color === color)
  else {
    const ids = pathIds.value
    toRemove = dots.value.filter((d) => ids.has(d.id))
  }
  if (toRemove.length < 2) return

  const gained = toRemove.length + (loopFound.value ? toRemove.length : 0) // loop = double
  score.value += gained
  haptics.success()
  const removeIds = new Set(toRemove.map((d) => d.id))
  dots.value = dots.value.filter((d) => !removeIds.has(d.id))
  applyGravity()

  // mode end-conditions
  if (mode === 'blitz') {
    addTime(0.5 + gained * 0.13)
  } else if (mode === 'challenge') {
    movesLeft.value--
    if (score.value >= target.value) {
      overlay.value = 'levelClear'
      haptics.success()
    } else if (movesLeft.value <= 0) {
      overText.value = 'Out of moves'
      overSub.value = `Reached ${score.value} / ${target.value}`
      overlay.value = 'over'
      haptics.error?.() || haptics.heavy()
    }
  }
}

function applyGravity() {
  for (let c = 0; c < COLS; c++) {
    const col = dots.value.filter((d) => d.col === c).sort((a, b) => a.row - b.row)
    const count = col.length
    col.forEach((d, i) => {
      d.row = ROWS - count + i
      d.spawn = false
    })
    for (let r = 0; r < ROWS - count; r++) {
      dots.value.push({ id: nextId++, color: randColor(), row: r, col: c, spawn: true })
    }
  }
  setTimeout(() => dots.value.forEach((d) => (d.spawn = false)), 200)
}

function goBack() {
  haptics.light()
  if (mode === 'zen' && score.value > 0) progressStore.recordDots('zen', { score: score.value })
  router.push({ name: 'menu' })
}
function howToPlay() {
  haptics.light()
  router.push({ name: 'how-to-play' })
}

onMounted(startMode)
onBeforeUnmount(() => {
  stopBlitz()
  if (mode === 'zen' && score.value > 0) progressStore.recordDots('zen', { score: score.value })
})
</script>

<style lang="scss" scoped>
.dots-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow: hidden;
  position: relative;
}
.game-header {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 520px;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 16px;
  padding-top: max(56px, calc(env(safe-area-inset-top) + 16px));
}
.scores {
  flex: 1;
  display: flex;
  justify-content: center;
  gap: 8px;
}
.score-box {
  min-width: 64px;
  padding: 6px 10px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(8px);
  text-align: center;
  color: #fff;
}
.score-label {
  font-size: 0.65rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  opacity: 0.75;
}
.score-value {
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.2;
}
.score-value.low { color: #ff6b6b; animation: pulse 0.8s ease-in-out infinite; }
.score-value .target { font-size: 0.85rem; opacity: 0.6; font-weight: 600; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
.header-menu {
  display: flex;
  gap: 2px;
}

.progress-track {
  position: relative;
  z-index: 1;
  width: min(92vw, 60vh, 440px);
  height: 8px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.3);
  overflow: hidden;
  margin-bottom: 2px;
}
.progress-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #42a5f5, #66bb6a);
  transition: width 0.3s ease;
}

.board-wrap {
  position: relative;
  z-index: 1;
  width: 100%;
  display: flex;
  justify-content: center;
  padding: 8px 16px;
  flex: 1;
  align-items: center;
}
.board {
  position: relative;
  width: min(92vw, 60vh, 440px);
  aspect-ratio: 1;
  touch-action: none;
  user-select: none;
}
.link {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 3;
}
.dot {
  position: absolute;
  width: calc(100% / var(--cols));
  height: calc(100% / var(--rows));
  left: calc(var(--c) * 100% / var(--cols));
  top: calc(var(--r) * 100% / var(--rows));
  display: flex;
  align-items: center;
  justify-content: center;
  transition: top 0.18s ease-in, left 0.18s ease;
}
.disc {
  width: 62%;
  height: 62%;
  border-radius: 50%;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
  transition: transform 0.12s ease;
}
.dot.inpath .disc {
  transform: scale(1.25);
  box-shadow: 0 0 12px rgba(255, 255, 255, 0.6);
}
.dot.spawn .disc {
  animation: pop 0.2s ease;
}
@keyframes pop {
  0% { transform: scale(0.2); }
  100% { transform: scale(1); }
}

.board-overlay {
  position: absolute;
  inset: 0;
  border-radius: 14px;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(3px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  z-index: 5;
}
.overlay-text {
  font-size: 1.8rem;
  font-weight: 800;
  color: #fff;
  text-align: center;
  padding: 0 14px;
}
.overlay-sub {
  color: rgba(255, 255, 255, 0.85);
  margin-top: -8px;
}
.overlay-actions { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.overlay-fade-enter-active {
  transition: opacity 0.35s ease;
}
.overlay-fade-enter-from {
  opacity: 0;
}
.hint {
  position: relative;
  z-index: 1;
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.82rem;
  text-align: center;
  margin: 12px 24px max(16px, env(safe-area-inset-bottom));
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}
:deep(.q-btn.bg-primary) {
  background: linear-gradient(135deg, #42a5f5 0%, #ab47bc 100%) !important;
}
</style>
