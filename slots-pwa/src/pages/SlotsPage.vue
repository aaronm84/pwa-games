<template>
  <q-page class="slots-page" :style="{ background: themeStore.colors.gradient }" :data-spinning="spinning">
    <!-- Header -->
    <div class="game-header">
      <q-btn fab-mini flat icon="arrow_back" color="white" @click="goBack" />
      <div class="machine-title">Gem Fortune</div>
      <div class="header-menu">
        <q-btn fab-mini flat icon="help_outline" color="white" @click="howToPlay" />
      </div>
    </div>

    <!-- Jackpot ticker -->
    <div class="jackpot">
      <span class="jp-label">💎 JACKPOT</span>
      <span class="jp-value">{{ Math.round(jackpotDisplay).toLocaleString() }}</span>
    </div>

    <!-- Reels -->
    <div class="board-wrap">
      <div class="board">
        <canvas ref="canvasEl" :width="CW" :height="CH" class="reels"></canvas>

        <transition name="pop">
          <div v-if="banner" class="win-banner" :class="banner.cls">
            <div class="wb-title">{{ banner.title }}</div>
            <div class="wb-amount">{{ banner.amount.toLocaleString() }}</div>
          </div>
        </transition>

        <transition name="pop">
          <div v-if="freeIntro" class="fs-intro">
            <div class="fs-title">FREE SPINS!</div>
            <div class="fs-sub">{{ freeIntro }} spins · ×{{ FREE_MULT }} wins</div>
          </div>
        </transition>
      </div>
    </div>

    <!-- Win / status line -->
    <div class="statusline">
      <template v-if="freeSpins > 0">
        <span class="fs-tag">FREE SPIN {{ freeTotal - freeSpins + 1 }}/{{ freeTotal }} · ×{{ FREE_MULT }}</span>
      </template>
      <template v-else-if="lastWin > 0">
        <span class="win-amt">WIN {{ lastWin.toLocaleString() }}</span>
      </template>
      <template v-else>
        <span class="hint-txt">{{ spinning ? 'Good luck…' : 'Spin to win — 3+ 💰 scatters trigger Free Spins' }}</span>
      </template>
    </div>

    <!-- Controls -->
    <div class="controls">
      <div class="wallet">
        <div class="w-box"><div class="w-label">Credits</div><div class="w-val">{{ credits.toLocaleString() }}</div></div>
        <div class="w-box"><div class="w-label">Bet</div><div class="w-val">{{ totalBet.toLocaleString() }}</div></div>
      </div>
      <div class="row">
        <div class="bet-stepper">
          <q-btn round dense unelevated class="step" icon="remove" :disable="spinning || freeSpins > 0" @click="changeBet(-1)" />
          <div class="bet-mid">
            <div class="bet-line">${{ betPerLine }}<span>/line</span></div>
            <div class="lines">{{ LINES.length }} lines</div>
          </div>
          <q-btn round dense unelevated class="step" icon="add" :disable="spinning || freeSpins > 0" @click="changeBet(1)" />
        </div>
        <button class="spin-btn" :class="{ auto: autospin }" :disabled="spinning && freeSpins === 0" @click="onSpinButton">
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

    <!-- Daily bonus -->
    <q-dialog v-model="showDaily">
      <q-card class="dlg">
        <q-card-section class="text-center">
          <div class="dlg-title">🎁 Daily Bonus</div>
          <div class="dlg-sub">Welcome back — enjoy a fresh stack of credits.</div>
        </q-card-section>
        <q-card-actions align="center">
          <q-btn unelevated color="primary" text-color="white" :label="`Collect +${DAILY.toLocaleString()}`" @click="collectDaily" />
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
import symBell from 'src/assets/slots/sym-bell.png'
import symHorseshoe from 'src/assets/slots/sym-horseshoe.png'
import symBar from 'src/assets/slots/sym-bar.png'
import symSeven from 'src/assets/slots/sym-seven.png'
import symDiamond from 'src/assets/slots/sym-diamond.png'
import symCoin from 'src/assets/slots/sym-coin.png'

const router = useRouter()
const themeStore = useThemeStore()
const progressStore = useProgressStore()
const { casino } = storeToRefs(progressStore)
const haptics = useHaptics()

// ---------- machine definition ----------
const REELS = 5
const ROWS = 3
const FREE_MULT = 2
const TOPUP = 2000
const DAILY = 1000
const BETS = [1, 2, 5, 10, 25, 50]

