<template>
  <q-page
    class="trails-page"
    :style="{ background: themeStore.colors.gradient }"
    :data-state="gameOver ? 'over' : 'playing'"
    :data-tiles="placedCount"
    :data-alive="aliveCount"
  >
    <!-- Header -->
    <div class="game-header">
      <q-btn fab-mini flat icon="arrow_back" color="white" @click="goBack" />
      <div class="status">
        <div class="turn-line">
          <span
            v-for="pl in players"
            :key="pl.id"
            class="pip"
            :class="{ dead: !pl.alive, active: pl.id === current && !gameOver }"
            :style="{ background: pl.color }"
          ></span>
          <span class="turn-text">{{ turnText }}</span>
        </div>
      </div>
      <div class="header-menu">
        <q-btn fab-mini flat icon="refresh" color="white" @click="newGame" />
        <q-btn fab-mini flat icon="help_outline" color="white" @click="howToPlay" />
      </div>
    </div>

    <!-- Board -->
    <div class="board-wrap">
      <div class="board">
        <svg :viewBox="`0 0 ${B * S} ${B * S}`" class="field">
          <!-- grid -->
          <g stroke="rgba(255,255,255,0.12)" stroke-width="1">
            <line v-for="i in B + 1" :key="'v' + i" :x1="(i - 1) * S" :y1="0" :x2="(i - 1) * S" :y2="B * S" />
            <line v-for="i in B + 1" :key="'h' + i" :x1="0" :y1="(i - 1) * S" :x2="B * S" :y2="(i - 1) * S" />
          </g>
          <!-- placed tiles -->
          <g v-for="t in placedList" :key="t.key">
            <rect :x="t.x" :y="t.y" :width="S" :height="S" fill="rgba(255,255,255,0.06)" />
            <path
              v-for="(d, i) in t.paths"
              :key="i"
              :d="d"
              fill="none"
              stroke="#e0d4b8"
              stroke-width="6"
              stroke-linecap="round"
            />
          </g>
          <!-- target cell highlight -->
          <rect
            v-if="!gameOver && activePlayer && !activePlayer.isAI && targetCell"
            :x="targetCell.c * S"
            :y="targetCell.r * S"
            :width="S"
            :height="S"
            fill="none"
            stroke="#ffd54f"
            stroke-width="4"
            class="target"
          />
          <!-- preview of selected tile in target cell -->
          <g v-if="previewPaths">
            <path
              v-for="(d, i) in previewPaths"
              :key="'pv' + i"
              :d="d"
              fill="none"
              stroke="rgba(255,213,79,0.7)"
              stroke-width="5"
              stroke-linecap="round"
            />
          </g>
          <!-- stones -->
          <circle
            v-for="pl in players"
            v-show="pl.alive"
            :key="'s' + pl.id"
            :cx="stoneXY(pl).x"
            :cy="stoneXY(pl).y"
            r="11"
            :fill="pl.color"
            stroke="#fff"
            stroke-width="2.5"
          />
        </svg>

        <transition name="overlay-fade">
          <div v-if="gameOver" class="board-overlay">
            <div class="overlay-text">{{ win ? 'You survived!' : 'Eliminated' }}</div>
            <q-btn unelevated color="primary" text-color="white" label="New Game" @click="newGame" />
          </div>
        </transition>
      </div>
    </div>

    <!-- Hand / controls -->
    <div class="controls" v-if="!gameOver && activePlayer && !activePlayer.isAI">
      <div class="hand">
        <button
          v-for="(tile, i) in playerHand"
          :key="i"
          class="handtile"
          :class="{ sel: selectedIdx === i }"
          @click="selectHand(i)"
        >
          <svg viewBox="0 0 100 100">
            <rect x="2" y="2" width="96" height="96" rx="8" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.2)" />
            <path v-for="(d, j) in handPreview(tile)" :key="j" :d="d" fill="none" stroke="#e0d4b8" stroke-width="6" stroke-linecap="round" />
          </svg>
        </button>
      </div>
      <div class="actions">
        <q-btn dense unelevated color="grey-8" text-color="white" icon="rotate_right" label="Rotate" :disable="selectedIdx < 0" @click="rotateSel" />
        <q-btn dense unelevated color="primary" text-color="white" label="Place" class="place" :disable="selectedIdx < 0" @click="placeSelected" />
      </div>
    </div>

    <p class="hint">Lay a tile in the highlighted square, then follow your path — don't run off the board</p>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useThemeStore } from 'src/stores/theme'
