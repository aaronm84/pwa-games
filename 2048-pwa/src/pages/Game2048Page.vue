<template>
  <q-page class="game-2048-page" :style="{ background: themeStore.colors.gradient }">
    <!-- Header -->
    <div class="game-header">
      <q-btn fab-mini flat icon="arrow_back" color="white" @click="goBack" />

      <div class="scores">
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
        <q-btn
          fab-mini
          flat
          icon="more_vert"
          color="white"
          :class="['menu-button', { 'menu-button-active': showMenu }]"
          @click="toggleMenu"
        />
        <transition-group
          name="menu-fade"
          tag="div"
          :class="['menu-buttons-container', { 'has-items': showMenu }]"
        >
          <q-btn
            v-if="showMenu"
            key="new"
            fab-mini
            flat
            icon="refresh"
            color="white"
            class="menu-item"
            @click="newGame"
          />
          <q-btn
            v-if="showMenu"
            key="undo"
            fab-mini
            flat
            icon="undo"
            color="white"
            class="menu-item"
            :disable="!canUndo"
            @click="undo"
          />
          <q-btn
            v-if="showMenu"
            key="help"
            fab-mini
            flat
            icon="help_outline"
            color="white"
            class="menu-item"
            @click="howToPlay"
          />
        </transition-group>
      </div>
    </div>

    <!-- Board -->
    <div class="board-wrap">
      <div
        ref="boardEl"
        class="board"
        @touchstart.passive="onTouchStart"
        @touchend="onTouchEnd"
      >
        <!-- Background cells -->
        <div
          v-for="cell in cells"
          :key="'bg-' + cell"
          class="cell"
          :style="cellStyle(cell)"
        ></div>

        <!-- Tiles -->
        <div
          v-for="tile in tiles"
          :key="tile.id"
          class="tile"
          :class="[
            tileClass(tile.value),
            { 'tile-merged': tile.justMerged, 'tile-new': tile.spawned },
          ]"
          :style="{ '--row': tile.row, '--col': tile.col }"
        >
          <span class="tile-inner">{{ tile.value }}</span>
        </div>

        <!-- Win / Game over overlay -->
        <transition name="overlay-fade">
          <div v-if="showOverlay" class="board-overlay">
            <div class="overlay-text">{{ won && !keepPlaying ? 'You win!' : 'Game over' }}</div>
            <div class="overlay-actions">
              <q-btn
                v-if="won && !keepPlaying"
                unelevated
                color="primary"
                text-color="white"
                label="Keep going"
                @click="continuePlaying"
              />
              <q-btn unelevated color="primary" text-color="white" label="New Game" @click="newGame" />
            </div>
          </div>
        </transition>
      </div>
    </div>

    <p class="hint">{{ isTouch ? 'Swipe to move the tiles' : 'Use the arrow keys (or WASD) to move' }}</p>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useThemeStore } from 'src/stores/theme'
import { useProgressStore } from 'src/stores/progress'
import { useHaptics } from 'src/composables/useHaptics'

const SIZE = 4
const TARGET = 2048
const SAVE_KEY = '2048-game-state'
const SLIDE_MS = 110

const router = useRouter()
const themeStore = useThemeStore()
const progressStore = useProgressStore()
const { game2048: stats } = storeToRefs(progressStore)
const haptics = useHaptics()

const boardEl = ref(null)
const cells = SIZE * SIZE
const tiles = ref([])
const score = ref(0)
const won = ref(false)
const keepPlaying = ref(false)
const gameOver = ref(false)
const showMenu = ref(false)
const isAnimating = ref(false)
let queuedMove = null // one buffered input, replayed when the slide finishes
const previous = ref(null)

let nextId = 1
const isTouch = ref(false)

const bestScore = computed(() => Math.max(stats.value.bestScore, score.value))
const canUndo = computed(() => !!previous.value)
const showOverlay = computed(() => gameOver.value || (won.value && !keepPlaying.value))

// --- layout helpers ---
function cellStyle(index) {
  const i = index - 1
  return { '--row': Math.floor(i / SIZE), '--col': i % SIZE }
}

function tileClass(value) {
  if (value > TARGET) return 'tile-super'
  return `tile-${value}`
}

