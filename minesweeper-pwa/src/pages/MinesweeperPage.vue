<template>
  <q-page class="mines-page" :style="{ background: themeStore.colors.gradient }">
    <!-- Header -->
    <div class="game-header">
      <q-btn fab-mini flat icon="arrow_back" color="white" @click="goBack" />

      <div class="stats">
        <div class="stat"><q-icon name="flag" size="16px" />{{ minesRemaining }}</div>
        <div class="stat"><q-icon name="schedule" size="16px" />{{ time }}</div>
      </div>

      <div class="header-menu">
        <q-btn
          fab-mini
          flat
          :icon="flagMode ? 'flag' : 'touch_app'"
          :color="flagMode ? 'amber' : 'white'"
          @click="toggleFlagMode"
        />
        <q-btn fab-mini flat icon="refresh" color="white" @click="newGame" />
        <q-btn fab-mini flat icon="help_outline" color="white" @click="howToPlay" />
      </div>
    </div>

    <!-- Board -->
    <div class="board-wrap">
      <div class="board" :class="{ shake: lost }" :style="{ '--n': N }">
        <div
          v-for="(cell, idx) in cells"
          :key="idx"
          class="cell"
          :class="cellClass(cell)"
          @pointerdown="onDown(idx, $event)"
          @pointerup="onUp(idx)"
          @pointerleave="cancelLong"
          @pointercancel="cancelLong"
          @contextmenu.prevent
        >
          <template v-if="cell.flagged && !cell.revealed">🚩</template>
          <template v-else-if="cell.revealed && cell.mine">💣</template>
          <template v-else-if="cell.revealed && cell.adj > 0">{{ cell.adj }}</template>
        </div>

        <transition name="overlay-fade">
          <div v-if="gameOver" class="board-overlay">
            <div class="overlay-text">{{ won ? 'Cleared!' : 'Boom!' }}</div>
            <div class="overlay-sub">
              {{ won ? `${diffLabel} · ${time}` : 'You hit a mine' }}
            </div>
            <q-btn unelevated color="primary" text-color="white" label="New Game" @click="newGame" />
          </div>
        </transition>
      </div>
    </div>

    <p class="hint">
      {{ flagMode ? 'Flag mode: tap to flag' : 'Tap to reveal' }} ·
      long-press to flag · tap a number to chord
    </p>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useThemeStore } from 'src/stores/theme'
import { useSettingsStore } from 'src/stores/settings'
import { useProgressStore } from 'src/stores/progress'
import { useHaptics } from 'src/composables/useHaptics'

const DIFFS = {
  easy: { n: 8, mines: 10, label: 'Easy' },
  medium: { n: 12, mines: 26, label: 'Medium' },
  hard: { n: 14, mines: 45, label: 'Hard' },
}

const router = useRouter()
const themeStore = useThemeStore()
const settingsStore = useSettingsStore()
const progressStore = useProgressStore()
const haptics = useHaptics()

const diffKey = ref('medium')
const N = ref(12)
const mineCount = ref(26)
const cells = ref([]) // { mine, adj, revealed, flagged }
const started = ref(false)
const gameOver = ref(false)
const won = ref(false)
const lost = ref(false)
const flagMode = ref(false)
const time = ref(0)
let timer = null

const diffLabel = computed(() => DIFFS[diffKey.value].label)
const flagsUsed = computed(() => cells.value.filter((c) => c.flagged && !c.revealed).length)
const minesRemaining = computed(() => mineCount.value - flagsUsed.value)

function idxOf(r, c) {
  return r * N.value + c
}
function rc(idx) {
  return { r: Math.floor(idx / N.value), c: idx % N.value }
}
function neighbors(idx) {
  const { r, c } = rc(idx)
  const out = []
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue
      const nr = r + dr
      const nc = c + dc
      if (nr >= 0 && nr < N.value && nc >= 0 && nc < N.value) out.push(idxOf(nr, nc))
    }
  return out
}

function blankBoard() {
  const total = N.value * N.value
  cells.value = Array.from({ length: total }, () => ({
    mine: false,
    adj: 0,
    revealed: false,
    flagged: false,
  }))
}

function placeMines(safeIdx) {
  const safe = new Set([safeIdx, ...neighbors(safeIdx)])
  const candidates = []
  for (let i = 0; i < cells.value.length; i++) if (!safe.has(i)) candidates.push(i)
  // shuffle, take mineCount
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[candidates[i], candidates[j]] = [candidates[j], candidates[i]]
  }
  const m = Math.min(mineCount.value, candidates.length)
  for (let i = 0; i < m; i++) cells.value[candidates[i]].mine = true
  // adjacency
  for (let i = 0; i < cells.value.length; i++) {
    if (cells.value[i].mine) continue
    cells.value[i].adj = neighbors(i).filter((n) => cells.value[n].mine).length
  }
}

function startTimer() {
  stopTimer()
  timer = setInterval(() => {
    time.value++
  }, 1000)
}
function stopTimer() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

function newGame() {
  haptics.light()
  const cfg = DIFFS[diffKey.value]
  N.value = cfg.n
  mineCount.value = cfg.mines
  blankBoard()
  started.value = false
  gameOver.value = false
  won.value = false
  lost.value = false
  time.value = 0
  stopTimer()
}