// symbol table: img, and paytable for [3,4,5] of a kind (× betPerLine)
const SYMBOLS = {
  cherry: { img: symCherry, pay: [2, 5, 15] },
  lemon: { img: symLemon, pay: [2, 5, 15] },
  orange: { img: symOrange, pay: [3, 8, 20] },
  plum: { img: symPlum, pay: [3, 8, 25] },
  bell: { img: symBell, pay: [5, 15, 50] },
  horseshoe: { img: symHorseshoe, pay: [8, 25, 75] },
  bar: { img: symBar, pay: [15, 50, 150] },
  seven: { img: symSeven, pay: [25, 100, 300] },
  diamond: { img: symDiamond, pay: [50, 200, 750], wild: true }, // WILD, pays top
  coin: { img: symCoin, pay: [2, 10, 50], scatter: true }, // SCATTER (× total bet)
}
const SYM_KEYS = Object.keys(SYMBOLS)

// preload images
const IMG = {}
for (const k of SYM_KEYS) {
  const im = new Image()
  im.src = SYMBOLS[k].img
  IMG[k] = im
}

// weighted reel strip (shared shape, shuffled per reel) — low common, high/wild/scatter rare
const STRIP_WEIGHTS = {
  cherry: 6, lemon: 6, orange: 5, plum: 5,
  bell: 4, horseshoe: 4, bar: 3, seven: 2,
  diamond: 2, coin: 2,
}
function makeStrip() {
  const s = []
  for (const [k, n] of Object.entries(STRIP_WEIGHTS)) for (let i = 0; i < n; i++) s.push(k)
  for (let i = s.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[s[i], s[j]] = [s[j], s[i]]
  }
  return s
}
const strips = Array.from({ length: REELS }, makeStrip)

// 20 paylines (row index per reel)
const LINES = [
  [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0], [2, 1, 0, 1, 2],
  [0, 0, 1, 2, 2], [2, 2, 1, 0, 0], [1, 0, 0, 0, 1], [1, 2, 2, 2, 1],
  [0, 1, 1, 1, 0], [2, 1, 1, 1, 2], [1, 0, 1, 2, 1], [1, 2, 1, 0, 1],
  [0, 0, 1, 0, 0], [2, 2, 1, 2, 2], [0, 1, 0, 1, 0], [2, 1, 2, 1, 2],
  [1, 1, 0, 1, 1], [1, 1, 2, 1, 1], [0, 2, 0, 2, 0],
]

// ---------- canvas geometry ----------
const CELL = 96
const PADX = 8
const PADY = 8
const CW = REELS * CELL + PADX * 2
const CH = ROWS * CELL + PADY * 2

// ---------- reactive state ----------
const canvasEl = ref(null)
const spinning = ref(false)
const betIdx = ref(2) // $5/line default
const lastWin = ref(0)
const banner = ref(null)
const freeIntro = ref(0)
const freeSpins = ref(0)
const freeTotal = ref(0)
const autospin = ref(false)
const showBust = ref(false)
const showDaily = ref(false)
const jackpotDisplay = ref(0)

const credits = computed(() => casino.value.credits)
const betPerLine = computed(() => BETS[betIdx.value])
const totalBet = computed(() => betPerLine.value * LINES.length)

// ---------- game data (non-reactive) ----------
let ctx = null
let raf = null
let reels = []
let grid = [] // [reel][row] final symbol keys
let winLines = [] // { line, sym, count }
let winFlash = 0
let bannerTimer = null
let pendingResolve = null

// ---------- helpers ----------
function initReels() {
  reels = Array.from({ length: REELS }, (_, r) => ({
    strip: [],
    scroll: 0,
    target: 0,
    dur: 0,
    t: 0,
    spinning: false,
    result: [strips[r][0], strips[r][1], strips[r][2]],
  }))
  grid = reels.map((rl) => rl.result.slice())
}