// --- grid helpers ---
function buildGrid() {
  const g = Array.from({ length: SIZE }, () => Array(SIZE).fill(null))
  for (const t of tiles.value) g[t.row][t.col] = t
  return g
}

function emptyCells() {
  const g = buildGrid()
  const out = []
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (!g[r][c]) out.push({ row: r, col: c })
    }
  }
  return out
}

function addRandomTile(spawned = true) {
  const free = emptyCells()
  if (!free.length) return null
  const { row, col } = free[Math.floor(Math.random() * free.length)]
  const value = Math.random() < 0.9 ? 2 : 4
  const tile = { id: nextId++, value, row, col, justMerged: false, spawned }
  tiles.value.push(tile)
  return tile
}

function lineCells(dir) {
  // Returns an array of lines; each line is cells in travel order
  // (index 0 is nearest the wall the tiles move toward).
  const lines = []
  for (let a = 0; a < SIZE; a++) {
    const line = []
    for (let b = 0; b < SIZE; b++) {
      if (dir === 'left') line.push({ row: a, col: b })
      else if (dir === 'right') line.push({ row: a, col: SIZE - 1 - b })
      else if (dir === 'up') line.push({ row: b, col: a })
      else line.push({ row: SIZE - 1 - b, col: a }) // down
    }
    lines.push(line)
  }
  return lines
}

function movesAvailable() {
  if (emptyCells().length) return true
  const g = buildGrid()
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = g[r][c]?.value
      if (c < SIZE - 1 && g[r][c + 1]?.value === v) return true
      if (r < SIZE - 1 && g[r + 1][c]?.value === v) return true
    }
  }
  return false
}

// --- the move ---
function move(dir) {
  if (showOverlay.value) return
  // buffer one input during the slide instead of dropping it
  if (isAnimating.value) {
    queuedMove = dir
    return
  }

  const before = tiles.value.map((t) => ({ id: t.id, value: t.value, row: t.row, col: t.col }))
  const beforeScore = score.value

  const g = buildGrid()
  const absorbed = [] // tiles that merge away
  const mergedSurvivors = []
  let moved = false

  for (const line of lineCells(dir)) {
    const lineTiles = line.map((cell) => g[cell.row][cell.col]).filter(Boolean)
    const survivors = []
    for (const t of lineTiles) {
      const last = survivors[survivors.length - 1]
      if (last && !last._merged && last.value === t.value) {
        last._merged = true
        absorbed.push({ tile: t, target: last })
        mergedSurvivors.push(last)
      } else {
        survivors.push(t)
      }
    }
    survivors.forEach((t, i) => {
      const cell = line[i]
      if (t.row !== cell.row || t.col !== cell.col) moved = true
      t.row = cell.row
      t.col = cell.col
    })
  }
  // Absorbed tiles slide onto their survivor's (now final) cell.
  for (const a of absorbed) {
    a.tile.row = a.target.row
    a.tile.col = a.target.col
    moved = true
  }

  if (!moved) {
    tiles.value.forEach((t) => delete t._merged)
    return
  }

  previous.value = { tiles: before, score: beforeScore, won: won.value }
  isAnimating.value = true
  haptics.light()

  // Phase 2: after the slide, collapse merges, double values, spawn, score.
  setTimeout(() => {
    const absorbedIds = new Set(absorbed.map((a) => a.tile.id))
    tiles.value = tiles.value.filter((t) => !absorbedIds.has(t.id))

    let gained = 0
    for (const s of mergedSurvivors) {
      s.value *= 2
      s._merged = false
      s.justMerged = true
      gained += s.value
    }
    if (gained) {
      score.value += gained
      haptics.medium()
    }

    const reached = mergedSurvivors.some((s) => s.value >= TARGET)
    if (reached && !won.value) {
      won.value = true
      haptics.success()
      progressStore.record2048Win()
    }

    addRandomTile()

    // clear pop/appear flags after the animation
    setTimeout(() => {
      tiles.value.forEach((t) => {
        t.justMerged = false
        t.spawned = false
      })
    }, 140)

    isAnimating.value = false

    if (!movesAvailable()) {
      gameOver.value = true
      finishGame()
    }
    progressStore.update2048Best(score.value, maxTile())
    save()

    // replay a buffered input now that the slide is done
    if (!gameOver.value && queuedMove) {
      const q = queuedMove
      queuedMove = null
      move(q)
    }
  }, SLIDE_MS)
}

