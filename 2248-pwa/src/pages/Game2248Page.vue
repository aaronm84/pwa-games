<template>
  <q-page class="game-2248-page" :style="{ background: themeStore.colors.gradient }">
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

    <!-- Result preview while connecting -->
    <div class="preview-bar">
      <transition name="pop">
        <div
          v-if="path.length >= 2"
          class="preview-chip"
          :style="{ background: tileColor(pathSum), color: tileText(pathSum) }"
        >
          {{ pathSum }}
        </div>
      </transition>
    </div>

    <!-- Board -->
    <div class="board-wrap">
      <div
        ref="boardEl"
        class="board"
        :style="{ '--cols': COLS, '--rows': ROWS }"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
      >
        <!-- Connection line -->
        <svg
          class="path-overlay"
          :viewBox="`0 0 ${COLS} ${ROWS}`"
          preserveAspectRatio="none"
        >
          <polyline
            v-if="path.length >= 2"
            :points="pathPoints"
            fill="none"
            :stroke="tileColor(pathSum)"
            stroke-width="6"
            stroke-linecap="round"
            stroke-linejoin="round"
            vector-effect="non-scaling-stroke"
            opacity="0.85"
          />
        </svg>

        <!-- Tiles -->
        <div
          v-for="tile in tiles"
          :key="tile.id"
          class="tile"
          :class="{ 'in-path': pathIds.has(tile.id), 'tile-merged': tile.justMerged, 'tile-new': tile.spawned }"
          :style="{ '--row': tile.row, '--col': tile.col }"
          :data-row="tile.row"
          :data-col="tile.col"
          :data-value="tile.value"
        >
          <div
            class="tile-face"
            :class="digitClass(tile.value)"
            :style="{ background: tileColor(tile.value), color: tileText(tile.value) }"
          >
            {{ tile.value }}
          </div>
        </div>

        <!-- Game over overlay -->
        <transition name="overlay-fade">
          <div v-if="gameOver" class="board-overlay">
            <div class="overlay-text">No moves left</div>
            <div class="overlay-sub">Score {{ score }}</div>
            <q-btn unelevated color="primary" text-color="white" label="New Game" @click="newGame" />
          </div>
        </transition>
      </div>
    </div>

    <p class="hint">Drag across touching tiles — start with two equal numbers, then keep going up</p>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useThemeStore } from 'src/stores/theme'
import { useProgressStore } from 'src/stores/progress'
import { useHaptics } from 'src/composables/useHaptics'

const COLS = 5
const ROWS = 7
const SAVE_KEY = '2248-game-state'

const router = useRouter()
const themeStore = useThemeStore()
const progressStore = useProgressStore()
const { game2248: stats } = storeToRefs(progressStore)
const haptics = useHaptics()

const boardEl = ref(null)
const tiles = ref([])
const score = ref(0)
const gameOver = ref(false)
const showMenu = ref(false)
const isAnimating = ref(false)
const previous = ref(null)

// connection path (array of tile objects)
const path = ref([])
const pathSum = ref(0)
let dragging = false
let nextId = 1

const bestScore = computed(() => Math.max(stats.value.bestScore, score.value))
const canUndo = computed(() => !!previous.value)
const pathIds = computed(() => new Set(path.value.map((t) => t.id)))
const pathPoints = computed(() =>
  path.value.map((t) => `${t.col + 0.5},${t.row + 0.5}`).join(' '),
)

// --- colours (cool teal -> indigo ramp) ---
const PALETTE = [
  '#d8f3f0', // 2
  '#b8e6e1', // 4
  '#93d8d0', // 8
  '#6fc7bd', // 16
  '#4db6ac', // 32
  '#39a99c', // 64
  '#2f8f86', // 128
  '#2a7d8c', // 256
  '#2b6f97', // 512
  '#345b9e', // 1024
  '#4b4ba3', // 2048
  '#6a3f9e', // 4096
  '#7b3f8f', // 8192
]
function expOf(v) {
  return Math.max(0, Math.round(Math.log2(v)) - 1)
}
function tileColor(v) {
  const i = expOf(v)
  return PALETTE[Math.min(i, PALETTE.length - 1)]
}
function tileText(v) {
  return v >= 32 ? '#f7fbfb' : '#23423f'
}
function digitClass(v) {
  if (v >= 1000) return 'd4'
  if (v >= 100) return 'd3'
  return ''
}