import { useProgressStore } from 'src/stores/progress'
import { useHaptics } from 'src/composables/useHaptics'

const B = 6
const S = 100
// exit port -> {dr,dc, entry port on neighbour}
const EXIT = {
  0: { dr: -1, dc: 0, e: 5 },
  1: { dr: -1, dc: 0, e: 4 },
  2: { dr: 0, dc: 1, e: 7 },
  3: { dr: 0, dc: 1, e: 6 },
  4: { dr: 1, dc: 0, e: 1 },
  5: { dr: 1, dc: 0, e: 0 },
  6: { dr: 0, dc: -1, e: 3 },
  7: { dr: 0, dc: -1, e: 2 },
}

const router = useRouter()
const themeStore = useThemeStore()
const progressStore = useProgressStore()
const { trails: stats } = storeToRefs(progressStore)
const haptics = useHaptics()

const cells = ref([]) // [r][c] -> { link:[8] } or null
const players = ref([])
const current = ref(0)
const gameOver = ref(false)
const win = ref(false)
const selectedIdx = ref(-1)
const selectedRot = ref(0)
const tickRef = ref(0) // force recompute of stone positions

let deck = []
let busy = false
let aiTimer = null

void stats // reserved for future stats display

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const activePlayer = computed(() => players.value[current.value] || null)
const playerObj = computed(() => players.value.find((p) => !p.isAI))
const playerHand = computed(() => (playerObj.value ? playerObj.value.hand : []))
const aliveCount = computed(() => players.value.filter((p) => p.alive).length)
const placedCount = computed(() => {
  tickRef.value
  let n = 0
  for (let r = 0; r < B; r++) for (let c = 0; c < B; c++) if (cells.value[r]?.[c]) n++
  return n
})
const targetCell = computed(() => {
  const p = activePlayer.value
  if (!p || p.isAI) return null
  return { r: p.r, c: p.c }
})
const turnText = computed(() => {
  if (gameOver.value) return win.value ? 'You win' : 'You lost'
  const p = activePlayer.value
  if (!p) return ''
  return p.isAI ? `${p.name} is moving…` : 'Your turn'
})

// ---------- tiles ----------
function randomTile() {
  const ports = [0, 1, 2, 3, 4, 5, 6, 7]
  for (let i = ports.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[ports[i], ports[j]] = [ports[j], ports[i]]
  }
  const link = new Array(8)
  for (let i = 0; i < 8; i += 2) {
    link[ports[i]] = ports[i + 1]
    link[ports[i + 1]] = ports[i]
  }
  return link
}
function rotate(link) {
  const out = new Array(8)
  for (let p = 0; p < 8; p++) out[p] = (link[(p + 6) % 8] + 2) % 8
  return out
}
function rotateN(link, n) {
  let l = link
  for (let i = 0; i < (n % 4); i++) l = rotate(l)
  return l
}

// port -> {x,y} within a cell at origin (ox,oy)
function portXY(p, ox, oy) {
  const t = S / 3
  switch (p) {
    case 0: return { x: ox + t, y: oy }
    case 1: return { x: ox + 2 * t, y: oy }
    case 2: return { x: ox + S, y: oy + t }
    case 3: return { x: ox + S, y: oy + 2 * t }
    case 4: return { x: ox + 2 * t, y: oy + S }
    case 5: return { x: ox + t, y: oy + S }
    case 6: return { x: ox, y: oy + 2 * t }
    default: return { x: ox, y: oy + t }
  }
}
function tilePaths(link, ox, oy) {
  const out = []
  const cx = ox + S / 2
  const cy = oy + S / 2
  for (let p = 0; p < 8; p++) {
    const q = link[p]
    if (p >= q) continue
    const a = portXY(p, ox, oy)
    const b = portXY(q, ox, oy)
    const c1 = { x: a.x + (cx - a.x) * 0.55, y: a.y + (cy - a.y) * 0.55 }
    const c2 = { x: b.x + (cx - b.x) * 0.55, y: b.y + (cy - b.y) * 0.55 }
    out.push(`M ${a.x} ${a.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${b.x} ${b.y}`)
  }
  return out
}

