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

        <!-- Commentator speech bubble / hint -->
        <transition name="quip-fade">
          <div v-if="quip" class="quip"><span class="quip-who">Chip:</span> {{ quip }}</div>
        </transition>
        <div class="banner" v-if="!quip && state === 'aim' && strokes === 0">Drag back from the ball to aim &amp; putt</div>

        <!-- Hole intro card -->
        <transition name="intro-fade">
          <div v-if="showIntro" class="hole-intro">
            <div class="hi-num">Hole {{ holeNum }}</div>
            <div class="hi-name">{{ hole.name }}</div>
            <div class="hi-par">Par {{ hole.par }}</div>
          </div>
        </transition>

        <!-- Hole complete -->
        <transition name="overlay-fade">
          <div v-if="state === 'holeDone'" class="board-overlay">
            <div class="overlay-text">{{ resultLabel }}</div>
            <div class="overlay-sub">{{ strokes }} {{ strokes === 1 ? 'stroke' : 'strokes' }} · par {{ hole.par }}</div>
            <div v-if="quip" class="overlay-quip">“{{ quip }}”<span class="oq-who"> — Chip</span></div>
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
              <div class="sc-title">Front Nine</div>
              <div class="sc-grid" :style="gridStyle(9)">
                <span class="sc-h">#</span>
                <span v-for="n in 9" :key="'fh' + n">{{ n }}</span>
                <span class="sc-tot">OUT</span>
                <span class="sc-h">Par</span>
                <span v-for="i in 9" :key="'fp' + i">{{ holes[i - 1].par }}</span>
                <span class="sc-tot">{{ frontPar }}</span>
                <span class="sc-h">You</span>
                <span v-for="i in 9" :key="'fy' + i" :class="scoreClass(scores[i - 1], holes[i - 1].par)">{{ scores[i - 1] ?? '–' }}</span>
                <span class="sc-tot">{{ frontStrokes }}</span>
              </div>
              <div class="sc-title">Back Nine</div>
              <div class="sc-grid" :style="gridStyle(9)">
                <span class="sc-h">#</span>
                <span v-for="n in 9" :key="'bh' + n">{{ n + 9 }}</span>
                <span class="sc-tot">IN</span>
                <span class="sc-h">Par</span>
                <span v-for="i in 9" :key="'bp' + i">{{ holes[i + 8].par }}</span>
                <span class="sc-tot">{{ backPar }}</span>
                <span class="sc-h">You</span>
                <span v-for="i in 9" :key="'by' + i" :class="scoreClass(scores[i + 8], holes[i + 8].par)">{{ scores[i + 8] ?? '–' }}</span>
                <span class="sc-tot">{{ backStrokes }}</span>
              </div>
            </div>
            <div class="overlay-sub big">{{ totalStrokes }} · {{ formatToPar(totalStrokes - coursePar) }}</div>
            <div v-if="quip" class="overlay-quip">“{{ quip }}”<span class="oq-who"> — Chip</span></div>
            <q-btn unelevated color="primary" text-color="white" label="Play Again" @click="newRound" />
          </div>
        </transition>
      </div>
    </div>

    <p class="hint">{{ holeHint }}</p>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useThemeStore } from 'src/stores/theme'
import { useProgressStore } from 'src/stores/progress'
import { useHaptics } from 'src/composables/useHaptics'
import { holes, coursePar as COURSE_PAR, PLAY_W, PLAY_H } from 'src/game/course'

// ---- geometry / tuning ----
const W = PLAY_W
const H = PLAY_H
const R = 7 // ball radius
const MAXSPEED = 14 // px/frame at full power
const MAXPULL = 230 // drag distance (canvas px) for full power
const MAXV = 20 // hard speed cap (keeps fast balls from tunnelling)
const SUB = 6 // physics sub-steps per frame
const WALL_E = 0.68 // wall restitution
const BUMP_E = 1.06 // bumpers are extra-bouncy
const FRICTION = 0.976 // per-frame rolling friction
const SAND_FRICTION = 0.86 // sand kills the roll fast
const BOOST = 0.55 // impulse per sub-step inside a boost pad
const STOP2 = 0.05 // speed² below which the ball is "stopped"
const CUP_R = 14 // capture radius around the cup
const SINK2 = 20 // speed² under which the ball drops in when over the cup

const router = useRouter()
const $q = useQuasar()
const themeStore = useThemeStore()
const progressStore = useProgressStore()
const haptics = useHaptics()

