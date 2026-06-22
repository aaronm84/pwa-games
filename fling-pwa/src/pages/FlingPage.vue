<template>
  <q-page
    class="fling-page"
    :style="{ background: themeStore.colors.gradient }"
    :data-state="state"
    :data-level="level"
    :data-shots="shots"
    :data-targets="targetsLeft"
    :data-score="score"
  >
    <!-- Header -->
    <div class="game-header">
      <q-btn fab-mini flat icon="arrow_back" color="white" @click="goBack" />
      <div class="scores">
        <div class="score-box"><div class="score-label">Level</div><div class="score-value">{{ level }}</div></div>
        <div class="score-box"><div class="score-label">Shots</div><div class="score-value">{{ shots }}</div></div>
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
        <div class="banner" v-if="state === 'playing'">Drag back from the slingshot to aim &amp; fire</div>

        <transition name="overlay-fade">
          <div v-if="state === 'over' || state === 'won'" class="board-overlay">
            <div class="overlay-text">{{ state === 'won' ? `Level ${level} cleared!` : 'Out of shots' }}</div>
            <div class="overlay-sub">Score {{ score }}</div>
            <q-btn
              unelevated color="primary" text-color="white"
              :label="state === 'won' ? 'Next Level' : 'Try Again'"
              @click="state === 'won' ? nextLevel() : newGame()"
            />
          </div>
        </transition>
      </div>
    </div>

    <p class="hint">Knock out every target — topple the wooden towers and let gravity finish the job</p>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import Matter from 'matter-js'
import { useThemeStore } from 'src/stores/theme'
import { useProgressStore } from 'src/stores/progress'
import { useHaptics } from 'src/composables/useHaptics'
// Kenney "Physics Assets" sprites (CC0) — see src/assets/fling/KENNEY-LICENSE.txt
import birdRedSrc from 'src/assets/fling/bird-red.png'
import birdSpeedySrc from 'src/assets/fling/bird-speedy.png'
import birdBoulderSrc from 'src/assets/fling/bird-boulder.png'
import tgStandardSrc from 'src/assets/fling/target-standard.png'
import tgSmallSrc from 'src/assets/fling/target-small.png'
import tgToughSrc from 'src/assets/fling/target-tough.png'
import blockWoodSrc from 'src/assets/fling/block-wood.png'

const { Engine, World, Bodies, Body, Events, Sleeping } = Matter

// preload sprites; rendering falls back to canvas shapes until they're ready
const IMG = {}
for (const [key, src] of Object.entries({
  birdRed: birdRedSrc, birdSpeedy: birdSpeedySrc, birdBoulder: birdBoulderSrc,
  tgStandard: tgStandardSrc, tgSmall: tgSmallSrc, tgTough: tgToughSrc, blockWood: blockWoodSrc,
})) {
  const im = new Image()
  im.src = src
  IMG[key] = im
}
function drawSprite(key, x, y, w, h, angle) {
  const im = IMG[key]
  if (!im || !im.complete || !im.naturalWidth) return false
  ctx.save()
  ctx.translate(x, y)
  if (angle) ctx.rotate(angle)
  ctx.drawImage(im, -w / 2, -h / 2, w, h)
  ctx.restore()
  return true
}

const W = 420
const H = 680
const GROUND_Y = 600
const SLING = { x: 70, y: GROUND_Y - 72 }
const FORK_DX = 15
const BIRD_R = 15
const MAX_PULL = 95
const MIN_PULL = 16
const MAX_V = 15
const GRAVY = 2.6
const GP = GRAVY * 0.2778 // per-step gravity gain matching matter's integration
const forkL = { x: SLING.x - FORK_DX, y: SLING.y - 6 }
const forkR = { x: SLING.x + FORK_DX, y: SLING.y - 6 }

const router = useRouter()
const themeStore = useThemeStore()
const progressStore = useProgressStore()
const haptics = useHaptics()

