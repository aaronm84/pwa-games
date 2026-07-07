<template>
  <q-page class="gems-page">
    <GemBackground />

    <!-- Header -->
    <div class="game-header">
      <q-btn fab-mini flat icon="arrow_back" color="white" @click="goBack" />
      <div class="scores">
        <!-- Challenge -->
        <template v-if="mode === 'challenge'">
          <div class="score-box"><div class="score-label">Level</div><div class="score-value">{{ level }}</div></div>
          <div class="score-box"><div class="score-label">Moves</div><div class="score-value" :class="{ low: movesLeft <= 3 }">{{ movesLeft }}</div></div>
          <div class="score-box"><div class="score-label">Score</div><div class="score-value">{{ score }}<span class="target">/{{ target }}</span></div></div>
        </template>
        <!-- Blitz -->
        <template v-else-if="mode === 'blitz'">
          <div class="score-box"><div class="score-label">Time</div><div class="score-value" :class="{ low: timeLeft <= 10 }">{{ Math.ceil(timeLeft) }}s</div></div>
          <div class="score-box"><div class="score-label">Score</div><div class="score-value">{{ score }}</div></div>
          <div class="score-box"><div class="score-label">Best</div><div class="score-value">{{ blitzBest }}</div></div>
        </template>
        <!-- Zen -->
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
          <span
            class="disc"
            :class="{ bomb: g.type === 'bomb', blast: g.type === 'blast' }"
            :style="{ background: COLORS[g.color] }"
          >
            <span v-if="g.type === 'bomb'" class="sym">★</span>
            <span v-else-if="g.type !== 'normal'" class="sym">✛</span>
          </span>
        </div>

        <!-- transient activation effects -->
        <div class="fx-layer">
          <div v-for="fx in effects" :key="fx.id" class="fx" :class="fx.cls" :style="fx.style">{{ fx.text }}</div>
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
import GemBackground from 'src/components/GemBackground.vue'

const N = 8
const COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22']
const ZEN_MOVES = 25 // not used for limits; kept for reference
const BLITZ_START = 60
const BLITZ_CAP = 90

const router = useRouter()
const route = useRoute()
const progressStore = useProgressStore()
const { gems: stats } = storeToRefs(progressStore)
const haptics = useHaptics()

const mode = ['zen', 'challenge', 'blitz'].includes(route.query.mode) ? route.query.mode : 'zen'
// Challenge resumes at the level passed from the menu (Continue vs Restart)
const startLevel = Math.max(1, parseInt(route.query.level, 10) || 1)

const boardEl = ref(null)
const gems = ref([])
const score = ref(0)
const movesLeft = ref(ZEN_MOVES)
const level = ref(startLevel)
const target = ref(0)
const timeLeft = ref(BLITZ_START)
const overlay = ref(null) // null | 'levelClear' | 'over'
const overText = ref('')
const overSub = ref('')
const selectedId = ref(null)
const effects = ref([])

let nextId = 1
let fxId = 1
let busy = false
let dragStart = null
let blitzTimer = null

const zenBest = computed(() => Math.max(stats.value.zenBest, mode === 'zen' ? score.value : 0))
const blitzBest = computed(() => Math.max(stats.value.blitzBest, mode === 'blitz' ? score.value : 0))
const hint = computed(() => {
  if (mode === 'challenge') return 'Hit the target score before you run out of moves'
  if (mode === 'blitz') return 'Match fast — every clear adds time, combos add more!'
  return 'Relax and match — Zen mode never ends. Match 4 → ✛, 5 → ★'
})

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

