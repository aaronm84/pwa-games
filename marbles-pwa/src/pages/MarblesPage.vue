<template>
  <q-page
    class="marbles-page"
    :style="{ background: themeStore.colors.gradient }"
    :data-state="state"
    :data-level="level"
    :data-chain="chainLen"
  >
    <!-- Header -->
    <div class="game-header">
      <q-btn fab-mini flat icon="arrow_back" color="white" @click="goBack" />
      <div class="scores">
        <div class="score-box"><div class="score-label">Level</div><div class="score-value">{{ level }}</div></div>
        <div class="score-box"><div class="score-label">Score</div><div class="score-value">{{ score }}</div></div>
        <div class="score-box"><div class="score-label">Best</div><div class="score-value">{{ bestScore }}</div></div>
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
        <div class="banner" v-if="state === 'playing'">Tap the launcher to swap · drag to aim &amp; fire</div>

        <transition name="overlay-fade">
          <div v-if="state === 'over' || state === 'won'" class="board-overlay">
            <div class="overlay-text">{{ state === 'won' ? `Level ${level} cleared!` : 'The marbles got through' }}</div>
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

    <p class="hint">Fire marbles into the chain — line up 3+ of a colour to pop them before they reach the hole</p>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useThemeStore } from 'src/stores/theme'
import { useProgressStore } from 'src/stores/progress'
import { useHaptics } from 'src/composables/useHaptics'

const W = 540
const H = 760
const R = 15
const SP = 30 // spacing between chain marbles
const STEP = 2 // path sample step
const COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6']
const SHOOTER = { x: W / 2, y: H - 70 }
const WAYPOINTS = [
  [24, 96], [516, 96], [516, 224], [24, 224],
  [24, 352], [516, 352], [516, 472], [270, 540],
]

const router = useRouter()
const themeStore = useThemeStore()
const progressStore = useProgressStore()
const haptics = useHaptics()

const canvasEl = ref(null)
const state = ref('playing') // playing | over | won
const level = ref(1)
const score = ref(0)
const chainLen = ref(0)

let ctx = null
let samples = []
let pathLen = 0
let chain = [] // array of color indices, front = index 0
let frontDist = 0
let speed = 0.5
let cur = 0
let nxt = 0
let fly = null // {x,y,vx,vy,color}
let aimAngle = -Math.PI / 2
let aiming = false
let downPt = null
let raf = null

const bestScore = computed(() => Math.max(progressStore.marbles.bestScore, score.value))

function buildPath() {
  samples = []
  samples.push({ x: WAYPOINTS[0][0], y: WAYPOINTS[0][1] })
  for (let i = 1; i < WAYPOINTS.length; i++) {
    const [x0, y0] = WAYPOINTS[i - 1]
    const [x1, y1] = WAYPOINTS[i]
    const segLen = Math.hypot(x1 - x0, y1 - y0)
    const n = Math.max(1, Math.round(segLen / STEP))
    for (let s = 1; s <= n; s++) {
      const t = s / n
      samples.push({ x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t })
    }
  }
  pathLen = (samples.length - 1) * STEP
}
function posAt(d) {
  if (d <= 0) return samples[0]
  if (d >= pathLen) return samples[samples.length - 1]
  const k = d / STEP
  const i = Math.floor(k)
  const f = k - i
  const a = samples[i]
  const b = samples[i + 1] || a
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }
}
function ballDist(i) {
  return frontDist - i * SP
}

// ---------- setup ----------
function startLevel() {
  cancelAnimationFrame(raf)
  buildPath()
  const n = 26 + level.value * 4
  chain = []
  for (let i = 0; i < n; i++) chain.push(Math.floor(Math.random() * COLORS.length))
  frontDist = 9 * SP
  speed = 0.5 + level.value * 0.06
  fly = null
  cur = pickColor()
  nxt = pickColor()
  state.value = 'playing'
  chainLen.value = chain.length
  loop()
}
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
function pickColor() {
  // prefer a colour still on the chain
  const present = [...new Set(chain)]
  const pool = present.length ? present : [...COLORS.keys()]
  return pool[Math.floor(Math.random() * pool.length)]
}

