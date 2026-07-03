<template>
  <q-page class="slots-page" :style="{ background: themeStore.colors.gradient }" :data-spinning="spinning">
    <!-- Header -->
    <div class="game-header">
      <q-btn fab-mini flat icon="arrow_back" color="white" @click="goBack" />
      <div class="machine-title">Wild Ways</div>
      <div class="header-menu">
        <q-btn fab-mini flat icon="help_outline" color="white" @click="howToPlay" />
      </div>
    </div>

    <!-- Jackpot + ways -->
    <div class="topbar">
      <div class="jackpot">
        <span class="jp-label">🌟 JACKPOT</span>
        <span class="jp-value">{{ Math.round(jackpotDisplay).toLocaleString() }}</span>
      </div>
      <div class="ways-chip">{{ ways.toLocaleString() }} ways</div>
    </div>

    <!-- Reels -->
    <div class="board-wrap">
      <div class="board">
        <canvas ref="canvasEl" :width="CW" :height="CH" class="reels"></canvas>
        <transition name="pop">
          <div v-if="freeSpins > 0 && freeMult > 1" class="multi-chip">×{{ freeMult }}</div>
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
            <div class="fs-sub">{{ freeIntro }} spins · growing multiplier</div>
          </div>
        </transition>
      </div>
    </div>

    <!-- Status -->
    <div class="statusline">
      <span v-if="freeSpins > 0" class="fs-tag">FREE SPIN {{ freeTotal - freeSpins + 1 }}/{{ freeTotal }} · ×{{ freeMult }}</span>
      <span v-else-if="lastWin > 0" class="win-amt">WIN {{ lastWin.toLocaleString() }}</span>
      <span v-else class="hint-txt">{{ spinning ? 'Spinning…' : 'Match symbols on adjacent reels — thousands of ways to win' }}</span>
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

import symSeven from 'src/assets/slots/sym-seven.png'
import symBar from 'src/assets/slots/sym-bar.png'
import symBell from 'src/assets/slots/sym-bell.png'
import symHorseshoe from 'src/assets/slots/sym-horseshoe.png'
import symHeart from 'src/assets/slots/sym-heart.png'
import symClover from 'src/assets/slots/sym-clover.png'
import symDiamond from 'src/assets/slots/sym-diamond.png'
import symCoin from 'src/assets/slots/sym-coin.png'

const router = useRouter()
const themeStore = useThemeStore()
const progressStore = useProgressStore()
const { casino } = storeToRefs(progressStore)
const haptics = useHaptics()

const REELS = 6
const MINH = 2
const MAXH = 6
const TOPUP = 2000
const BETS = [10, 20, 50, 100, 200, 500]

// paying symbols pay for 3..6 adjacent reels (× ways × bet); diamond = wild, coin = scatter
const SYMBOLS = {
  clover: { img: symClover, w: 18, pay: [0.1, 0.2, 0.5, 1.0] },
  heart: { img: symHeart, w: 16, pay: [0.1, 0.3, 0.6, 1.2] },
  horseshoe: { img: symHorseshoe, w: 14, pay: [0.15, 0.4, 0.8, 1.5] },
  bell: { img: symBell, w: 11, pay: [0.2, 0.5, 1.0, 2.0] },
  bar: { img: symBar, w: 8, pay: [0.3, 0.8, 1.6, 3.0] },
  seven: { img: symSeven, w: 5, pay: [0.5, 1.5, 3.0, 6.0] },
  diamond: { img: symDiamond, w: 5, wild: true },
  coin: { img: symCoin, w: 4, scatter: true },
}
const SYM_KEYS = Object.keys(SYMBOLS)
const PAYING = SYM_KEYS.filter((k) => !SYMBOLS[k].wild && !SYMBOLS[k].scatter)
const IMG = {}
for (const k of SYM_KEYS) {
  const im = new Image()
  im.src = SYMBOLS[k].img
  IMG[k] = im
}
const POOL = []
for (const k of SYM_KEYS) for (let i = 0; i < SYMBOLS[k].w; i++) POOL.push(k)
const randSym = () => POOL[Math.floor(Math.random() * POOL.length)]