const course = holes
const coursePar = COURSE_PAR
const total = course.length

const canvasEl = ref(null)
const state = ref('aim') // aim | roll | holeDone | courseDone
const holeIdx = ref(0)
const strokes = ref(0)
const scores = ref([]) // strokes taken on each completed hole
const quip = ref(null)
const showIntro = ref(false)

const hole = computed(() => course[holeIdx.value])
const holeNum = computed(() => holeIdx.value + 1)
const totalStrokes = computed(() => {
  const done = scores.value.reduce((a, b) => a + (b || 0), 0)
  const currentCounted = scores.value[holeIdx.value] != null
  return done + (currentCounted ? 0 : strokes.value)
})
const resultLabel = computed(() => scoreName(strokes.value, hole.value.par))
const frontPar = computed(() => course.slice(0, 9).reduce((a, h) => a + h.par, 0))
const backPar = computed(() => course.slice(9, 18).reduce((a, h) => a + h.par, 0))
const frontStrokes = computed(() => sumScores(0, 9))
const backStrokes = computed(() => sumScores(9, 18))
const holeHint = computed(() => HINTS[hole.value.name] || 'Ease off the power near the cup — a fast ball lips out')

let ctx = null
let ball = { x: 0, y: 0, vx: 0, vy: 0 }
let restPos = { x: 0, y: 0 } // last dry resting spot (water sends you back here)
let segs = [] // flattened wall segments for the current hole
let cupPos = { x: 0, y: 0 } // live cup position (may move)
let cupBase = { x: 0, y: 0 } // moving-cup oscillation origin
let windmills = [] // live windmill state (angle etc.)
let raf = null
let tick = 0 // frame counter, drives all timed animation (no Date needed)
let restFrames = 0
let hitCd = 0 // throttle wall-hit haptics
let portalCd = 0 // frames until portals re-arm
let bounces = 0 // wall/bumper bounces this shot (for trick-shot detection)
let dizzy = 0 // frames Otto stays dizzy after a hard knock
let introUntil = 0 // tick until which the intro card shows
let quipUntil = 0 // tick until which the speech bubble shows
let sunk = false

// pointer / aim state
let aiming = false
let pullX = 0
let pullY = 0
let power = 0

// ---------- hole setup ----------
function loadHole() {
  cancelAnimationFrame(raf)
  const h = hole.value
  strokes.value = 0
  sunk = false
  bounces = 0
  dizzy = 0
  portalCd = 0
  ball = { x: h.tee.x, y: h.tee.y, vx: 0, vy: 0 }
  restPos = { x: h.tee.x, y: h.tee.y }
  segs = buildSegments(h)
  cupBase = { x: h.cup.x, y: h.cup.y }
  cupPos = { x: h.cup.x, y: h.cup.y }
  windmills = (h.windmills || []).map((wm) => ({ ...wm, angle: 0 }))
  aiming = false
  power = 0
  quip.value = null
  introUntil = tick + 96
  showIntro.value = true
  state.value = 'aim'
  loop()
}

// break every polygon (fairway border + obstacles) into individual segments
function buildSegments(h) {
  const out = []
  const polys = [h.fairway, ...(h.walls || [])]
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
  // capture the pointer so aiming keeps tracking even if the finger strays off
  // the (small) canvas — otherwise a strong pull past the edge gets dropped
  try {
    canvasEl.value.setPointerCapture(e.pointerId)
  } catch {
    // capture is best-effort; ignore if unsupported
  }
  ball._anchor = toLocal(e)
  pullX = 0
  pullY = 0
  power = 0
}
function onMove(e) {
  if (!aiming) return
  e.preventDefault()
  const p = toLocal(e)
  pullX = ball._anchor.x - p.x
  pullY = ball._anchor.y - p.y
  power = Math.min(Math.hypot(pullX, pullY) / MAXPULL, 1)
}
function onUp() {
  if (!aiming) return
  aiming = false
  if (state.value !== 'aim') return
  if (power < 0.06) {
    power = 0
    return
  }
  putt()
}
function putt() {
  const len = Math.hypot(pullX, pullY) || 1
  const speed = power * MAXSPEED
  ball.vx = (pullX / len) * speed
  ball.vy = (pullY / len) * speed
  strokes.value++
  restFrames = 0
  bounces = 0
  power = 0
  quip.value = null
  state.value = 'roll'
  haptics.medium()
}

