<template>
  <q-page class="dots-page" :style="{ background: themeStore.colors.gradient }">
    <!-- Header -->
    <div class="game-header">
      <q-btn fab-mini flat icon="arrow_back" color="white" @click="goBack" />
      <div class="scores">
        <div class="score-box">
          <div class="score-label">Moves</div>
          <div class="score-value">{{ movesLeft }}</div>
        </div>
        <div class="score-box">
          <div class="score-label">Score</div>
          <div class="score-value">{{ score }}</div>
        </div>
        <div class="score-box">
          <div class="score-label">Best</div>
          <div class="score-value">{{ bestScore }}</div>
        </div>
      </div>
      <div class="header-menu">
        <q-btn fab-mini flat icon="refresh" color="white" @click="newGame" />
        <q-btn fab-mini flat icon="help_outline" color="white" @click="howToPlay" />
      </div>
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
          <div v-if="gameOver" class="board-overlay">
            <div class="overlay-text">Out of moves</div>
            <div class="overlay-sub">Score {{ score }}{{ score >= bestScore && score > 0 ? ' · new best!' : '' }}</div>
            <q-btn unelevated color="primary" text-color="white" label="Play Again" @click="newGame" />
          </div>
        </transition>
      </div>
    </div>

    <p class="hint">Connect dots of the same colour · close a loop to clear every dot of that colour</p>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useThemeStore } from 'src/stores/theme'
import { useProgressStore } from 'src/stores/progress'
import { useHaptics } from 'src/composables/useHaptics'

const COLS = 6
const ROWS = 6
const START_MOVES = 30
const COLORS = ['#ef5350', '#42a5f5', '#66bb6a', '#ffca28', '#ab47bc']

const router = useRouter()
const themeStore = useThemeStore()
const progressStore = useProgressStore()
const { dots: stats } = storeToRefs(progressStore)
const haptics = useHaptics()

const boardEl = ref(null)
const dots = ref([])
const score = ref(0)
const movesLeft = ref(START_MOVES)
const gameOver = ref(false)

const path = ref([]) // array of dot objects
const loopFound = ref(false)
let dragging = false
let nextId = 1

const bestScore = computed(() => Math.max(stats.value.bestScore, score.value))
const pathIds = computed(() => new Set(path.value.map((d) => d.id)))
const activeStroke = computed(() => (path.value.length ? COLORS[path.value[0].color] : '#fff'))
const pathPoints = computed(() => {
  if (path.value.length < 2) return ''
  const pts = path.value.map((d) => `${d.col + 0.5},${d.row + 0.5}`)
  if (loopFound.value) pts.push(pts[0]) // close the loop
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

function newGame() {
  haptics.light()
  fillBoard()
  score.value = 0
  movesLeft.value = START_MOVES
  gameOver.value = false
  path.value = []
  loopFound.value = false
}

// pointer
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
  if (gameOver.value) return
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
  // backtrack
  if (path.value.length >= 2 && d.id === path.value[path.value.length - 2].id) {
    path.value.pop()
    return
  }
  if (d.color !== last.color) return
  if (!orthAdjacent(d, last)) return
  if (pathIds.value.has(d.id)) {
    // connecting back onto the path => closed loop
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
  if (loopFound.value) {
    toRemove = dots.value.filter((d) => d.color === color)
  } else {
    const ids = pathIds.value
    toRemove = dots.value.filter((d) => ids.has(d.id))
  }
  if (toRemove.length < 2) return

  score.value += toRemove.length + (loopFound.value ? toRemove.length : 0) // loop = double
  haptics.success()
  const removeIds = new Set(toRemove.map((d) => d.id))
  dots.value = dots.value.filter((d) => !removeIds.has(d.id))
  applyGravity()

  movesLeft.value--
  if (movesLeft.value <= 0) {
    gameOver.value = true
    progressStore.recordDotsGame(score.value)
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
  // clear spawn flags after the drop animation
  setTimeout(() => dots.value.forEach((d) => (d.spawn = false)), 200)
}

function goBack() {
  haptics.light()
  router.back()
}
function howToPlay() {
  haptics.light()
  router.push({ name: 'how-to-play' })
}

onMounted(newGame)
</script>

<style lang="scss" scoped>
.dots-page {
  min-height: 100vh;
  transition: background 2s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow: hidden;
}
.game-header {
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
  background: rgba(0, 0, 0, 0.22);
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
.header-menu {
  display: flex;
  gap: 2px;
}

.board-wrap {
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
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(3px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  z-index: 5;
}
.overlay-text {
  font-size: 2rem;
  font-weight: 800;
  color: #fff;
}
.overlay-sub {
  color: rgba(255, 255, 255, 0.85);
  margin-top: -8px;
}
.overlay-fade-enter-active {
  transition: opacity 0.35s ease;
}
.overlay-fade-enter-from {
  opacity: 0;
}
.hint {
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