const canvasEl = ref(null)
const state = ref('playing') // playing | over | won
const level = ref(1)
const score = ref(0)
const shots = ref(0)
const targetsLeft = ref(0)

let ctx = null
let engine = null
let world = null
let blocks = []
let targets = []
let bird = null
let ready = false
let flying = false
let dragging = false
let pull = null
let birdAge = 0
let restTimer = 0
let raf = null

const bestScore = computed(() => Math.max(progressStore.fling.bestScore, score.value))

// ---------- birds ----------
// Variety via size / mass / bounce / colour. Mass doesn't change the ballistic
// arc, so a single trajectory preview stays accurate for every bird.
const BIRD_TYPES = {
  red: { r: 15, density: 0.009, restitution: 0.35, body: '#e8503a', edge: '#b53a28', belly: '#f6c89a', img: 'birdRed' },
  boulder: { r: 19, density: 0.022, restitution: 0.2, body: '#727781', edge: '#3f4248', belly: '#aab0b8', img: 'birdBoulder' },
  speedy: { r: 12, density: 0.006, restitution: 0.55, body: '#f5c542', edge: '#c79a14', belly: '#fdeaa8', img: 'birdSpeedy' },
}
let birdQueue = []
let birdIdx = 0
function buildBirdQueue(n) {
  const pattern = ['red', 'speedy', 'boulder', 'red', 'boulder', 'speedy']
  birdQueue = Array.from({ length: n }, (_, i) => pattern[i % pattern.length])
}
function curBird() {
  return BIRD_TYPES[birdQueue[Math.min(birdIdx, birdQueue.length - 1)] || 'red']
}

// ---------- targets ----------
const TARGET_TYPES = {
  standard: { color: '#46c46a', edge: 'rgba(20,60,25,0.45)', hp: 1, pts: 100, img: 'tgStandard' },
  small: { color: '#3ec0c4', edge: 'rgba(15,55,60,0.45)', hp: 1, pts: 150, img: 'tgSmall' },
  tough: { color: '#9a86c4', edge: 'rgba(40,30,70,0.5)', hp: 2, pts: 220, img: 'tgTough' },
}

// ---------- levels ----------
const G = GROUND_Y
const LEVELS = [
  // 1 — a single target behind a low post
  () => ({
    blocks: [{ x: 250, y: G - 35, w: 20, h: 70 }],
    targets: [{ x: 300, y: G - 18, r: 18 }],
    shots: 4,
  }),
  // 2 — target on a table
  () => ({
    blocks: [
      { x: 265, y: G - 40, w: 20, h: 80 },
      { x: 325, y: G - 40, w: 20, h: 80 },
      { x: 295, y: G - 89, w: 110, h: 18 },
    ],
    targets: [{ x: 295, y: G - 116, r: 18, t: 'small' }],
    shots: 4,
  }),
  // 3 — a little house: one inside, an armoured one on the roof
  () => ({
    blocks: [
      { x: 255, y: G - 45, w: 20, h: 90 },
      { x: 325, y: G - 45, w: 20, h: 90 },
      { x: 290, y: G - 99, w: 120, h: 18 },
    ],
    targets: [
      { x: 290, y: G - 18, r: 16 },
      { x: 290, y: G - 126, r: 18, t: 'tough' },
    ],
    shots: 5,
  }),
  // 4 — crate tower (armoured) + a guarded ground target
  () => ({
    blocks: [
      { x: 345, y: G - 20, w: 40, h: 40 },
      { x: 345, y: G - 60, w: 40, h: 40 },
      { x: 205, y: G - 35, w: 20, h: 70 },
    ],
    targets: [
      { x: 345, y: G - 98, r: 18, t: 'tough' },
      { x: 235, y: G - 18, r: 17 },
    ],
    shots: 5,
  }),
  // 5 — pyramid + a small straggler near the edge
  () => ({
    blocks: [
      { x: 250, y: G - 20, w: 40, h: 40 },
      { x: 300, y: G - 20, w: 40, h: 40 },
      { x: 350, y: G - 20, w: 40, h: 40 },
      { x: 275, y: G - 60, w: 40, h: 40 },
      { x: 325, y: G - 60, w: 40, h: 40 },
    ],
    targets: [
      { x: 300, y: G - 98, r: 18 },
      { x: 392, y: G - 18, r: 13, t: 'small' },
    ],
    shots: 6,
  }),
]