// ---------- physics ----------
function physics() {
  const h = hole.value
  let inSand = false
  for (let s = 0; s < SUB; s++) {
    ball.x += ball.vx / SUB
    ball.y += ball.vy / SUB

    // terrain zones
    if (h.zones) {
      for (const z of h.zones) {
        if (!pointInPoly(ball, z.poly)) continue
        if (z.type === 'water') return splash()
        if (z.type === 'sand') inSand = true
        if (z.type === 'boost') {
          ball.vx += z.dir.x * BOOST
          ball.vy += z.dir.y * BOOST
        }
      }
    }

    // walls / obstacles (two passes settle tight corners)
    for (let pass = 0; pass < 2; pass++) {
      for (const sg of segs) collideSegment(ball, sg)
    }
    // bumpers
    if (h.bumpers) for (const b of h.bumpers) collideBumper(b)
    // windmills
    for (const wm of windmills) collideWindmill(wm)
    // portals
    if (h.portals && portalCd <= 0) {
      for (const pt of h.portals) {
        if (dist(ball, pt.a) < pt.r) return teleport(pt.b)
        if (dist(ball, pt.b) < pt.r) return teleport(pt.a)
      }
    }

    clampSpeed()

    // cup capture (against the live cup position)
    const dxc = cupPos.x - ball.x
    const dyc = cupPos.y - ball.y
    const dc = Math.hypot(dxc, dyc)
    const sp2 = ball.vx * ball.vx + ball.vy * ball.vy
    if (dc < CUP_R) {
      if (sp2 < SINK2) return sink()
      ball.vx += (dxc / dc) * 0.4
      ball.vy += (dyc / dc) * 0.4
      if (sp2 > 40 && dizzy === 0) dizzy = 32 // lipped out at speed → dizzy
    } else if (dc < CUP_R * 2.3 && sp2 < 8) {
      ball.vx += (dxc / dc) * 0.3
      ball.vy += (dyc / dc) * 0.3
    }
  }

  if (portalCd > 0) portalCd--
  const f = inSand ? SAND_FRICTION : FRICTION
  ball.vx *= f
  ball.vy *= f
  if (hitCd > 0) hitCd--

  const sp2 = ball.vx * ball.vx + ball.vy * ball.vy
  if (sp2 < STOP2) restFrames++
  else restFrames = 0

  if (restFrames > 8) {
    ball.vx = 0
    ball.vy = 0
    if (!pointInPoly(ball, h.fairway) || inAnyWall(ball, h.walls) || inWater(ball)) {
      ball.x = restPos.x
      ball.y = restPos.y
    }
    restPos = { x: ball.x, y: ball.y }
    state.value = 'aim'
  }
}

function clampSpeed() {
  const sp = Math.hypot(ball.vx, ball.vy)
  if (sp > MAXV) {
    ball.vx = (ball.vx / sp) * MAXV
    ball.vy = (ball.vy / sp) * MAXV
  }
}

// circle vs line-segment: push out + reflect
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
    registerBounce(vn)
  }
}

function collideBumper(bp) {
  const dx = ball.x - bp.x
  const dy = ball.y - bp.y
  const d = Math.hypot(dx, dy)
  const min = R + bp.r
  if (d >= min || d === 0) return
  const nx = dx / d
  const ny = dy / d
  ball.x = bp.x + nx * min
  ball.y = bp.y + ny * min
  const vn = ball.vx * nx + ball.vy * ny
  if (vn < 0) {
    ball.vx -= (1 + BUMP_E) * vn * nx
    ball.vy -= (1 + BUMP_E) * vn * ny
    registerBounce(vn * 1.4)
  }
}

