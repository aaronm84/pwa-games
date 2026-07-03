<template>
  <q-page class="slots-page" :style="{ background: themeStore.colors.gradient }" :data-spinning="spinning">
    <!-- Header -->
    <div class="game-header">
      <q-btn fab-mini flat icon="arrow_back" color="white" @click="goBack" />
      <div class="machine-title">Sugar Tumble</div>
      <div class="header-menu">
        <q-btn fab-mini flat icon="help_outline" color="white" @click="howToPlay" />
      </div>
    </div>

    <!-- Jackpot ticker -->
    <div class="jackpot">
      <span class="jp-label">🍬 JACKPOT</span>
      <span class="jp-value">{{ Math.round(jackpotDisplay).toLocaleString() }}</span>
    </div>

    <!-- Grid -->
    <div class="board-wrap">
      <div class="board">
        <canvas ref="canvasEl" :width="CW" :height="CH" class="reels"></canvas>

        <transition name="pop">
          <div v-if="multi > 1" class="multi-chip" :key="multi">×{{ multi }}</div>
        </transition>
        <transition name="pop">
          <div v-if="banner" class="win-banner" :class="banner.cls">
            <div class="wb-title">{{ banner.title }}</div>
            <div class="wb-amount">{{ banner.amount.toLocaleString() }}</div>
          </div>
        </transition>
        <transition name="pop">
          <div v-if="freeIntro" class="fs-intro">
            <div class="fs-title">FREE SPINS!</div>
            <div class="fs-sub">{{ freeIntro }} spins · multiplier to ×{{ FREE_CAP }}</div>
          </div>
        </transition>
      </div>
    </div>

    <!-- Status -->
    <div class="statusline">
      <span v-if="freeSpins > 0" class="fs-tag">FREE SPIN {{ freeTotal - freeSpins + 1 }}/{{ freeTotal }}</span>
      <span v-else-if="lastWin > 0" class="win-amt">WIN {{ lastWin.toLocaleString() }}</span>
      <span v-else class="hint-txt">{{ spinning ? 'Tumbling…' : 'Land 8+ of a fruit anywhere · they pay, then tumble' }}</span>
    </div>

    <!-- Controls -->
    <div class="controls">
      <div class="wallet">
        <div class="w-box"><div class="w-label">Credits</div><div class="w-val">{{ credits.toLocaleString() }}</div></div>
        <div class="w-box"><div class="w-label">Bet</div><div class="w-val">{{ bet.toLocaleString() }}</div></div>
      </div>
      <div class="row">
        <div class="bet-stepper">
          <q-btn round dense unelevated class="step" icon="remove" :disable="spinning || freeSpins > 0" @click="changeBet(-1)" />
          <div class="bet-mid"><div class="bet-line">${{ bet }}</div><div class="lines">total</div></div>
          <q-btn round dense unelevated class="step" icon="add" :disable="spinning || freeSpins > 0" @click="changeBet(1)" />
        </div>
        <button class="spin-btn" :disabled="spinning && freeSpins === 0" @click="onSpin">
          <q-icon :name="freeSpins > 0 ? 'skip_next' : 'refresh'" size="26px" />
          <span>{{ freeSpins > 0 ? 'FREE' : spinning ? '…' : 'SPIN' }}</span>
        </button>
        <q-btn round dense unelevated class="auto-btn" :class="{ on: autospin }" :disable="freeSpins > 0" icon="autorenew" @click="toggleAuto" />
      </div>
    </div>

    <!-- Bust top-up -->
    <q-dialog v-model="showBust" persistent>
      <q-card class="dlg">
        <q-card-section class="text-center">
          <div class="dlg-title">Out of credits!</div>
          <div class="dlg-sub">Here's a top-up so the reels keep spinning.</div>
        </q-card-section>
        <q-card-actions align="center">
          <q-btn unelevated color="primary" text-color="white" :label="`Collect +${TOPUP.toLocaleString()}`" @click="collectTopup" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useThemeStore } from 'src/stores/theme'
import { useProgressStore } from 'src/stores/progress'
import { useHaptics } from 'src/composables/useHaptics'