// ---------- geometry ----------
const CELL = 62
const PADX = 6
const PADY = 6
const CW = REELS * CELL + PADX * 2
const CH = MAXH * CELL + PADY * 2

// ---------- state ----------
const canvasEl = ref(null)
const spinning = ref(false)
const betIdx = ref(1)
const lastWin = ref(0)
const banner = ref(null)
const ways = ref(1)
const freeIntro = ref(0)
const freeSpins = ref(0)
const freeTotal = ref(0)
const freeMult = ref(1)
const autospin = ref(false)
const showBust = ref(false)
const jackpotDisplay = ref(0)

const credits = computed(() => casino.value.credits)
const bet = computed(() => BETS[betIdx.value])

// ---------- game data ----------
let ctx = null
let raf = null
let reels = [] // { h, result:[syms], strip, scroll, target, dur, t, spinning }
let winCells = [] // {reel,row} to highlight
let winFlash = 0
let bannerTimer = null
let pendingResolve = null

function makeReel(h) {
  const result = Array.from({ length: h }, randSym)
  return { h, result, strip: [], scroll: 0, target: 0, dur: 0, t: 0, spinning: false }
}
function initReels() {
  reels = Array.from({ length: REELS }, () => makeReel(MINH + Math.floor(Math.random() * (MAXH - MINH + 1))))
  updateWays()
}
function updateWays() {
  ways.value = reels.reduce((a, r) => a * r.h, 1)
}