// circle vs rotating blade (a bar through the hub) + the solid hub
function collideWindmill(wm) {
  // hub acts like a small static bumper
  const hd = dist(ball, wm)
  if (hd < R + wm.hub && hd > 0) {
    const nx = (ball.x - wm.x) / hd
    const ny = (ball.y - wm.y) / hd
    ball.x = wm.x + nx * (R + wm.hub)
    ball.y = wm.y + ny * (R + wm.hub)
    const vn = ball.vx * nx + ball.vy * ny
    if (vn < 0) {
      ball.vx -= (1 + WALL_E) * vn * nx
      ball.vy -= (1 + WALL_E) * vn * ny
    }
  }
  // blade: a segment from one tip through the hub to the other
  const a = wm.angle
  const ex = Math.cos(a) * wm.len
  const ey = Math.sin(a) * wm.len
  const p1 = { x: wm.x + ex, y: wm.y + ey }
  const p2 = { x: wm.x - ex, y: wm.y - ey }
  const abx = p2.x - p1.x
  const aby = p2.y - p1.y
  const len2 = abx * abx + aby * aby || 1
  let t = ((ball.x - p1.x) * abx + (ball.y - p1.y) * aby) / len2
  t = t < 0 ? 0 : t > 1 ? 1 : t
  const cx = p1.x + abx * t
  const cy = p1.y + aby * t
  let nx = ball.x - cx
  let ny = ball.y - cy
  let d = Math.hypot(nx, ny)
  const rad = R + 5 // blade half-thickness
  if (d >= rad || d === 0) return
  nx /= d
  ny /= d
  ball.x = cx + nx * rad
  ball.y = cy + ny * rad
  // blade surface velocity at the contact point (ω × r) — this "swats" the ball
  const rx = cx - wm.x
  const ry = cy - wm.y
  const bvx = -wm.speed * ry
  const bvy = wm.speed * rx
  const relx = ball.vx - bvx
  const rely = ball.vy - bvy
  const vn = relx * nx + rely * ny
  if (vn < 0) {
    const rvx = relx - (1 + WALL_E) * vn * nx
    const rvy = rely - (1 + WALL_E) * vn * ny
    ball.vx = rvx + bvx
    ball.vy = rvy + bvy
    registerBounce(vn * 1.3)
  }
}

function teleport(dest) {
  const sp = Math.hypot(ball.vx, ball.vy) || 1
  ball.x = dest.x + (ball.vx / sp) * (R + 24)
  ball.y = dest.y + (ball.vy / sp) * (R + 24)
  portalCd = 14
  setQuip(LINES.portal)
  haptics.light()
}

function splash() {
  strokes.value += 1 // penalty
  ball.x = restPos.x
  ball.y = restPos.y
  ball.vx = 0
  ball.vy = 0
  restFrames = 0
  dizzy = 0
  progressStore.recordSplash()
  setQuip(LINES.water)
  haptics.medium()
  state.value = 'aim'
}

function registerBounce(vn) {
  bounces++
  if (-vn > 9 && dizzy === 0) dizzy = 30
  if (hitCd === 0 && vn < -2.2) {
    haptics.light()
    hitCd = 5
  }
}

function dist(p, q) {
  return Math.hypot(p.x - q.x, p.y - q.y)
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
  if (!walls) return false
  for (const w of walls) if (pointInPoly(p, w)) return true
  return false
}
function inWater(p) {
  const zs = hole.value.zones
  if (!zs) return false
  for (const z of zs) if (z.type === 'water' && pointInPoly(p, z.poly)) return true
  return false
}
function nearWater(p) {
  const zs = hole.value.zones
  if (!zs) return false
  for (const z of zs) {
    if (z.type !== 'water') continue
    if (distToPoly(p, z.poly) < 46 || pointInPoly(p, z.poly)) return true
  }
  return false
}
function distToPoly(p, poly) {
  let min = Infinity
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const abx = b.x - a.x
    const aby = b.y - a.y
    const l2 = abx * abx + aby * aby || 1
    let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / l2
    t = t < 0 ? 0 : t > 1 ? 1 : t
    min = Math.min(min, Math.hypot(p.x - (a.x + abx * t), p.y - (a.y + aby * t)))
  }
  return min
}

function sink() {
  sunk = true
  ball.vx = 0
  ball.vy = 0
  ball.x = cupPos.x
  ball.y = cupPos.y
  haptics.success()
  scores.value[holeIdx.value] = strokes.value
  if (strokes.value === 1) {
    progressStore.recordHoleInOne()
    setQuip(LINES.ace)
  } else if (bounces >= 3) {
    setQuip(LINES.trick)
  } else {
    const d = strokes.value - hole.value.par
    if (d < 0) setQuip(LINES.under)
    else if (d === 0) setQuip(LINES.par)
    else if (d === 1) setQuip(LINES.bogey)
    else setQuip(LINES.bad)
  }
  state.value = 'holeDone'
}

// ---------- commentator ----------
function setQuip(pool) {
  quip.value = pool[Math.floor(Math.random() * pool.length)]
  quipUntil = tick + 150
}

// ---------- render loop ----------
function loop() {
  cancelAnimationFrame(raf)
  const step = () => {
    tick++
    // spin windmills + slide moving cups even while aiming
    for (const wm of windmills) wm.angle += wm.speed
    updateCup()
    if (showIntro.value && tick > introUntil) showIntro.value = false
    if (quip.value && state.value === 'roll' && tick > quipUntil) quip.value = null
    if (dizzy > 0) dizzy--

    if (state.value === 'roll') physics()
    draw()
    raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)
}

