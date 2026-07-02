<template>
  <q-page class="slots-page" :style="{ background: themeStore.colors.gradient }" :data-spinning="spinning">
    <!-- Header -->
    <div class="game-header">
      <q-btn fab-mini flat icon="arrow_back" color="white" @click="goBack" />
      <div class="machine-title">Lucky 7s</div>
      <div class="header-menu">
        <q-btn fab-mini flat icon="help_outline" color="white" @click="howToPlay" />
      </div>
    </div>

    <!-- Jackpot ticker -->
    <div class="jackpot">
      <span class="jp-label">7️⃣ JACKPOT</span>
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
      </div>
    </div>

    <!-- Hold row -->
    <div class="holds">
      <button
        v-for="r in REELS"
        :key="r"
        class="hold-btn"
        :class="{ on: held[r - 1], ready: canHold }"
        :disabled="!canHold"
        @click="toggleHold(r - 1)"
      >{{ held[r - 1] ? 'HELD' : 'HOLD' }}</button>
    </div>

    <!-- Win / status line -->
    <div class="statusline">
      <span v-if="lastWin > 0" class="win-amt">WIN {{ lastWin.toLocaleString() }}</span>
      <span v-else class="hint-txt">{{ spinning ? 'Spinning…' : canHold ? 'Hold reels, then spin again' : 'Match 3 · 7-7-7 hits the Jackpot' }}</span>
    </div>

    <!-- Controls -->
    <div class="controls">
      <div class="wallet">
        <div class="w-box"><div class="w-label">Credits</div><div class="w-val">{{ credits.toLocaleString() }}</div></div>
        <div class="w-box"><div class="w-label">Bet</div><div class="w-val">{{ betPerLine.toLocaleString() }}</div></div>
      </div>
      <div class="row">
        <div class="bet-stepper">
          <q-btn round dense unelevated class="step" icon="remove" :disable="spinning" @click="changeBet(-1)" />
          <div class="bet-mid">
            <div class="bet-line">${{ betPerLine }}</div>
            <div class="lines">1 line</div>
          </div>
          <q-btn round dense unelevated class="step" icon="add" :disable="spinning" @click="changeBet(1)" />
        </div>
        <button class="spin-btn" :disabled="spinning" @click="onSpin">
          <q-icon name="refresh" size="26px" />
          <span>{{ spinning ? '…' : 'SPIN' }}</span>
        </button>
        <q-btn round dense unelevated class="auto-btn" :class="{ on: autospin }" icon="autorenew" @click="toggleAuto" />
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

import pixSeven from 'src/assets/slots/pix-seven.png'
import pixCherry from 'src/assets/slots/pix-cherry.png'
import pixBell from 'src/assets/slots/pix-bell.png'
import pixBar from 'src/assets/slots/pix-bar.png'

const router = useRouter()
const themeStore = useThemeStore()
const progressStore = useProgressStore()
const { casino } = storeToRefs(progressStore)
const haptics = useHaptics()

const REELS = 3
const TOPUP = 2000
const BETS = [1, 2, 5, 10, 25, 50]

const SYMBOLS = {
  cherry: { img: pixCherry },
  bell: { img: pixBell },
  bar: { img: pixBar },
  seven: { img: pixSeven },
}
const IMG = {}
for (const k of Object.keys(SYMBOLS)) {
  const im = new Image()
  im.src = SYMBOLS[k].img
  IMG[k] = im
}

// weighted strip — cherry common, seven rare
const WEIGHTS = { cherry: 8, bell: 5, bar: 3, seven: 2 }
function makeStrip() {
  const s = []
  for (const [k, n] of Object.entries(WEIGHTS)) for (let i = 0; i < n; i++) s.push(k)
  for (let i = s.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[s[i], s[j]] = [s[j], s[i]]
  }
  return s
}
const strips = Array.from({ length: REELS }, makeStrip)

// 3-of-a-kind pays (× bet); cherries also pay for 1 or 2
const PAY3 = { cherry: 12, bell: 25, bar: 60, seven: 250 }
const CHERRY_ANY = [0, 1, 4, 12] // index by cherry count

// ---------- geometry ----------
const CELL = 118
const PADX = 10
const PADY = 10
const CW = REELS * CELL + PADX * 2
const CH = CELL + PADY * 2

// ---------- state ----------
const canvasEl = ref(null)
const spinning = ref(false)
const betIdx = ref(2)
const lastWin = ref(0)
const banner = ref(null)
const autospin = ref(false)
const showBust = ref(false)
const jackpotDisplay = ref(0)
const held = ref([false, false, false])
const canHold = ref(false)

const credits = computed(() => casino.value.credits)
const betPerLine = computed(() => BETS[betIdx.value])

let ctx = null
let raf = null
let reels = []
let result = ['cherry', 'cherry', 'cherry']
let bannerTimer = null
let pendingResolve = null
let winFlash = 0
let hasSpun = false