// ---------- rendering ----------
function draw() {
  if (!ctx) return
  ctx.clearRect(0, 0, W, H)
  // path track
  ctx.beginPath()
  ctx.moveTo(samples[0].x, samples[0].y)
  for (let i = 1; i < samples.length; i += 4) ctx.lineTo(samples[i].x, samples[i].y)
  ctx.strokeStyle = 'rgba(255,255,255,0.10)'
  ctx.lineWidth = R * 2 + 6
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.stroke()
  // hole
  const hole = samples[samples.length - 1]
  ctx.beginPath()
  ctx.arc(hole.x, hole.y, R + 8, 0, 6.28)
  ctx.fillStyle = 'rgba(0,0,0,0.5)'
  ctx.fill()
  // chain
  for (let i = chain.length - 1; i >= 0; i--) {
    const d = ballDist(i)
    if (d < 0 || d > pathLen) continue
    const pos = posAt(d)
    marble(pos.x, pos.y, COLORS[chain[i]])
  }
  // shooter
  ctx.save()
  ctx.translate(SHOOTER.x, SHOOTER.y)
  ctx.beginPath()
  ctx.arc(0, 0, R + 9, 0, 6.28)
  ctx.fillStyle = '#cfd8dc'
  ctx.fill()
  ctx.rotate(aimAngle + Math.PI / 2)
  ctx.fillStyle = '#90a4ae'
  ctx.fillRect(-6, -R - 22, 12, 22)
  ctx.restore()
  marble(SHOOTER.x, SHOOTER.y, COLORS[cur])
  marble(SHOOTER.x + 34, SHOOTER.y + 30, COLORS[nxt], 0.7) // next preview
  // aim guide
  if (state.value === 'playing' && !fly) {
    ctx.save()
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'
    ctx.setLineDash([4, 9])
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(SHOOTER.x, SHOOTER.y)
    ctx.lineTo(SHOOTER.x + Math.cos(aimAngle) * 150, SHOOTER.y + Math.sin(aimAngle) * 150)
    ctx.stroke()
    ctx.restore()
  }
  // flying
  if (fly) marble(fly.x, fly.y, COLORS[fly.color])
}
function marble(x, y, color, scale = 1) {
  ctx.beginPath()
  ctx.arc(x, y, R * scale, 0, 6.28)
  ctx.fillStyle = color
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x - R * 0.3 * scale, y - R * 0.3 * scale, R * 0.32 * scale, 0, 6.28)
  ctx.fillStyle = 'rgba(255,255,255,0.45)'
  ctx.fill()
}

// ---------- loop ----------
function loop() {
  cancelAnimationFrame(raf)
  const step = () => {
    if (state.value === 'playing') {
      if (chain.length) frontDist += speed
      if (fly) moveFly()
      if (chain.length && frontDist >= pathLen) lose()
    }
    draw()
    raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)
}

function moveFly() {
  for (let s = 0; s < 3; s++) {
    fly.x += fly.vx / 3
    fly.y += fly.vy / 3
    if (fly.x < R || fly.x > W - R) fly.vx *= -1
    if (fly.y < R) { fly = null; return }
    // collide with chain
    for (let i = 0; i < chain.length; i++) {
      const d = ballDist(i)
      if (d < 0 || d > pathLen) continue
      const pos = posAt(d)
      if (Math.hypot(fly.x - pos.x, fly.y - pos.y) < 2 * R - 4) {
        insertAt(i, fly.color)
        fly = null
        return
      }
    }
    if (fly.y > H + R) { fly = null; return }
  }
}