// --- grid helpers ---
function buildGrid() {
  const g = Array.from({ length: ROWS }, () => Array(COLS).fill(null))
  for (const t of tiles.value) g[t.row][t.col] = t
  return g
}
function tileAt(row, col) {
  return tiles.value.find((t) => t.row === row && t.col === col) || null
}
function spawnValue() {
  // raise the spawn floor as the board climbs, so late boards can actually get
  // stuck (tension) instead of self-healing forever with tiny tiles
  const m = maxTile()
  const r = Math.random()
  if (m >= 512) {
    if (r < 0.58) return 8
    if (r < 0.88) return 16
    return 32
  }
  if (m >= 128) {
    if (r < 0.6) return 4
    if (r < 0.9) return 8
    return 16
  }
  if (r < 0.62) return 2
  if (r < 0.9) return 4
  return 8
}

function hasMoves() {
  const g = buildGrid()
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const v = g[r][c]?.value
      if (!v) continue
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue
          const nr = r + dr
          const nc = c + dc
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue
          if (g[nr][nc]?.value === v) return true
        }
      }
    }
  }
  return false
}

function maxTile() {
  return tiles.value.reduce((m, t) => Math.max(m, t.value), 0)
}

// --- setup ---
function setup() {
  tiles.value = []
  nextId = 1
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      tiles.value.push({ id: nextId++, value: spawnValue(), row: r, col: c, justMerged: false, spawned: false })
    }
  }
  score.value = 0
  gameOver.value = false
  previous.value = null
  // Guarantee at least one move exists
  let guard = 0
  while (!hasMoves() && guard++ < 30) {
    tiles.value.forEach((t) => (t.value = spawnValue()))
  }
}

// --- connection input ---
function pointerTile(e) {
  const el = boardEl.value
  if (!el) return null
  const rect = el.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null
  const col = Math.min(COLS - 1, Math.max(0, Math.floor((x / rect.width) * COLS)))
  const row = Math.min(ROWS - 1, Math.max(0, Math.floor((y / rect.height) * ROWS)))
  return tileAt(row, col)
}

function isAdjacent(a, b) {
  return Math.abs(a.row - b.row) <= 1 && Math.abs(a.col - b.col) <= 1 && a.id !== b.id
}

function onPointerDown(e) {
  if (isAnimating.value || gameOver.value) return
  const t = pointerTile(e)
  if (!t) return
  dragging = true
  boardEl.value.setPointerCapture?.(e.pointerId)
  path.value = [t]
  pathSum.value = t.value
  haptics.light()
}

function onPointerMove(e) {
  if (!dragging) return
  e.preventDefault()
  const t = pointerTile(e)
  if (!t) return
  const last = path.value[path.value.length - 1]
  if (t.id === last.id) return

  // backtrack
  if (path.value.length >= 2 && t.id === path.value[path.value.length - 2].id) {
    path.value.pop()
    pathSum.value = path.value.reduce((s, x) => s + x.value, 0)
    haptics.light()
    return
  }
  if (pathIds.value.has(t.id)) return
  if (!isAdjacent(t, last)) return
  // The next tile must equal the running sum (gives 2,2,4,8,... chains)
  if (t.value !== pathSum.value) return

  path.value.push(t)
  pathSum.value += t.value
  haptics.light()
}

function onPointerUp() {
  if (!dragging) return
  dragging = false
  commitPath()
}

function clearPath() {
  path.value = []
  pathSum.value = 0
}

function commitPath() {
  if (path.value.length < 2) {
    clearPath()
    return
  }

  // Snapshot for undo
  previous.value = {
    tiles: tiles.value.map((t) => ({ id: t.id, value: t.value, row: t.row, col: t.col })),
    score: score.value,
  }

  const result = pathSum.value // equals the running sum (a power of two)
  const last = path.value[path.value.length - 1]
  const ids = new Set(path.value.map((t) => t.id))

  isAnimating.value = true
  haptics.medium()

  // Phase 1: remove connected tiles, drop a merged tile at the last cell
  tiles.value = tiles.value.filter((t) => !ids.has(t.id))
  tiles.value.push({ id: nextId++, value: result, row: last.row, col: last.col, justMerged: true, spawned: false })
  score.value += result
  clearPath()

  // Phase 2: gravity + refill
  setTimeout(() => {
    applyGravityAndRefill()
  }, 120)

  // Phase 3: clear flags, finish
  setTimeout(() => {
    tiles.value.forEach((t) => {
      t.justMerged = false
      t.spawned = false
    })
    isAnimating.value = false
    progressStore.update2248Best(score.value, maxTile())
    if (!hasMoves()) {
      gameOver.value = true
      progressStore.record2248GameOver(score.value, maxTile())
      clearSave()
    } else {
      save()
    }
  }, 320)
}

