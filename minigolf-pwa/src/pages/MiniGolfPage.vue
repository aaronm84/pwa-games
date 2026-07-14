<template>
  <q-page
    class="golf-page"
    :style="{ background: theme.sky || themeStore.colors.gradient }"
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
        <q-btn v-if="canMulligan" fab-mini flat icon="undo" color="amber" @click="mulligan" />
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

        <transition name="quip-fade">
          <div v-if="quip" class="quip"><span class="quip-who">Chip:</span> {{ quip }}</div>
        </transition>
        <div class="banner" v-if="!quip && state === 'aim' && strokes === 0">Drag back from the ball to aim &amp; putt</div>

        <transition name="toast-fade">
          <div v-if="toast" class="event-toast">{{ toast }}</div>
        </transition>

        <transition name="intro-fade">
          <div v-if="showIntro" class="hole-intro">
            <div class="hi-num">{{ course.name }} · Hole {{ holeNum }}</div>
            <div class="hi-name">{{ hole.name }}</div>
            <div class="hi-par">Par {{ hole.par }}</div>
          </div>
        </transition>

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

        <transition name="overlay-fade">
          <div v-if="state === 'courseDone'" class="board-overlay scorecard-overlay">
            <div class="overlay-text">Round Complete</div>
            <div class="sc-course">{{ course.name }}</div>
            <div class="scorecard">
              <div class="sc-title">Front Nine</div>
              <div class="sc-grid" :style="gridStyle">
                <span class="sc-h">#</span><span v-for="n in 9" :key="'fh' + n">{{ n }}</span><span class="sc-tot">OUT</span>
                <span class="sc-h">Par</span><span v-for="i in 9" :key="'fp' + i">{{ hole9(i - 1).par }}</span><span class="sc-tot">{{ frontPar }}</span>
                <span class="sc-h">You</span><span v-for="i in 9" :key="'fy' + i" :class="scoreClass(scores[i - 1], hole9(i - 1).par)">{{ scores[i - 1] ?? '–' }}</span><span class="sc-tot">{{ frontStrokes }}</span>
              </div>
              <div class="sc-title">Back Nine</div>
              <div class="sc-grid" :style="gridStyle">
                <span class="sc-h">#</span><span v-for="n in 9" :key="'bh' + n">{{ n + 9 }}</span><span class="sc-tot">IN</span>
                <span class="sc-h">Par</span><span v-for="i in 9" :key="'bp' + i">{{ hole9(i + 8).par }}</span><span class="sc-tot">{{ backPar }}</span>
                <span class="sc-h">You</span><span v-for="i in 9" :key="'by' + i" :class="scoreClass(scores[i + 8], hole9(i + 8).par)">{{ scores[i + 8] ?? '–' }}</span><span class="sc-tot">{{ backStrokes }}</span>
              </div>
            </div>
            <div class="overlay-sub big">{{ totalStrokes }} · {{ formatToPar(totalStrokes - coursePar) }}</div>
            <div v-if="quip" class="overlay-quip">“{{ quip }}”<span class="oq-who"> — Chip</span></div>
            <div class="cd-btns">
              <q-btn unelevated color="primary" text-color="white" label="Play Again" @click="newRound" />
              <q-btn flat color="white" label="Courses" @click="toCourses" />
            </div>
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
import { useSettingsStore } from 'src/stores/settings'
import { useHaptics } from 'src/composables/useHaptics'
import { courseById, coursePar as parOf, PLAY_W, PLAY_H } from 'src/game/courses'
import { putterById } from 'src/game/putters'

// ---- geometry / tuning ----
const W = PLAY_W
const H = PLAY_H
const R = 7
const BASE_MAXSPEED = 14
const MAXPULL = 230
const MAXV = 20
const SUB = 6
const WALL_E = 0.68
const BUMP_E = 1.06
const BASE_FRICTION = 0.976
const SAND_FRICTION = 0.86
const SPLAT_FRICTION = 0.9
const BOOST = 0.55
const STOP2 = 0.05
const CUP_R = 14
const SINK2 = 20

const router = useRouter()
const $q = useQuasar()
const themeStore = useThemeStore()
const progressStore = useProgressStore()
const settings = useSettingsStore()
const haptics = useHaptics()

// ---- selection ----
const course = courseById(settings.settings.selectedCourse)
const putter = putterById(settings.settings.selectedPutter)
const theme = course.theme
const holesArr = course.holes
const coursePar = parOf(course)
const total = holesArr.length

const MAXSPEED = BASE_MAXSPEED * (putter.mods.power ?? 1)
const FRICTION = 1 - (1 - BASE_FRICTION) / (putter.mods.friction ?? 1)
const HOMING = putter.mods.homing ?? 0
const GUIDE = putter.mods.guide ?? 'line'
const MULLIGANS = putter.mods.mulligan ?? 0

const canvasEl = ref(null)
const state = ref('aim')
const holeIdx = ref(0)
const strokes = ref(0)
const scores = ref([])
const quip = ref(null)
const toast = ref(null)
const showIntro = ref(false)
const mulligansLeft = ref(0)