function genLevel(lvl) {
  // build real structures (tables / crate towers / sheltered targets) that the
  // bird must topple — not a flat exposed row — and keep shots tight
  const blocks = []
  const targets = []
  const mods = Math.min(2 + Math.floor((lvl - 5) / 4), 3)
  const left = 210
  const right = 385
  for (let i = 0; i < mods; i++) {
    const cx = mods === 1 ? (left + right) / 2 : Math.round(left + ((right - left) * i) / (mods - 1))
    const kind = (lvl + i) % 3
    if (kind === 0) {
      // a table with a target balanced on top
      blocks.push({ x: cx - 26, y: G - 38, w: 18, h: 76 })
      blocks.push({ x: cx + 26, y: G - 38, w: 18, h: 76 })
      blocks.push({ x: cx, y: G - 85, w: 80, h: 16 })
      targets.push({ x: cx, y: G - 110, r: 14, t: 'small' })
    } else if (kind === 1) {
      // a crate tower with an armoured target perched up high
      blocks.push({ x: cx, y: G - 20, w: 40, h: 40 })
      blocks.push({ x: cx, y: G - 60, w: 40, h: 40 })
      targets.push({ x: cx, y: G - 98, r: 16, t: 'tough' })
    } else {
      // a wall sheltering a ground target — arc over or knock it through
      blocks.push({ x: cx - 24, y: G - 48, w: 18, h: 96 })
      targets.push({ x: cx + 18, y: G - 17, r: 16 })
    }
  }
  const tough = targets.filter((t) => t.t === 'tough').length
  return { blocks, targets, shots: targets.length + 1 + tough }
}

