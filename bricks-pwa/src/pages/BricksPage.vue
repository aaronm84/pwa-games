<template>
  <q-page
    class="bricks-page"
    :style="{ background: themeStore.colors.gradient }"
    :data-state="state"
    :data-lives="lives"
    :data-level="level"
    :data-bricks="bricksLeft"
  >
    <!-- Header -->
    <div class="game-header">
      <q-btn fab-mini flat icon="arrow_back" color="white" @click="goBack" />
      <div class="scores">
        <div class="score-box"><div class="score-label">Level</div><div class="score-value">{{ level }}</div></div>
        <div class="score-box"><div class="score-label">Lives</div><div class="score-value">{{ lives }}</div></div>
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
        <div class="banner" v-if="state === 'playing' && hasStuckBall">Drag to move · tap to launch</div>

        <transition name="overlay-fade">
          <div v-if="state === 'over' || state === 'won'" class="board-overlay">
            <div class="overlay-text">{{ state === 'won' ? `Level ${level} cleared!` : 'Game over' }}</div>
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

    <p class="hint">Bounce the ball off the paddle to smash every brick · catch power-ups to help</p>
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
const R = 8 // ball radius
const PADDLE_Y = H - 54
const PADDLE_H = 16
const PW_BASE = 96
const PW_WIDE = 150
const BASE_SPEED = 6.2
const MAX_ANGLE = 1.05 // paddle steer, radians from vertical
const MAX_BALLS = 8

// brick grid
const COLS = 9
const MARGIN = 18
const BRICK_W = (W - MARGIN * 2) / COLS
const BRICK_H = 26
const TOP = 70
const GAP = 3

const HP_COLORS = ['#00000000', '#5c8bef', '#2ecc71', '#f1c40f', '#e67e22']
const POWERS = {
  multi: { label: '3×', color: '#4fc3f7' },
  wide: { label: '↔', color: '#66bb6a' },
  slow: { label: '≈', color: '#ce93d8' },
  life: { label: '♥', color: '#ef5350' },
}
const POWER_KEYS = Object.keys(POWERS)

const router = useRouter()
const themeStore = useThemeStore()
const progressStore = useProgressStore()
const haptics = useHaptics()

const canvasEl = ref(null)
const state = ref('playing') // playing | over | won
const level = ref(1)
const score = ref(0)
const lives = ref(3)
const bricksLeft = ref(0)
const hasStuckBall = ref(false)

const bestScore = computed(() => Math.max(progressStore.bricks.bestScore, score.value))

let ctx = null
let paddle = { x: W / 2, w: PW_BASE }
let balls = []
let bricks = []
let powerups = []
let particles = []
let floats = []
let wideTimer = 0
let slowTimer = 0
let raf = null
let dragging = false

// ---------- setup ----------
function newGame() {
  haptics.light()
  level.value = 1
  score.value = 0
  lives.value = 3
  startLevel()
}
function nextLevel() {
  level.value++
  startLevel()
}
function startLevel() {
  cancelAnimationFrame(raf)
  paddle = { x: W / 2, w: PW_BASE }
  balls = []
  powerups = []
  particles = []
  floats = []
  wideTimer = 0
  slowTimer = 0
  buildBricks()
  resetBall()
  state.value = 'playing'
  loop()
}

function buildBricks() {
  bricks = []
  const rows = Math.min(3 + level.value, 9)
  // powerup budget scales gently with level
  const powerCount = Math.min(2 + Math.floor(level.value / 2), 6)
  const cells = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < COLS; c++) {
      // carve occasional gaps on deeper levels for interesting shapes
      if (level.value >= 3 && Math.random() < 0.1) continue
      const maxHp = Math.min(1 + Math.floor(Math.random() * (1 + level.value / 2)), 4)
      const b = {
        x: MARGIN + c * BRICK_W + GAP / 2,
        y: TOP + r * (BRICK_H + GAP),
        w: BRICK_W - GAP,
        h: BRICK_H,
        hp: maxHp,
        maxHp,
        power: null,
        alive: true,
      }
      bricks.push(b)
      cells.push(b)
    }
  }
  // sprinkle power-ups onto random bricks
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[cells[i], cells[j]] = [cells[j], cells[i]]
  }
  for (let i = 0; i < powerCount && i < cells.length; i++) {
    cells[i].power = POWER_KEYS[Math.floor(Math.random() * POWER_KEYS.length)]
  }
  bricksLeft.value = bricks.length
}

function levelSpeed() {
  return Math.min(BASE_SPEED + (level.value - 1) * 0.35, 9.5)
}
function resetBall() {
  balls = [{ x: paddle.x, y: PADDLE_Y - R - 1, vx: 0, vy: 0, stuck: true }]
  hasStuckBall.value = true
}
function launchStuck() {
  let launched = false
  for (const b of balls) {
    if (b.stuck) {
      const sp = levelSpeed()
      const ang = (Math.random() * 0.4 - 0.2) // slight random tilt
      b.vx = Math.sin(ang) * sp
      b.vy = -Math.cos(ang) * sp
      b.stuck = false
      launched = true
    }
  }
  if (launched) {
    hasStuckBall.value = false
    haptics.light()
  }
}