function applyGravityAndRefill() {
  for (let c = 0; c < COLS; c++) {
    const colTiles = tiles.value.filter((t) => t.col === c).sort((a, b) => a.row - b.row)
    const count = colTiles.length
    // Drop existing tiles to the bottom, preserving order
    colTiles.forEach((t, i) => {
      t.row = ROWS - count + i
    })
    // Fill the empty cells at the top with new tiles
    for (let r = 0; r < ROWS - count; r++) {
      tiles.value.push({ id: nextId++, value: spawnValue(), row: r, col: c, justMerged: false, spawned: true })
    }
  }
}

// --- controls ---
function newGame() {
  haptics.light()
  showMenu.value = false
  if (score.value > 0 && !gameOver.value) {
    progressStore.update2248Best(score.value, maxTile())
  }
  setup()
  save()
}

function undo() {
  if (!canUndo.value) return
  haptics.light()
  showMenu.value = false
  tiles.value = previous.value.tiles.map((t) => ({ ...t, justMerged: false, spawned: false }))
  score.value = previous.value.score
  gameOver.value = false
  previous.value = null
  // keep nextId ahead of restored ids
  nextId = Math.max(nextId, ...tiles.value.map((t) => t.id)) + 1
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

// --- persistence ---
function save() {
  try {
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        tiles: tiles.value.map((t) => ({ id: t.id, value: t.value, row: t.row, col: t.col })),
        score: score.value,
        nextId,
      }),
    )
  } catch {
    // ignore
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
    if (!Array.isArray(s.tiles) || s.tiles.length !== COLS * ROWS) return false
    tiles.value = s.tiles.map((t) => ({ ...t, justMerged: false, spawned: false }))
    score.value = s.score || 0
    nextId = s.nextId || tiles.value.length + 1
    gameOver.value = !hasMoves()
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
})
onBeforeUnmount(() => {
  if (!gameOver.value) save()
})
</script>

<style lang="scss" scoped>
.game-2248-page {
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

.preview-bar {
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.preview-chip {
  min-width: 56px;
  padding: 4px 16px;
  border-radius: 999px;
  font-weight: 800;
  font-size: 1.2rem;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}
.pop-enter-active {
  transition: transform 0.12s ease, opacity 0.12s ease;
}
.pop-enter-from {
  transform: scale(0.6);
  opacity: 0;
}

.board-wrap {
  width: 100%;
  display: flex;
  justify-content: center;
  padding: 0 16px;
}
.board {
  position: relative;
  width: min(92vw, calc(64vh * 5 / 7), 400px);
  aspect-ratio: 5 / 7;
  border-radius: 16px;
  background: rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(6px);
  padding: 0;
  touch-action: none;
  user-select: none;
}

.path-overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 3;
}

.tile {
  position: absolute;
  width: calc(100% / var(--cols));
  height: calc(100% / var(--rows));
  left: calc(var(--col) * 100% / var(--cols));
  top: calc(var(--row) * 100% / var(--rows));
  transition: left 0.13s ease-in, top 0.13s ease-in;
  padding: 3px;
}
.tile-face {
  width: 100%;
  height: 100%;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: clamp(1rem, 5.2vw, 1.7rem);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  &.d3 {
    font-size: clamp(0.85rem, 4.4vw, 1.4rem);
  }
  &.d4 {
    font-size: clamp(0.7rem, 3.6vw, 1.15rem);
  }
}
.tile.in-path .tile-face {
  outline: 3px solid rgba(255, 255, 255, 0.9);
  outline-offset: -3px;
  transform: scale(0.92);
  transition: transform 0.08s ease;
}
.tile-new .tile-face {
  animation: tile-appear 0.16s ease;
}
.tile-merged .tile-face {
  animation: tile-pop 0.18s ease;
}
@keyframes tile-appear {
  0% {
    transform: scale(0.1);
    opacity: 0.2;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}
@keyframes tile-pop {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1);
  }
}

.board-overlay {
  position: absolute;
  inset: 0;
  border-radius: 16px;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(3px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  z-index: 5;
}
.overlay-text {
  font-size: 1.8rem;
  font-weight: 800;
  color: #fff;
}
.overlay-sub {
  color: rgba(255, 255, 255, 0.85);
  margin-top: -8px;
}
.overlay-fade-enter-active {
  transition: opacity 0.4s ease;
}
.overlay-fade-enter-from {
  opacity: 0;
}

.hint {
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.85rem;
  text-align: center;
  margin: 12px 24px max(16px, env(safe-area-inset-bottom));
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

:deep(.q-btn.bg-primary) {
  background: linear-gradient(135deg, #4db6ac 0%, #345b9e 100%) !important;
}
</style>