// ---------- setup ----------
function startLevel() {
  cancelAnimationFrame(raf)
  if (engine) {
    Events.off(engine)
    World.clear(world, false)
    Engine.clear(engine)
  }
  // sleeping ON so resting targets settle and stay put between shots (no
  // auto-rolling); we explicitly wake the structure during a shot so a target
  // still falls when the blocks under it are knocked away (see loop)
  engine = Engine.create({ enableSleeping: true })
  engine.gravity.y = GRAVY
  world = engine.world

  const ground = Bodies.rectangle(W / 2, GROUND_Y + 200, W * 3, 400, { isStatic: true, friction: 1 })
  ground.gType = 'ground'
  World.add(world, ground)

  blocks = []
  targets = []
  const def = level.value <= LEVELS.length ? LEVELS[level.value - 1]() : genLevel(level.value)
  for (const bl of def.blocks) {
    const body = Bodies.rectangle(bl.x, bl.y, bl.w, bl.h, {
      friction: 0.7,
      frictionStatic: 1,
      restitution: 0,
      density: 0.004,
    })
    body.gType = 'block'
    body.gW = bl.w
    body.gH = bl.h
    blocks.push(body)
    World.add(world, body)
  }
  for (const tg of def.targets) {
    const tt = TARGET_TYPES[tg.t || 'standard']
    const body = Bodies.circle(tg.x, tg.y, tg.r, { friction: 0.5, restitution: 0.2, density: 0.003 })
    body.gType = 'target'
    body.gR = tg.r
    body.gTT = tt
    body.gHp = tt.hp
    body.gPoints = tt.pts
    body.gHurt = 0
    targets.push(body)
    World.add(world, body)
  }
  Events.on(engine, 'collisionStart', onCollide)

  shots.value = def.shots
  buildBirdQueue(def.shots)
  birdIdx = 0
  targetsLeft.value = targets.length
  bird = null
  ready = true
  flying = false
  dragging = false
  pull = null
  birdAge = 0
  restTimer = 0
  state.value = 'playing'
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

// ---------- physics events ----------
function onCollide(ev) {
  for (const p of ev.pairs) {
    const rel = Math.hypot(
      p.bodyA.velocity.x - p.bodyB.velocity.x,
      p.bodyA.velocity.y - p.bodyB.velocity.y,
    )
    hit(p.bodyA, p.bodyB, rel)
    hit(p.bodyB, p.bodyA, rel)
  }
}
function hit(t, other, rel) {
  if (t.gType !== 'target' || t.gDead) return
  const thr = other.gType === 'bird' ? 3 : 5
  if (rel > thr) {
    t.gHp--
    if (t.gHp <= 0) t.gDead = true
    else t.gHurt = 14 // survived a hit (tough target) — flash
  }
}

// ---------- launch ----------
function clampPull(p) {
  const dx = p.x - SLING.x
  const dy = p.y - SLING.y
  const d = Math.hypot(dx, dy)
  if (d <= MAX_PULL) return { x: p.x, y: p.y }
  return { x: SLING.x + (dx / d) * MAX_PULL, y: SLING.y + (dy / d) * MAX_PULL }
}
function launch(v, start) {
  ready = false
  flying = true
  birdAge = 0
  restTimer = 0
  const bt = curBird()
  bird = Bodies.circle(start.x, start.y, bt.r, {
    density: bt.density,
    restitution: bt.restitution,
    friction: 0.4,
    frictionAir: 0.002,
  })
  bird.gType = 'bird'
  bird.gBird = bt
  World.add(world, bird)
  Body.setVelocity(bird, v)
  birdIdx++
  haptics.medium()
}
function endShot() {
  if (bird) {
    World.remove(world, bird)
    bird = null
  }
  flying = false
  birdAge = 0
  restTimer = 0
  if (state.value !== 'playing') return
  shots.value--
  if (targetsLeft.value <= 0) return
  if (shots.value <= 0) {
    lose()
    return
  }
  ready = true
}

function win() {
  if (state.value !== 'playing') return
  state.value = 'won'
  // the in-flight shot is spent, so leftover = remaining minus the one in the air
  const leftover = Math.max(0, shots.value - (flying ? 1 : 0))
  score.value += 200 + leftover * 60 + level.value * 40
  progressStore.recordFling(level.value, score.value, true)
  haptics.success()
}
function lose() {
  state.value = 'over'
  progressStore.recordFling(level.value, score.value, false)
}

// ---------- loop ----------
function loop() {
  cancelAnimationFrame(raf)
  const step = () => {
    if (state.value === 'playing') {
      // while a shot is live, keep the structure awake so a target whose support
      // is knocked out actually falls (a sleeping body wouldn't notice). Once
      // woken it stays awake ~1s, long enough to finish any collapse, then sleeps.
      if (flying) {
        for (const b of blocks) Sleeping.set(b, false)
        for (const t of targets) Sleeping.set(t, false)
      }
      Engine.update(engine, 1000 / 60)
      cleanup()
      for (const t of targets) if (t.gHurt > 0) t.gHurt--
      if (flying && bird) trackBird()
    }
    draw()
    raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)
}
function cleanup() {
  for (let i = targets.length - 1; i >= 0; i--) {
    const t = targets[i]
    if (t.gDead || t.position.y > GROUND_Y + 80 || t.position.x < -30 || t.position.x > W + 30) {
      World.remove(world, t)
      targets.splice(i, 1)
      targetsLeft.value--
      score.value += t.gPoints || 100
      haptics.medium()
      if (targetsLeft.value <= 0) {
        win()
        return
      }
    }
  }
  for (let i = blocks.length - 1; i >= 0; i--) {
    const b = blocks[i]
    if (b.position.y > H + 300 || b.position.x < -200 || b.position.x > W + 200) {
      World.remove(world, b)
      blocks.splice(i, 1)
    }
  }
}
function trackBird() {
  birdAge++
  if (bird.position.x < -40 || bird.position.x > W + 40 || bird.position.y > GROUND_Y + 60) {
    endShot()
    return
  }
  if (birdAge > 18 && bird.speed < 0.45) restTimer++
  else restTimer = 0
  if (restTimer > 32) endShot()
}

// ---------- rendering ----------
function rr(x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
function draw() {
  if (!ctx) return
  const sky = ctx.createLinearGradient(0, 0, 0, H)
  sky.addColorStop(0, '#bfe3f7')
  sky.addColorStop(1, '#e7f5fd')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, W, H)

  // ground
  ctx.fillStyle = '#6aa85c'
  ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y)
  ctx.fillStyle = '#5a8f4e'
  ctx.fillRect(0, GROUND_Y + 12, W, H - GROUND_Y - 12)

  // blocks
  for (const b of blocks) drawBlock(b)
  // targets
  for (const t of targets) drawTarget(t)

  // slingshot
  ctx.strokeStyle = '#7a4a22'
  ctx.lineWidth = 12
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(SLING.x, GROUND_Y)
  ctx.lineTo(SLING.x, SLING.y + 6)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(SLING.x, SLING.y + 8)
  ctx.lineTo(forkL.x, forkL.y)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(SLING.x, SLING.y + 8)
  ctx.lineTo(forkR.x, forkR.y)
  ctx.stroke()

  // trajectory preview while aiming
  if (dragging && pull) drawTrajectory()

  // ready bird + bands
  if (ready && !flying) {
    const bp = dragging && pull ? pull : SLING
    ctx.strokeStyle = '#5a3a26'
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.moveTo(forkR.x, forkR.y)
    ctx.lineTo(bp.x, bp.y)
    ctx.stroke()
    drawBird(bp.x, bp.y)
    ctx.beginPath()
    ctx.moveTo(forkL.x, forkL.y)
    ctx.lineTo(bp.x, bp.y)
    ctx.stroke()
  }

  // flying bird
  if (flying && bird) drawBird(bird.position.x, bird.position.y, bird.gBird)
}
function drawTrajectory() {
  let vx = SLING.x - pull.x
  let vy = SLING.y - pull.y
  const d = Math.hypot(vx, vy) || 1
  const speed = (Math.min(d, MAX_PULL) / MAX_PULL) * MAX_V
  vx = (vx / d) * speed
  vy = (vy / d) * speed
  let px = SLING.x
  let py = SLING.y
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  for (let i = 0; i < 32; i++) {
    // match the bird's integration: gravity, then frictionAir damping, then move
    vy += GP
    vx *= 0.998
    vy *= 0.998
    px += vx
    py += vy
    if (py > GROUND_Y - BIRD_R || px > W) break
    if (i % 2 === 0) {
      ctx.beginPath()
      ctx.arc(px, py, 2.6, 0, 6.28)
      ctx.fill()
    }
  }
}
function drawBlock(b) {
  // +8 covers the sprite's transparent margin so the wood fills the physics body
  if (drawSprite('blockWood', b.position.x, b.position.y, b.gW + 8, b.gH + 8, b.angle)) return
  ctx.save()
  ctx.translate(b.position.x, b.position.y)
  ctx.rotate(b.angle)
  const w = b.gW
  const h = b.gH
  rr(-w / 2, -h / 2, w, h, 4)
  ctx.fillStyle = '#c4904f'
  ctx.fill()
  ctx.strokeStyle = 'rgba(90,55,25,0.5)'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.strokeStyle = 'rgba(120,75,35,0.4)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(-w / 2 + 3, 0)
  ctx.lineTo(w / 2 - 3, 0)
  ctx.stroke()
  ctx.restore()
}
function drawTarget(b) {
  const x = b.position.x
  const y = b.position.y
  const r = b.gR
  const tt = b.gTT || TARGET_TYPES.standard
  if (drawSprite(tt.img, x, y, r * 2.3, r * 2.3, b.angle)) {
    if (b.gHurt > 0) {
      ctx.save()
      ctx.globalAlpha = 0.5
      ctx.beginPath()
      ctx.arc(x, y, r, 0, 6.28)
      ctx.fillStyle = '#fff'
      ctx.fill()
      ctx.restore()
    }
    return
  }
  ctx.beginPath()
  ctx.arc(x, y, r, 0, 6.28)
  ctx.fillStyle = b.gHurt > 0 ? '#ffffff' : tt.color
  ctx.fill()
  ctx.strokeStyle = tt.edge
  ctx.lineWidth = 2
  ctx.stroke()
  // tough targets wear an armour band across the top
  if (tt.hp > 1) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(x, y, r, Math.PI * 1.08, Math.PI * 1.92)
    ctx.lineWidth = r * 0.42
    ctx.strokeStyle = b.gHp > 1 ? '#5b4f7a' : 'rgba(91,79,122,0.4)'
    ctx.stroke()
    ctx.restore()
  }
  const ex = r * 0.38
  const ey = -r * 0.2
  const er = r * 0.26
  for (const s of [-1, 1]) {
    ctx.beginPath()
    ctx.arc(x + s * ex, y + ey, er, 0, 6.28)
    ctx.fillStyle = '#fff'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(x + s * ex, y + ey + 1, er * 0.5, 0, 6.28)
    ctx.fillStyle = '#1c2b1c'
    ctx.fill()
  }
}
function drawBird(x, y, bt) {
  bt = bt || curBird()
  const R = bt.r
  if (drawSprite(bt.img, x, y, R * 2.3, R * 2.3)) return
  ctx.beginPath()
  ctx.arc(x, y, R, 0, 6.28)
  ctx.fillStyle = bt.body
  ctx.fill()
  ctx.strokeStyle = bt.edge
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(x, y + 3, R * 0.55, 0, 6.28)
  ctx.fillStyle = bt.belly
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x + R * 0.35, y - R * 0.3, R * 0.22, 0, 6.28)
  ctx.fillStyle = '#fff'
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x + R * 0.42, y - R * 0.3, R * 0.11, 0, 6.28)
  ctx.fillStyle = '#222'
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(x + R * 0.8, y)
  ctx.lineTo(x + R * 1.4, y + 3)
  ctx.lineTo(x + R * 0.8, y + 7)
  ctx.closePath()
  ctx.fillStyle = '#f5a623'
  ctx.fill()
}