import symCherry from 'src/assets/slots/sym-cherry.png'
import symLemon from 'src/assets/slots/sym-lemon.png'
import symOrange from 'src/assets/slots/sym-orange.png'
import symPlum from 'src/assets/slots/sym-plum.png'
import symGrapes from 'src/assets/slots/sym-grapes.png'
import symWatermelon from 'src/assets/slots/sym-watermelon.png'
import symApple from 'src/assets/slots/sym-apple.png'
import symHeart from 'src/assets/slots/sym-heart.png'
import symCoin from 'src/assets/slots/sym-coin.png'

const router = useRouter()
const themeStore = useThemeStore()
const progressStore = useProgressStore()
const { casino } = storeToRefs(progressStore)
const haptics = useHaptics()

const COLS = 6
const ROWS = 5
const TOPUP = 2000
const BETS = [10, 20, 50, 100, 200, 500]
const BASE_CAP = 5
const FREE_CAP = 10

// symbol → sprite + pay table (× total bet) for counts [8-9, 10-11, 12+]
const SYMBOLS = {
  cherry: { img: symCherry, w: 20, pay: [0.2, 0.5, 1.5] },
  lemon: { img: symLemon, w: 20, pay: [0.2, 0.5, 1.5] },
  orange: { img: symOrange, w: 16, pay: [0.3, 0.8, 2.5] },
  plum: { img: symPlum, w: 16, pay: [0.3, 0.8, 2.5] },
  grapes: { img: symGrapes, w: 12, pay: [0.5, 1.5, 4] },
  watermelon: { img: symWatermelon, w: 12, pay: [0.5, 1.5, 4] },
  apple: { img: symApple, w: 9, pay: [0.8, 2.5, 6] },
  heart: { img: symHeart, w: 7, pay: [1.2, 4, 12] },
  coin: { img: symCoin, w: 4, scatter: true }, // scatter
}
const SYM_KEYS = Object.keys(SYMBOLS)
const IMG = {}
for (const k of SYM_KEYS) {
  const im = new Image()
  im.src = SYMBOLS[k].img
  IMG[k] = im
}
// weighted pool for random picks
const POOL = []
for (const k of SYM_KEYS) for (let i = 0; i < SYMBOLS[k].w; i++) POOL.push(k)
function randSym() {
  return POOL[Math.floor(Math.random() * POOL.length)]
}

// ---------- geometry ----------
const CELL = 72
const PADX = 6
const PADY = 6
const CW = COLS * CELL + PADX * 2
const CH = ROWS * CELL + PADY * 2

// ---------- state ----------
const canvasEl = ref(null)
const spinning = ref(false)
const betIdx = ref(1)
const lastWin = ref(0)
const multi = ref(1)
const banner = ref(null)
const freeIntro = ref(0)
const freeSpins = ref(0)
const freeTotal = ref(0)
const autospin = ref(false)
const showBust = ref(false)
const jackpotDisplay = ref(0)

const credits = computed(() => casino.value.credits)
const bet = computed(() => BETS[betIdx.value])

// ---------- game data ----------
let ctx = null
let raf = null
let tiles = [] // { col, row, sym, y, scatter, popping, popT }
let bannerTimer = null
let settleResolve = null
let nextId = 1

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function newTile(col, row, y, sym) {
  return { id: nextId++, col, row, sym, y, scatter: !!SYMBOLS[sym].scatter, popping: false, popT: 0 }
}
function fillGrid() {
  tiles = []
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      // spawn above the board so it drops in
      tiles.push(newTile(c, r, r - ROWS - 1 - (ROWS - r) * 0.15, randSym()))
    }
  }
}