function initReels() {
  reels = Array.from({ length: REELS }, (_, r) => ({
    strip: [], scroll: 0, target: 0, dur: 0, t: 0, spinning: false, sym: strips[r][0],
  }))
  result = reels.map((rl) => rl.sym)
}

function draw() {
  if (!ctx) return
  ctx.clearRect(0, 0, CW, CH)
  ctx.fillStyle = 'rgba(10,6,26,0.65)'
  rr(PADX, PADY, REELS * CELL, CELL, 10)
  ctx.fill()
  for (let r = 0; r < REELS; r++) {
    const rl = reels[r]
    const x = PADX + r * CELL
    ctx.save()
    ctx.beginPath()
    ctx.rect(x, PADY, CELL, CELL)
    ctx.clip()
    if (rl.spinning) {
      const top = Math.floor(rl.scroll / CELL)
      const frac = rl.scroll % CELL
      for (let k = -1; k < 2; k++) {
        const idx = top + k
        if (idx < 0 || idx >= rl.strip.length) continue
        drawSym(rl.strip[idx], x, PADY + k * CELL - frac)
      }
    } else {
      drawSym(rl.sym, x, PADY, winFlash > 0 && isWin ? 1 : 1)
    }
    ctx.restore()
    // held glow
    if (held.value[r]) {
      ctx.strokeStyle = '#ffd54f'
      ctx.lineWidth = 3
      ctx.strokeRect(x + 2, PADY + 2, CELL - 4, CELL - 4)
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'
    ctx.lineWidth = 1
    ctx.strokeRect(x + 0.5, PADY + 0.5, CELL, CELL)
  }
  // win pay line flash
  if (winFlash > 0 && isWin) {
    ctx.strokeStyle = `rgba(255,225,90,${0.4 + 0.4 * Math.abs(Math.sin(winFlash / 6))})`
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(PADX, PADY + CELL / 2)
    ctx.lineTo(PADX + REELS * CELL, PADY + CELL / 2)
    ctx.stroke()
  }
}
let isWin = false
function drawSym(key, x, y) {
  const im = IMG[key]
  const pad = 12
  if (im && im.complete && im.naturalWidth) {
    ctx.imageSmoothingEnabled = false // crisp pixel art
    ctx.drawImage(im, x + pad, y + pad, CELL - pad * 2, CELL - pad * 2)
    ctx.imageSmoothingEnabled = true
  } else {
    ctx.fillStyle = '#5c6bc0'
    ctx.fillRect(x + pad, y + pad, CELL - pad * 2, CELL - pad * 2)
  }
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

function pickResult(r) {
  const strip = strips[r]
  return strip[Math.floor(Math.random() * strip.length)]
}
function buildDisplayStrip(reelIndex, sym) {
  const n = 16 + reelIndex * 5
  const strip = []
  for (let i = 0; i < n; i++) strip.push(strips[reelIndex][Math.floor(Math.random() * strips[reelIndex].length)])
  strip.push(sym)
  return strip
}

async function spin() {
  if (spinning.value) return
  if (credits.value < betPerLine.value) {
    showBust.value = true
    autospin.value = false
    return
  }
  progressStore.addCredits(-betPerLine.value)
  progressStore.setJackpot(casino.value.jackpot + betPerLine.value * 0.02)

  spinning.value = true
  canHold.value = false
  lastWin.value = 0
  isWin = false
  winFlash = 0
  clearBanner()
  haptics.light()

  // held reels keep their symbol; others get a fresh result
  const newResult = result.slice()
  for (let r = 0; r < REELS; r++) if (!held.value[r]) newResult[r] = pickResult(r)

  for (let r = 0; r < REELS; r++) {
    const rl = reels[r]
    rl.sym = newResult[r]
    if (held.value[r]) {
      rl.spinning = false
      continue
    }
    rl.strip = buildDisplayStrip(r, newResult[r])
    rl.scroll = 0
    rl.target = (rl.strip.length - 1) * CELL
    rl.dur = 560 + r * 190
    rl.t = 0
    rl.spinning = true
  }
  result = newResult

  await new Promise((resolve) => { pendingResolve = resolve })
  resolveWin()
}

function resolveWin() {
  const bet = betPerLine.value
  let win = 0
  let jackpotHit = false

  const cherryCount = result.filter((s) => s === 'cherry').length
  if (cherryCount >= 1 && cherryCount < 3) win += CHERRY_ANY[cherryCount] * bet

  if (result[0] === result[1] && result[1] === result[2]) {
    const s = result[0]
    win += PAY3[s] * bet
    if (s === 'seven') jackpotHit = true
  }

  if (jackpotHit) {
    win += Math.round(casino.value.jackpot)
    progressStore.setJackpot(progressStore.JACKPOT_SEED)
  }

  if (win > 0) {
    progressStore.addCredits(win)
    lastWin.value = win
    isWin = true
    winFlash = 1
    haptics.success()
    celebrate(win, bet, jackpotHit)
  }
  progressStore.recordSpin(win)

  hasSpun = true
  spinning.value = false
  // holds reset each spin; offer a fresh hold choice (unless autospinning)
  held.value = [false, false, false]
  canHold.value = !autospin.value

  if (autospin.value) {
    setTimeout(() => {
      if (autospin.value && !spinning.value) {
        if (credits.value < betPerLine.value) { autospin.value = false; showBust.value = true }
        else spin()
      }
    }, 800)
  }
}

function celebrate(win, bet, jackpot) {
  const ratio = win / bet
  let cls, title
  if (jackpot) { cls = 'epic'; title = 'JACKPOT!!!' }
  else if (ratio >= 100) { cls = 'epic'; title = 'EPIC WIN' }
  else if (ratio >= 40) { cls = 'mega'; title = 'MEGA WIN' }
  else if (ratio >= 12) { cls = 'big'; title = 'BIG WIN' }
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

function onSpin() {
  if (spinning.value) return
  spin()
}
function toggleHold(r) {
  if (!canHold.value) return
  held.value[r] = !held.value[r]
  haptics.light()
}
function changeBet(d) {
  if (spinning.value) return
  betIdx.value = Math.max(0, Math.min(BETS.length - 1, betIdx.value + d))
  haptics.light()
}
function toggleAuto() {
  autospin.value = !autospin.value
  haptics.light()
  if (autospin.value) { canHold.value = false; held.value = [false, false, false]; if (!spinning.value) spin() }
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
  initReels()
  loop()
  void hasSpun
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
.machine-title { flex: 1; text-align: center; color: #fff; font-weight: 800; font-size: 1.2rem; letter-spacing: 0.03em; text-shadow: 0 2px 10px rgba(0, 0, 0, 0.4); }
.header-menu { display: flex; gap: 2px; }

.jackpot {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 20px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(255, 100, 90, 0.25), rgba(255, 190, 60, 0.25));
  border: 1px solid rgba(255, 200, 120, 0.5);
  margin-bottom: 4px;
}
.jp-label { color: #ffd0a0; font-weight: 800; font-size: 0.8rem; letter-spacing: 0.05em; }
.jp-value { color: #fff; font-weight: 800; font-size: 1.25rem; font-variant-numeric: tabular-nums; text-shadow: 0 0 10px rgba(255, 160, 120, 0.7); }

.board-wrap { width: 100%; display: flex; justify-content: center; padding: 8px 12px 4px; align-items: center; }
.board { position: relative; width: min(94vw, 52vh, 400px); }
.reels { width: 100%; height: auto; display: block; border-radius: 14px; background: rgba(0, 0, 0, 0.3); image-rendering: pixelated; }

.win-banner { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none; gap: 4px; }
.wb-title { font-weight: 900; font-size: 1.9rem; letter-spacing: 0.04em; text-shadow: 0 2px 14px rgba(0, 0, 0, 0.7); }
.wb-amount { font-weight: 800; font-size: 1.5rem; color: #fff; text-shadow: 0 2px 12px rgba(0, 0, 0, 0.8); }
.win-banner.big .wb-title { color: #7cf0a0; }
.win-banner.mega .wb-title { color: #ffd54f; }
.win-banner.epic .wb-title { color: #ff8ae0; animation: shake 0.4s ease infinite; }
@keyframes shake { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.08); } }
.pop-enter-active { animation: popin 0.3s ease; }
@keyframes popin { 0% { opacity: 0; transform: scale(0.5); } 100% { opacity: 1; transform: scale(1); } }

.holds {
  width: min(94vw, 52vh, 400px);
  display: flex;
  gap: 6px;
  padding: 4px 0;
}
.hold-btn {
  flex: 1;
  height: 34px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(0, 0, 0, 0.28);
  color: #fff;
  font-weight: 800;
  font-size: 0.8rem;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: opacity 0.15s ease, background 0.15s ease;
}
.hold-btn:not(.ready) { opacity: 0.35; }
.hold-btn.on { background: #ffd54f; color: #3a2600; border-color: #ffd54f; }

.statusline { height: 26px; display: flex; align-items: center; justify-content: center; color: #fff; }
.win-amt { color: #7cf0a0; font-weight: 800; font-size: 1.1rem; }
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
.auto-btn { background: rgba(255, 255, 255, 0.14) !important; color: #fff; width: 46px; height: 46px; }
.auto-btn.on { background: #5fd0e0 !important; color: #11343a; }

.dlg { background: rgba(40, 18, 60, 0.97); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 18px; color: #fff; min-width: 280px; :deep(*) { color: #fff; } }
.dlg-title { font-size: 1.4rem; font-weight: 800; }
.dlg-sub { opacity: 0.8; margin-top: 6px; }
:deep(.q-btn.bg-primary) { background: linear-gradient(135deg, #ff8a3d 0%, #ff4d6d 100%) !important; }
</style>