// ---------- challenge config ----------
function challengeConfig(lvl) {
  return {
    target: 400 + (lvl - 1) * 300,
    moves: Math.max(12, 20 - Math.floor((lvl - 1) / 3)),
  }
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

function startMode() {
  haptics.light()
  score.value = 0
  overlay.value = null
  selectedId.value = null
  effects.value = []
  busy = false
  stopBlitz()
  if (mode === 'challenge') {
    const cfg = challengeConfig(level.value)
    target.value = cfg.target
    movesLeft.value = cfg.moves
    // remember this level so the player can resume it later
    progressStore.saveChallengeLevel(level.value)
  } else if (mode === 'blitz') {
    timeLeft.value = BLITZ_START
    startBlitz()
  }
  fillBoard()
}
function restart() {
  // Challenge retries the current level; Zen/Blitz start a fresh run
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
  progressStore.recordGems('blitz', { score: score.value })
  overText.value = "Time's up!"
  overSub.value = `Score ${score.value}${isBest && score.value > 0 ? ' · new best!' : ''}`
  overlay.value = 'over'
}

// ---------- matching ----------
function findRuns() {
  const grid = buildGrid()
  const runs = []
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
  ;[a.row, b.row] = [b.row, a.row]
  ;[a.col, b.col] = [b.col, a.col]
  await sleep(160)

  const special = a.type !== 'normal' || b.type !== 'normal'
  if (findRuns().length === 0 && !special) {
    ;[a.row, b.row] = [b.row, a.row]
    ;[a.col, b.col] = [b.col, a.col]
    haptics.warning()
    await sleep(160)
    busy = false
    return
  }

  const scoreBefore = score.value
  if (mode === 'challenge') movesLeft.value--
  haptics.light()
  if (special) await commitClear(detonateClearSet(a, b), 1)
  await resolveCascades(new Set([a.id, b.id]))

  // blitz: reward clears with time
  if (mode === 'blitz') {
    const delta = score.value - scoreBefore
    if (delta > 0) addTime(0.6 + delta * 0.006)
  }

  // end-of-move conditions
  if (mode === 'challenge') {
    if (score.value >= target.value) {
      overlay.value = 'levelClear'
      haptics.success()
    } else if (movesLeft.value <= 0) {
      overText.value = 'Out of moves'
      overSub.value = `Reached ${score.value} / ${target.value}`
      overlay.value = 'over'
      haptics.error?.() || haptics.heavy()
    } else if (!hasMove()) {
      reshuffle()
    }
  } else if (!hasMove()) {
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
    if (combo >= 2) {
      const c0 = runs[0].cells[0]
      spawnCombo(combo, c0.row, c0.col)
    }

    const clear = new Set()
    const conversions = []
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

    expandSpecials(clear)
    for (const cv of conversions) clear.delete(cv.id)

    score.value += clear.size * 10 * combo
    haptics.medium()

    for (const cv of conversions) {
      const g = gems.value.find((x) => x.id === cv.id)
      if (g) g.type = cv.type
    }

    for (const g of gems.value) if (clear.has(g.id)) g.clearing = true
    await sleep(140)
    gems.value = gems.value.filter((g) => !clear.has(g.id))

    applyGravity()
    await sleep(180)
    swapIds = new Set()
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
        spawnBeam(g.row, g.col)
        for (const o of gems.value) if (o.row === g.row || o.col === g.col) clear.add(o.id)
      } else if (g.type === 'bomb') {
        spawnRing(g.row, g.col, COLORS[g.color])
        for (const o of gems.value) if (o.color === g.color) clear.add(o.id)
      }
    }
  }
  for (const g of gems.value) delete g._expanded
}

// ---------- activation effects ----------
const pct = (n) => (n / N) * 100
function addFx(fx, ms = 480) {
  const id = fxId++
  effects.value.push({ id, ...fx })
  setTimeout(() => {
    effects.value = effects.value.filter((e) => e.id !== id)
  }, ms)
}
function spawnBeam(row, col) {
  addFx({ cls: 'beam beam-h', style: { top: pct(row) + '%', height: pct(1) + '%' } })
  addFx({ cls: 'beam beam-v', style: { left: pct(col) + '%', width: pct(1) + '%' } })
}
function spawnRing(row, col, color) {
  addFx({ cls: 'ring', style: { left: pct(col + 0.5) + '%', top: pct(row + 0.5) + '%', '--fx': color } }, 540)
}
function spawnCombo(n, row, col) {
  addFx({ cls: 'combo', text: `COMBO ×${n}`, style: { left: pct(col + 0.5) + '%', top: pct(row + 0.5) + '%' } }, 700)
}

async function commitClear(clear, combo) {
  expandSpecials(clear)
  if (clear.size === 0) return
  score.value += clear.size * 10 * combo
  haptics.medium()
  for (const g of gems.value) if (clear.has(g.id)) g.clearing = true
  await sleep(140)
  gems.value = gems.value.filter((g) => !clear.has(g.id))
  applyGravity()
  await sleep(180)
}