function draw() {
  if (!ctx) return
  ctx.clearRect(0, 0, CW, CH)
  ctx.fillStyle = 'rgba(30,8,40,0.55)'
  rr(PADX, PADY, COLS * CELL, ROWS * CELL, 10)
  ctx.fill()
  ctx.save()
  ctx.beginPath()
  ctx.rect(PADX, PADY, COLS * CELL, ROWS * CELL)
  ctx.clip()
  for (const t of tiles) {
    const x = PADX + t.col * CELL
    const y = PADY + t.y * CELL
    const im = IMG[t.sym]
    let pad = 6
    let a = 1
    if (t.popping) {
      const p = Math.min(1, t.popT / 12)
      a = 1 - p
      pad = 6 + p * (CELL / 2 - 6)
    }
    ctx.globalAlpha = a
    if (im && im.complete && im.naturalWidth) ctx.drawImage(im, x + pad, y + pad, CELL - pad * 2, CELL - pad * 2)
    else {
      ctx.fillStyle = '#c060a0'
      ctx.beginPath()
      ctx.arc(x + CELL / 2, y + CELL / 2, CELL / 2 - pad, 0, 6.28)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }
  ctx.restore()
}
function rr(x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function settle() {
  return new Promise((res) => { settleResolve = res })
}
function allSettled() {
  return tiles.every((t) => Math.abs(t.y - t.row) < 0.02)
}

// ---------- cascade evaluation ----------
function payFor(sym, n) {
  const tier = n >= 12 ? 2 : n >= 10 ? 1 : 0
  return SYMBOLS[sym].pay[tier]
}
function findWins() {
  const groups = {}
  for (const t of tiles) {
    if (t.scatter || t.popping) continue
    ;(groups[t.sym] ??= []).push(t)
  }
  let win = 0
  const popping = []
  for (const [sym, list] of Object.entries(groups)) {
    if (list.length >= 8) {
      win += payFor(sym, list.length) * bet.value
      popping.push(...list)
    }
  }
  return { win, popping }
}
function refill() {
  // per column: keep survivors, drop them to the bottom, spawn new above
  for (let c = 0; c < COLS; c++) {
    const col = tiles.filter((t) => t.col === c && !t.popping).sort((a, b) => a.row - b.row)
    const need = ROWS - col.length
    // assign target rows bottom-up
    col.forEach((t, i) => { t.row = need + i })
    for (let i = 0; i < need; i++) {
      tiles.push(newTile(c, i, i - need - 1, randSym()))
    }
  }
  tiles = tiles.filter((t) => !t.popping)
}

async function spin() {
  if (spinning.value) return
  const free = freeSpins.value > 0
  if (!free) {
    if (credits.value < bet.value) { showBust.value = true; autospin.value = false; return }
    progressStore.addCredits(-bet.value)
    progressStore.setJackpot(casino.value.jackpot + bet.value * 0.02)
  } else {
    freeSpins.value--
  }

  spinning.value = true
  lastWin.value = 0
  multi.value = 1
  clearBanner()
  haptics.light()

  fillGrid()
  await settle()

  // scatter check on the fresh grid
  const scatters = tiles.filter((t) => t.scatter).length

  const cap = free ? FREE_CAP : BASE_CAP
  let spinWin = 0
  let chain = 0
  for (;;) {
    const { win, popping } = findWins()
    if (!popping.length) break
    chain++
    const m = Math.min(chain, cap)
    multi.value = m
    spinWin += win * m
    for (const t of popping) { t.popping = true; t.popT = 0 }
    haptics.medium()
    await sleep(260)
    refill()
    await settle()
  }

  // jackpot on a long cascade chain
  let jackpotHit = false
  if (chain >= 7) {
    spinWin += Math.round(casino.value.jackpot)
    progressStore.setJackpot(progressStore.JACKPOT_SEED)
    jackpotHit = true
  }

  if (spinWin > 0) {
    progressStore.addCredits(spinWin)
    lastWin.value = spinWin
    haptics.success()
    celebrate(spinWin, jackpotHit)
  }
  progressStore.recordSpin(spinWin)
  multi.value = 1

  // free spins trigger / retrigger
  if (scatters >= 4 || (free && scatters >= 3)) {
    const award = scatters >= 6 ? 20 : scatters >= 5 ? 15 : 10
    const first = freeSpins.value === 0
    freeSpins.value += award
    freeTotal.value = first ? award : freeTotal.value + award
    freeIntro.value = award
    haptics.heavy()
    setTimeout(() => (freeIntro.value = 0), 1600)
  }

  spinning.value = false
  if (freeSpins.value > 0) setTimeout(() => { if (!spinning.value) spin() }, 850)
  else if (autospin.value) setTimeout(() => {
    if (autospin.value && !spinning.value) {
      if (credits.value < bet.value) { autospin.value = false; showBust.value = true }
      else spin()
    }
  }, 800)
}

function celebrate(win, jackpot) {
  const ratio = win / bet.value
  let cls, title
  if (jackpot) { cls = 'epic'; title = 'JACKPOT!!!' }
  else if (ratio >= 50) { cls = 'epic'; title = 'EPIC WIN' }
  else if (ratio >= 20) { cls = 'mega'; title = 'MEGA WIN' }
  else if (ratio >= 8) { cls = 'big'; title = 'BIG WIN' }
  else return
  banner.value = { cls, title, amount: win }
  clearTimeout(bannerTimer)
  bannerTimer = setTimeout(() => (banner.value = null), 2200)
}
function clearBanner() {
  banner.value = null
  clearTimeout(bannerTimer)
}

function loop() {
  cancelAnimationFrame(raf)
  const step = () => {
    const target = casino.value.jackpot
    jackpotDisplay.value += (target - jackpotDisplay.value) * 0.08
    if (Math.abs(target - jackpotDisplay.value) < 1) jackpotDisplay.value = target
    // fall / settle
    for (const t of tiles) {
      if (t.popping) { t.popT++; continue }
      const d = t.row - t.y
      if (Math.abs(d) > 0.02) t.y += d * 0.3
      else t.y = t.row
    }
    if (settleResolve && allSettled()) { const r = settleResolve; settleResolve = null; r() }
    draw()
    raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)
}

function onSpin() { if (!spinning.value) spin() }
function changeBet(d) {
  if (spinning.value || freeSpins.value > 0) return
  betIdx.value = Math.max(0, Math.min(BETS.length - 1, betIdx.value + d))
  haptics.light()
}
function toggleAuto() {
  if (freeSpins.value > 0) return
  autospin.value = !autospin.value
  haptics.light()
  if (autospin.value && !spinning.value) spin()
}
function collectTopup() {
  progressStore.addCredits(TOPUP)
  showBust.value = false
  haptics.success()
}
function goBack() {
  haptics.light()
  router.push({ name: 'lobby' })
}
function howToPlay() {
  haptics.light()
  router.push({ name: 'how-to-play' })
}

onMounted(() => {
  ctx = canvasEl.value.getContext('2d')
  jackpotDisplay.value = casino.value.jackpot
  // show a static starting grid
  tiles = []
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) tiles.push(newTile(c, r, r, randSym()))
  loop()
})
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  clearTimeout(bannerTimer)
})
</script>