function draw() {
  if (!ctx) return
  ctx.clearRect(0, 0, CW, CH)
  ctx.fillStyle = 'rgba(10,6,26,0.65)'
  rr(PADX, PADY, REELS * CELL, ROWS * CELL, 10)
  ctx.fill()

  for (let r = 0; r < REELS; r++) {
    const rl = reels[r]
    const x = PADX + r * CELL
    ctx.save()
    ctx.beginPath()
    ctx.rect(x, PADY, CELL, ROWS * CELL)
    ctx.clip()
    if (rl.spinning) {
      const top = Math.floor(rl.scroll / CELL)
      const frac = rl.scroll % CELL
      for (let k = -1; k < ROWS + 1; k++) {
        const idx = top + k
        if (idx < 0 || idx >= rl.strip.length) continue
        drawSym(rl.strip[idx], x, PADY + k * CELL - frac)
      }
    } else {
      for (let row = 0; row < ROWS; row++) {
        const dim = winLines.length > 0 && !isWinningCell(r, row)
        drawSym(rl.result[row], x, PADY + row * CELL, dim ? 0.35 : 1)
      }
    }
    ctx.restore()
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'
    ctx.lineWidth = 1
    ctx.strokeRect(x + 0.5, PADY + 0.5, CELL, ROWS * CELL)
  }

  if (winFlash > 0 && winLines.length) {
    for (const w of winLines) {
      ctx.strokeStyle = `rgba(255,225,90,${0.35 + 0.4 * Math.abs(Math.sin(winFlash / 6))})`
      ctx.lineWidth = 3
      ctx.beginPath()
      for (let r = 0; r < w.count; r++) {
        const row = LINES[w.line][r]
        const px = PADX + r * CELL + CELL / 2
        const py = PADY + row * CELL + CELL / 2
        if (r === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.stroke()
    }
  }
}
function drawSym(key, x, y, alpha = 1) {
  const im = IMG[key]
  const pad = 8
  ctx.globalAlpha = alpha
  if (im && im.complete && im.naturalWidth) {
    ctx.drawImage(im, x + pad, y + pad, CELL - pad * 2, CELL - pad * 2)
  } else {
    ctx.fillStyle = '#5c6bc0'
    ctx.beginPath()
    ctx.arc(x + CELL / 2, y + CELL / 2, CELL / 2 - pad, 0, 6.28)
    ctx.fill()
  }
  ctx.globalAlpha = 1
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
function isWinningCell(reel, row) {
  for (const w of winLines) if (reel < w.count && LINES[w.line][reel] === row) return true
  return false
}

// ---------- spin ----------
function pickResults() {
  const res = []
  for (let r = 0; r < REELS; r++) {
    const strip = strips[r]
    const stop = Math.floor(Math.random() * strip.length)
    res.push([strip[stop % strip.length], strip[(stop + 1) % strip.length], strip[(stop + 2) % strip.length]])
  }
  return res
}
function buildDisplayStrip(reelIndex, result) {
  const n = 18 + reelIndex * 5
  const strip = []
  for (let i = 0; i < n; i++) strip.push(strips[reelIndex][Math.floor(Math.random() * strips[reelIndex].length)])
  strip.push(result[0], result[1], result[2])
  return strip
}

async function spin() {
  if (spinning.value) return
  const free = freeSpins.value > 0
  if (!free) {
    if (credits.value < totalBet.value) {
      showBust.value = true
      autospin.value = false
      return
    }
    progressStore.addCredits(-totalBet.value)
    progressStore.setJackpot(casino.value.jackpot + totalBet.value * 0.02)
  } else {
    freeSpins.value--
  }

  spinning.value = true
  lastWin.value = 0
  winLines = []
  winFlash = 0
  clearBanner()
  haptics.light()

  const results = pickResults()
  let scatterSoFar = 0
  for (let r = 0; r < 3; r++) scatterSoFar += results[r].filter((s) => s === 'coin').length

  for (let r = 0; r < REELS; r++) {
    const rl = reels[r]
    rl.strip = buildDisplayStrip(r, results[r])
    rl.scroll = 0
    rl.target = (rl.strip.length - ROWS) * CELL
    rl.dur = 620 + r * 170 + (scatterSoFar >= 2 && r >= 3 ? 700 : 0)
    rl.t = 0
    rl.spinning = true
    rl.result = results[r]
  }

  await new Promise((resolve) => {
    pendingResolve = resolve
  })

  grid = reels.map((rl) => rl.result.slice())
  resolveWins(free)
}

function resolveWins(free) {
  const bet = betPerLine.value
  const tbet = totalBet.value
  let total = 0
  const lines = []
  let jackpotHit = false

  for (let li = 0; li < LINES.length; li++) {
    const pat = LINES[li]
    const syms = pat.map((row, r) => grid[r][row])
    let base = null
    for (const s of syms) {
      if (s === 'coin') break
      if (!SYMBOLS[s].wild) { base = s; break }
    }
    if (base === null && syms[0] === 'diamond') base = 'diamond'
    if (!base || base === 'coin') continue
    let count = 0
    for (const s of syms) {
      if (s === base || SYMBOLS[s].wild) count++
      else break
    }
    if (count >= 3) {
      total += SYMBOLS[base].pay[count - 3] * bet
      lines.push({ line: li, sym: base, count })
      if (base === 'diamond' && count === 5) jackpotHit = true
    }
  }

  let scatterCount = 0
  for (let r = 0; r < REELS; r++) for (let row = 0; row < ROWS; row++) if (grid[r][row] === 'coin') scatterCount++
  if (scatterCount >= 3) total += SYMBOLS.coin.pay[Math.min(scatterCount, 5) - 3] * tbet

  let win = total
  if (free) win *= FREE_MULT
  winLines = lines

  if (jackpotHit) {
    win += Math.round(casino.value.jackpot)
    progressStore.setJackpot(progressStore.JACKPOT_SEED)
  }

  if (win > 0) {
    progressStore.addCredits(win)
    lastWin.value = win
    winFlash = 1
    haptics.success()
    celebrate(win, tbet, jackpotHit)
  }
  progressStore.recordSpin(win)

  if (scatterCount >= 3) {
    const award = scatterCount >= 5 ? 20 : scatterCount === 4 ? 15 : 10
    const first = freeSpins.value === 0
    freeSpins.value += award
    freeTotal.value = first ? award : freeTotal.value + award
    freeIntro.value = award
    haptics.heavy()
    setTimeout(() => (freeIntro.value = 0), 1600)
  }

  spinning.value = false

  if (freeSpins.value > 0) {
    setTimeout(() => { if (!spinning.value) spin() }, 900)
  } else if (autospin.value) {
    setTimeout(() => {
      if (autospin.value && !spinning.value) {
        if (credits.value < totalBet.value) { autospin.value = false; showBust.value = true }
        else spin()
      }
    }, 850)
  }
}

function celebrate(win, tbet, jackpot) {
  const ratio = win / tbet
  let cls, title
  if (jackpot) { cls = 'epic'; title = 'JACKPOT!!!' }
  else if (ratio >= 50) { cls = 'epic'; title = 'EPIC WIN' }
  else if (ratio >= 25) { cls = 'mega'; title = 'MEGA WIN' }
  else if (ratio >= 10) { cls = 'big'; title = 'BIG WIN' }
  else return
  banner.value = { cls, title, amount: win }
  clearTimeout(bannerTimer)
  bannerTimer = setTimeout(() => (banner.value = null), 2200)
}
function clearBanner() {
  banner.value = null
  clearTimeout(bannerTimer)
}

// ---------- loop ----------
function loop() {
  cancelAnimationFrame(raf)
  let last = 0
  const step = (now) => {
    if (!last) last = now
    const dt = Math.min(now - last, 50)
    last = now
    const target = casino.value.jackpot
    jackpotDisplay.value += (target - jackpotDisplay.value) * 0.08
    if (Math.abs(target - jackpotDisplay.value) < 1) jackpotDisplay.value = target

    for (const rl of reels) {
      if (!rl.spinning) continue
      rl.t += dt
      const p = Math.min(1, rl.t / rl.dur)
      rl.scroll = rl.target * easeOutBack(p)
      if (p >= 1) {
        rl.scroll = rl.target
        rl.spinning = false
        haptics.light()
      }
    }
    if (winFlash > 0) winFlash++
    if (winFlash > 90) winFlash = 0
    if (pendingResolve && spinning.value && reels.every((rl) => !rl.spinning)) {
      const r = pendingResolve
      pendingResolve = null
      r()
    }
    draw()
    raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)
}
function easeOutBack(t) {
  const c1 = 1.2
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

// ---------- controls ----------
function onSpinButton() {
  if (spinning.value) return
  spin()
}
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
function collectDaily() {
  progressStore.addCredits(DAILY)
  casino.value.lastDaily = todayNum()
  progressStore.save()
  showDaily.value = false
  haptics.success()
}
function todayNum() {
  return Math.floor(Date.now() / 86400000)
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
  initReels()
  loop()
  // daily bonus is offered at the lobby, not per-machine
})
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  clearTimeout(bannerTimer)
})
</script>

<style lang="scss" scoped>
.slots-page {
  min-height: 100vh;
  transition: background 2s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow: hidden;
}
.game-header {
  width: 100%;
  max-width: 540px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  padding-top: max(52px, calc(env(safe-area-inset-top) + 12px));
}
.machine-title {
  flex: 1;
  text-align: center;
  color: #fff;
  font-weight: 800;
  font-size: 1.2rem;
  letter-spacing: 0.03em;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.4);
}
.header-menu { display: flex; gap: 2px; }