function updateCup() {
  const m = hole.value.cup.move
  if (!m) return
  const span = (m.max - m.min) / 2
  const mid = (m.max + m.min) / 2
  const off = Math.sin(tick * 0.02 * m.speed) * span
  if (m.axis === 'x') cupPos = { x: mid + off, y: cupBase.y }
  else cupPos = { x: cupBase.x, y: mid + off }
}

function draw() {
  if (!ctx) return
  const h = hole.value
  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = '#1f5c37'
  ctx.fillRect(0, 0, W, H)

  // fairway fill + mow stripes
  ctx.save()
  tracePoly(h.fairway)
  ctx.clip()
  ctx.fillStyle = '#43a047'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = 'rgba(255,255,255,0.05)'
  for (let y = 0; y < H; y += 72) ctx.fillRect(0, y, W, 36)
  drawZones(h)
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
  for (const w of h.walls || []) {
    ctx.save()
    tracePoly(w)
    ctx.fillStyle = '#2f7d49'
    ctx.fill()
    ctx.strokeStyle = '#1c4a2c'
    ctx.lineWidth = 3
    ctx.lineJoin = 'round'
    ctx.stroke()
    ctx.restore()
  }

  drawPortals(h)
  drawBumpers(h)
  drawCup()
  drawWindmills()
  drawTee(h)
  drawAim()
  drawBall()
}

function drawZones(h) {
  if (!h.zones) return
  for (const z of h.zones) {
    tracePoly(z.poly)
    if (z.type === 'water') {
      ctx.fillStyle = 'rgba(30,120,190,0.75)'
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.12)'
      for (let i = 0; i < 5; i++) {
        const yy = z.poly[0].y + 12 + i * 14 + Math.sin(tick * 0.05 + i) * 3
        ctx.fillRect(z.poly[0].x + 8, yy, z.poly[1].x - z.poly[0].x - 16, 3)
      }
    } else if (z.type === 'sand') {
      ctx.fillStyle = '#d9c48f'
      ctx.fill()
      ctx.fillStyle = 'rgba(140,110,50,0.35)'
      const b = polyBounds(z.poly)
      for (let i = 0; i < 26; i++) {
        const px = b.x1 + ((i * 71) % (b.x2 - b.x1))
        const py = b.y1 + ((i * 137) % (b.y2 - b.y1))
        ctx.fillRect(px, py, 2, 2)
      }
    } else if (z.type === 'boost') {
      ctx.fillStyle = 'rgba(255,214,0,0.14)'
      ctx.fill()
      // chevrons pointing along dir
      const b = polyBounds(z.poly)
      const cx = (b.x1 + b.x2) / 2
      ctx.strokeStyle = 'rgba(255,214,0,0.85)'
      ctx.lineWidth = 4
      ctx.lineCap = 'round'
      const ph = (tick * 0.6) % 26
      for (let k = -1; k < 4; k++) {
        const yy = b.y2 - 12 - k * 26 - ph
        if (yy < b.y1 + 6 || yy > b.y2 - 6) continue
        ctx.beginPath()
        ctx.moveTo(cx - 16, yy + 8)
        ctx.lineTo(cx, yy)
        ctx.lineTo(cx + 16, yy + 8)
        ctx.stroke()
      }
    }
  }
}

function drawBumpers(h) {
  if (!h.bumpers) return
  for (const b of h.bumpers) {
    ctx.beginPath()
    ctx.arc(b.x, b.y, b.r, 0, 6.283)
    ctx.fillStyle = '#e0398a'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(b.x, b.y, b.r * 0.62, 0, 6.283)
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'
    ctx.lineWidth = 3
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.18, 0, 6.283)
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.fill()
  }
}