// ---------- loop ----------
function loop() {
  cancelAnimationFrame(raf)
  const step = () => {
    if (state.value === 'playing') update()
    updateFx()
    draw()
    raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)
}

function update() {
  if (wideTimer > 0 && --wideTimer === 0) paddle.w = PW_BASE
  if (slowTimer > 0 && --slowTimer === 0) {
    for (const b of balls) if (!b.stuck) rescale(b, 1 / 0.62)
  }

  const SUB = 4
  for (const b of balls) {
    if (b.stuck) {
      b.x = paddle.x
      b.y = PADDLE_Y - R - 1
      continue
    }
    for (let s = 0; s < SUB; s++) {
      b.x += b.vx / SUB
      b.y += b.vy / SUB
      // walls
      if (b.x < R) { b.x = R; b.vx = Math.abs(b.vx) }
      if (b.x > W - R) { b.x = W - R; b.vx = -Math.abs(b.vx) }
      if (b.y < R) { b.y = R; b.vy = Math.abs(b.vy) }
      // paddle
      if (b.vy > 0 && b.y > PADDLE_Y - R && b.y < PADDLE_Y + PADDLE_H && Math.abs(b.x - paddle.x) < paddle.w / 2 + R) {
        bounceOffPaddle(b)
      }
      // bricks
      collideBricks(b)
    }
  }

  // lost balls
  const before = balls.length
  balls = balls.filter((b) => b.y < H + 20)
  if (balls.length === 0 && before > 0) loseLife()

  // power-ups fall
  for (const p of powerups) {
    p.y += 2.4
    if (p.y > PADDLE_Y - 6 && p.y < PADDLE_Y + PADDLE_H + 6 && Math.abs(p.x - paddle.x) < paddle.w / 2 + 14) {
      applyPower(p.kind)
      p.dead = true
    }
  }
  powerups = powerups.filter((p) => !p.dead && p.y < H + 20)

  if (bricksLeft.value <= 0 && state.value === 'playing') winLevel()
}

function bounceOffPaddle(b) {
  const off = Math.max(-1, Math.min(1, (b.x - paddle.x) / (paddle.w / 2)))
  const sp = Math.hypot(b.vx, b.vy) || levelSpeed()
  const ang = off * MAX_ANGLE
  b.vx = Math.sin(ang) * sp
  b.vy = -Math.cos(ang) * sp
  b.y = PADDLE_Y - R - 1
  haptics.light()
}

function collideBricks(b) {
  for (const br of bricks) {
    if (!br.alive) continue
    const nx = Math.max(br.x, Math.min(b.x, br.x + br.w))
    const ny = Math.max(br.y, Math.min(b.y, br.y + br.h))
    const dx = b.x - nx
    const dy = b.y - ny
    if (dx * dx + dy * dy > R * R) continue
    // reflect on the dominant penetration axis
    if (dx === 0 && dy === 0) {
      b.vy = -b.vy
    } else if (Math.abs(dx) > Math.abs(dy)) {
      b.vx = dx > 0 ? Math.abs(b.vx) : -Math.abs(b.vx)
    } else {
      b.vy = dy > 0 ? Math.abs(b.vy) : -Math.abs(b.vy)
    }
    hitBrick(br)
    break // one brick per substep to avoid double-reflect jitter
  }
}

function hitBrick(br) {
  br.hp--
  spawnParticles(br.x + br.w / 2, br.y + br.h / 2, HP_COLORS[br.maxHp] || '#fff', 5)
  if (br.hp <= 0) {
    br.alive = false
    bricksLeft.value--
    const gain = 10 * br.maxHp
    score.value += gain
    spawnFloat(br.x + br.w / 2, br.y + br.h / 2, '+' + gain, '#ffe9a8')
    if (br.power) spawnPowerup(br.x + br.w / 2, br.y + br.h / 2, br.power)
    haptics.light()
  }
}

function loseLife() {
  lives.value--
  if (lives.value <= 0) {
    state.value = 'over'
    progressStore.recordBricks(level.value, score.value)
    progressStore.recordBricksGameOver()
    haptics.heavy()
    return
  }
  haptics.medium()
  paddle.w = PW_BASE
  wideTimer = 0
  slowTimer = 0
  resetBall()
}
function winLevel() {
  state.value = 'won'
  const bonus = lives.value * 100 + level.value * 40
  score.value += bonus
  progressStore.recordBricks(level.value, score.value)
  haptics.success()
}

