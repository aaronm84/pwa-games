<template>
  <q-page class="gems-page" :style="{ background: themeStore.colors.gradient }">
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
        :style="{ '--n': N }"
        @pointerdown="onDown"
        @pointermove="onMove"
        @pointerup="onUp"
        @pointercancel="onUp"
      >
        <div
          v-for="g in gems"
          :key="g.id"
          class="gem"
          :class="{ sel: selectedId === g.id, spawn: g.spawn, clearing: g.clearing }"
          :style="{ '--r': g.row, '--c': g.col }"
        >
          <span class="disc" :style="{ background: COLORS[g.color] }">
            <span v-if="g.type === 'bomb'" class="sym">★</span>
            <span v-else-if="g.type !== 'normal'" class="sym">✛</span>
          </span>
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

    <p class="hint">Swap neighbours to line up 3+ · match 4 for a ✛ blast, 5 for a ★ bomb</p>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useThemeStore } from 'src/stores/theme'
import { useProgressStore } from 'src/stores/progress'
import { useHaptics } from 'src/composables/useHaptics'

const N = 8
const START_MOVES = 25
const COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22']

const router = useRouter()
const themeStore = useThemeStore()
const progressStore = useProgressStore()
const { gems: stats } = storeToRefs(progressStore)
const haptics = useHaptics()

const boardEl = ref(null)
const gems = ref([])
const score = ref(0)
const movesLeft = ref(START_MOVES)
const gameOver = ref(false)
const selectedId = ref(null)

let nextId = 1
let busy = false
let dragStart = null

const bestScore = computed(() => Math.max(stats.value.bestScore, score.value))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const randColor = () => Math.floor(Math.random() * COLORS.length)

function gemAt(r, c) {
  return gems.value.find((g) => g.row === r && g.col === c) || null
}
function buildGrid() {
  const grid = Array.from({ length: N }, () => Array(N).fill(null))
  for (const g of gems.value) grid[g.row][g.col] = g
  return grid
}

// ---------- setup ----------
function fillBoard() {
  gems.value = []
  nextId = 1
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      let color
      do {
        color = randColor()
      } while (
        (c >= 2 && gemAt(r, c - 1)?.color === color && gemAt(r, c - 2)?.color === color) ||
        (r >= 2 && gemAt(r - 1, c)?.color === color && gemAt(r - 2, c)?.color === color)
      )
      gems.value.push({ id: nextId++, color, type: 'normal', row: r, col: c, spawn: false, clearing: false })
    }
  }
  if (!hasMove()) fillBoard()
}

function newGame() {
  haptics.light()
  score.value = 0
  movesLeft.value = START_MOVES
  gameOver.value = false
  selectedId.value = null
  busy = false
  fillBoard()
}

// ---------- matching ----------
function findRuns() {
  const grid = buildGrid()
  const runs = []
  // horizontal
  for (let r = 0; r < N; r++) {
    let run = [grid[r][0]]
    for (let c = 1; c <= N; c++) {
      const g = c < N ? grid[r][c] : null
      if (g && run[0] && g.color === run[0].color) run.push(g)
      else {
        if (run.length >= 3 && run[0]) runs.push({ cells: run.slice(), dir: 'h' })
        run = [g]
      }
    }
  }
  // vertical
  for (let c = 0; c < N; c++) {
    let run = [grid[0][c]]
    for (let r = 1; r <= N; r++) {
      const g = r < N ? grid[r][c] : null
      if (g && run[0] && g.color === run[0].color) run.push(g)
      else {
        if (run.length >= 3 && run[0]) runs.push({ cells: run.slice(), dir: 'v' })
        run = [g]
      }
    }
  }
  return runs
}

function hasMove() {
  // try every adjacent swap on a value grid, look for any 3-run
  const grid = buildGrid()
  const col = (r, c) => grid[r][c]?.color
  const makesMatch = () => {
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++) {
        const v = grid[r][c]?.color
        if (v == null) continue
        if (c <= N - 3 && col(r, c + 1) === v && col(r, c + 2) === v) return true
        if (r <= N - 3 && col(r + 1, c) === v && col(r + 2, c) === v) return true
      }
    return false
  }
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      for (const [dr, dc] of [[0, 1], [1, 0]]) {
        const nr = r + dr
        const nc = c + dc
        if (nr >= N || nc >= N) continue
        const a = grid[r][c]
        const b = grid[nr][nc]
        if (!a || !b) continue
        ;[grid[r][c], grid[nr][nc]] = [b, a]
        const ok = makesMatch()
        ;[grid[r][c], grid[nr][nc]] = [a, b]
        if (ok) return true
      }
    }
  }
  return false
}

// ---------- swap + resolve ----------
function adjacent(a, b) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1
}

async function trySwap(a, b) {
  if (busy || !a || !b || !adjacent(a, b)) return
  busy = true
  selectedId.value = null
  // swap positions
  ;[a.row, b.row] = [b.row, a.row]
  ;[a.col, b.col] = [b.col, a.col]
  await sleep(160)

  if (findRuns().length === 0) {
    // invalid: swap back
    ;[a.row, b.row] = [b.row, a.row]
    ;[a.col, b.col] = [b.col, a.col]
    haptics.warning()
    await sleep(160)
    busy = false
    return
  }

  movesLeft.value--
  haptics.light()
  await resolveCascades(new Set([a.id, b.id]))

  if (movesLeft.value <= 0) {
    gameOver.value = true
    progressStore.recordGemsGame(score.value)
  } else if (!hasMove()) {
    // reshuffle if stuck
    reshuffle()
  }
  busy = false
}