const placedList = computed(() => {
  tickRef.value
  const list = []
  for (let r = 0; r < B; r++) {
    for (let c = 0; c < B; c++) {
      const t = cells.value[r]?.[c]
      if (t) list.push({ key: r * B + c, x: c * S, y: r * S, paths: tilePaths(t.link, c * S, r * S) })
    }
  }
  return list
})
function handPreview(tile) {
  return tilePaths(tile, 0, 0)
}
const previewPaths = computed(() => {
  const p = activePlayer.value
  if (gameOver.value || !p || p.isAI || selectedIdx.value < 0) return null
  const base = playerHand.value[selectedIdx.value]
  if (!base) return null
  return tilePaths(rotateN(base, selectedRot.value), p.c * S, p.r * S)
})

function stoneXY(pl) {
  tickRef.value
  return portXY(pl.port, pl.c * S, pl.r * S)
}

// ---------- movement ----------
function resolve(r, c, port) {
  let guard = 0
  while (guard++ < 200) {
    if (r < 0 || r >= B || c < 0 || c >= B) return { off: true }
    const tile = cells.value[r]?.[c]
    if (!tile) return { off: false, r, c, port }
    const exit = tile.link[port]
    const e = EXIT[exit]
    r += e.dr
    c += e.dc
    port = e.e
  }
  return { off: true }
}

function applyMove(pl) {
  const res = resolve(pl.r, pl.c, pl.port)
  if (res.off) {
    pl.alive = false
    return
  }
  pl.r = res.r
  pl.c = res.c
  pl.port = res.port
  // collision: any other alive stone at same point?
  for (const o of players.value) {
    if (o === pl || !o.alive) continue
    if (o.r === pl.r && o.c === pl.c && o.port === pl.port) {
      o.alive = false
      pl.alive = false
    }
  }
}

// ---------- turn flow ----------
function placeTile(pl, link) {
  if (!cells.value[pl.r]) cells.value[pl.r] = []
  cells.value[pl.r][pl.c] = { link }
  applyMove(pl)
  tickRef.value++
}

async function placeSelected() {
  if (busy || selectedIdx.value < 0) return
  const pl = activePlayer.value
  if (!pl || pl.isAI) return
  busy = true
  const base = pl.hand[selectedIdx.value]
  const link = rotateN(base, selectedRot.value)
  pl.hand.splice(selectedIdx.value, 1)
  selectedIdx.value = -1
  selectedRot.value = 0
  haptics.medium()
  placeTile(pl, link)
  drawTile(pl)
  await sleep(450)
  endTurn()
}

function drawTile(pl) {
  if (deck.length && pl.hand.length < 3) pl.hand.push(deck.pop())
}

function endTurn() {
  if (checkOver()) {
    busy = false
    return
  }
  // advance to next alive player
  let n = current.value
  for (let i = 0; i < players.value.length; i++) {
    n = (n + 1) % players.value.length
    if (players.value[n].alive) break
  }
  current.value = n
  busy = false
  if (activePlayer.value.isAI) {
    aiTimer = setTimeout(aiMove, 650)
  }
}

function checkOver() {
  const p = playerObj.value
  if (!p.alive) {
    gameOver.value = true
    win.value = false
    progressStore.recordTrailsGame(false)
    return true
  }
  if (players.value.filter((x) => x.alive && x.isAI).length === 0) {
    gameOver.value = true
    win.value = true
    progressStore.recordTrailsGame(true)
    return true
  }
  // no tiles left anywhere -> survivors win; player is alive so they win
  if (players.value.every((x) => !x.alive || x.hand.length === 0) && deck.length === 0) {
    gameOver.value = true
    win.value = true
    progressStore.recordTrailsGame(true)
    return true
  }
  return false
}

function aiMove() {
  const pl = activePlayer.value
  if (!pl || !pl.isAI || gameOver.value) return
  if (pl.hand.length === 0) {
    endTurn()
    return
  }
  // try all tiles x rotations; prefer ones that keep the stone alive
  let safe = []
  let any = []
  for (let i = 0; i < pl.hand.length; i++) {
    for (let rot = 0; rot < 4; rot++) {
      const link = rotateN(pl.hand[i], rot)
      // simulate on a temp: place link at (pl.r,pl.c) then resolve
      const saved = cells.value[pl.r]?.[pl.c]
      if (!cells.value[pl.r]) cells.value[pl.r] = []
      cells.value[pl.r][pl.c] = { link }
      const res = resolve(pl.r, pl.c, pl.port)
      cells.value[pl.r][pl.c] = saved || null
      any.push({ i, rot })
      if (!res.off) safe.push({ i, rot, dist: Math.abs(res.r - pl.r) + Math.abs(res.c - pl.c) })
    }
  }
  const pick = (safe.length ? safe[Math.floor(Math.random() * safe.length)] : any[Math.floor(Math.random() * any.length)])
  const link = rotateN(pl.hand[pick.i], pick.rot)
  pl.hand.splice(pick.i, 1)
  placeTile(pl, link)
  drawTile(pl)
  haptics.light()
  setTimeout(endTurn, 400)
}