const hole = computed(() => holesArr[holeIdx.value])
const holeNum = computed(() => holeIdx.value + 1)
const totalStrokes = computed(() => {
  const done = scores.value.reduce((a, b) => a + (b || 0), 0)
  return done + (scores.value[holeIdx.value] != null ? 0 : strokes.value)
})
const resultLabel = computed(() => scoreName(strokes.value, hole.value.par))
const frontPar = computed(() => holesArr.slice(0, 9).reduce((a, h) => a + h.par, 0))
const backPar = computed(() => holesArr.slice(9, 18).reduce((a, h) => a + h.par, 0))
const frontStrokes = computed(() => sumScores(0, 9))
const backStrokes = computed(() => sumScores(9, 18))
const holeHint = computed(() => HINTS[hole.value.name] || DEFAULT_HINT)
const canMulligan = computed(
  () => mulligansLeft.value > 0 && state.value === 'aim' && strokes.value > 0 && mulliganPos !== null,
)
const gridStyle = computed(() => ({ gridTemplateColumns: '2.2rem repeat(9, 1fr) 1.9rem' }))

let ctx = null
let ball = { x: 0, y: 0, vx: 0, vy: 0 }
let restPos = { x: 0, y: 0 }
let mulliganPos = null // ball position before the last shot (for a do-over)
let segs = []
let cupPos = { x: 0, y: 0 }
let cupBase = { x: 0, y: 0 }
let windmills = []
let props = [] // decorative rough props
let raf = null
let tick = 0
let restFrames = 0
let hitCd = 0
let portalCd = 0
let bounces = 0
let dizzy = 0
let introUntil = 0
let quipUntil = 0
let toastUntil = 0
let sunk = false

// critter/event state
let gators = []
let bird = null
let bigfoot = null
let ufo = null
let splats = []
let nextBird = 0
let nextBigfoot = 0
let nextAlien = 0
let abductedThisHole = false

// pointer / aim
let aiming = false
let pullX = 0
let pullY = 0
let power = 0

// ---- tiny seeded rng ----
function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---------- hole setup ----------
function loadHole() {
  cancelAnimationFrame(raf)
  const h = hole.value
  strokes.value = 0
  sunk = false
  bounces = 0
  dizzy = 0
  portalCd = 0
  abductedThisHole = false
  mulligansLeft.value = MULLIGANS
  mulliganPos = null
  ball = { x: h.tee.x, y: h.tee.y, vx: 0, vy: 0 }
  restPos = { x: h.tee.x, y: h.tee.y }
  segs = buildSegments(h)
  cupBase = { x: h.cup.x, y: h.cup.y }
  cupPos = { x: h.cup.x, y: h.cup.y }
  windmills = (h.windmills || []).map((wm) => ({ ...wm, angle: 0 }))
  props = buildProps(h)
  splats = []
  bird = null
  bigfoot = null
  ufo = null
  gators = buildGators(h)
  nextBird = tick + 240 + Math.floor(Math.random() * 360)
  nextBigfoot = tick + 360 + Math.floor(Math.random() * 500)
  nextAlien = tick + 300 + Math.floor(Math.random() * 500)
  aiming = false
  power = 0
  quip.value = null
  toast.value = null
  introUntil = tick + 96
  showIntro.value = true
  state.value = 'aim'
  loop()
}

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

// scatter decorative props in the rough (never on the fairway)
function buildProps(h) {
  const rand = rng(h.name.length * 131 + holeIdx.value * 977 + 7)
  const out = []
  let tries = 0
  const want = 16
  while (out.length < want && tries < 160) {
    tries++
    const x = 20 + rand() * (W - 40)
    const y = 30 + rand() * (H - 60)
    if (pointInPoly({ x, y }, h.fairway)) continue
    if (distToPoly({ x, y }, h.fairway) < 14) continue
    out.push({ x, y, s: 0.7 + rand() * 0.7, k: rand() })
  }
  return out
}

function buildGators(h) {
  if (!course.events.includes('gator') || !h.zones) return []
  const rand = rng(holeIdx.value * 53 + 11)
  return (h.zones || [])
    .filter((z) => z.type === 'water')
    .map((z) => {
      const b = polyBounds(z.poly)
      return { cx: b.cx, cy: b.cy, r: Math.min((b.x2 - b.x1) / 2, (b.y2 - b.y1) / 2) - 8, a: rand() * 6.28, phase: rand() * 6.28, chomp: 0 }
    })
}

function polyBounds(poly) {
  let x1 = Infinity
  let y1 = Infinity
  let x2 = -Infinity
  let y2 = -Infinity
  for (const p of poly) {
    if (p.x < x1) x1 = p.x
    if (p.y < y1) y1 = p.y
    if (p.x > x2) x2 = p.x
    if (p.y > y2) y2 = p.y
  }
  return { x1, y1, x2, y2, cx: (x1 + x2) / 2, cy: (y1 + y2) / 2 }
}

