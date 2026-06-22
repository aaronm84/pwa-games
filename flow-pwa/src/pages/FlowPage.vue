<template>
  <q-page class="flow-page" :style="{ background: themeStore.colors.gradient }">
    <!-- Header -->
    <div class="game-header">
      <q-btn fab-mini flat icon="arrow_back" color="white" @click="goBack" />

      <div class="status">
        <div class="level-label">Level {{ level }}</div>
        <div class="level-sub">{{ connectedCount }}/{{ totalColors }} flows · {{ coverage }}% · {{ moves }} moves</div>
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
            key="reset"
            fab-mini
            flat
            icon="refresh"
            color="white"
            class="menu-item"
            @click="resetBoard"
          />
          <q-btn
            v-if="showMenu"
            key="skip"
            fab-mini
            flat
            icon="skip_next"
            color="white"
            class="menu-item"
            @click="skipLevel"
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
        :style="{ '--n': size }"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
      >
        <!-- Cell tints + grid -->
        <div class="grid">
          <div
            v-for="i in size * size"
            :key="i"
            class="cell"
            :style="cellColors[i - 1] ? { background: cellColors[i - 1] + '33' } : null"
          ></div>
        </div>

        <!-- Pipes + endpoint dots -->
        <svg class="pipes" :viewBox="`0 0 ${size} ${size}`" preserveAspectRatio="none">
          <polyline
            v-for="pl in pipePolylines"
            :key="pl.color"
            :points="pl.points"
            fill="none"
            :stroke="pl.stroke"
            stroke-width="0.42"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <circle
            v-for="(dot, idx) in endpointDots"
            :key="'dot-' + idx"
            :cx="dot.c + 0.5"
            :cy="dot.r + 0.5"
            r="0.3"
            :fill="dot.color"
          />
        </svg>

        <!-- Win overlay -->
        <transition name="overlay-fade">
          <div v-if="solved" class="board-overlay">
            <div class="overlay-text">Level {{ level }} solved!</div>
            <q-btn unelevated color="primary" text-color="white" label="Next Level" @click="nextLevel" />
          </div>
        </transition>
      </div>
    </div>

    <p class="hint">Connect each pair of dots. Fill every square — pipes can't cross.</p>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useThemeStore } from 'src/stores/theme'
import { useProgressStore } from 'src/stores/progress'
import { useHaptics } from 'src/composables/useHaptics'

const SAVE_KEY = 'flow-game-state'
const COLORS = [
  '#e6194b', '#3cb44b', '#4363d8', '#ffe119', '#f58231', '#911eb4',
  '#42d4f4', '#f032e6', '#bfef45', '#fb7185', '#14b8a6', '#a16207',
]

const router = useRouter()
const route = useRoute()
const themeStore = useThemeStore()
const progressStore = useProgressStore()
const haptics = useHaptics()

const boardEl = ref(null)
const level = ref(1)
const size = ref(5)
const totalColors = ref(4)
const moves = ref(0)
const showMenu = ref(false)
const solved = ref(false)
const rev = ref(0) // bump to re-render after path mutations

// Non-reactive logic state (mirrored to the view via `rev`)
let endpointGrid = make2D(5, -1) // [r][c] -> color or -1
let endpoints = [] // [{ color, a:{r,c}, b:{r,c} }]
let ownerGrid = make2D(5, -1) // [r][c] -> color or -1
let pathsData = {} // color -> [{r,c}, ...] ordered from one endpoint
let drawing = false
let activeColor = -1

// ---------- deterministic RNG ----------
function mulberry32(a) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function shuffle(arr, rng) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ---------- puzzle generation ----------
function hamiltonAttempt(n, rng) {
  const T = n * n
  const visited = new Array(T).fill(false)
  const path = []
  let iter = 0
  const CAP = 120000
  const sr = Math.floor(rng() * n)
  const sc = Math.floor(rng() * n)
  function go(r, c) {
    if (++iter > CAP) throw new Error('cap')
    visited[r * n + c] = true
    path.push({ r, c })
    if (path.length === T) return true
    for (const [dr, dc] of shuffle([[1, 0], [-1, 0], [0, 1], [0, -1]], rng)) {
      const nr = r + dr
      const nc = c + dc
      if (nr >= 0 && nr < n && nc >= 0 && nc < n && !visited[nr * n + nc]) {
        if (go(nr, nc)) return true
      }
    }
    visited[r * n + c] = false
    path.pop()
    return false
  }
  try {
    if (go(sr, sc)) return path
  } catch {
    // hit the cap — caller falls back
  }
  return null
}