.jackpot {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 20px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(255, 190, 60, 0.25), rgba(255, 120, 200, 0.25));
  border: 1px solid rgba(255, 220, 120, 0.5);
  margin-bottom: 4px;
}
.jp-label { color: #ffe08a; font-weight: 800; font-size: 0.8rem; letter-spacing: 0.05em; }
.jp-value { color: #fff; font-weight: 800; font-size: 1.25rem; font-variant-numeric: tabular-nums; text-shadow: 0 0 10px rgba(255, 210, 120, 0.7); }

.board-wrap { width: 100%; display: flex; justify-content: center; padding: 6px 12px; flex: 1; align-items: center; }
.board { position: relative; width: min(96vw, 60vh, 460px); }
.reels { width: 100%; height: auto; display: block; border-radius: 14px; background: rgba(0, 0, 0, 0.3); }

.win-banner {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  gap: 4px;
}
.wb-title {
  font-weight: 900;
  font-size: 2rem;
  letter-spacing: 0.04em;
  text-shadow: 0 2px 14px rgba(0, 0, 0, 0.7);
}
.wb-amount { font-weight: 800; font-size: 1.6rem; color: #fff; text-shadow: 0 2px 12px rgba(0, 0, 0, 0.8); }
.win-banner.big .wb-title { color: #7cf0a0; }
.win-banner.mega .wb-title { color: #ffd54f; }
.win-banner.epic .wb-title { color: #ff8ae0; animation: shake 0.4s ease infinite; }
@keyframes shake {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.08); }
}

.fs-intro {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(20, 6, 40, 0.7);
  border-radius: 14px;
  pointer-events: none;
}
.fs-title { font-weight: 900; font-size: 2.1rem; color: #ffd54f; text-shadow: 0 0 18px rgba(255, 200, 90, 0.8); }
.fs-sub { color: #fff; font-weight: 700; margin-top: 4px; }

.pop-enter-active { animation: popin 0.3s ease; }
@keyframes popin {
  0% { opacity: 0; transform: scale(0.5); }
  100% { opacity: 1; transform: scale(1); }
}

.statusline {
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}
.win-amt { color: #7cf0a0; font-weight: 800; font-size: 1.1rem; }
.fs-tag { color: #ffd54f; font-weight: 800; }
.hint-txt { color: rgba(255, 255, 255, 0.7); font-size: 0.85rem; }

.controls {
  width: 100%;
  max-width: 460px;
  padding: 4px 14px max(14px, env(safe-area-inset-bottom));
}
.wallet { display: flex; gap: 10px; margin-bottom: 8px; }
.w-box {
  flex: 1;
  background: rgba(0, 0, 0, 0.28);
  border-radius: 12px;
  padding: 6px 14px;
  color: #fff;
  text-align: center;
}
.w-label { font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.7; }
.w-val { font-size: 1.2rem; font-weight: 800; font-variant-numeric: tabular-nums; }
.w-box:last-child .w-val { color: #ffd54f; }

.row { display: flex; align-items: center; gap: 12px; justify-content: center; }
.bet-stepper {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(0, 0, 0, 0.28);
  border-radius: 14px;
  padding: 5px 8px;
}
.step { background: rgba(255, 255, 255, 0.14) !important; color: #fff; }
.bet-mid { text-align: center; color: #fff; min-width: 62px; }
.bet-line { font-weight: 800; font-size: 0.95rem; span { opacity: 0.6; font-weight: 600; font-size: 0.7rem; } }
.lines { font-size: 0.62rem; opacity: 0.6; }

.spin-btn {
  flex: 1;
  max-width: 150px;
  height: 66px;
  border: none;
  border-radius: 18px;
  background: linear-gradient(135deg, #ff8a3d, #ff4d6d);
  color: #fff;
  font-weight: 900;
  font-size: 1.1rem;
  letter-spacing: 0.05em;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  cursor: pointer;
  box-shadow: 0 6px 18px rgba(255, 80, 100, 0.4);
  transition: transform 0.1s ease, filter 0.2s ease;
}
.spin-btn:active { transform: scale(0.95); }
.spin-btn:disabled { filter: grayscale(0.5) brightness(0.7); }
.spin-btn.auto { background: linear-gradient(135deg, #8e5fc8, #5fd0e0); }

.auto-btn { background: rgba(255, 255, 255, 0.14) !important; color: #fff; width: 46px; height: 46px; }
.auto-btn.on { background: #5fd0e0 !important; color: #11343a; }

.dlg {
  background: rgba(40, 18, 60, 0.97);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 18px;
  color: #fff;
  min-width: 280px;
  :deep(*) { color: #fff; }
}
.dlg-title { font-size: 1.4rem; font-weight: 800; }
.dlg-sub { opacity: 0.8; margin-top: 6px; }
:deep(.q-btn.bg-primary) { background: linear-gradient(135deg, #ff8a3d 0%, #ff4d6d 100%) !important; }
</style>