function drawPortals(h) {
  if (!h.portals) return
  for (const pt of h.portals) {
    drawPortalRing(pt.a, '#7e57c2')
    drawPortalRing(pt.b, '#26c6da')
  }
}
function drawPortalRing(p, color) {
  for (let i = 0; i < 3; i++) {
    ctx.beginPath()
    const rr = p.r - i * 5 + Math.sin(tick * 0.08 + i) * 2
    ctx.arc(p.x, p.y, Math.max(3, rr), 0, 6.283)
    ctx.strokeStyle = color
    ctx.globalAlpha = 0.4 + i * 0.2
    ctx.lineWidth = 3
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

function drawCup() {
  ctx.beginPath()
  ctx.arc(cupPos.x, cupPos.y, CUP_R - 3, 0, 6.283)
  ctx.fillStyle = '#14261a'
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = 'rgba(255,255,255,0.65)'
  ctx.stroke()
  if (!sunk) {
    ctx.strokeStyle = '#e0e0e0'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(cupPos.x, cupPos.y)
    ctx.lineTo(cupPos.x, cupPos.y - 46)
    ctx.stroke()
    ctx.fillStyle = '#e53935'
    ctx.beginPath()
    ctx.moveTo(cupPos.x, cupPos.y - 46)
    ctx.lineTo(cupPos.x + 26, cupPos.y - 39)
    ctx.lineTo(cupPos.x, cupPos.y - 32)
    ctx.closePath()
    ctx.fill()
  }
}

function drawWindmills() {
  for (const wm of windmills) {
    // blade
    ctx.save()
    ctx.translate(wm.x, wm.y)
    ctx.rotate(wm.angle)
    ctx.fillStyle = '#f5f5f5'
    ctx.strokeStyle = '#c62828'
    ctx.lineWidth = 2
    roundRect(-wm.len, -6, wm.len * 2, 12, 6)
    ctx.fill()
    ctx.stroke()
    // red tips
    ctx.fillStyle = '#e53935'
    roundRect(wm.len - 26, -6, 26, 12, 6)
    ctx.fill()
    roundRect(-wm.len, -6, 26, 12, 6)
    ctx.fill()
    ctx.restore()
    // hub
    ctx.beginPath()
    ctx.arc(wm.x, wm.y, wm.hub, 0, 6.283)
    ctx.fillStyle = '#5d4037'
    ctx.fill()
    ctx.strokeStyle = '#3e2723'
    ctx.lineWidth = 2
    ctx.stroke()
  }
}

function drawTee(h) {
  if (strokes.value === 0 && state.value === 'aim') {
    ctx.beginPath()
    ctx.arc(h.tee.x, h.tee.y, R + 5, 0, 6.283)
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'
    ctx.lineWidth = 2
    ctx.stroke()
  }
}

function drawAim() {
  if (state.value !== 'aim' || power <= 0.06) return
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
  const a = Math.atan2(dy, dx)
  ctx.fillStyle = col
  ctx.beginPath()
  ctx.moveTo(ex, ey)
  ctx.lineTo(ex - 11 * Math.cos(a - 0.4), ey - 11 * Math.sin(a - 0.4))
  ctx.lineTo(ex - 11 * Math.cos(a + 0.4), ey - 11 * Math.sin(a + 0.4))
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.arc(ball.x, ball.y, R + 6, -Math.PI / 2, -Math.PI / 2 + power * 6.283)
  ctx.strokeStyle = col
  ctx.lineWidth = 3
  ctx.stroke()
}

// Otto the ball — a googly-eyed golf ball that emotes
function drawBall() {
  ctx.beginPath()
  ctx.arc(ball.x, ball.y + 2, R, 0, 6.283)
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  ctx.fill()
  ctx.beginPath()
  ctx.arc(ball.x, ball.y, R, 0, 6.283)
  ctx.fillStyle = '#ffffff'
  ctx.fill()

  const sp = Math.hypot(ball.vx, ball.vy)
  // where Otto looks: along motion, else toward the aim, else toward the cup
  let lx = 0
  let ly = 0
  if (sp > 0.8) {
    lx = ball.vx / sp
    ly = ball.vy / sp
  } else if (state.value === 'aim' && power > 0.06) {
    const l = Math.hypot(pullX, pullY) || 1
    lx = pullX / l
    ly = pullY / l
  } else {
    const dx = cupPos.x - ball.x
    const dy = cupPos.y - ball.y
    const l = Math.hypot(dx, dy) || 1
    lx = dx / l
    ly = dy / l
  }

  const eyeDx = 2.5
  const worried = nearWater(ball) && state.value !== 'holeDone'
  const blink = tick % 220 < 6 && dizzy === 0 && !worried

  ctx.save()
  // eye whites
  const er = worried ? 3.1 : 2.6
  for (const s of [-1, 1]) {
    const ex = ball.x + s * eyeDx
    const ey = ball.y - 1
    if (dizzy > 0) {
      // dizzy: little X eyes
      ctx.strokeStyle = '#333'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(ex - 2, ey - 2)
      ctx.lineTo(ex + 2, ey + 2)
      ctx.moveTo(ex + 2, ey - 2)
      ctx.lineTo(ex - 2, ey + 2)
      ctx.stroke()
      continue
    }
    ctx.beginPath()
    ctx.fillStyle = '#fff'
    ctx.arc(ex, ey, er, 0, 6.283)
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.15)'
    ctx.lineWidth = 0.5
    ctx.stroke()
    if (blink) {
      ctx.strokeStyle = '#333'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(ex - er, ey)
      ctx.lineTo(ex + er, ey)
      ctx.stroke()
    } else {
      ctx.beginPath()
      ctx.fillStyle = '#222'
      ctx.arc(ex + lx * 1.3, ey + ly * 1.3, 1.4, 0, 6.283)
      ctx.fill()
    }
  }
  // happy mouth on sink; sweat drop when worried
  if (sunk) {
    ctx.strokeStyle = '#c62828'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(ball.x, ball.y + 1.5, 2.4, 0.1 * Math.PI, 0.9 * Math.PI)
    ctx.stroke()
  }
  if (worried) {
    ctx.fillStyle = '#4fc3f7'
    ctx.beginPath()
    ctx.arc(ball.x + eyeDx + 3, ball.y - 3 + (tick % 40) * 0.05, 1.4, 0, 6.283)
    ctx.fill()
  }
  ctx.restore()
}

// ---------- canvas helpers ----------
function tracePoly(poly) {
  ctx.beginPath()
  ctx.moveTo(poly[0].x, poly[0].y)
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y)
  ctx.closePath()
}
function roundRect(x, y, w, hh, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + hh, r)
  ctx.arcTo(x + w, y + hh, x, y + hh, r)
  ctx.arcTo(x, y + hh, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
function polyBounds(poly) {
  let x1 = Infinity
  let y1 = Infinity
  let x2 = -Infinity
  let y2 = -Infinity
  for (const p of poly) {
    x1 = Math.min(x1, p.x)
    y1 = Math.min(y1, p.y)
    x2 = Math.max(x2, p.x)
    y2 = Math.max(y2, p.y)
  }
  return { x1, y1, x2, y2 }
}

// ---------- flow ----------
function advance() {
  haptics.light()
  if (holeIdx.value + 1 < total) {
    holeIdx.value++
    loadHole()
  } else {
    progressStore.recordCourse(totalStrokes.value, coursePar)
    setQuip(roundQuip(totalStrokes.value - coursePar))
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
    message: "Replay this hole from the tee. Your strokes on it so far won't count.",
    cancel: true,
    dark: true,
  }).onOk(() => loadHole())
}