// ---------- input ----------
function toLocal(e) {
  const r = canvasEl.value.getBoundingClientRect()
  return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H }
}
function onDown(e) {
  if (state.value !== 'aim') return
  aiming = true
  try {
    canvasEl.value.setPointerCapture(e.pointerId)
  } catch {
    // best-effort
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
  mulliganPos = { x: ball.x, y: ball.y }
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
function mulligan() {
  if (!canMulligan.value) return
  haptics.light()
  mulligansLeft.value--
  strokes.value = Math.max(0, strokes.value - 1)
  ball = { x: mulliganPos.x, y: mulliganPos.y, vx: 0, vy: 0 }
  restPos = { x: mulliganPos.x, y: mulliganPos.y }
  mulliganPos = null
  setToast('Mulligan! That one never happened.')
}

// ---------- physics ----------
function physics() {
  const h = hole.value
  let inSand = false
  for (let s = 0; s < SUB; s++) {
    ball.x += ball.vx / SUB
    ball.y += ball.vy / SUB

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
    for (const sp of splats) {
      if (Math.hypot(ball.x - sp.x, ball.y - sp.y) < sp.r) inSand = inSand || 'splat'
    }

    for (let pass = 0; pass < 2; pass++) {
      for (const sg of segs) collideSegment(ball, sg)
    }
    if (h.bumpers) for (const b of h.bumpers) collideBumper(ball, b)
    for (const wm of windmills) collideWindmill(ball, wm)
    if (h.portals && portalCd <= 0) {
      for (const pt of h.portals) {
        if (dist(ball, pt.a) < pt.r) return teleport(pt.b)
        if (dist(ball, pt.b) < pt.r) return teleport(pt.a)
      }
    }

    clampSpeed()

    const dxc = cupPos.x - ball.x
    const dyc = cupPos.y - ball.y
    const dc = Math.hypot(dxc, dyc)
    const sp2 = ball.vx * ball.vx + ball.vy * ball.vy
    if (dc < CUP_R) {
      if (sp2 < SINK2) return sink()
      ball.vx += (dxc / dc) * 0.4
      ball.vy += (dyc / dc) * 0.4
      if (sp2 > 40 && dizzy === 0) dizzy = 32
    } else if (dc < CUP_R * 2.3 && sp2 < 8) {
      ball.vx += (dxc / dc) * (0.3 + HOMING * 0.35)
      ball.vy += (dyc / dc) * (0.3 + HOMING * 0.35)
    }
  }

  if (portalCd > 0) portalCd--
  const f = inSand === true ? SAND_FRICTION : inSand === 'splat' ? SPLAT_FRICTION : FRICTION
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
    if (b === ball) registerBounce(vn)
  }
}
function collideBumper(b, bp) {
  const dx = b.x - bp.x
  const dy = b.y - bp.y
  const d = Math.hypot(dx, dy)
  const min = R + bp.r
  if (d >= min || d === 0) return
  const nx = dx / d
  const ny = dy / d
  b.x = bp.x + nx * min
  b.y = bp.y + ny * min
  const vn = b.vx * nx + b.vy * ny
  if (vn < 0) {
    b.vx -= (1 + BUMP_E) * vn * nx
    b.vy -= (1 + BUMP_E) * vn * ny
    if (b === ball) registerBounce(vn * 1.4)
  }
}
function collideWindmill(b, wm) {
  const hd = dist(b, wm)
  if (hd < R + wm.hub && hd > 0) {
    const nx = (b.x - wm.x) / hd
    const ny = (b.y - wm.y) / hd
    b.x = wm.x + nx * (R + wm.hub)
    b.y = wm.y + ny * (R + wm.hub)
    const vn = b.vx * nx + b.vy * ny
    if (vn < 0) {
      b.vx -= (1 + WALL_E) * vn * nx
      b.vy -= (1 + WALL_E) * vn * ny
    }
  }
  const a = wm.angle
  const ex = Math.cos(a) * wm.len
  const ey = Math.sin(a) * wm.len
  const p1 = { x: wm.x + ex, y: wm.y + ey }
  const p2 = { x: wm.x - ex, y: wm.y - ey }
  const abx = p2.x - p1.x
  const aby = p2.y - p1.y
  const len2 = abx * abx + aby * aby || 1
  let t = ((b.x - p1.x) * abx + (b.y - p1.y) * aby) / len2
  t = t < 0 ? 0 : t > 1 ? 1 : t
  const cx = p1.x + abx * t
  const cy = p1.y + aby * t
  let nx = b.x - cx
  let ny = b.y - cy
  let d = Math.hypot(nx, ny)
  const rad = R + 5
  if (d >= rad || d === 0) return
  nx /= d
  ny /= d
  b.x = cx + nx * rad
  b.y = cy + ny * rad
  const rx = cx - wm.x
  const ry = cy - wm.y
  const bvx = -wm.speed * ry
  const bvy = wm.speed * rx
  const relx = b.vx - bvx
  const rely = b.vy - bvy
  const vn = relx * nx + rely * ny
  if (vn < 0) {
    b.vx = relx - (1 + WALL_E) * vn * nx + bvx
    b.vy = rely - (1 + WALL_E) * vn * ny + bvy
    if (b === ball) registerBounce(vn * 1.3)
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
  strokes.value += 1
  ball.x = restPos.x
  ball.y = restPos.y
  ball.vx = 0
  ball.vy = 0
  restFrames = 0
  dizzy = 0
  progressStore.recordSplash()
  const gator = gators.find((g) => dist({ x: g.cx, y: g.cy }, ball) < 300)
  if (gators.length) {
    if (gator) gator.chomp = 26
    setQuip(LINES.gator)
    setToast('🐊 CHOMP!')
  } else {
    setQuip(course.splash || LINES.water) // lava/ice courses have their own lines
  }
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
    if (yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi) inside = !inside
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
  for (const z of zs) if (z.type === 'water' && (pointInPoly(p, z.poly) || distToPoly(p, z.poly) < 46)) return true
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

// ---------- world events (critters) ----------
function updateEvents() {
  if (state.value !== 'aim' && state.value !== 'roll') return
  // gator idle drift
  for (const g of gators) {
    g.a += Math.sin(tick * 0.01 + g.phase) * 0.003
    if (g.chomp > 0) g.chomp--
  }
  // bird flyover (all courses) — may drop a splat
  if (!bird && tick > nextBird && course.events.includes('bird')) {
    const dir = Math.random() < 0.5 ? 1 : -1
    bird = { x: dir > 0 ? -30 : W + 30, y: 90 + Math.random() * 320, dir, dropped: false, dropAt: 140 + Math.random() * 240 }
    nextBird = tick + 520 + Math.floor(Math.random() * 520)
  }
  if (bird) {
    bird.x += bird.dir * 3.2
    if (!bird.dropped && bird.x > bird.dropAt && bird.x < bird.dropAt + 8 && Math.random() < 0.9) {
      bird.dropped = true
      const sx = bird.x
      const sy = bird.y + 30
      if (pointInPoly({ x: sx, y: sy }, hole.value.fairway)) {
        splats.push({ x: sx, y: sy, r: 16, life: 420 })
        setQuip(LINES.bird)
        setToast('🐦 …splat.')
      }
    }
    if (bird.x < -40 || bird.x > W + 40) bird = null
  }
  splats = splats.filter((s) => (s.life -= 1) > 0)

  // bigfoot cameo (cove) — purely cosmetic
  if (!bigfoot && tick > nextBigfoot && course.events.includes('bigfoot')) {
    const dir = Math.random() < 0.5 ? 1 : -1
    bigfoot = { x: dir > 0 ? -40 : W + 40, y: 120 + Math.random() * 500, dir }
    nextBigfoot = tick + 900 + Math.floor(Math.random() * 700)
    setToast('👀 Was that…?')
  }
  if (bigfoot) {
    bigfoot.x += bigfoot.dir * 1.4
    if (bigfoot.x < -60 || bigfoot.x > W + 60) {
      bigfoot = null
      if (Math.random() < 0.6) setQuip(LINES.bigfoot)
    }
  }

  // alien abduction (area51) — relocates the ball, no stroke
  if (!ufo && !abductedThisHole && tick > nextAlien && course.events.includes('alien') && Math.hypot(ball.vx, ball.vy) < 2 && !sunk) {
    ufo = { x: ball.x, y: -40, phase: 'descend', t: 0 }
    nextAlien = tick + 1200
  }
  if (ufo) updateUfo()
}
function updateUfo() {
  ufo.t++
  if (ufo.phase === 'descend') {
    ufo.y += (150 - ufo.y) * 0.08
    ufo.x += (ball.x - ufo.x) * 0.08
    if (ufo.t > 40) {
      ufo.phase = 'beam'
      ufo.t = 0
    }
  } else if (ufo.phase === 'beam') {
    // lift the ball toward the saucer
    ball.x += (ufo.x - ball.x) * 0.15
    ball.y += (ufo.y + 18 - ball.y) * 0.15
    ball.vx = 0
    ball.vy = 0
    if (ufo.t > 46) {
      ufo.phase = 'leave'
      ufo.t = 0
      dropBall()
      progressStore.recordAbduction()
      abductedThisHole = true
      setQuip(LINES.alien)
      setToast('👽 ABDUCTED!')
    }
  } else if (ufo.phase === 'leave') {
    ufo.y -= 6
    ufo.x += 2
    if (ufo.y < -60) ufo = null
  }
}
function dropBall() {
  const rand = rng(tick * 13 + 1)
  for (let i = 0; i < 60; i++) {
    const x = 90 + rand() * (W - 180)
    const y = 130 + rand() * (H - 300)
    const p = { x, y }
    if (pointInPoly(p, hole.value.fairway) && !inAnyWall(p, hole.value.walls) && !inWater(p) && distToPoly(p, hole.value.fairway) > R + 4) {
      ball.x = x
      ball.y = y
      restPos = { x, y }
      return
    }
  }
  ball.x = restPos.x
  ball.y = restPos.y
}

// ---------- commentary ----------
function setQuip(pool) {
  quip.value = pool[Math.floor(Math.random() * pool.length)]
  quipUntil = tick + 150
}
function setToast(msg) {
  toast.value = msg
  toastUntil = tick + 110
}

// ---------- loop ----------
function loop() {
  cancelAnimationFrame(raf)
  const step = () => {
    tick++
    for (const wm of windmills) wm.angle += wm.speed
    updateCup()
    updateEvents()
    if (showIntro.value && tick > introUntil) showIntro.value = false
    if (quip.value && state.value === 'roll' && tick > quipUntil) quip.value = null
    if (toast.value && tick > toastUntil) toast.value = null
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

// ---------- render ----------
function draw() {
  if (!ctx) return
  const h = hole.value
  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = theme.rough
  ctx.fillRect(0, 0, W, H)
  drawProps(true)

  ctx.save()
  tracePoly(h.fairway)
  ctx.clip()
  ctx.fillStyle = theme.grass
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = 'rgba(255,255,255,0.05)'
  for (let y = 0; y < H; y += 72) ctx.fillRect(0, y, W, 36)
  drawZones(h)
  drawSplats()
  ctx.restore()

  ctx.save()
  tracePoly(h.fairway)
  ctx.lineJoin = 'round'
  ctx.strokeStyle = theme.border
  ctx.lineWidth = 8
  ctx.stroke()
  ctx.strokeStyle = theme.lip
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.restore()

  for (const w of h.walls || []) {
    ctx.save()
    tracePoly(w)
    ctx.fillStyle = theme.grassDark || '#2f7d49'
    ctx.fill()
    ctx.strokeStyle = theme.border
    ctx.lineWidth = 3
    ctx.lineJoin = 'round'
    ctx.stroke()
    ctx.restore()
  }

  drawGators()
  drawPortals(h)
  drawBumpers(h)
  drawCup()
  drawWindmills()
  drawTee(h)
  drawAim()
  drawBall()
  drawBird()
  drawBigfoot()
  drawUfo()
}

function drawProps(rough) {
  if (!rough) return
  for (const p of props) {
    const x = p.x
    const y = p.y
    if (theme.prop === 'pine') {
      ctx.fillStyle = '#1c4a2c'
      ctx.beginPath()
      ctx.moveTo(x, y - 16 * p.s)
      ctx.lineTo(x - 8 * p.s, y + 4 * p.s)
      ctx.lineTo(x + 8 * p.s, y + 4 * p.s)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = '#5d4037'
      ctx.fillRect(x - 1.5, y + 4 * p.s, 3, 5 * p.s)
    } else if (theme.prop === 'reed') {
      ctx.strokeStyle = '#3a5a2a'
      ctx.lineWidth = 2
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath()
        ctx.moveTo(x + i * 3, y + 6 * p.s)
        ctx.quadraticCurveTo(x + i * 4 + Math.sin(tick * 0.04 + p.k * 6) * 2, y - 4 * p.s, x + i * 5, y - 12 * p.s)
        ctx.stroke()
      }
    } else if (theme.prop === 'cactus') {
      ctx.fillStyle = '#3f6b3a'
      ctx.fillRect(x - 2.5 * p.s, y - 12 * p.s, 5 * p.s, 20 * p.s)
      if (p.k > 0.5) ctx.fillRect(x - 8 * p.s, y - 4 * p.s, 6 * p.s, 3 * p.s)
      else ctx.fillRect(x + 2 * p.s, y - 6 * p.s, 6 * p.s, 3 * p.s)
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.12)'
      ctx.beginPath()
      ctx.arc(x, y, 5 * p.s, 0, 6.283)
      ctx.fill()
    }
  }
}

function drawZones(h) {
  if (!h.zones) return
  for (const z of h.zones) {
    tracePoly(z.poly)
    if (z.type === 'water') {
      ctx.fillStyle = theme.water || 'rgba(30,120,190,0.75)'
      ctx.fill()
      const b = polyBounds(z.poly)
      ctx.strokeStyle = 'rgba(255,255,255,0.14)'
      ctx.lineWidth = 2
      for (let i = 0; i < 4; i++) {
        const yy = b.y1 + 14 + i * 15 + Math.sin(tick * 0.05 + i) * 3
        ctx.beginPath()
        ctx.moveTo(b.x1 + 12, yy)
        ctx.lineTo(b.x2 - 12, yy)
        ctx.stroke()
      }
    } else if (z.type === 'sand') {
      ctx.fillStyle = theme.sand || '#d9c48f'
      ctx.fill()
      const b = polyBounds(z.poly)
      ctx.fillStyle = 'rgba(120,95,45,0.3)'
      for (let i = 0; i < 22; i++) {
        const px = b.x1 + ((i * 71) % (b.x2 - b.x1))
        const py = b.y1 + ((i * 137) % (b.y2 - b.y1))
        ctx.fillRect(px, py, 2, 2)
      }
    } else if (z.type === 'boost') {
      ctx.fillStyle = 'rgba(255,214,0,0.14)'
      ctx.fill()
      const b = polyBounds(z.poly)
      ctx.strokeStyle = 'rgba(255,214,0,0.85)'
      ctx.lineWidth = 4
      ctx.lineCap = 'round'
      const ph = (tick * 0.6) % 24
      for (let k = -1; k < 3; k++) {
        const yy = b.y2 - 12 - k * 24 - ph
        if (yy < b.y1 + 6 || yy > b.y2 - 6) continue
        ctx.beginPath()
        ctx.moveTo(b.cx - 14, yy + 7)
        ctx.lineTo(b.cx, yy)
        ctx.lineTo(b.cx + 14, yy + 7)
        ctx.stroke()
      }
    }
  }
}
function drawSplats() {
  for (const s of splats) {
    ctx.globalAlpha = Math.min(1, s.life / 90)
    ctx.fillStyle = '#6b8f3a'
    ctx.beginPath()
    ctx.ellipse(s.x, s.y, s.r, s.r * 0.7, 0, 0, 6.283)
    ctx.fill()
    ctx.fillStyle = 'rgba(240,240,240,0.9)'
    ctx.beginPath()
    ctx.arc(s.x + 3, s.y - 2, 3, 0, 6.283)
    ctx.fill()
    ctx.globalAlpha = 1
  }
}
function drawGators() {
  for (const g of gators) {
    const bob = Math.sin(tick * 0.03 + g.phase) * 3
    const gx = g.cx + Math.cos(g.a) * g.r * 0.3
    const gy = g.cy + Math.sin(g.a) * g.r * 0.3 + bob
    const dx = Math.cos(g.a)
    const dy = Math.sin(g.a)
    // eyes just above water
    ctx.fillStyle = '#2f4a1e'
    for (const s of [-1, 1]) {
      ctx.beginPath()
      ctx.arc(gx + dy * s * 5, gy - dx * s * 5, 3.2, 0, 6.283)
      ctx.fill()
      ctx.fillStyle = '#e8e07a'
      ctx.beginPath()
      ctx.arc(gx + dy * s * 5, gy - dx * s * 5, 1.4, 0, 6.283)
      ctx.fill()
      ctx.fillStyle = '#2f4a1e'
    }
    // snout
    ctx.fillStyle = g.chomp > 0 ? '#3e6b28' : '#33582140'
    ctx.beginPath()
    ctx.ellipse(gx + dx * 14, gy + dy * 14, 10, 5, g.a, 0, 6.283)
    ctx.fill()
    if (g.chomp > 0) {
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 20px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('CHOMP!', g.cx, g.cy - 16)
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
    ctx.arc(p.x, p.y, Math.max(3, p.r - i * 5 + Math.sin(tick * 0.08 + i) * 2), 0, 6.283)
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
    ctx.save()
    ctx.translate(wm.x, wm.y)
    ctx.rotate(wm.angle)
    ctx.fillStyle = '#f5f5f5'
    ctx.strokeStyle = '#c62828'
    ctx.lineWidth = 2
    roundRect(-wm.len, -6, wm.len * 2, 12, 6)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#e53935'
    roundRect(wm.len - 26, -6, 26, 12, 6)
    ctx.fill()
    roundRect(-wm.len, -6, 26, 12, 6)
    ctx.fill()
    ctx.restore()
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
  const col = power < 0.5 ? '#8bc34a' : power < 0.8 ? '#ffb300' : '#ff5252'
  if (GUIDE === 'predict') {
    const pts = predictPath(dx, dy, power * MAXSPEED)
    ctx.fillStyle = col
    for (const p of pts) {
      ctx.beginPath()
      ctx.arc(p.x, p.y, 2.6, 0, 6.283)
      ctx.fill()
    }
  } else {
    const reach = 30 + power * 150
    const ex = ball.x + dx * reach
    const ey = ball.y + dy * reach
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
  }
  ctx.beginPath()
  ctx.arc(ball.x, ball.y, R + 6, -Math.PI / 2, -Math.PI / 2 + power * 6.283)
  ctx.strokeStyle = col
  ctx.lineWidth = 3
  ctx.stroke()
}
// simulate the shot (walls only) for the Sniper/Feather predicted-path guide
function predictPath(dx, dy, speed) {
  const b = { x: ball.x, y: ball.y, vx: dx * speed, vy: dy * speed }
  const out = []
  for (let i = 0; i < 150; i++) {
    for (let s = 0; s < SUB; s++) {
      b.x += b.vx / SUB
      b.y += b.vy / SUB
      for (const sg of segs) collideSegment(b, sg)
    }
    b.vx *= FRICTION
    b.vy *= FRICTION
    if (i % 4 === 0) out.push({ x: b.x, y: b.y })
    if (b.vx * b.vx + b.vy * b.vy < STOP2) break
    if (dist(b, cupPos) < CUP_R) break
  }
  return out
}
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
    const ddx = cupPos.x - ball.x
    const ddy = cupPos.y - ball.y
    const l = Math.hypot(ddx, ddy) || 1
    lx = ddx / l
    ly = ddy / l
  }
  const eyeDx = 2.5
  const worried = nearWater(ball) && state.value !== 'holeDone'
  const blink = tick % 220 < 6 && dizzy === 0 && !worried
  for (const s of [-1, 1]) {
    const ex = ball.x + s * eyeDx
    const ey = ball.y - 1
    if (dizzy > 0) {
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
    ctx.arc(ex, ey, worried ? 3.1 : 2.6, 0, 6.283)
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.15)'
    ctx.lineWidth = 0.5
    ctx.stroke()
    if (blink) {
      ctx.strokeStyle = '#333'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(ex - 2.6, ey)
      ctx.lineTo(ex + 2.6, ey)
      ctx.stroke()
    } else {
      ctx.beginPath()
      ctx.fillStyle = '#222'
      ctx.arc(ex + lx * 1.3, ey + ly * 1.3, 1.4, 0, 6.283)
      ctx.fill()
    }
  }
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
}
function drawBird() {
  if (!bird) return
  ctx.strokeStyle = '#222'
  ctx.lineWidth = 2.4
  const flap = Math.sin(tick * 0.4) * 5
  ctx.beginPath()
  ctx.moveTo(bird.x - 9, bird.y + flap)
  ctx.lineTo(bird.x, bird.y)
  ctx.lineTo(bird.x + 9, bird.y + flap)
  ctx.stroke()
}
function drawBigfoot() {
  if (!bigfoot) return
  const x = bigfoot.x
  const y = bigfoot.y
  ctx.fillStyle = theme.cryptid || '#3b2a1c' // brown Bigfoot, white Yeti…
  ctx.beginPath()
  ctx.ellipse(x, y, 9, 15, 0, 0, 6.283)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x, y - 16, 7, 0, 6.283)
  ctx.fill()
  // legs shuffle
  const sw = Math.sin(tick * 0.3) * 4
  ctx.fillRect(x - 6, y + 12, 4, 10 + sw)
  ctx.fillRect(x + 2, y + 12, 4, 10 - sw)
}
function drawUfo() {
  if (!ufo) return
  if (ufo.phase === 'beam') {
    ctx.fillStyle = 'rgba(120,230,140,0.22)'
    ctx.beginPath()
    ctx.moveTo(ufo.x - 8, ufo.y)
    ctx.lineTo(ufo.x + 8, ufo.y)
    ctx.lineTo(ufo.x + 26, ufo.y + 120)
    ctx.lineTo(ufo.x - 26, ufo.y + 120)
    ctx.closePath()
    ctx.fill()
  }
  ctx.fillStyle = '#9aa7b3'
  ctx.beginPath()
  ctx.ellipse(ufo.x, ufo.y, 30, 11, 0, 0, 6.283)
  ctx.fill()
  ctx.fillStyle = '#c7f0ff'
  ctx.beginPath()
  ctx.ellipse(ufo.x, ufo.y - 7, 14, 9, 0, Math.PI, 0)
  ctx.fill()
  ctx.fillStyle = ['#ff5252', '#ffd54f', '#69f0ae'][Math.floor(tick / 6) % 3]
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath()
    ctx.arc(ufo.x + i * 14, ufo.y + 5, 2.5, 0, 6.283)
    ctx.fill()
  }
}
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

// ---------- flow ----------
function advance() {
  haptics.light()
  if (holeIdx.value + 1 < total) {
    holeIdx.value++
    loadHole()
  } else {
    progressStore.recordCourse(course.id, totalStrokes.value, coursePar)
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
function toCourses() {
  haptics.light()
  cancelAnimationFrame(raf)
  router.push({ name: 'course-select' })
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
function hole9(i) {
  return holesArr[i]
}
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
function formatToPar(t) {
  if (t === 0) return 'Even par'
  return t > 0 ? `+${t} over par` : `${t} under par`
}
function roundQuip(t) {
  if (t <= -3) return LINES.roundGreat
  if (t <= 2) return LINES.roundGood
  if (t <= 10) return LINES.roundOk
  return LINES.roundRough
}
function goBack() {
  haptics.light()
  cancelAnimationFrame(raf)
  router.push({ name: 'course-select' })
}
function howToPlay() {
  haptics.light()
  router.push({ name: 'how-to-play' })
}

onMounted(() => {
  ctx = canvasEl.value.getContext('2d')
  newRound()
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
onBeforeUnmount(() => cancelAnimationFrame(raf))

// ---------- copy ----------
const DEFAULT_HINT = 'Ease off the power near the cup — a fast ball lips out'
const HINTS = {
  'Gator Gap': 'Go around the pond — those eyes are watching',
  'The Lagoon': 'Big water. Take the safe way round.',
  'Bigfoot Bridge': 'Everything at once. And keep an eye on the tree line.',
  'The Windmill': 'Time your putt through the spinning blade',
  'Cryptid Crossing': 'Time your putt through the swinging log',
  'Tractor Beam': 'Roll onto a pad for a boost — mind the sky',
  'The Saucer': 'Everything at once. Give ’em a show.',
  'Warp Pads': 'The portals link up — one drops you near the cup',
  "Will-o'-Portals": 'The lights link up — one drops you near the cup',
  'Moving Target': 'The cup slides — putt where it’s going',
  'Moving Marsh': 'The cup slides — putt where it’s going',
  'The Vortex': 'Moving cup and a portal. Good luck.',
}
const LINES = {
  water: ['SPLASH! Otto’s going for a swim. +1.', 'And it’s in the drink. +1.', 'Otto forgot his floaties. +1.'],
  gator: ['A gator got it! …he’ll want a new ball. +1.', 'CHOMP. That one belongs to the swamp now. +1.', 'Never smile at a crocodile. +1.'],
  ace: ['ACE! Chip is speechless. (He isn’t.)', 'Hole in one! Frame it.', 'One shot. Absolutely filthy.'],
  trick: ['Off the walls — literally!', 'Bank shot! Chip is on his feet.', 'That belongs on a highlight reel.'],
  under: ['Under par. Chip approves.', 'Birdie business. Smooth.', 'Almost suspiciously good.'],
  par: ['Par. Respectable.', 'Right on the number.', 'Par for the course. Literally.'],
  bogey: ['One over. We move on.', 'Bogey. Happens to the best.', 'Close enough. Next!'],
  bad: ['…we don’t talk about that one.', 'Chip has quietly looked away.', 'Let’s call it a “learning hole.”'],
  portal: ['Wheee! See you on the other side.', 'Otto took the shortcut.'],
  bird: ['A direct hit. Nature is cruel.', 'That bird had opinions.', 'Right on Otto. Unbelievable.'],
  bigfoot: ['I swear something just walked past.', 'You saw that too, right? …Right?', 'The legend is real. Probably.'],
  alien: ['Otto has been abducted. He’s fine. Probably.', 'Beamed up and dropped off. Rude.', 'The truth is out there. So is your ball.'],
  roundGreat: ['A round for the ages. Chip is tearing up.'],
  roundGood: ['Tidy round. The clubhouse is impressed.'],
  roundOk: ['Not bad! Otto had fun, and that’s what counts.'],
  roundRough: ['Rough day out there. Snacks are on the house.'],
}
</script>

<style lang="scss" scoped>
.golf-page {
  min-height: 100vh;
  transition: background 1.2s ease;
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
.quip-fade-enter-active, .quip-fade-leave-active { transition: opacity 0.3s ease; }
.quip-fade-enter-from, .quip-fade-leave-to { opacity: 0; }

.event-toast {
  position: absolute;
  top: 44%;
  left: 50%;
  transform: translateX(-50%);
  font-size: 1.5rem;
  font-weight: 800;
  color: #fff;
  text-shadow: 0 3px 12px rgba(0, 0, 0, 0.7);
  pointer-events: none;
}
.toast-fade-enter-active, .toast-fade-leave-active { transition: opacity 0.4s ease; }
.toast-fade-enter-from, .toast-fade-leave-to { opacity: 0; }

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
.hi-num { font-size: 0.82rem; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.85; }
.hi-name { font-size: 2rem; font-weight: 800; }
.hi-par { font-size: 1rem; opacity: 0.9; }
.intro-fade-enter-active { transition: opacity 0.3s ease; }
.intro-fade-leave-active { transition: opacity 0.6s ease; }
.intro-fade-enter-from, .intro-fade-leave-to { opacity: 0; }

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
.overlay-quip { color: #ffe082; font-size: 0.85rem; font-style: italic; text-align: center; max-width: 90%; }
.oq-who { color: rgba(255, 255, 255, 0.6); font-style: normal; }
.overlay-fade-enter-active { transition: opacity 0.35s ease; }
.overlay-fade-enter-from { opacity: 0; }

.scorecard-overlay { gap: 10px; }
.sc-course { color: rgba(255,255,255,0.8); font-size: 0.9rem; margin-top: -6px; }
.scorecard { width: 100%; color: #fff; display: flex; flex-direction: column; gap: 6px; }
.sc-title { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.75; margin-top: 2px; }
.sc-grid { display: grid; gap: 2px 1px; align-items: center; text-align: center; font-size: 0.72rem; }
.sc-grid > span { padding: 1px 0; }
.sc-h { text-align: left !important; opacity: 0.7; font-size: 0.64rem; }
.sc-tot { font-weight: 800; }
.sc-under { color: #a5d6a7; font-weight: 800; }
.sc-over { color: #ffab91; }
.cd-btns { display: flex; gap: 10px; align-items: center; }

.hint {
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.82rem;
  text-align: center;
  margin: 8px 24px max(16px, env(safe-area-inset-bottom));
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}
:deep(.q-btn.bg-primary) { background: linear-gradient(135deg, #43a047 0%, #1b5e20 100%) !important; }
</style>
