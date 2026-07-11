<template>
  <q-page
    class="golf-page"
    :style="{ background: themeStore.colors.gradient }"
    :data-state="state"
    :data-hole="holeNum"
    :data-strokes="strokes"
  >
    <!-- Header -->
    <div class="game-header">
      <q-btn fab-mini flat icon="arrow_back" color="white" @click="goBack" />
      <div class="scores">
        <div class="score-box"><div class="score-label">Hole</div><div class="score-value">{{ holeNum }}/{{ total }}</div></div>
        <div class="score-box"><div class="score-label">Par</div><div class="score-value">{{ hole.par }}</div></div>
        <div class="score-box"><div class="score-label">Shot</div><div class="score-value">{{ strokes }}</div></div>
        <div class="score-box"><div class="score-label">Total</div><div class="score-value">{{ totalStrokes }}</div></div>
      </div>
      <div class="header-menu">
        <q-btn fab-mini flat icon="refresh" color="white" @click="confirmRestart" />
        <q-btn fab-mini flat icon="help_outline" color="white" @click="howToPlay" />
      </div>
    </div>

    <!-- Course -->
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
        <div class="banner" v-if="state === 'aim' && strokes === 0">Drag back from the ball to aim &amp; putt</div>

        <!-- Hole complete -->
        <transition name="overlay-fade">
          <div v-if="state === 'holeDone'" class="board-overlay">
            <div class="overlay-text">{{ resultLabel }}</div>
            <div class="overlay-sub">{{ strokes }} {{ strokes === 1 ? 'stroke' : 'strokes' }} · par {{ hole.par }}</div>
            <q-btn
              unelevated color="primary" text-color="white"
              :label="holeIdx + 1 < total ? 'Next Hole' : 'See Scorecard'"
              @click="advance"
            />
          </div>
        </transition>

        <!-- Course complete: scorecard -->
        <transition name="overlay-fade">
          <div v-if="state === 'courseDone'" class="board-overlay scorecard-overlay">
            <div class="overlay-text">Round Complete</div>
            <div class="scorecard">
              <div class="sc-row sc-head">
                <span>Hole</span>
                <span v-for="n in total" :key="'h' + n">{{ n }}</span>
                <span class="sc-tot">Σ</span>
              </div>
              <div class="sc-row">
                <span>Par</span>
                <span v-for="(h, i) in course" :key="'p' + i">{{ h.par }}</span>
                <span class="sc-tot">{{ coursePar }}</span>
              </div>
              <div class="sc-row">
                <span>You</span>
                <span
                  v-for="(s, i) in scores"
                  :key="'s' + i"
                  :class="scoreClass(s, course[i].par)"
                >{{ s }}</span>
                <span class="sc-tot">{{ totalStrokes }}</span>
              </div>
            </div>
            <div class="overlay-sub big">{{ formatToPar(totalStrokes - coursePar) }}</div>
            <q-btn
              unelevated color="primary" text-color="white"
              label="Play Again"
              @click="newRound"
            />
          </div>
        </transition>
      </div>
    </div>

    <p class="hint">Ease off the power near the cup — a fast ball lips out</p>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useThemeStore } from 'src/stores/theme'
import { useProgressStore } from 'src/stores/progress'
import { useHaptics } from 'src/composables/useHaptics'
import { frontNine, coursePar as COURSE_PAR, PLAY_W, PLAY_H } from 'src/game/frontNine'

// ---- geometry / tuning ----
const W = PLAY_W
const H = PLAY_H
const R = 7 // ball radius
const MAXSPEED = 14 // px/frame at full power
const MAXPULL = 230 // drag distance (canvas px) for full power
const SUB = 6 // physics sub-steps per frame
const WALL_E = 0.68 // wall restitution
const FRICTION = 0.976 // per-frame rolling friction
const STOP2 = 0.05 // speed² below which the ball is "stopped"
const CUP_R = 14 // capture radius around the cup
const SINK2 = 20 // speed² under which the ball drops in when over the cup

const router = useRouter()
const $q = useQuasar()
const themeStore = useThemeStore()
const progressStore = useProgressStore()
const haptics = useHaptics()

const course = frontNine
const coursePar = COURSE_PAR
const total = course.length

const canvasEl = ref(null)
const state = ref('aim') // aim | roll | holeDone | courseDone
const holeIdx = ref(0)
const strokes = ref(0)
const scores = ref([]) // strokes taken on each completed hole

const hole = computed(() => course[holeIdx.value])
const holeNum = computed(() => holeIdx.value + 1)
const totalStrokes = computed(() => {
  // once a hole is sunk its strokes live in `scores`; don't also add the live
  // `strokes` for that same hole (it isn't reset until the next hole loads)
  const done = scores.value.reduce((a, b) => a + (b || 0), 0)
  const currentCounted = scores.value[holeIdx.value] != null
  return done + (currentCounted ? 0 : strokes.value)
})
const resultLabel = computed(() => scoreName(strokes.value, hole.value.par))

