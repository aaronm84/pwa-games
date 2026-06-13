<template>
  <q-page
    class="pegs-page"
    :style="{ background: themeStore.colors.gradient }"
    :data-state="state"
    :data-balls="balls"
    :data-orange="orangeLeft"
    :data-level="level"
  >
    <!-- Header -->
    <div class="game-header">
      <q-btn fab-mini flat icon="arrow_back" color="white" @click="goBack" />
      <div class="scores">
        <div class="score-box"><div class="score-label">Level</div><div class="score-value">{{ level }}</div></div>
        <div class="score-box"><div class="score-label">Balls</div><div class="score-value">{{ balls }}</div></div>
        <div class="score-box"><div class="score-label">Orange</div><div class="score-value">{{ orangeLeft }}</div></div>
        <div class="score-box"><div class="score-label">Score</div><div class="score-value">{{ score }}</div></div>
      </div>
      <div class="header-menu">
        <q-btn fab-mini flat icon="refresh" color="white" @click="newGame" />
        <q-btn fab-mini flat icon="help_outline" color="white" @click="howToPlay" />
      </div>
    </div>

    <!-- Field -->
    <div class="board-wrap">
      <div class="board">
        <canvas
          ref="canvasEl"
          :width="W"
          :height="H"
          class="field"
          @pointerdown="onDown"
          @pointermove="onMove"
          @pointerup="onUp"
          @pointercancel="onUp"
        ></canvas>
        <div class="banner" v-if="state === 'aiming'">Drag to aim, release to drop</div>

        <transition name="overlay-fade">
          <div v-if="state === 'over' || state === 'won'" class="board-overlay">
            <div class="overlay-text">{{ state === 'won' ? `Level ${level} cleared!` : 'Out of balls' }}</div>
            <div class="overlay-sub">Score {{ score }}</div>
            <q-btn
              unelevated color="primary" text-color="white"
              :label="state === 'won' ? 'Next Level' : 'Play Again'"
              @click="state === 'won' ? nextLevel() : newGame()"
            />
          </div>
        </transition>
      </div>
    </div>

    <p class="hint">Clear every orange peg · catch the ball in the bucket for a free ball</p>
  </q-page>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useThemeStore } from 'src/stores/theme'
import { useProgressStore } from 'src/stores/progress'
import { useHaptics } from 'src/composables/useHaptics'

const W = 540
const H = 760
const GRAV = 0.22
const R = 9 // ball radius
const P = 11 // peg radius
const E = 0.72 // restitution
const LAUNCH = 7.6
const LX = W / 2
const LY = 44

const router = useRouter()
const themeStore = useThemeStore()
const progressStore = useProgressStore()
const haptics = useHaptics()

const canvasEl = ref(null)
const state = ref('aiming') // aiming | shooting | over | won
const level = ref(1)
const balls = ref(8)
const score = ref(0)
const orangeLeft = ref(0)

let ctx = null
let pegs = []
let ball = null
let aimAngle = Math.PI / 2 // straight down
let aiming = false
let bucketX = W / 2
let bucketDir = 1
let raf = null
let shotSteps = 0

function newGame() {
  haptics.light()
  level.value = 1
  score.value = 0
  startLevel()
}
function nextLevel() {
  level.value++
  startLevel()
}
function startLevel() {
  cancelAnimationFrame(raf)
  ball = null
  balls.value = 8
  buildPegs()
  state.value = 'aiming'
  loop()
}

function buildPegs() {
  pegs = []
  const cols = 9
  const rows = 7
  const top = 150
  const gapX = (W - 80) / (cols - 1)
  const gapY = 62
  const cellList = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const off = r % 2 === 0 ? 0 : gapX / 2
      let x = 40 + c * gapX + off
      const y = top + r * gapY
      if (x > W - 30) continue
      x += (Math.random() - 0.5) * 10
      if (Math.random() < 0.12) continue // gaps
      cellList.push({ x, y, hit: false, orange: false })
    }
  }
  // choose orange targets
  const targets = Math.min(6 + level.value, 18, cellList.length)
  const idx = [...cellList.keys()]
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[idx[i], idx[j]] = [idx[j], idx[i]]
  }
  for (let i = 0; i < targets; i++) cellList[idx[i]].orange = true
  pegs = cellList
  orangeLeft.value = targets
}