function serpentine(n, rng) {
  let cells = []
  for (let r = 0; r < n; r++) {
    const cols = r % 2 === 0 ? range(n) : range(n).reverse()
    for (const c of cols) cells.push({ r, c })
  }
  // Apply random symmetry transforms (all preserve path adjacency)
  if (rng() < 0.5) cells = cells.map((p) => ({ r: p.c, c: p.r })) // transpose
  if (rng() < 0.5) cells = cells.map((p) => ({ r: n - 1 - p.r, c: p.c })) // flip v
  if (rng() < 0.5) cells = cells.map((p) => ({ r: p.r, c: n - 1 - p.c })) // flip h
  if (rng() < 0.5) cells.reverse()
  return cells
}

function range(n) {
  return Array.from({ length: n }, (_, i) => i)
}
function make2D(n, v) {
  return Array.from({ length: n }, () => new Array(n).fill(v))
}

function splitLengths(total, k, rng, minLen = 3) {
  // longer minimum flows avoid trivial two-cell (adjacent-dot) connections;
  // fall back to 2 only if the board genuinely can't fit length-3 everywhere
  const m = total >= minLen * k ? minLen : 2
  const len = new Array(k).fill(m)
  let rem = total - m * k
  while (rem-- > 0) len[Math.floor(rng() * k)]++
  return len
}

// Difficulty curve: ramp the colour count within each board size, then grow the
// board. Gives a gentle start (5x5, 3 colours) and a steady climb.
function levelConfig(lvl) {
  const stages = []
  for (const s of [5, 6, 7, 8, 9]) {
    for (const k of [s - 2, s - 1, s]) stages.push({ size: s, colors: k })
  }
  if (lvl - 1 < stages.length) return stages[lvl - 1]
  // Beyond the staged levels: stay at 9x9 and keep adding colours (capped).
  const extra = lvl - 1 - stages.length
  return { size: 9, colors: Math.min(10 + extra, 12) }
}

function generatePuzzle(lvl) {
  const cfg = levelConfig(lvl)
  const n = cfg.size
  // cap colours below the board size: more colours = more endpoints = a more
  // *constrained* (often forced/easier) board, so fewer, longer flows are harder
  const colorCount = Math.min(cfg.colors, COLORS.length, n - 1, Math.floor((n * n) / 2))
  const rng = mulberry32((Math.imul(lvl, 2654435761) >>> 0) || 1)

  let order = null
  for (let attempt = 0; attempt < 3 && !order; attempt++) order = hamiltonAttempt(n, rng)
  if (!order) order = serpentine(n, rng)

  const lengths = splitLengths(n * n, colorCount, rng)
  const eps = []
  const epGrid = make2D(n, -1)
  let idx = 0
  for (let col = 0; col < colorCount; col++) {
    const seg = order.slice(idx, idx + lengths[col])
    const a = seg[0]
    const b = seg[seg.length - 1]
    eps.push({ color: col, a, b })
    epGrid[a.r][a.c] = col
    epGrid[b.r][b.c] = col
    idx += lengths[col]
  }
  return { n, colorCount, endpoints: eps, epGrid }
}

// ---------- level setup ----------
function loadLevel(lvl, savedPaths) {
  const puz = generatePuzzle(lvl)
  // Populate the plain logic state BEFORE touching reactive refs, so any
  // size-driven computed always sees matching grids.
  endpoints = puz.endpoints
  endpointGrid = puz.epGrid
  ownerGrid = make2D(puz.n, -1)
  pathsData = {}
  drawing = false
  activeColor = -1
  moves.value = 0
  solved.value = false
  totalColors.value = puz.colorCount
  size.value = puz.n

  if (savedPaths) {
    // Restore validated paths
    for (const [color, cells] of Object.entries(savedPaths)) {
      const c = Number(color)
      if (!Array.isArray(cells) || cells.length < 2) continue
      const valid = cells.every(
        (p) => p && p.r >= 0 && p.r < puz.n && p.c >= 0 && p.c < puz.n,
      )
      if (!valid) continue
      pathsData[c] = cells.map((p) => ({ r: p.r, c: p.c }))
      for (const p of cells) ownerGrid[p.r][p.c] = c
    }
  }
  rev.value++
  checkSolved()
}

function newLevel(lvl) {
  level.value = lvl
  loadLevel(lvl, null)
  save()
}