let ctx = null
let ball = { x: 0, y: 0, vx: 0, vy: 0 }
let restPos = { x: 0, y: 0 } // fallback if the ball ever escapes the green
let segs = [] // flattened wall segments for the current hole
let raf = null
let restFrames = 0
let hitCooldown = 0 // throttle wall-hit haptics
let sunk = false

// pointer / aim state
let aiming = false
let pullX = 0 // vector from current pointer back to press point (the "pull")
let pullY = 0
let power = 0 // 0..1

// ---------- hole setup ----------
function loadHole() {
  cancelAnimationFrame(raf)
  const h = hole.value
  strokes.value = 0
  sunk = false
  ball = { x: h.tee.x, y: h.tee.y, vx: 0, vy: 0 }
  restPos = { x: h.tee.x, y: h.tee.y }
  segs = buildSegments(h)
  aiming = false
  power = 0
  state.value = 'aim'
  loop()
}

// break every polygon (fairway border + obstacles) into individual segments
function buildSegments(h) {
  const out = []
  const polys = [h.fairway, ...h.walls]
  for (const poly of polys) {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]
      const b = poly[(i + 1) % poly.length]
      out.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y })
    }
  }
  return out
}

// ---------- input ----------
function toLocal(e) {
  const r = canvasEl.value.getBoundingClientRect()
  return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H }
}
function onDown(e) {
  if (state.value !== 'aim') return
  aiming = true
  // anchor the pull at the press point; the ball launches opposite the drag
  ball._anchor = toLocal(e)
  pullX = 0
  pullY = 0
  power = 0
}
function onMove(e) {
  if (!aiming) return
  e.preventDefault()
  const p = toLocal(e)
  // "pull" points from the current finger position back toward the press point;
  // the ball launches along that pull (drag down-right → putt up-left)
  pullX = ball._anchor.x - p.x
  pullY = ball._anchor.y - p.y
  const len = Math.hypot(pullX, pullY)
  power = Math.min(len / MAXPULL, 1)
}
function onUp() {
  if (!aiming) return
  aiming = false
  if (state.value !== 'aim') return
  if (power < 0.06) {
    power = 0
    return // too small — not a real putt, don't waste a stroke
  }
  putt()
}
function putt() {
  const len = Math.hypot(pullX, pullY) || 1
  const dir = { x: pullX / len, y: pullY / len }
  const speed = power * MAXSPEED
  ball.vx = dir.x * speed
  ball.vy = dir.y * speed
  strokes.value++
  restFrames = 0
  power = 0
  state.value = 'roll'
  haptics.medium()
}

// ---------- physics ----------
function physics() {
  const h = hole.value
  for (let s = 0; s < SUB; s++) {
    ball.x += ball.vx / SUB
    ball.y += ball.vy / SUB

    // wall / obstacle collisions (two passes settle tight corners)
    for (let pass = 0; pass < 2; pass++) {
      for (const sg of segs) collideSegment(ball, sg)
    }

    // cup interaction
    const dxc = h.cup.x - ball.x
    const dyc = h.cup.y - ball.y
    const dc = Math.hypot(dxc, dyc)
    const sp2 = ball.vx * ball.vx + ball.vy * ball.vy
    if (dc < CUP_R) {
      if (sp2 < SINK2) return sink()
      // too fast: lip-out, but leave a little inward pull so near-misses curl
      ball.vx += (dxc / dc) * 0.4
      ball.vy += (dyc / dc) * 0.4
    } else if (dc < CUP_R * 2.3 && sp2 < 8) {
      // slow and close: gravity assist toward the hole
      ball.vx += (dxc / dc) * 0.3
      ball.vy += (dyc / dc) * 0.3
    }
  }

  ball.vx *= FRICTION
  ball.vy *= FRICTION
  if (hitCooldown > 0) hitCooldown--

  const sp2 = ball.vx * ball.vx + ball.vy * ball.vy
  if (sp2 < STOP2) restFrames++
  else restFrames = 0

  if (restFrames > 8) {
    ball.vx = 0
    ball.vy = 0
    // safety: if the ball somehow rests off the green, snap back
    if (!pointInPoly(ball, h.fairway) || inAnyWall(ball, h.walls)) {
      ball.x = restPos.x
      ball.y = restPos.y
    }
    restPos = { x: ball.x, y: ball.y }
    state.value = 'aim'
  }
}