// ---------- rendering ----------
function draw() {
  if (!ctx) return
  ctx.clearRect(0, 0, W, H)
  // pegs
  for (const pg of pegs) {
    ctx.beginPath()
    ctx.arc(pg.x, pg.y, P, 0, 6.28)
    if (pg.hit) {
      ctx.fillStyle = pg.orange ? 'rgba(255,167,38,0.35)' : 'rgba(120,160,255,0.3)'
    } else {
      ctx.fillStyle = pg.orange ? '#ffa726' : '#5c8bef'
    }
    ctx.fill()
    if (!pg.hit) {
      ctx.beginPath()
      ctx.arc(pg.x - 3, pg.y - 3, P * 0.4, 0, 6.28)
      ctx.fillStyle = 'rgba(255,255,255,0.4)'
      ctx.fill()
    }
  }
  // bucket
  ctx.fillStyle = '#26a69a'
  ctx.fillRect(bucketX - 42, H - 22, 84, 16)
  ctx.fillStyle = 'rgba(255,255,255,0.25)'
  ctx.fillRect(bucketX - 42, H - 22, 84, 4)
  // launcher
  ctx.save()
  ctx.translate(LX, LY)
  ctx.fillStyle = '#cfd8dc'
  ctx.beginPath()
  ctx.arc(0, 0, 14, 0, 6.28)
  ctx.fill()
  ctx.rotate(aimAngle - Math.PI / 2)
  ctx.fillStyle = '#90a4ae'
  ctx.fillRect(-5, 0, 10, 26)
  ctx.restore()
  // aim guide
  if (state.value === 'aiming') {
    ctx.save()
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'
    ctx.setLineDash([4, 8])
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(LX, LY)
    ctx.lineTo(LX + Math.cos(aimAngle) * 130, LY + Math.sin(aimAngle) * 130)
    ctx.stroke()
    ctx.restore()
  }
  // ball
  if (ball) {
    ctx.beginPath()
    ctx.arc(ball.x, ball.y, R, 0, 6.28)
    ctx.fillStyle = '#fff'
    ctx.fill()
  }
}

// ---------- loop ----------
function loop() {
  cancelAnimationFrame(raf)
  const step = () => {
    // bucket movement
    bucketX += bucketDir * 2.4
    if (bucketX > W - 50 || bucketX < 50) bucketDir *= -1

    if (state.value === 'shooting' && ball) physics()
    draw()
    raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)
}

function physics() {
  shotSteps++
  const SUB = 4
  for (let s = 0; s < SUB; s++) {
    ball.vy += GRAV / SUB
    ball.x += ball.vx / SUB
    ball.y += ball.vy / SUB
    // walls
    if (ball.x < R) { ball.x = R; ball.vx = Math.abs(ball.vx) * E }
    if (ball.x > W - R) { ball.x = W - R; ball.vx = -Math.abs(ball.vx) * E }
    if (ball.y < R) { ball.y = R; ball.vy = Math.abs(ball.vy) * E }
    // pegs
    for (const pg of pegs) {
      const dx = ball.x - pg.x
      const dy = ball.y - pg.y
      const d = Math.hypot(dx, dy)
      const min = R + P
      if (d < min && d > 0) {
        const nx = dx / d
        const ny = dy / d
        const vn = ball.vx * nx + ball.vy * ny
        if (vn < 0) {
          ball.vx -= (1 + E) * vn * nx
          ball.vy -= (1 + E) * vn * ny
        }
        ball.x = pg.x + nx * min
        ball.y = pg.y + ny * min
        if (!pg.hit) {
          pg.hit = true
          score.value += pg.orange ? 80 : 15
          if (pg.orange) orangeLeft.value--
          haptics.light()
        }
      }
    }
  }
  // bucket catch
  if (ball.y > H - 24 && ball.y < H - 4 && Math.abs(ball.x - bucketX) < 42) {
    balls.value++
    haptics.success()
    return endShot()
  }
  if (ball.y > H + R || shotSteps > 1400) endShot()
}