function detonateClearSet(a, b) {
  const clear = new Set()
  const aT = a.type
  const bT = b.type
  if (aT === 'bomb' && bT === 'bomb') {
    for (const o of gems.value) clear.add(o.id)
    return clear
  }
  if ((aT === 'bomb' && bT === 'blast') || (aT === 'blast' && bT === 'bomb')) {
    const bomb = aT === 'bomb' ? a : b
    for (const o of gems.value)
      if (o.color === bomb.color)
        for (const p of gems.value) if (p.row === o.row || p.col === o.col) clear.add(p.id)
    clear.add(a.id)
    clear.add(b.id)
    return clear
  }
  if (aT !== 'normal') {
    if (aT === 'bomb' && bT === 'normal') a.color = b.color
    clear.add(a.id)
  }
  if (bT !== 'normal') {
    if (bT === 'bomb' && aT === 'normal') b.color = a.color
    clear.add(b.id)
  }
  return clear
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
  if (busy || overlay.value) return
  const g = cellFromPoint(e)
  if (!g) return
  dragStart = g
  const sel = selectedId.value ? gems.value.find((x) => x.id === selectedId.value) : null
  if (sel && sel.id !== g.id && adjacent(sel, g)) trySwap(sel, g)
  else selectedId.value = g.id
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
  if (mode === 'zen' && score.value > 0) progressStore.recordGems('zen', { score: score.value })
  router.push({ name: 'menu' })
}
function howToPlay() {
  haptics.light()
  router.push({ name: 'how-to-play' })
}

onMounted(startMode)
onBeforeUnmount(() => {
  stopBlitz()
  if (mode === 'zen' && score.value > 0) progressStore.recordGems('zen', { score: score.value })
})
</script>

<style lang="scss" scoped>
.gems-page {
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
  width: min(94vw, 64vh, 460px);
  height: 8px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.3);
  overflow: hidden;
  margin-bottom: 2px;
}
.progress-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #2ecc71, #f1c40f);
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
.disc.blast {
  box-shadow: inset 0 0 0 3px rgba(255, 255, 255, 0.85), 0 0 10px rgba(255, 255, 255, 0.5);
  animation: charged 1.1s ease-in-out infinite;
}
.disc.bomb {
  box-shadow: inset 0 0 0 3px rgba(255, 255, 255, 0.9), 0 0 14px rgba(255, 255, 255, 0.75);
  animation: charged 0.9s ease-in-out infinite;
}
@keyframes charged {
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(1.4); }
}
.gem.spawn .disc { animation: pop 0.2s ease; }
.gem.clearing .disc { animation: clear 0.16s ease forwards; }
@keyframes pop { 0% { transform: scale(0.2); } 100% { transform: scale(1); } }
@keyframes clear { 0% { transform: scale(1); opacity: 1; } 100% { transform: scale(0.1); opacity: 0; } }

/* transient activation effects */
.fx-layer { position: absolute; inset: 0; pointer-events: none; overflow: hidden; border-radius: 14px; z-index: 4; }
.fx { position: absolute; }
.beam { background: rgba(255, 255, 255, 0.92); box-shadow: 0 0 18px 4px rgba(255, 255, 255, 0.9); animation: beamflash 0.42s ease-out forwards; }
.beam-h { left: 0; width: 100%; }
.beam-v { top: 0; height: 100%; }
@keyframes beamflash { 0% { opacity: 0; transform: scale(0.4); } 18% { opacity: 1; transform: scale(1); } 100% { opacity: 0; } }
.ring { width: 12%; aspect-ratio: 1; border-radius: 50%; border: 4px solid var(--fx, #fff); box-shadow: 0 0 22px var(--fx, #fff), inset 0 0 14px var(--fx, #fff); transform: translate(-50%, -50%) scale(0.2); animation: ringpop 0.54s ease-out forwards; }
@keyframes ringpop { 0% { transform: translate(-50%, -50%) scale(0.2); opacity: 0.95; } 100% { transform: translate(-50%, -50%) scale(3.6); opacity: 0; } }
.combo { transform: translate(-50%, -50%); color: #fff; font-weight: 800; font-size: clamp(1rem, 5vw, 1.5rem); letter-spacing: 0.02em; text-shadow: 0 2px 10px rgba(0, 0, 0, 0.65); white-space: nowrap; animation: combopop 0.7s ease-out forwards; }
@keyframes combopop { 0% { opacity: 0; transform: translate(-50%, -30%) scale(0.6); } 25% { opacity: 1; transform: translate(-50%, -55%) scale(1.15); } 100% { opacity: 0; transform: translate(-50%, -95%) scale(1); } }

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
.overlay-text { font-size: 1.8rem; font-weight: 800; color: #fff; text-align: center; padding: 0 14px; }
.overlay-sub { color: rgba(255, 255, 255, 0.85); margin-top: -8px; }
.overlay-actions { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.overlay-fade-enter-active { transition: opacity 0.35s ease; }
.overlay-fade-enter-from { opacity: 0; }
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
  background: linear-gradient(135deg, #9b59b6 0%, #e74c3c 100%) !important;
}
</style>