// circle vs line-segment: push the ball out and reflect its velocity
function collideSegment(b, sg) {
  const abx = sg.bx - sg.ax
  const aby = sg.by - sg.ay
  const len2 = abx * abx + aby * aby || 1
  let t = ((b.x - sg.ax) * abx + (b.y - sg.ay) * aby) / len2
  t = t < 0 ? 0 : t > 1 ? 1 : t
  const cx = sg.ax + abx * t
  const cy = sg.ay + aby * t
  let nx = b.x - cx
  let ny = b.y - cy
  let d = Math.hypot(nx, ny)
  if (d >= R || d === 0) return
  nx /= d
  ny /= d
  b.x = cx + nx * R
  b.y = cy + ny * R
  const vn = b.vx * nx + b.vy * ny
  if (vn < 0) {
    b.vx -= (1 + WALL_E) * vn * nx
    b.vy -= (1 + WALL_E) * vn * ny
    if (hitCooldown === 0 && vn < -2.5) {
      haptics.light()
      hitCooldown = 6
    }
  }
}

function pointInPoly(p, poly) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x
    const yi = poly[i].y
    const xj = poly[j].x
    const yj = poly[j].y
    const hit = yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi
    if (hit) inside = !inside
  }
  return inside
}
function inAnyWall(p, walls) {
  for (const w of walls) if (pointInPoly(p, w)) return true
  return false
}

function sink() {
  sunk = true
  ball.vx = 0
  ball.vy = 0
  ball.x = hole.value.cup.x
  ball.y = hole.value.cup.y
  haptics.success()
  scores.value[holeIdx.value] = strokes.value
  if (strokes.value === 1) progressStore.recordHoleInOne()
  state.value = 'holeDone'
}

// ---------- render loop ----------
function loop() {
  cancelAnimationFrame(raf)
  const step = () => {
    if (state.value === 'roll') physics()
    draw()
    raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)
}

function draw() {
  if (!ctx) return
  const h = hole.value
  ctx.clearRect(0, 0, W, H)

  // rough backdrop under the green
  ctx.fillStyle = '#1f5c37'
  ctx.fillRect(0, 0, W, H)

  // fairway fill + mow stripes (clipped to the fairway shape)
  ctx.save()
  tracePoly(h.fairway)
  ctx.clip()
  ctx.fillStyle = '#43a047'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = 'rgba(255,255,255,0.05)'
  for (let y = 0; y < H; y += 72) ctx.fillRect(0, y, W, 36)
  ctx.restore()

  // fairway border wall
  ctx.save()
  tracePoly(h.fairway)
  ctx.lineJoin = 'round'
  ctx.strokeStyle = '#255d38'
  ctx.lineWidth = 8
  ctx.stroke()
  ctx.strokeStyle = '#7bcb91'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.restore()

  // obstacles (hedges)
  for (const w of h.walls) {
    ctx.save()
    tracePoly(w)
    ctx.fillStyle = '#2f7d49'
    ctx.fill()
    ctx.strokeStyle = '#1c4a2c'
    ctx.lineWidth = 3
    ctx.lineJoin = 'round'
    ctx.stroke()
    ctx.restore()
    // top highlight
    ctx.save()
    tracePoly(w)
    ctx.clip()
    ctx.fillStyle = 'rgba(255,255,255,0.10)'
    ctx.fill()
    ctx.restore()
  }

  // cup
  ctx.beginPath()
  ctx.arc(h.cup.x, h.cup.y, CUP_R - 3, 0, 6.283)
  ctx.fillStyle = '#14261a'
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = 'rgba(255,255,255,0.65)'
  ctx.stroke()
  // flag (hidden once sunk, so the ball shows in the cup)
  if (!sunk) {
    ctx.strokeStyle = '#e0e0e0'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(h.cup.x, h.cup.y)
    ctx.lineTo(h.cup.x, h.cup.y - 46)
    ctx.stroke()
    ctx.fillStyle = '#e53935'
    ctx.beginPath()
    ctx.moveTo(h.cup.x, h.cup.y - 46)
    ctx.lineTo(h.cup.x + 26, h.cup.y - 39)
    ctx.lineTo(h.cup.x, h.cup.y - 32)
    ctx.closePath()
    ctx.fill()
  }

  // tee marker (until the first putt)
  if (strokes.value === 0 && state.value === 'aim') {
    ctx.beginPath()
    ctx.arc(h.tee.x, h.tee.y, R + 5, 0, 6.283)
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'
    ctx.lineWidth = 2
    ctx.stroke()
  }

  // aim indicator
  if (state.value === 'aim' && power > 0.06) {
    const len = Math.hypot(pullX, pullY) || 1
    const dx = pullX / len
    const dy = pullY / len
    const reach = 30 + power * 150
    const ex = ball.x + dx * reach
    const ey = ball.y + dy * reach
    const col = power < 0.5 ? '#8bc34a' : power < 0.8 ? '#ffb300' : '#ff5252'
    ctx.strokeStyle = col
    ctx.lineWidth = 3
    ctx.setLineDash([7, 6])
    ctx.beginPath()
    ctx.moveTo(ball.x, ball.y)
    ctx.lineTo(ex, ey)
    ctx.stroke()
    ctx.setLineDash([])
    // arrowhead
    const a = Math.atan2(dy, dx)
    ctx.fillStyle = col
    ctx.beginPath()
    ctx.moveTo(ex, ey)
    ctx.lineTo(ex - 11 * Math.cos(a - 0.4), ey - 11 * Math.sin(a - 0.4))
    ctx.lineTo(ex - 11 * Math.cos(a + 0.4), ey - 11 * Math.sin(a + 0.4))
    ctx.closePath()
    ctx.fill()
    // power ring on the ball
    ctx.beginPath()
    ctx.arc(ball.x, ball.y, R + 6, -Math.PI / 2, -Math.PI / 2 + power * 6.283)
    ctx.strokeStyle = col
    ctx.lineWidth = 3
    ctx.stroke()
  }

  // ball
  ctx.beginPath()
  ctx.arc(ball.x, ball.y + 2, R, 0, 6.283)
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  ctx.fill()
  ctx.beginPath()
  ctx.arc(ball.x, ball.y, R, 0, 6.283)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.beginPath()
  ctx.arc(ball.x - 2, ball.y - 2, R * 0.4, 0, 6.283)
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.fill()
}