<style lang="scss" scoped>
.slots-page { min-height: 100vh; transition: background 2s ease; display: flex; flex-direction: column; align-items: center; overflow: hidden; }
.game-header { width: 100%; max-width: 540px; display: flex; align-items: center; gap: 8px; padding: 12px 14px; padding-top: max(52px, calc(env(safe-area-inset-top) + 12px)); }
.machine-title { flex: 1; text-align: center; color: #fff; font-weight: 800; font-size: 1.2rem; letter-spacing: 0.03em; text-shadow: 0 2px 10px rgba(0, 0, 0, 0.4); }
.header-menu { display: flex; gap: 2px; }

.jackpot { display: flex; align-items: center; gap: 10px; padding: 6px 20px; border-radius: 999px; background: linear-gradient(90deg, rgba(255, 130, 200, 0.28), rgba(150, 120, 255, 0.28)); border: 1px solid rgba(255, 170, 220, 0.5); margin-bottom: 4px; }
.jp-label { color: #ffc0e6; font-weight: 800; font-size: 0.8rem; letter-spacing: 0.05em; }
.jp-value { color: #fff; font-weight: 800; font-size: 1.25rem; font-variant-numeric: tabular-nums; text-shadow: 0 0 10px rgba(255, 170, 220, 0.7); }

.board-wrap { width: 100%; display: flex; justify-content: center; padding: 6px 12px; flex: 1; align-items: center; }
.board { position: relative; width: min(96vw, 58vh, 440px); }
.reels { width: 100%; height: auto; display: block; border-radius: 14px; background: rgba(0, 0, 0, 0.3); }

.multi-chip {
  position: absolute;
  top: 8px; right: 10px;
  background: linear-gradient(135deg, #ff8ac6, #b06bff);
  color: #fff; font-weight: 900; font-size: 1.3rem;
  padding: 2px 12px; border-radius: 999px;
  box-shadow: 0 4px 14px rgba(200, 100, 220, 0.5);
  pointer-events: none;
}
.win-banner { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none; gap: 4px; }
.wb-title { font-weight: 900; font-size: 2rem; letter-spacing: 0.04em; text-shadow: 0 2px 14px rgba(0, 0, 0, 0.7); }
.wb-amount { font-weight: 800; font-size: 1.6rem; color: #fff; text-shadow: 0 2px 12px rgba(0, 0, 0, 0.8); }
.win-banner.big .wb-title { color: #7cf0a0; }
.win-banner.mega .wb-title { color: #ffd54f; }
.win-banner.epic .wb-title { color: #ff8ae0; animation: shake 0.4s ease infinite; }
@keyframes shake { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.08); } }
.fs-intro { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(30, 6, 40, 0.7); border-radius: 14px; pointer-events: none; }
.fs-title { font-weight: 900; font-size: 2.1rem; color: #ffd54f; text-shadow: 0 0 18px rgba(255, 200, 90, 0.8); }
.fs-sub { color: #fff; font-weight: 700; margin-top: 4px; }
.pop-enter-active { animation: popin 0.3s ease; }
@keyframes popin { 0% { opacity: 0; transform: scale(0.5); } 100% { opacity: 1; transform: scale(1); } }

.statusline { height: 26px; display: flex; align-items: center; justify-content: center; color: #fff; }
.win-amt { color: #7cf0a0; font-weight: 800; font-size: 1.1rem; }
.fs-tag { color: #ffd54f; font-weight: 800; }
.hint-txt { color: rgba(255, 255, 255, 0.7); font-size: 0.85rem; }

.controls { width: 100%; max-width: 460px; padding: 4px 14px max(14px, env(safe-area-inset-bottom)); }
.wallet { display: flex; gap: 10px; margin-bottom: 8px; }
.w-box { flex: 1; background: rgba(0, 0, 0, 0.28); border-radius: 12px; padding: 6px 14px; color: #fff; text-align: center; }
.w-label { font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.7; }
.w-val { font-size: 1.2rem; font-weight: 800; font-variant-numeric: tabular-nums; }
.w-box:last-child .w-val { color: #ffd54f; }
.row { display: flex; align-items: center; gap: 12px; justify-content: center; }
.bet-stepper { display: flex; align-items: center; gap: 6px; background: rgba(0, 0, 0, 0.28); border-radius: 14px; padding: 5px 8px; }
.step { background: rgba(255, 255, 255, 0.14) !important; color: #fff; }
.bet-mid { text-align: center; color: #fff; min-width: 50px; }
.bet-line { font-weight: 800; font-size: 0.95rem; }
.lines { font-size: 0.62rem; opacity: 0.6; }
.spin-btn { flex: 1; max-width: 150px; height: 66px; border: none; border-radius: 18px; background: linear-gradient(135deg, #ff6fb5, #b06bff); color: #fff; font-weight: 900; font-size: 1.1rem; letter-spacing: 0.05em; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; cursor: pointer; box-shadow: 0 6px 18px rgba(200, 100, 220, 0.4); transition: transform 0.1s ease, filter 0.2s ease; }
.spin-btn:active { transform: scale(0.95); }
.spin-btn:disabled { filter: grayscale(0.5) brightness(0.7); }
.auto-btn { background: rgba(255, 255, 255, 0.14) !important; color: #fff; width: 46px; height: 46px; }
.auto-btn.on { background: #5fd0e0 !important; color: #11343a; }
.dlg { background: rgba(40, 18, 60, 0.97); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 18px; color: #fff; min-width: 280px; :deep(*) { color: #fff; } }
.dlg-title { font-size: 1.4rem; font-weight: 800; }
.dlg-sub { opacity: 0.8; margin-top: 6px; }
:deep(.q-btn.bg-primary) { background: linear-gradient(135deg, #ff6fb5 0%, #b06bff 100%) !important; }
</style>