function maxTile() {
  return tiles.value.reduce((m, t) => Math.max(m, t.value), 0)
}

let recorded = false
function finishGame() {
  if (recorded) return
  recorded = true
  progressStore.record2048GameOver(score.value, maxTile())
  clearSave()
}

// --- controls ---
function setup() {
  tiles.value = []
  nextId = 1
  score.value = 0
  won.value = false
  keepPlaying.value = false
  gameOver.value = false
  previous.value = null
  recorded = false
  addRandomTile(false)
  addRandomTile(false)
}

function newGame() {
  haptics.light()
  showMenu.value = false
  queuedMove = null
  isAnimating.value = false
  // A new game after moves were made counts the abandoned board as played.
  if (score.value > 0 && !gameOver.value) {
    progressStore.update2048Best(score.value, maxTile())
  }
  setup()
  save()
}

function continuePlaying() {
  keepPlaying.value = true
}

function undo() {
  if (!canUndo.value) return
  haptics.light()
  showMenu.value = false
  const prev = previous.value
  tiles.value = prev.tiles.map((t) => ({ ...t, justMerged: false, spawned: false }))
  score.value = prev.score
  won.value = prev.won
  gameOver.value = false
  recorded = false
  previous.value = null
  save()
}

function toggleMenu() {
  haptics.light()
  showMenu.value = !showMenu.value
}

function goBack() {
  haptics.light()
  router.back()
}

function howToPlay() {
  haptics.light()
  router.push({ name: 'how-to-play' })
}

// --- input: keyboard ---
const KEYS = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  a: 'left', d: 'right', w: 'up', s: 'down',
}
function onKeyDown(e) {
  const dir = KEYS[e.key]
  if (!dir) return
  e.preventDefault()
  move(dir)
}

// --- input: touch swipe ---
let touchStartX = 0
let touchStartY = 0
function onTouchStart(e) {
  isTouch.value = true
  const t = e.touches[0]
  touchStartX = t.clientX
  touchStartY = t.clientY
}
function onTouchEnd(e) {
  const t = e.changedTouches[0]
  const dx = t.clientX - touchStartX
  const dy = t.clientY - touchStartY
  const absX = Math.abs(dx)
  const absY = Math.abs(dy)
  if (Math.max(absX, absY) < 24) return // ignore taps
  // require a clear dominant axis so near-diagonal flicks don't misfire
  if (absX > absY * 1.2) move(dx > 0 ? 'right' : 'left')
  else if (absY > absX * 1.2) move(dy > 0 ? 'down' : 'up')
}

// --- persistence ---
function save() {
  try {
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        tiles: tiles.value.map((t) => ({ id: t.id, value: t.value, row: t.row, col: t.col })),
        score: score.value,
        won: won.value,
        keepPlaying: keepPlaying.value,
        nextId,
      }),
    )
  } catch {
    // ignore quota/availability errors
  }
}

function load() {
  let raw
  try {
    raw = localStorage.getItem(SAVE_KEY)
  } catch {
    return false
  }
  if (!raw) return false
  try {
    const s = JSON.parse(raw)
    if (!Array.isArray(s.tiles) || !s.tiles.length) return false
    tiles.value = s.tiles.map((t) => ({ ...t, justMerged: false, spawned: false }))
    score.value = s.score || 0
    won.value = !!s.won
    keepPlaying.value = !!s.keepPlaying
    nextId = s.nextId || tiles.value.length + 1
    gameOver.value = !movesAvailable()
    return true
  } catch {
    return false
  }
}

function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY)
  } catch {
    // ignore
  }
}

onMounted(() => {
  if (!load()) setup()
  window.addEventListener('keydown', onKeyDown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
  save()
})
</script>

<style lang="scss" scoped>
.game-2048-page {
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
  gap: 12px;
  padding: 16px;
  padding-top: max(56px, calc(env(safe-area-inset-top) + 16px));
}

.scores {
  flex: 1;
  display: flex;
  justify-content: center;
  gap: 12px;
}

.score-box {
  min-width: 84px;
  padding: 8px 14px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.22);
  backdrop-filter: blur(8px);
  text-align: center;
  color: #fff;
}

.score-label {
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.75;
}

.score-value {
  font-size: 1.35rem;
  font-weight: 700;
  line-height: 1.2;
}