function endShot() {
  ball = null
  // remove hit pegs
  pegs = pegs.filter((pg) => !pg.hit)
  if (orangeLeft.value <= 0) {
    state.value = 'won'
    score.value += balls.value * 200
    progressStore.recordPegs(level.value, score.value)
    return
  }
  if (balls.value <= 0) {
    state.value = 'over'
    progressStore.recordPegs(level.value, score.value)
    progressStore.recordPegsGameOver()
    return
  }
  state.value = 'aiming'
}

// ---------- input ----------
function toLocal(e) {
  const r = canvasEl.value.getBoundingClientRect()
  return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H }
}
function setAim(e) {
  const p = toLocal(e)
  const dx = p.x - LX
  const dy = p.y - LY
  let a = Math.atan2(dy, dx)
  // clamp to downward hemisphere
  if (a < 0.18) a = 0.18
  if (a > Math.PI - 0.18) a = Math.PI - 0.18
  aimAngle = a
}
function onDown(e) {
  if (state.value !== 'aiming') return
  aiming = true
  setAim(e)
}
function onMove(e) {
  if (!aiming) return
  e.preventDefault()
  setAim(e)
}
function onUp() {
  if (!aiming || state.value !== 'aiming') {
    aiming = false
    return
  }
  aiming = false
  fire()
}
function fire() {
  balls.value--
  shotSteps = 0
  ball = { x: LX, y: LY + 16, vx: Math.cos(aimAngle) * LAUNCH, vy: Math.sin(aimAngle) * LAUNCH }
  state.value = 'shooting'
  haptics.medium()
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
  ctx = canvasEl.value.getContext('2d')
  newGame()
})
onBeforeUnmount(() => cancelAnimationFrame(raf))
</script>

<style lang="scss" scoped>
.pegs-page {
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
  align-items: flex-start;
  gap: 8px;
  padding: 14px;
  padding-top: max(54px, calc(env(safe-area-inset-top) + 14px));
}
.scores { flex: 1; display: flex; justify-content: center; gap: 7px; }
.score-box {
  min-width: 56px;
  padding: 5px 8px;
  border-radius: 11px;
  background: rgba(0, 0, 0, 0.22);
  backdrop-filter: blur(8px);
  text-align: center;
  color: #fff;
}
.score-label { font-size: 0.6rem; letter-spacing: 0.05em; text-transform: uppercase; opacity: 0.75; }
.score-value { font-size: 1.1rem; font-weight: 700; line-height: 1.2; }
.header-menu { display: flex; gap: 2px; }

.board-wrap { width: 100%; display: flex; justify-content: center; padding: 6px 12px; flex: 1; align-items: center; }
.board { position: relative; width: min(96vw, 64vh, 420px); }
.field {
  width: 100%;
  height: auto;
  display: block;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.22);
  touch-action: none;
}
.banner {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.78rem;
  color: #fff;
  background: rgba(0, 0, 0, 0.35);
  padding: 3px 12px;
  border-radius: 999px;
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
  gap: 14px;
}
.overlay-text { font-size: 1.7rem; font-weight: 800; color: #fff; }
.overlay-sub { color: rgba(255, 255, 255, 0.85); margin-top: -8px; }
.overlay-fade-enter-active { transition: opacity 0.35s ease; }
.overlay-fade-enter-from { opacity: 0; }
.hint {
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.82rem;
  text-align: center;
  margin: 8px 24px max(16px, env(safe-area-inset-bottom));
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}
:deep(.q-btn.bg-primary) { background: linear-gradient(135deg, #ffa726 0%, #5c8bef 100%) !important; }
</style>