// ---------- helpers ----------
function eq(a, b) {
  return a.r === b.r && a.c === b.c
}
function endpointColorAt(r, c) {
  return endpointGrid[r][c]
}
function isEndpoint(p) {
  return endpointGrid[p.r][p.c] !== -1
}
function head() {
  const p = pathsData[activeColor]
  return p[p.length - 1]
}
function freeCell(p) {
  ownerGrid[p.r][p.c] = -1
}
function indexInPath(arr, p) {
  return arr.findIndex((x) => eq(x, p))
}

// ---------- drawing ----------
function getCellFromPoint(e) {
  const el = boardEl.value
  if (!el) return null
  const rect = el.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null
  const c = Math.min(size.value - 1, Math.max(0, Math.floor((x / rect.width) * size.value)))
  const r = Math.min(size.value - 1, Math.max(0, Math.floor((y / rect.height) * size.value)))
  return { r, c }
}

function clearColor(color) {
  const p = pathsData[color]
  if (!p) return
  for (const cell of p) freeCell(cell)
  pathsData[color] = []
}

function truncateColorFrom(color, cell) {
  const p = pathsData[color]
  const i = indexInPath(p, cell)
  if (i === -1) return
  for (let k = p.length - 1; k >= i; k--) freeCell(p[k])
  p.length = i
}

function onPointerDown(e) {
  if (solved.value) return
  const cell = getCellFromPoint(e)
  if (!cell) return
  const epc = endpointColorAt(cell.r, cell.c)
  if (epc !== -1) {
    // Start fresh from this endpoint
    activeColor = epc
    clearColor(epc)
    pathsData[epc] = [{ r: cell.r, c: cell.c }]
    ownerGrid[cell.r][cell.c] = epc
    drawing = true
  } else if (ownerGrid[cell.r][cell.c] !== -1) {
    // Continue an existing pipe from this cell
    activeColor = ownerGrid[cell.r][cell.c]
    truncateColorFrom(activeColor, cell)
    pathsData[activeColor].push({ r: cell.r, c: cell.c })
    ownerGrid[cell.r][cell.c] = activeColor
    drawing = true
  } else {
    return
  }
  boardEl.value.setPointerCapture?.(e.pointerId)
  haptics.light()
  rev.value++
}

function onPointerMove(e) {
  if (!drawing) return
  e.preventDefault()
  const target = getCellFromPoint(e)
  if (!target) return
  let guard = 0
  const limit = size.value * size.value
  while (!eq(head(), target) && guard++ < limit) {
    const h = head()
    const dr = Math.sign(target.r - h.r)
    const dc = Math.sign(target.c - h.c)
    let next
    if (Math.abs(target.r - h.r) >= Math.abs(target.c - h.c) && dr !== 0) next = { r: h.r + dr, c: h.c }
    else if (dc !== 0) next = { r: h.r, c: h.c + dc }
    else if (dr !== 0) next = { r: h.r + dr, c: h.c }
    else break
    if (!tryStep(next)) break
  }
}

function tryStep(next) {
  const p = pathsData[activeColor]
  const h = p[p.length - 1]

  // Backtrack onto the previous cell
  if (p.length >= 2 && eq(next, p[p.length - 2])) {
    const removed = p.pop()
    freeCell(removed)
    rev.value++
    return true
  }

  // If the head is already the closing endpoint, only backtracking is allowed
  if (p.length >= 2 && isEndpoint(h) && !eq(h, p[0])) return false

  // Looping back onto our own path: truncate to that cell
  const ownIdx = indexInPath(p, next)
  if (ownIdx !== -1) {
    for (let k = p.length - 1; k > ownIdx; k--) freeCell(p[k])
    p.length = ownIdx + 1
    rev.value++
    return true
  }

  const epc = endpointColorAt(next.r, next.c)
  if (epc !== -1 && epc !== activeColor) return false // blocked by another colour's dot

  // Overwrite another colour's pipe (cut it at the crossing)
  const own = ownerGrid[next.r][next.c]
  if (own !== -1 && own !== activeColor) truncateColorFrom(own, next)

  ownerGrid[next.r][next.c] = activeColor
  p.push({ r: next.r, c: next.c })
  rev.value++
  return true
}

function onPointerUp() {
  if (!drawing) return
  drawing = false
  activeColor = -1
  moves.value++
  checkSolved()
  save()
}