function reveal(idx) {
  const cell = cells.value[idx]
  if (cell.revealed || cell.flagged) return
  if (!started.value) {
    placeMines(idx)
    started.value = true
    startTimer()
  }
  if (cell.mine) {
    cell.revealed = true
    return loseGame()
  }
  // flood reveal
  const stack = [idx]
  while (stack.length) {
    const i = stack.pop()
    const c = cells.value[i]
    if (c.revealed || c.flagged) continue
    c.revealed = true
    if (c.adj === 0) for (const n of neighbors(i)) if (!cells.value[n].revealed) stack.push(n)
  }
  haptics.light()
  checkWin()
}

function chord(idx) {
  const cell = cells.value[idx]
  if (!cell.revealed || cell.adj === 0) return
  const nb = neighbors(idx)
  const flagged = nb.filter((n) => cells.value[n].flagged).length
  if (flagged !== cell.adj) return
  for (const n of nb) if (!cells.value[n].flagged && !cells.value[n].revealed) reveal(n)
}

function toggleFlag(idx) {
  const cell = cells.value[idx]
  if (cell.revealed) return
  if (!started.value) {
    // allow flagging before first reveal without placing mines
  }
  cell.flagged = !cell.flagged
  haptics.light()
}

function loseGame() {
  lost.value = true
  gameOver.value = true
  stopTimer()
  haptics.heavy()
  for (const c of cells.value) if (c.mine) c.revealed = true
  progressStore.recordMinesweeper(diffKey.value, false, time.value)
}

function checkWin() {
  const total = N.value * N.value
  const revealed = cells.value.filter((c) => c.revealed).length
  if (revealed === total - mineCount.value) {
    won.value = true
    gameOver.value = true
    stopTimer()
    haptics.success()
    // auto-flag remaining mines for a tidy finish
    for (const c of cells.value) if (c.mine) c.flagged = true
    progressStore.recordMinesweeper(diffKey.value, true, time.value)
  }
}

// --- input (tap vs long-press) ---
let longTimer = null
let longFired = false
function onDown(idx, e) {
  if (gameOver.value) return
  if (e.button === 2) return
  longFired = false
  longTimer = setTimeout(() => {
    longFired = true
    toggleFlag(idx)
  }, 350)
}
function cancelLong() {
  if (longTimer) {
    clearTimeout(longTimer)
    longTimer = null
  }
}
function onUp(idx) {
  cancelLong()
  if (gameOver.value || longFired) return
  const cell = cells.value[idx]
  if (cell.revealed) {
    chord(idx)
  } else if (flagMode.value) {
    toggleFlag(idx)
  } else {
    reveal(idx)
  }
}

function toggleFlagMode() {
  haptics.light()
  flagMode.value = !flagMode.value
}
function cellClass(cell) {
  return {
    revealed: cell.revealed,
    covered: !cell.revealed,
    flagged: cell.flagged && !cell.revealed,
    mine: cell.revealed && cell.mine,
    ['n' + cell.adj]: cell.revealed && !cell.mine && cell.adj > 0,
  }
}

function goBack() {
  haptics.light()
  router.back()
}
function howToPlay() {
  haptics.light()
  router.push({ name: 'how-to-play' })
}

onMounted(() => {
  diffKey.value = DIFFS[settingsStore.settings.minesweeperDifficulty]
    ? settingsStore.settings.minesweeperDifficulty
    : 'medium'
  newGame()
})
onBeforeUnmount(stopTimer)
</script>

<style lang="scss" scoped>
.mines-page {
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
  align-items: center;
  gap: 12px;
  padding: 16px;
  padding-top: max(56px, calc(env(safe-area-inset-top) + 16px));
}
.stats {
  flex: 1;
  display: flex;
  justify-content: center;
  gap: 18px;
}
.stat {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #fff;
  font-size: 1.2rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  background: rgba(0, 0, 0, 0.22);
  padding: 6px 14px;
  border-radius: 12px;
}
.header-menu {
  display: flex;
  gap: 4px;
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
  width: min(94vw, 70vh, 480px);
  aspect-ratio: 1;
  display: grid;
  grid-template-columns: repeat(var(--n), 1fr);
  grid-template-rows: repeat(var(--n), 1fr);
  gap: 2px;
  padding: 2px;
  background: rgba(0, 0, 0, 0.25);
  border-radius: 10px;
}
.board.shake {
  animation: shake 0.4s;
}
@keyframes shake {
  0%, 100% { transform: translate(0, 0); }
  25% { transform: translate(-5px, 3px); }
  50% { transform: translate(5px, -3px); }
  75% { transform: translate(-3px, -3px); }
}
.cell {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  font-weight: 800;
  font-size: clamp(0.7rem, 3.4vw, 1.2rem);
  user-select: none;
  cursor: pointer;
  line-height: 1;
}
.cell.covered {
  background: rgba(255, 255, 255, 0.16);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2);
}
.cell.covered:active {
  background: rgba(255, 255, 255, 0.26);
}
.cell.revealed {
  background: rgba(0, 0, 0, 0.22);
}
.cell.mine {
  background: rgba(229, 57, 53, 0.55);
}
.cell.n1 { color: #64b5f6; }
.cell.n2 { color: #81c784; }
.cell.n3 { color: #e57373; }
.cell.n4 { color: #9575cd; }
.cell.n5 { color: #ffb74d; }
.cell.n6 { color: #4dd0e1; }
.cell.n7 { color: #f06292; }
.cell.n8 { color: #e0e0e0; }

.board-overlay {
  position: absolute;
  inset: 0;
  border-radius: 10px;
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
  font-size: 0.8rem;
  text-align: center;
  margin: 8px 24px max(16px, env(safe-area-inset-bottom));
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}
:deep(.q-btn.bg-primary) {
  background: linear-gradient(135deg, #5c6bc0 0%, #42a5f5 100%) !important;
}
</style>