// ---------- setup ----------
function selectHand(i) {
  if (busy) return
  selectedIdx.value = i
  selectedRot.value = 0
  haptics.light()
}
function rotateSel() {
  if (selectedIdx.value < 0) return
  selectedRot.value = (selectedRot.value + 1) % 4
  haptics.light()
}

function newGame() {
  haptics.light()
  clearTimeout(aiTimer)
  busy = false
  gameOver.value = false
  win.value = false
  selectedIdx.value = -1
  selectedRot.value = 0
  cells.value = Array.from({ length: B }, () => new Array(B).fill(null))
  deck = []
  for (let i = 0; i < 40; i++) deck.push(randomTile())
  players.value = [
    { id: 0, name: 'You', color: '#42a5f5', isAI: false, alive: true, r: 0, c: 1, port: 1, hand: [] },
    { id: 1, name: 'Red', color: '#ef5350', isAI: true, alive: true, r: 5, c: 4, port: 5, hand: [] },
    { id: 2, name: 'Green', color: '#66bb6a', isAI: true, alive: true, r: 2, c: 5, port: 3, hand: [] },
  ]
  for (const p of players.value) for (let k = 0; k < 3; k++) drawTile(p)
  current.value = 0
  tickRef.value++
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
onBeforeUnmount(() => clearTimeout(aiTimer))
</script>

<style lang="scss" scoped>
.trails-page {
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
  gap: 10px;
  padding: 16px;
  padding-top: max(56px, calc(env(safe-area-inset-top) + 16px));
}
.status { flex: 1; text-align: center; color: #fff; }
.turn-line { display: flex; align-items: center; justify-content: center; gap: 6px; }
.pip { width: 12px; height: 12px; border-radius: 50%; opacity: 0.95; }
.pip.dead { opacity: 0.25; }
.pip.active { outline: 2px solid #fff; outline-offset: 1px; }
.turn-text { font-size: 0.85rem; font-weight: 600; margin-left: 6px; }
.header-menu { display: flex; gap: 2px; }

.board-wrap { width: 100%; display: flex; justify-content: center; padding: 8px 16px; flex: 1; align-items: center; }
.board { position: relative; width: min(94vw, 60vh, 460px); }
.field {
  width: 100%;
  height: auto;
  display: block;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(6px);
}
.target { animation: pulse 1.2s ease-in-out infinite; }
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.board-overlay {
  position: absolute;
  inset: 0;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(3px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  z-index: 5;
}
.overlay-text { font-size: 2rem; font-weight: 800; color: #fff; }
.overlay-fade-enter-active { transition: opacity 0.4s ease; }
.overlay-fade-enter-from { opacity: 0; }

.controls {
  width: 100%;
  max-width: 520px;
  padding: 4px 16px max(12px, env(safe-area-inset-bottom));
}
.hand { display: flex; gap: 10px; justify-content: center; }
.handtile {
  width: 78px;
  height: 78px;
  border: 2px solid transparent;
  border-radius: 12px;
  background: transparent;
  padding: 0;
  cursor: pointer;
}
.handtile svg { width: 100%; height: 100%; display: block; }
.handtile.sel { border-color: #ffd54f; box-shadow: 0 0 12px rgba(255, 213, 79, 0.5); }
.actions { display: flex; gap: 8px; justify-content: center; margin-top: 10px; }
.actions .place { min-width: 120px; font-weight: 700; }

.hint {
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.82rem;
  text-align: center;
  margin: 10px 24px max(16px, env(safe-area-inset-bottom));
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}
:deep(.q-btn.bg-primary) { background: linear-gradient(135deg, #42a5f5 0%, #66bb6a 100%) !important; }
</style>