// ---------- scoring ----------
function sumScores(a, b) {
  let t = 0
  for (let i = a; i < b; i++) t += scores.value[i] || 0
  return t
}
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
  if (s == null) return ''
  const d = s - par
  if (d < 0) return 'sc-under'
  if (d > 0) return 'sc-over'
  return ''
}
function formatToPar(toPar) {
  if (toPar === 0) return 'Even par'
  return toPar > 0 ? `+${toPar} over par` : `${toPar} under par`
}
function gridStyle(cols) {
  return { gridTemplateColumns: `2.2rem repeat(${cols}, 1fr) 1.9rem` }
}
function roundQuip(toPar) {
  if (toPar <= -3) return LINES.roundGreat
  if (toPar <= 2) return LINES.roundGood
  if (toPar <= 8) return LINES.roundOk
  return LINES.roundRough
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
  scores.value = []
  holeIdx.value = devStartHole()
  loadHole()
  // Dev-only test harness hook (tree-shaken out of production builds).
  if (import.meta.env.DEV) {
    window.__mg = () => ({
      state: state.value,
      hole: holeIdx.value,
      strokes: strokes.value,
      ball: { x: ball.x, y: ball.y },
      cup: { x: cupPos.x, y: cupPos.y },
    })
  }
})
function devStartHole() {
  if (import.meta.env.DEV) {
    const q = new URLSearchParams((location.hash.split('?')[1] || ''))
    const n = parseInt(q.get('hole'), 10)
    if (n >= 1 && n <= total) return n - 1
  }
  return 0
}
onBeforeUnmount(() => cancelAnimationFrame(raf))