function draw() {
  if (!ctx) return
  ctx.clearRect(0, 0, CW, CH)
  ctx.fillStyle = 'rgba(8,10,30,0.6)'
  rr(PADX, PADY, REELS * CELL, MAXH * CELL, 10)
  ctx.fill()
  for (let r = 0; r < REELS; r++) {
    const rl = reels[r]
    const x = PADX + r * CELL
    const h = rl.h
    // faint slot backgrounds for this reel's active cells
    for (let row = 0; row < h; row++) {
      ctx.fillStyle = 'rgba(255,255,255,0.04)'
      rr(x + 2, PADY + row * CELL + 2, CELL - 4, CELL - 4, 6)
      ctx.fill()
    }
    ctx.save()
    ctx.beginPath()
    ctx.rect(x, PADY, CELL, h * CELL)
    ctx.clip()
    if (rl.spinning) {
      const top = Math.floor(rl.scroll / CELL)
      const frac = rl.scroll % CELL
      for (let k = -1; k < h + 1; k++) {
        const idx = top + k
        if (idx < 0 || idx >= rl.strip.length) continue
        drawSym(rl.strip[idx], x, PADY + k * CELL - frac, 1)
      }
    } else {
      for (let row = 0; row < h; row++) {
        const dim = winCells.length > 0 && !isWin(r, row)
        drawSym(rl.result[row], x, PADY + row * CELL, dim ? 0.3 : 1)
      }
    }
    ctx.restore()
  }
  if (winFlash > 0 && winCells.length) {
    for (const c of winCells) {
      const a = 0.3 + 0.4 * Math.abs(Math.sin(winFlash / 6))
      ctx.strokeStyle = `rgba(255,225,90,${a})`
      ctx.lineWidth = 3
      ctx.strokeRect(PADX + c.reel * CELL + 2, PADY + c.row * CELL + 2, CELL - 4, CELL - 4)
    }
  }
}
function drawSym(key, x, y, alpha) {
  const im = IMG[key]
  const pad = 5
  ctx.globalAlpha = alpha
  if (im && im.complete && im.naturalWidth) ctx.drawImage(im, x + pad, y + pad, CELL - pad * 2, CELL - pad * 2)
  else { ctx.fillStyle = '#5c6bc0'; ctx.beginPath(); ctx.arc(x + CELL / 2, y + CELL / 2, CELL / 2 - pad, 0, 6.28); ctx.fill() }
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
function isWin(reel, row) {
  return winCells.some((c) => c.reel === reel && c.row === row)
}

// ---------- ways evaluation ----------
function evaluate() {
  const bt = bet.value
  let win = 0
  const cells = []
  let jackpotHit = false
  for (const sym of PAYING) {
    let w = 1
    let L = 0
    const runCells = []
    for (let r = 0; r < REELS; r++) {
      const rl = reels[r]
      let c = 0
      const hits = []
      for (let row = 0; row < rl.h; row++) {
        if (rl.result[row] === sym || rl.result[row] === 'diamond') { c++; hits.push({ reel: r, row }) }
      }
      if (c === 0) break
      w *= c
      L++
      runCells.push(...hits)
    }
    if (L >= 3) {
      win += SYMBOLS[sym].pay[L - 3] * w * bt
      cells.push(...runCells)
      if (sym === 'seven' && L === 6) jackpotHit = true
    }
  }
  // scatter
  let scatters = 0
  for (const rl of reels) for (const s of rl.result) if (s === 'coin') scatters++
  return { win, cells, jackpotHit, scatters }
}

// ---------- spin ----------
function buildDisplayStrip(h) {
  const n = 16 + h * 3
  const strip = []
  for (let i = 0; i < n; i++) strip.push(randSym())
  return strip
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
    freeMult.value++
  }

  spinning.value = true
  lastWin.value = 0
  winCells = []
  winFlash = 0
  clearBanner()
  haptics.light()

  // new heights + results
  for (let r = 0; r < REELS; r++) {
    const h = MINH + Math.floor(Math.random() * (MAXH - MINH + 1))
    const result = Array.from({ length: h }, randSym)
    reels[r] = { ...reels[r], h, result, strip: buildDisplayStrip(h), scroll: 0, t: 0, spinning: true }
    reels[r].target = (reels[r].strip.length - h) * CELL
    reels[r].dur = 560 + r * 150
  }
  updateWays()

  await new Promise((resolve) => { pendingResolve = resolve })

  const { win: baseWin, cells, jackpotHit, scatters } = evaluate()
  let win = baseWin
  if (free) win *= freeMult.value
  win = Math.round(win)
  winCells = cells

  if (jackpotHit) {
    win += Math.round(casino.value.jackpot)
    progressStore.setJackpot(progressStore.JACKPOT_SEED)
  }

  if (win > 0) {
    progressStore.addCredits(win)
    lastWin.value = win
    winFlash = 1
    haptics.success()
    celebrate(win, jackpotHit)
  }
  progressStore.recordSpin(win)

  if (scatters >= 4 || (free && scatters >= 3)) {
    const award = scatters >= 6 ? 20 : scatters >= 5 ? 15 : 10
    const first = freeSpins.value === 0
    if (first) { freeTotal.value = award; freeMult.value = 1 } else freeTotal.value += award
    freeSpins.value += award
    freeIntro.value = award
    haptics.heavy()
    setTimeout(() => (freeIntro.value = 0), 1600)
  }

  spinning.value = false
  if (freeSpins.value > 0) setTimeout(() => { if (!spinning.value) spin() }, 850)
  else {
    freeMult.value = 1
    if (autospin.value) setTimeout(() => {
      if (autospin.value && !spinning.value) {
        if (credits.value < bet.value) { autospin.value = false; showBust.value = true }
        else spin()
      }
    }, 800)
  }
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
      if (p >= 1) { rl.scroll = rl.target; rl.spinning = false; haptics.light() }
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
function goBack() { haptics.light(); router.push({ name: 'lobby' }) }
function howToPlay() { haptics.light(); router.push({ name: 'how-to-play' }) }

onMounted(() => {
  ctx = canvasEl.value.getContext('2d')
  jackpotDisplay.value = casino.value.jackpot
  initReels()
  loop()
})
onBeforeUnmount(() => { cancelAnimationFrame(raf); clearTimeout(bannerTimer) })
</script>

<style lang="scss" scoped>
.slots-page { min-height: 100vh; transition: background 2s ease; display: flex; flex-direction: column; align-items: center; overflow: hidden; }
.game-header { width: 100%; max-width: 540px; display: flex; align-items: center; gap: 8px; padding: 12px 14px; padding-top: max(52px, calc(env(safe-area-inset-top) + 12px)); }
.machine-title { flex: 1; text-align: center; color: #fff; font-weight: 800; font-size: 1.2rem; letter-spacing: 0.03em; text-shadow: 0 2px 10px rgba(0, 0, 0, 0.4); }
.header-menu { display: flex; gap: 2px; }

.topbar { display: flex; align-items: center; gap: 8px; }
.jackpot { display: flex; align-items: center; gap: 8px; padding: 6px 16px; border-radius: 999px; background: linear-gradient(90deg, rgba(245, 197, 66, 0.28), rgba(255, 130, 80, 0.28)); border: 1px solid rgba(255, 210, 120, 0.5); }
.jp-label { color: #ffe08a; font-weight: 800; font-size: 0.78rem; letter-spacing: 0.04em; }
.jp-value { color: #fff; font-weight: 800; font-size: 1.15rem; font-variant-numeric: tabular-nums; text-shadow: 0 0 10px rgba(255, 210, 120, 0.7); }
.ways-chip { background: rgba(0, 0, 0, 0.3); color: #9fe6ff; font-weight: 800; font-size: 0.8rem; padding: 5px 12px; border-radius: 999px; font-variant-numeric: tabular-nums; }

.board-wrap { width: 100%; display: flex; justify-content: center; padding: 6px 12px; flex: 1; align-items: center; }
.board { position: relative; width: min(96vw, 58vh, 440px); }
.reels { width: 100%; height: auto; display: block; border-radius: 14px; background: rgba(0, 0, 0, 0.3); }

.multi-chip { position: absolute; top: 8px; right: 10px; background: linear-gradient(135deg, #f5c542, #ff8a3d); color: #3a2600; font-weight: 900; font-size: 1.3rem; padding: 2px 12px; border-radius: 999px; box-shadow: 0 4px 14px rgba(240, 180, 60, 0.5); pointer-events: none; }
.win-banner { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none; gap: 4px; }
.wb-title { font-weight: 900; font-size: 2rem; letter-spacing: 0.04em; text-shadow: 0 2px 14px rgba(0, 0, 0, 0.7); }
.wb-amount { font-weight: 800; font-size: 1.6rem; color: #fff; text-shadow: 0 2px 12px rgba(0, 0, 0, 0.8); }
.win-banner.big .wb-title { color: #7cf0a0; }
.win-banner.mega .wb-title { color: #ffd54f; }
.win-banner.epic .wb-title { color: #ff8ae0; animation: shake 0.4s ease infinite; }
@keyframes shake { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.08); } }
.fs-intro { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(10, 12, 34, 0.72); border-radius: 14px; pointer-events: none; }
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
.spin-btn { flex: 1; max-width: 150px; height: 66px; border: none; border-radius: 18px; background: linear-gradient(135deg, #f5c542, #ff7a3d); color: #3a2600; font-weight: 900; font-size: 1.1rem; letter-spacing: 0.05em; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; cursor: pointer; box-shadow: 0 6px 18px rgba(240, 180, 60, 0.45); transition: transform 0.1s ease, filter 0.2s ease; }
.spin-btn:active { transform: scale(0.95); }
.spin-btn:disabled { filter: grayscale(0.5) brightness(0.8); }
.auto-btn { background: rgba(255, 255, 255, 0.14) !important; color: #fff; width: 46px; height: 46px; }
.auto-btn.on { background: #5fd0e0 !important; color: #11343a; }
.dlg { background: rgba(40, 18, 60, 0.97); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 18px; color: #fff; min-width: 280px; :deep(*) { color: #fff; } }
.dlg-title { font-size: 1.4rem; font-weight: 800; }
.dlg-sub { opacity: 0.8; margin-top: 6px; }
:deep(.q-btn.bg-primary) { background: linear-gradient(135deg, #f5c542 0%, #ff7a3d 100%) !important; }
</style>