function tracePoly(poly) {
  ctx.beginPath()
  ctx.moveTo(poly[0].x, poly[0].y)
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y)
  ctx.closePath()
}

// ---------- flow ----------
function advance() {
  haptics.light()
  if (holeIdx.value + 1 < total) {
    holeIdx.value++
    loadHole()
  } else {
    progressStore.recordCourse(totalStrokes.value, coursePar)
    state.value = 'courseDone'
  }
}
function newRound() {
  haptics.light()
  holeIdx.value = 0
  scores.value = []
  loadHole()
}
function confirmRestart() {
  haptics.light()
  $q.dialog({
    title: 'Restart hole?',
    message: 'Replay this hole from the tee. Your strokes on it so far won\'t count.',
    cancel: true,
    dark: true,
  }).onOk(() => loadHole())
}

// ---------- score naming ----------
function scoreName(s, par) {
  if (s === 1) return 'Hole in One!'
  const d = s - par
  if (d <= -3) return 'Albatross!'
  if (d === -2) return 'Eagle!'
  if (d === -1) return 'Birdie'
  if (d === 0) return 'Par'
  if (d === 1) return 'Bogey'
  if (d === 2) return 'Double Bogey'
  return `+${d}`
}
function scoreClass(s, par) {
  const d = s - par
  if (d < 0) return 'sc-under'
  if (d > 0) return 'sc-over'
  return ''
}
function formatToPar(toPar) {
  if (toPar === 0) return 'Even par'
  return toPar > 0 ? `+${toPar} over par` : `${toPar} under par`
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
  newRound()
})
onBeforeUnmount(() => cancelAnimationFrame(raf))
</script>

<style lang="scss" scoped>
.golf-page {
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
  min-width: 54px;
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
  padding: 16px;
}
.overlay-text { font-size: 1.7rem; font-weight: 800; color: #fff; text-align: center; }
.overlay-sub { color: rgba(255, 255, 255, 0.85); margin-top: -8px; }
.overlay-sub.big { font-size: 1.2rem; font-weight: 700; margin-top: 0; }
.overlay-fade-enter-active { transition: opacity 0.35s ease; }
.overlay-fade-enter-from { opacity: 0; }

.scorecard-overlay { gap: 16px; }
.scorecard {
  width: 100%;
  font-size: 0.8rem;
  color: #fff;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.sc-row {
  display: grid;
  grid-template-columns: 2.4rem repeat(9, 1fr) 1.8rem;
  gap: 2px;
  align-items: center;
  text-align: center;
}
.sc-row > span:first-child { text-align: left; opacity: 0.8; font-size: 0.7rem; }
.sc-head { opacity: 0.7; font-size: 0.7rem; }
.sc-tot { font-weight: 800; }
.sc-under { color: #a5d6a7; font-weight: 800; }
.sc-over { color: #ffab91; }

.hint {
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.82rem;
  text-align: center;
  margin: 8px 24px max(16px, env(safe-area-inset-bottom));
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}
:deep(.q-btn.bg-primary) { background: linear-gradient(135deg, #43a047 0%, #1b5e20 100%) !important; }
</style>