// ---------- input ----------
function toLocal(e) {
  const r = canvasEl.value.getBoundingClientRect()
  return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H }
}
function onDown(e) {
  if (state.value !== 'playing' || !ready || flying) return
  dragging = true
  pull = clampPull(toLocal(e))
}
function onMove(e) {
  if (!dragging) return
  e.preventDefault()
  pull = clampPull(toLocal(e))
}
function onUp() {
  if (!dragging) return
  dragging = false
  if (!pull) return
  const d = Math.hypot(SLING.x - pull.x, SLING.y - pull.y)
  if (d < MIN_PULL) {
    pull = null
    return
  }
  const dir = { x: (SLING.x - pull.x) / d, y: (SLING.y - pull.y) / d }
  const speed = (Math.min(d, MAX_PULL) / MAX_PULL) * MAX_V
  pull = null
  // launch from the fork, in the aimed direction
  launch({ x: dir.x * speed, y: dir.y * speed }, { x: SLING.x, y: SLING.y })
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
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  if (engine) {
    Events.off(engine)
    World.clear(world, false)
    Engine.clear(engine)
  }
})
</script>

<style lang="scss" scoped>
.fling-page {
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
.scores { flex: 1; display: flex; justify-content: center; gap: 6px; }
.score-box {
  min-width: 52px;
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
.field { width: 100%; height: auto; display: block; border-radius: 12px; background: #bfe3f7; touch-action: none; }
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
:deep(.q-btn.bg-primary) { background: linear-gradient(135deg, #f5a623 0%, #e8503a 100%) !important; }
</style>