function insertAt(i, color) {
  chain.splice(i, 0, color)
  resolveMatches()
  chainLen.value = chain.length
  if (chain.length === 0) winLevel()
}

function resolveMatches() {
  let combo = 0
  for (;;) {
    // find first run >= 3
    let runStart = -1
    let found = null
    let r = 0
    while (r < chain.length) {
      let e = r
      while (e + 1 < chain.length && chain[e + 1] === chain[r]) e++
      if (e - r + 1 >= 3) { runStart = r; found = e; break }
      r = e + 1
    }
    if (runStart < 0) break
    const count = found - runStart + 1
    combo++
    score.value += count * 10 * combo
    chain.splice(runStart, count)
    if (runStart === 0) frontDist -= count * SP
    haptics.light()
  }
  if (combo > 1) haptics.success()
}

function lose() {
  state.value = 'over'
  progressStore.recordMarbles(level.value, score.value, false)
}
function winLevel() {
  state.value = 'won'
  score.value += 300
  progressStore.recordMarbles(level.value, score.value, true)
}

// ---------- input ----------
function toLocal(e) {
  const r = canvasEl.value.getBoundingClientRect()
  return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H }
}
function setAim(pt) {
  const dx = pt.x - SHOOTER.x
  const dy = pt.y - SHOOTER.y
  let a = Math.atan2(dy, dx)
  // clamp to upward hemisphere
  if (a > -0.12) a = dx >= 0 ? -0.12 : -Math.PI + 0.12
  aimAngle = a
}
function onDown(e) {
  if (state.value !== 'playing') return
  aiming = true
  downPt = toLocal(e)
  setAim(downPt)
}
function onMove(e) {
  if (!aiming) return
  e.preventDefault()
  setAim(toLocal(e))
}
function onUp(e) {
  if (!aiming) return
  aiming = false
  const pt = toLocal(e)
  // tap on shooter = swap
  if (downPt && Math.hypot(pt.x - downPt.x, pt.y - downPt.y) < 12 && Math.hypot(pt.x - SHOOTER.x, pt.y - SHOOTER.y) < R + 14) {
    ;[cur, nxt] = [nxt, cur]
    haptics.light()
    return
  }
  fire()
}
function fire() {
  if (fly || state.value !== 'playing') return
  const SPEED = 11
  fly = { x: SHOOTER.x, y: SHOOTER.y, vx: Math.cos(aimAngle) * SPEED, vy: Math.sin(aimAngle) * SPEED, color: cur }
  cur = nxt
  nxt = pickColor()
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
.marbles-page {
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
.scores { flex: 1; display: flex; justify-content: center; gap: 8px; }
.score-box {
  min-width: 66px;
  padding: 5px 10px;
  border-radius: 11px;
  background: rgba(0, 0, 0, 0.22);
  backdrop-filter: blur(8px);
  text-align: center;
  color: #fff;
}
.score-label { font-size: 0.62rem; letter-spacing: 0.05em; text-transform: uppercase; opacity: 0.75; }
.score-value { font-size: 1.15rem; font-weight: 700; line-height: 1.2; }
.header-menu { display: flex; gap: 2px; }

.board-wrap { width: 100%; display: flex; justify-content: center; padding: 6px 12px; flex: 1; align-items: center; }
.board { position: relative; width: min(96vw, 64vh, 420px); }
.field { width: 100%; height: auto; display: block; border-radius: 12px; background: rgba(0, 0, 0, 0.22); touch-action: none; }
.banner {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.74rem;
  color: #fff;
  background: rgba(0, 0, 0, 0.35);
  padding: 3px 12px;
  border-radius: 999px;
  white-space: nowrap;
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
.overlay-text { font-size: 1.6rem; font-weight: 800; color: #fff; text-align: center; padding: 0 16px; }
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
:deep(.q-btn.bg-primary) { background: linear-gradient(135deg, #2ecc71 0%, #3498db 100%) !important; }
</style>