// ---------- copy ----------
const HINTS = {
  'Otto Overboard': 'Water is a one-stroke penalty — take the dry lane up the right',
  'Sand Trap': 'Sand kills your roll — carry it or skirt around the bunker',
  'Bumper Alley': 'The bumpers are bouncy — use them, or curse them',
  'The Windmill': 'Time your putt through the spinning blade',
  'Boost Boulevard': 'Roll onto a boost pad for a free burst of speed',
  'Portal Chaos': 'The portals link up — one takes you near the cup',
  'Moving Target': 'The cup slides — putt where it’s going to be',
  'The Gauntlet': 'Sand, bumpers, and a moving cup. Good luck.',
  'The Big Finish': 'Everything at once. Give ’em a show.',
}
const LINES = {
  water: [
    'SPLASH! Otto’s going for a swim. +1.',
    'And it’s in the drink. +1 penalty.',
    'Otto forgot his floaties. +1.',
    'Water you doing out there? +1.',
  ],
  ace: [
    'ACE! Chip is speechless. (He isn’t.)',
    'Hole in one! Somebody frame that.',
    'One shot. Absolutely filthy.',
    'Did you SEE that?! A perfect ace.',
  ],
  trick: [
    'Off the walls — literally!',
    'Bank shot! Chip is on his feet.',
    'That belongs on a highlight reel.',
  ],
  under: ['Under par. Chip approves.', 'Birdie business. Smooth.', 'Almost suspiciously good.'],
  par: ['Par. Respectable.', 'Right on the number.', 'Par for the course. Literally.'],
  bogey: ['One over. We move on.', 'Bogey. Happens to the best.', 'Close enough. Next!'],
  bad: [
    '…we don’t have to talk about that one.',
    'Chip has quietly looked away.',
    'Let’s call that a “learning hole.”',
  ],
  portal: ['Wheee! See you on the other side.', 'Otto took the shortcut.'],
  roundGreat: ['A round for the ages. Chip is tearing up.'],
  roundGood: ['Tidy round. The clubhouse is impressed.'],
  roundOk: ['Not bad! Otto had fun, and that’s what counts.'],
  roundRough: ['Rough day at the office. The snacks are on the house.'],
}
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
.banner,
.quip {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  max-width: 92%;
  text-align: center;
  font-size: 0.78rem;
  color: #fff;
  background: rgba(0, 0, 0, 0.42);
  padding: 4px 12px;
  border-radius: 999px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.quip-who { color: #ffd54f; font-weight: 700; margin-right: 3px; }
.quip-fade-enter-active,
.quip-fade-leave-active { transition: opacity 0.3s ease; }
.quip-fade-enter-from,
.quip-fade-leave-to { opacity: 0; }

.hole-intro {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  pointer-events: none;
  color: #fff;
  text-shadow: 0 3px 12px rgba(0, 0, 0, 0.6);
}
.hi-num { font-size: 0.9rem; letter-spacing: 0.1em; text-transform: uppercase; opacity: 0.85; }
.hi-name { font-size: 2rem; font-weight: 800; }
.hi-par { font-size: 1rem; opacity: 0.9; }
.intro-fade-enter-active { transition: opacity 0.3s ease; }
.intro-fade-leave-active { transition: opacity 0.6s ease; }
.intro-fade-enter-from,
.intro-fade-leave-to { opacity: 0; }

.board-overlay {
  position: absolute;
  inset: 0;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.58);
  backdrop-filter: blur(3px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 16px;
  overflow: auto;
}
.overlay-text { font-size: 1.7rem; font-weight: 800; color: #fff; text-align: center; }
.overlay-sub { color: rgba(255, 255, 255, 0.85); margin-top: -6px; }
.overlay-sub.big { font-size: 1.15rem; font-weight: 700; margin-top: 0; }
.overlay-quip {
  color: #ffe082;
  font-size: 0.85rem;
  font-style: italic;
  text-align: center;
  max-width: 90%;
}
.oq-who { color: rgba(255, 255, 255, 0.6); font-style: normal; }
.overlay-fade-enter-active { transition: opacity 0.35s ease; }
.overlay-fade-enter-from { opacity: 0; }

.scorecard-overlay { gap: 12px; }
.scorecard { width: 100%; color: #fff; display: flex; flex-direction: column; gap: 6px; }
.sc-title { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.75; margin-top: 2px; }
.sc-grid {
  display: grid;
  gap: 2px 1px;
  align-items: center;
  text-align: center;
  font-size: 0.72rem;
}
.sc-grid > span { padding: 1px 0; }
.sc-h { text-align: left !important; opacity: 0.7; font-size: 0.64rem; }
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