function reshuffle() {
  for (const g of gems.value) {
    if (g.type === 'normal') g.color = randColor()
  }
  if (!hasMove()) reshuffle()
}

async function resolveCascades(swapIds) {
  let combo = 0
  for (;;) {
    const runs = findRuns()
    if (runs.length === 0) break
    combo++

    const clear = new Set()
    const conversions = [] // { id, type }
    for (const run of runs) {
      for (const g of run.cells) clear.add(g.id)
      if (run.cells.length >= 5) {
        const cell = run.cells.find((g) => swapIds.has(g.id)) || run.cells[Math.floor(run.cells.length / 2)]
        conversions.push({ id: cell.id, type: 'bomb', color: cell.color })
      } else if (run.cells.length === 4) {
        const cell = run.cells.find((g) => swapIds.has(g.id)) || run.cells[Math.floor(run.cells.length / 2)]
        conversions.push({ id: cell.id, type: 'blast', color: cell.color })
      }
    }

    // expand specials that are being cleared
    expandSpecials(clear)

    // protect converted cells from clearing
    for (const cv of conversions) clear.delete(cv.id)

    // score
    score.value += clear.size * 10 * combo
    haptics.medium()

    // apply conversions
    for (const cv of conversions) {
      const g = gems.value.find((x) => x.id === cv.id)
      if (g) g.type = cv.type
    }

    // mark + remove cleared
    for (const g of gems.value) if (clear.has(g.id)) g.clearing = true
    await sleep(140)
    gems.value = gems.value.filter((g) => !clear.has(g.id))

    applyGravity()
    await sleep(180)
    swapIds = new Set() // only the first cascade uses the swapped cells
  }
}

function expandSpecials(clear) {
  let changed = true
  while (changed) {
    changed = false
    for (const g of gems.value) {
      if (!clear.has(g.id) || g.type === 'normal') continue
      if (g._expanded) continue
      g._expanded = true
      changed = true
      if (g.type === 'blast') {
        for (const o of gems.value) if (o.row === g.row || o.col === g.col) clear.add(o.id)
      } else if (g.type === 'bomb') {
        for (const o of gems.value) if (o.color === g.color) clear.add(o.id)
      }
    }
  }
  for (const g of gems.value) delete g._expanded
}

function applyGravity() {
  for (let c = 0; c < N; c++) {
    const col = gems.value.filter((g) => g.col === c).sort((a, b) => a.row - b.row)
    const count = col.length
    col.forEach((g, i) => {
      g.row = N - count + i
      g.spawn = false
    })
    for (let r = 0; r < N - count; r++) {
      gems.value.push({ id: nextId++, color: randColor(), type: 'normal', row: r, col: c, spawn: true, clearing: false })
    }
  }
  setTimeout(() => gems.value.forEach((g) => (g.spawn = false)), 200)
}

// ---------- input ----------
function cellFromPoint(e) {
  const el = boardEl.value
  if (!el) return null
  const rect = el.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null
  const c = Math.min(N - 1, Math.max(0, Math.floor((x / rect.width) * N)))
  const r = Math.min(N - 1, Math.max(0, Math.floor((y / rect.height) * N)))
  return gemAt(r, c)
}
function onDown(e) {
  if (busy || gameOver.value) return
  const g = cellFromPoint(e)
  if (!g) return
  dragStart = g
  const sel = selectedId.value ? gems.value.find((x) => x.id === selectedId.value) : null
  if (sel && sel.id !== g.id && adjacent(sel, g)) {
    trySwap(sel, g)
  } else {
    selectedId.value = g.id
  }
}
function onMove(e) {
  if (busy || !dragStart) return
  e.preventDefault()
  const g = cellFromPoint(e)
  if (g && g.id !== dragStart.id && adjacent(dragStart, g)) {
    const a = dragStart
    dragStart = null
    trySwap(a, g)
  }
}
function onUp() {
  dragStart = null
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
.gems-page {
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
  width: min(94vw, 64vh, 460px);
  aspect-ratio: 1;
  touch-action: none;
  user-select: none;
}
.gem {
  position: absolute;
  width: calc(100% / var(--n));
  height: calc(100% / var(--n));
  left: calc(var(--c) * 100% / var(--n));
  top: calc(var(--r) * 100% / var(--n));
  display: flex;
  align-items: center;
  justify-content: center;
  transition: top 0.18s ease-in, left 0.16s ease;
}
.disc {
  width: 80%;
  height: 80%;
  border-radius: 26%;
  box-shadow: inset 0 -3px 6px rgba(0, 0, 0, 0.25), 0 2px 4px rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.12s ease;
}
.sym {
  color: rgba(255, 255, 255, 0.95);
  font-size: clamp(0.8rem, 4vw, 1.3rem);
  font-weight: 800;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
}
.gem.sel .disc {
  transform: scale(0.86);
  outline: 3px solid #fff;
  outline-offset: 1px;
}
.gem.spawn .disc {
  animation: pop 0.2s ease;
}
.gem.clearing .disc {
  animation: clear 0.16s ease forwards;
}
@keyframes pop {
  0% { transform: scale(0.2); }
  100% { transform: scale(1); }
}
@keyframes clear {
  0% { transform: scale(1); opacity: 1; }
  100% { transform: scale(0.1); opacity: 0; }
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
  background: linear-gradient(135deg, #9b59b6 0%, #e74c3c 100%) !important;
}
</style>