// ---------- power-ups ----------
function spawnPowerup(x, y, kind) {
  powerups.push({ x, y, kind, dead: false })
}
function applyPower(kind) {
  haptics.success()
  spawnFloat(paddle.x, PADDLE_Y - 16, POWERS[kind].label, POWERS[kind].color)
  if (kind === 'life') {
    lives.value++
  } else if (kind === 'wide') {
    paddle.w = PW_WIDE
    wideTimer = 60 * 12
  } else if (kind === 'slow') {
    for (const b of balls) if (!b.stuck) rescale(b, 0.62)
    slowTimer = 60 * 7
  } else if (kind === 'multi') {
    const active = balls.filter((b) => !b.stuck)
    const src = active.length ? active : balls
    for (const b of src) {
      if (balls.length >= MAX_BALLS) break
      const sp = Math.hypot(b.vx, b.vy) || levelSpeed()
      for (const da of [-0.4, 0.4]) {
        if (balls.length >= MAX_BALLS) break
        const a = Math.atan2(b.vy, b.vx) + da
        balls.push({ x: b.x, y: b.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, stuck: false })
      }
    }
    if (balls.some((b) => b.stuck)) launchStuck()
  }
}
function rescale(b, f) {
  b.vx *= f
  b.vy *= f
}

// ---------- fx ----------
function spawnParticles(x, y, color, n) {
  for (let k = 0; k < n; k++) {
    const a = Math.random() * Math.PI * 2
    const sp = 1 + Math.random() * 2.6
    particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 18 + Math.random() * 10, color, r: 1.5 + Math.random() * 2.5 })
  }
}
function spawnFloat(x, y, text, color) {
  floats.push({ x, y, text, color, life: 0, max: 40 })
}
function updateFx() {
  for (const p of particles) {
    p.life++
    p.x += p.vx
    p.y += p.vy
    p.vy += 0.14
    p.vx *= 0.96
  }
  particles = particles.filter((p) => p.life < p.max)
  for (const f of floats) {
    f.y -= 0.8
    f.life++
  }
  floats = floats.filter((f) => f.life < f.max)
}

// ---------- render ----------
function draw() {
  if (!ctx) return
  ctx.clearRect(0, 0, W, H)
  // bricks
  for (const br of bricks) {
    if (!br.alive) continue
    ctx.fillStyle = HP_COLORS[br.hp] || '#8899aa'
    rr(br.x, br.y, br.w, br.h, 4)
    ctx.fill()
    // top sheen
    ctx.fillStyle = 'rgba(255,255,255,0.18)'
    rr(br.x, br.y, br.w, 5, 4)
    ctx.fill()
    if (br.power) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.font = 'bold 12px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(POWERS[br.power].label, br.x + br.w / 2, br.y + br.h / 2 + 4)
    }
  }
  // power-ups
  for (const p of powerups) {
    ctx.fillStyle = POWERS[p.kind].color
    rr(p.x - 13, p.y - 9, 26, 18, 5)
    ctx.fill()
    ctx.fillStyle = '#12202b'
    ctx.font = 'bold 13px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(POWERS[p.kind].label, p.x, p.y + 5)
  }
  // paddle
  ctx.fillStyle = slowTimer > 0 ? '#ce93d8' : wideTimer > 0 ? '#66bb6a' : '#e0e6ea'
  rr(paddle.x - paddle.w / 2, PADDLE_Y, paddle.w, PADDLE_H, 8)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  rr(paddle.x - paddle.w / 2, PADDLE_Y, paddle.w, 5, 8)
  ctx.fill()
  // balls
  for (const b of balls) {
    ctx.beginPath()
    ctx.arc(b.x, b.y, R, 0, 6.28)
    ctx.fillStyle = '#fff'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(b.x - 2.5, b.y - 2.5, R * 0.4, 0, 6.28)
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.fill()
  }
  // particles + floats
  for (const p of particles) {
    const t = p.life / p.max
    ctx.globalAlpha = 1 - t
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.r * (1 - t * 0.4), 0, 6.28)
    ctx.fillStyle = p.color
    ctx.fill()
  }
  ctx.globalAlpha = 1
  ctx.textAlign = 'center'
  ctx.font = 'bold 15px sans-serif'
  for (const f of floats) {
    const t = f.life / f.max
    ctx.globalAlpha = t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8
    ctx.fillStyle = f.color
    ctx.shadowColor = 'rgba(0,0,0,0.5)'
    ctx.shadowBlur = 4
    ctx.fillText(f.text, f.x, f.y)
    ctx.shadowBlur = 0
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

// ---------- input ----------
function toLocalX(e) {
  const rect = canvasEl.value.getBoundingClientRect()
  return ((e.clientX - rect.left) / rect.width) * W
}
function movePaddle(e) {
  const x = toLocalX(e)
  paddle.x = Math.max(paddle.w / 2, Math.min(W - paddle.w / 2, x))
}
function onDown(e) {
  if (state.value !== 'playing') return
  dragging = true
  movePaddle(e)
}
function onMove(e) {
  if (!dragging) return
  e.preventDefault()
  movePaddle(e)
}
function onUp() {
  if (!dragging) return
  dragging = false
  if (state.value === 'playing') launchStuck()
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
.bricks-page {
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
:deep(.q-btn.bg-primary) { background: linear-gradient(135deg, #5c8bef 0%, #2ecc71 100%) !important; }
</style>