// ---------- win ----------
function isConnected(color) {
  const p = pathsData[color]
  if (!p || p.length < 2) return false
  const e = endpoints[color]
  const first = p[0]
  const last = p[p.length - 1]
  return (
    (eq(first, e.a) && eq(last, e.b)) || (eq(first, e.b) && eq(last, e.a))
  )
}
function checkSolved() {
  let filled = 0
  for (let r = 0; r < size.value; r++) {
    const row = ownerGrid[r]
    if (!row) continue
    for (let c = 0; c < size.value; c++) if (row[c] !== undefined && row[c] !== -1) filled++
  }
  const allConnected = endpoints.every((e) => isConnected(e.color))
  if (filled === size.value * size.value && allConnected) {
    solved.value = true
    haptics.success()
    progressStore.recordFlowSolved(level.value)
    clearSave()
  }
}

// ---------- reactive views ----------
const cellColors = computed(() => {
  rev.value
  const n = size.value
  const arr = new Array(n * n).fill(null)
  for (const [color, cells] of Object.entries(pathsData)) {
    for (const p of cells) arr[p.r * n + p.c] = COLORS[color % COLORS.length]
  }
  return arr
})
const pipePolylines = computed(() => {
  rev.value
  const out = []
  for (const [color, cells] of Object.entries(pathsData)) {
    if (cells.length < 2) continue
    out.push({
      color,
      stroke: COLORS[color % COLORS.length],
      points: cells.map((p) => `${p.c + 0.5},${p.r + 0.5}`).join(' '),
    })
  }
  return out
})
const endpointDots = computed(() => {
  rev.value
  const out = []
  for (const e of endpoints) {
    out.push({ r: e.a.r, c: e.a.c, color: COLORS[e.color % COLORS.length] })
    out.push({ r: e.b.r, c: e.b.c, color: COLORS[e.color % COLORS.length] })
  }
  return out
})
const coverage = computed(() => {
  rev.value
  const n = size.value
  let filled = 0
  for (let r = 0; r < n; r++) {
    const row = ownerGrid[r]
    if (!row) continue
    for (let c = 0; c < n; c++) if (row[c] !== undefined && row[c] !== -1) filled++
  }
  return Math.round((filled / (n * n)) * 100)
})
const connectedCount = computed(() => {
  rev.value
  return endpoints.filter((e) => isConnected(e.color)).length
})

// ---------- controls ----------
function toggleMenu() {
  haptics.light()
  showMenu.value = !showMenu.value
}
function resetBoard() {
  haptics.light()
  showMenu.value = false
  loadLevel(level.value, null)
  save()
}
function nextLevel() {
  haptics.medium()
  newLevel(level.value + 1)
}
function skipLevel() {
  haptics.light()
  showMenu.value = false
  newLevel(level.value + 1)
}
function goBack() {
  haptics.light()
  router.back()
}
function howToPlay() {
  haptics.light()
  router.push({ name: 'how-to-play' })
}

// ---------- persistence ----------
function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ level: level.value, paths: pathsData }))
  } catch {
    // ignore
  }
}
function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY)
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
    if (!s.level) return false
    level.value = s.level
    loadLevel(s.level, s.paths || null)
    return true
  } catch {
    return false
  }
}

onMounted(() => {
  // Launched from the level-select screen with ?level=N → start that level fresh.
  const requested = Number(route.query.level)
  if (Number.isInteger(requested) && requested >= 1) {
    newLevel(requested)
    return
  }
  if (!load()) newLevel(1)
})
onBeforeUnmount(() => {
  if (!solved.value) save()
})
</script>

<style lang="scss" scoped>
.flow-page {
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
.status {
  flex: 1;
  text-align: center;
  color: #fff;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}
.level-label {
  font-size: 1.3rem;
  font-weight: 700;
}
.level-sub {
  font-size: 0.8rem;
  opacity: 0.8;
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

.board-wrap {
  width: 100%;
  display: flex;
  justify-content: center;
  padding: 8px 16px;
}
.board {
  position: relative;
  width: min(92vw, 64vh, 460px);
  aspect-ratio: 1;
  border-radius: 14px;
  background: rgba(0, 0, 0, 0.3);
  padding: 4px;
  touch-action: none;
  user-select: none;
}
.grid {
  position: absolute;
  inset: 4px;
  display: grid;
  grid-template-columns: repeat(var(--n), 1fr);
  grid-template-rows: repeat(var(--n), 1fr);
  gap: 0;
}
.cell {
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  transition: background 0.1s ease;
}
.pipes {
  position: absolute;
  inset: 4px;
  width: calc(100% - 8px);
  height: calc(100% - 8px);
  pointer-events: none;
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
  gap: 18px;
  z-index: 5;
}
.overlay-text {
  font-size: 1.7rem;
  font-weight: 800;
  color: #fff;
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
  background: linear-gradient(135deg, #4363d8 0%, #42d4f4 100%) !important;
}
</style>