// Header menu (mirrors the shared game-page pattern)
.header-menu {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}
.menu-button {
  background: transparent;
  transition: background 0.2s ease;
}
.menu-button-active {
  background: rgba(255, 255, 255, 0.15) !important;
  backdrop-filter: blur(10px);
}
.menu-buttons-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: all 0.2s ease;
  &.has-items {
    padding: 8px;
    background: rgba(0, 0, 0, 0.2);
    backdrop-filter: blur(10px);
    border-radius: 12px;
  }
}
.menu-item {
  background: rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(10px);
}
.menu-fade-enter-active {
  transition: all 0.2s ease-out;
}
.menu-fade-leave-active {
  transition: all 0.15s ease-in;
}
.menu-fade-enter-from,
.menu-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.8);
}

.board-wrap {
  width: 100%;
  display: flex;
  justify-content: center;
  padding: 8px 16px;
}

.board {
  position: relative;
  width: min(92vw, 460px);
  aspect-ratio: 1;
  border-radius: 16px;
  background: rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(6px);
  touch-action: none;
  user-select: none;
}

// Shared positioning for cells and tiles.
// 4 tiles + outer/inner gaps: tile = 21.875%, gap = 2.5%, step = 24.375%.
.cell,
.tile {
  position: absolute;
  width: 21.875%;
  height: 21.875%;
  border-radius: 10px;
  left: calc(2.5% + var(--col) * 24.375%);
  top: calc(2.5% + var(--row) * 24.375%);
}

.cell {
  background: rgba(255, 255, 255, 0.08);
}

.tile {
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  color: #776e65;
  background: #eee4da;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
  transition:
    left 0.11s ease-in-out,
    top 0.11s ease-in-out;
}

.tile-inner {
  font-size: clamp(1.3rem, 8vw, 2.4rem);
  line-height: 1;
}

// Smaller text for longer numbers
.tile-128 .tile-inner,
.tile-256 .tile-inner,
.tile-512 .tile-inner {
  font-size: clamp(1.1rem, 6.6vw, 2rem);
}
.tile-1024 .tile-inner,
.tile-2048 .tile-inner,
.tile-super .tile-inner {
  font-size: clamp(0.9rem, 5.4vw, 1.6rem);
}

// Classic 2048 palette
.tile-2 { background: #eee4da; color: #776e65; }
.tile-4 { background: #ede0c8; color: #776e65; }
.tile-8 { background: #f2b179; color: #f9f6f2; }
.tile-16 { background: #f59563; color: #f9f6f2; }
.tile-32 { background: #f67c5f; color: #f9f6f2; }
.tile-64 { background: #f65e3b; color: #f9f6f2; }
.tile-128 { background: #edcf72; color: #f9f6f2; }
.tile-256 { background: #edcc61; color: #f9f6f2; }
.tile-512 { background: #edc850; color: #f9f6f2; }
.tile-1024 { background: #edc53f; color: #f9f6f2; }
.tile-2048 { background: #edc22e; color: #f9f6f2; box-shadow: 0 0 18px rgba(237, 194, 46, 0.7); }
.tile-super { background: #3c3a32; color: #f9f6f2; }

// Spawn + merge animations
.tile-new {
  animation: tile-appear 0.14s ease;
}
.tile-merged {
  animation: tile-pop 0.16s ease;
}
@keyframes tile-appear {
  0% { transform: scale(0); }
  100% { transform: scale(1); }
}
@keyframes tile-pop {
  0% { transform: scale(1); }
  50% { transform: scale(1.16); }
  100% { transform: scale(1); }
}

.board-overlay {
  position: absolute;
  inset: 0;
  border-radius: 16px;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(3px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  z-index: 5;
}
.overlay-text {
  font-size: 2rem;
  font-weight: 800;
  color: #fff;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
}
.overlay-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
}
.overlay-fade-enter-active {
  transition: opacity 0.4s ease;
}
.overlay-fade-enter-from {
  opacity: 0;
}

.hint {
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.9rem;
  text-align: center;
  margin: 8px 16px max(16px, env(safe-area-inset-bottom));
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

:deep(.q-btn.bg-primary) {
  background: linear-gradient(135deg, #f2b179 0%, #edc22e 100%) !important;
}
</style>
