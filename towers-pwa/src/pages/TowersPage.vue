<template>
  <q-page
    class="towers-page"
    :style="{ background: themeStore.colors.gradient }"
    :data-state="state"
    :data-wave="wave"
    :data-gold="gold"
    :data-lives="lives"
  >
    <!-- Header -->
    <div class="game-header">
      <q-btn fab-mini flat icon="arrow_back" color="white" @click="goBack" />
      <div class="hud">
        <div class="hud-item"><q-icon name="waves" size="15px" /> {{ wave }}</div>
        <div class="hud-item lives"><q-icon name="favorite" size="15px" /> {{ lives }}</div>
        <div class="hud-item gold"><q-icon name="paid" size="15px" /> {{ gold }}</div>
      </div>
      <div class="header-menu">
        <q-btn fab-mini flat icon="restart_alt" color="white" @click="restart" />
        <q-btn fab-mini flat icon="help_outline" color="white" @click="howToPlay" />
      </div>
    </div>

    <!-- Board -->
    <div class="board-wrap">
      <div class="board">
        <canvas
          ref="canvasEl"
          :width="W"
          :height="H"
          class="field"
          @pointerdown="onTap"
        ></canvas>

        <!-- speed control -->
        <div class="speed" v-if="state === 'build' || state === 'combat'">
          <button :class="{ on: speed === 0 }" @click="setSpeed(0)"><q-icon name="pause" size="16px" /></button>
          <button :class="{ on: speed === 1 }" @click="setSpeed(1)">1×</button>
          <button :class="{ on: speed === 2 }" @click="setSpeed(2)">2×</button>
        </div>

        <!-- map select -->
        <transition name="overlay-fade">
          <div v-if="state === 'mapselect'" class="board-overlay">
            <div class="overlay-text">Choose a map</div>
            <div class="map-list">
              <button v-for="(m, i) in maps" :key="i" class="map-card" @click="startMap(i)">
                <span class="map-name">{{ m.name }}</span>
                <span class="map-desc">{{ m.desc }}</span>
              </button>
            </div>
          </div>
        </transition>

        <!-- game over -->
        <transition name="overlay-fade">
          <div v-if="state === 'over'" class="board-overlay">
            <div class="overlay-text">The gate has fallen</div>
            <div class="overlay-sub">Reached wave {{ wave }} · Score {{ score.toLocaleString() }}</div>
            <q-btn unelevated color="primary" text-color="white" label="Play Again" @click="restart" />
          </div>
        </transition>
      </div>
    </div>

    <!-- Control bar -->
    <div class="controls" v-if="state === 'build' || state === 'combat'">
      <!-- tower palette (placing on an empty cell) -->
      <div v-if="selCell" class="palette">
        <button
          v-for="t in towerList"
          :key="t.key"
          class="tchip"
          :class="{ off: gold < t.cost }"
          :disabled="gold < t.cost"
          @click="buildTower(t.key)"
        >
          <span class="tname" :style="{ color: t.color }">{{ t.name }}</span>
          <span class="tcost">${{ t.cost }}</span>
          <span class="ttag">{{ t.tag }}</span>
        </button>
      </div>

      <!-- manage an existing tower -->
      <div v-else-if="selTower" class="manage">
        <div class="minfo">
          <span class="mname" :style="{ color: baseOf(selTower).color }">{{ baseOf(selTower).name }}</span>
          <span class="mlvl">Lv {{ selTower.level }}</span>
          <span class="mstat">{{ Math.round(curDmg) }} dmg · {{ Math.round(curRange) }} rng</span>
        </div>
        <div class="mbtns">
          <q-btn
            dense unelevated class="mbtn up"
            :disable="selTower.level >= 3 || gold < upCost"
            :label="selTower.level >= 3 ? 'Max level' : `Upgrade $${upCost}`"
            @click="upgradeTower"
          />
          <q-btn dense unelevated class="mbtn sell" :label="`Sell $${sellVal}`" @click="sellTower" />
        </div>
      </div>

      <!-- default: send next wave / status -->
      <div v-else class="bottombar">
        <q-btn
          v-if="state === 'build'"
          unelevated class="send" color="primary" text-color="white"
          :label="`Send Wave ${wave + 1}`"
          @click="startWave"
        />
        <div v-else class="combat-status">Wave {{ wave }} — {{ enemiesLeft }} left · tap ground to build</div>
      </div>
    </div>

    <p class="hint" v-if="state === 'build' && !selCell && !selTower">
      Tap empty ground to build · towers fire automatically when a wave rolls in
    </p>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useThemeStore } from 'src/stores/theme'
import { useProgressStore } from 'src/stores/progress'
import { useHaptics } from 'src/composables/useHaptics'

// ---------- geometry ----------
const COLS = 8
const ROWS = 12
const CELL = 60
const W = COLS * CELL // 480
const H = ROWS * CELL // 720

const router = useRouter()
const themeStore = useThemeStore()
const progressStore = useProgressStore()
const haptics = useHaptics()

const canvasEl = ref(null)

// ---------- towers ----------
const TOWERS = {
  cannon: { name: 'Cannon', tag: 'ground', cost: 70, range: 130, rate: 1.1, dmg: 18, air: false, color: '#bcaaa4', proj: 'bolt' },
  mortar: { name: 'Mortar', tag: 'splash', cost: 120, range: 155, rate: 0.5, dmg: 22, air: false, splash: 42, color: '#90a4ae', proj: 'lob' },
  frost: { name: 'Frost', tag: 'air · slow', cost: 90, range: 115, rate: 0.9, dmg: 6, air: true, slow: 0.55, slowDur: 1.5, color: '#4fc3f7', proj: 'frost' },
  tesla: { name: 'Tesla', tag: 'air · chain', cost: 150, range: 125, rate: 1.3, dmg: 14, air: true, chain: 2, color: '#ce93d8', proj: 'spark' },
}
const towerList = Object.entries(TOWERS).map(([key, t]) => ({ key, ...t }))

function levelMul(level) {
  return level === 1 ? 1 : level === 2 ? 1.7 : 2.6
}
function towerDmg(t) {
  return TOWERS[t.key].dmg * levelMul(t.level)
}
function towerRange(t) {
  return TOWERS[t.key].range * (1 + (t.level - 1) * 0.18)
}
function towerRate(t) {
  return TOWERS[t.key].rate * (1 + (t.level - 1) * 0.12)
}

// ---------- enemies ----------
const ENEMIES = {
  grunt: { name: 'Grunt', hp: 14, speed: 36, reward: 4, leak: 1, air: false, r: 11, color: '#ef5350' },
  runner: { name: 'Runner', hp: 9, speed: 66, reward: 3, leak: 1, air: false, r: 9, color: '#ffb300' },
  armored: { name: 'Armored', hp: 30, speed: 32, reward: 7, leak: 2, air: false, armor: 6, r: 13, color: '#90a4ae' },
  brute: { name: 'Brute', hp: 48, speed: 24, reward: 9, leak: 2, air: false, r: 16, color: '#8d6e63' },
  flyer: { name: 'Flyer', hp: 20, speed: 46, reward: 6, leak: 1, air: true, r: 11, color: '#ab47bc' },
  boss: { name: 'Boss', hp: 340, speed: 20, reward: 60, leak: 6, air: false, boss: true, r: 22, color: '#c62828' },
}

function waveScript(w) {
  if (w % 10 === 0) {
    return [
      { type: 'boss', count: 1, gap: 0 },
      { type: 'grunt', count: 6 + Math.floor(w / 2), gap: 0.5 },
      { type: 'flyer', count: 4 + Math.floor(w / 3), gap: 0.5 },
    ]
  }
  const groups = [{ type: 'grunt', count: Math.round((6 + w) * 0.6), gap: Math.max(0.32, 0.8 - w * 0.02) }]
  if (w >= 2) groups.push({ type: 'runner', count: Math.round(2 + w * 0.4), gap: 0.4 })
  if (w >= 4) groups.push({ type: 'armored', count: Math.round(1 + w * 0.25), gap: 0.6 })
  if (w >= 5) groups.push({ type: 'flyer', count: Math.round(2 + w * 0.3), gap: 0.5 })
  if (w >= 6) groups.push({ type: 'brute', count: Math.round(1 + w * 0.2), gap: 0.9 })
  return groups
}
function enemyHp(type, w) {
  return Math.round(ENEMIES[type].hp * (1 + 0.16 * (w - 1)))
}

// ---------- maps ----------
const maps = [
  {
    name: 'Switchback',
    desc: 'A long folded path — lots of crossfire corners',
    corners: [[0, 1], [2, 1], [2, 6], [4, 6], [4, 1], [6, 1], [6, 6], [8, 6], [8, 1], [10, 1], [10, 6], [11, 6]],
  },
  {
    name: 'Hairpin',
    desc: 'Wider sweeps — fewer but longer firing lanes',
    corners: [[0, 6], [3, 6], [3, 1], [6, 1], [6, 6], [9, 6], [9, 2], [11, 2]],
  },
]

let pathCells = new Set()
let samples = []
let pathLen = 0
let flySamples = []
let flyPathLen = 0
let staticLayer = null

const cx = (c) => c * CELL + CELL / 2
const cy = (r) => r * CELL + CELL / 2

function buildSamples(pts) {
  const out = [{ x: pts[0].x, y: pts[0].y }]
  let len = 0
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    const d = Math.hypot(b.x - a.x, b.y - a.y)
    const n = Math.max(1, Math.round(d / 3))
    for (let s = 1; s <= n; s++) {
      const t = s / n
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
    }
    len += d
  }
  return { out, len }
}

function norm(x, y) {
  const d = Math.hypot(x, y) || 1
  return { x: x / d, y: y / d }
}

function loadMapGeometry(idx) {
  const m = maps[idx]
  const corners = m.corners.map(([r, c]) => ({ r, c }))
  // path cells (non-buildable)
  pathCells = new Set()
  for (let i = 0; i < corners.length - 1; i++) {
    const a = corners[i]
    const b = corners[i + 1]
    const dr = Math.sign(b.r - a.r)
    const dc = Math.sign(b.c - a.c)
    let r = a.r
    let c = a.c
    pathCells.add(r * COLS + c)
    while (r !== b.r || c !== b.c) {
      r += dr
      c += dc
      pathCells.add(r * COLS + c)
    }
  }
  // pixel polyline with off-board entry + exit so creeps spawn/leak off-screen
  const pts = corners.map((p) => ({ x: cx(p.c), y: cy(p.r) }))
  const head = pts[0]
  const hd = norm(head.x - pts[1].x, head.y - pts[1].y)
  pts.unshift({ x: head.x + hd.x * CELL, y: head.y + hd.y * CELL })
  const tail = pts[pts.length - 1]
  const td = norm(tail.x - pts[pts.length - 2].x, tail.y - pts[pts.length - 2].y)
  pts.push({ x: tail.x + td.x * CELL, y: tail.y + td.y * CELL })
  const ground = buildSamples(pts)
  samples = ground.out
  pathLen = ground.len
  // flyers cut straight from entry to exit
  const fly = buildSamples([pts[0], pts[pts.length - 1]])
  flySamples = fly.out
  flyPathLen = fly.len
  renderStaticLayer()
}

function posOn(arr, len, d) {
  if (d <= 0) return arr[0]
  if (d >= len) return arr[arr.length - 1]
  const k = (d / len) * (arr.length - 1)
  const i = Math.floor(k)
  const f = k - i
  const a = arr[i]
  const b = arr[i + 1] || a
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }
}

function renderStaticLayer() {
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const g = cv.getContext('2d')
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (pathCells.has(r * COLS + c)) continue
      g.fillStyle = 'rgba(255,255,255,0.05)'
      g.fillRect(c * CELL + 2, r * CELL + 2, CELL - 4, CELL - 4)
      g.strokeStyle = 'rgba(255,255,255,0.07)'
      g.strokeRect(c * CELL + 2, r * CELL + 2, CELL - 4, CELL - 4)
    }
  }
  g.beginPath()
  g.moveTo(samples[0].x, samples[0].y)
  for (let i = 1; i < samples.length; i += 3) g.lineTo(samples[i].x, samples[i].y)
  g.strokeStyle = 'rgba(0,0,0,0.32)'
  g.lineWidth = CELL - 8
  g.lineCap = 'round'
  g.lineJoin = 'round'
  g.stroke()
  g.strokeStyle = 'rgba(255,255,255,0.10)'
  g.lineWidth = CELL - 20
  g.stroke()
  const exit = samples[samples.length - 1]
  g.fillStyle = 'rgba(255,80,80,0.7)'
  g.fillRect(exit.x - 26, exit.y - 8, 52, 10)
  staticLayer = cv
}

// ---------- reactive state ----------
const state = ref('mapselect') // mapselect | build | combat | over
const wave = ref(0)
const gold = ref(120)
const lives = ref(20)
const speed = ref(1)
const selCell = ref(null) // { r, c }
const selTower = ref(null)
const uiRev = ref(0)

// non-reactive game data
let ctx = null
let towers = []
let enemies = []
let projectiles = []
let beams = []
let particles = []
let floats = []
let spawnQueue = []
let waveClock = 0
let goldEarned = 0
let raf = null
let lastT = 0

const score = computed(() => (uiRev.value, wave.value * 100 + goldEarned))
const enemiesLeft = computed(() => (uiRev.value, enemies.length + spawnQueue.length))
const baseOf = (t) => TOWERS[t.key]
const curDmg = computed(() => (uiRev.value, selTower.value ? towerDmg(selTower.value) : 0))
const curRange = computed(() => (uiRev.value, selTower.value ? towerRange(selTower.value) : 0))
const upCost = computed(() => {
  uiRev.value
  const t = selTower.value
  if (!t) return 0
  return Math.round(TOWERS[t.key].cost * (t.level === 1 ? 0.8 : 1.4))
})
const sellVal = computed(() => (uiRev.value, selTower.value ? Math.floor(selTower.value.invested * 0.7) : 0))

function bump() {
  uiRev.value++
}

// ---------- setup ----------
function startMap(idx) {
  loadMapGeometry(idx)
  wave.value = 0
  gold.value = 120
  lives.value = 20
  goldEarned = 0
  towers = []
  enemies = []
  projectiles = []
  beams = []
  particles = []
  floats = []
  spawnQueue = []
  selCell.value = null
  selTower.value = null
  speed.value = 1
  state.value = 'build'
  haptics.medium()
  bump()
}
function restart() {
  haptics.light()
  enemies = []
  projectiles = []
  spawnQueue = []
  selCell.value = null
  selTower.value = null
  state.value = 'mapselect'
}

// ---------- waves ----------
function startWave() {
  if (state.value !== 'build') return
  wave.value++
  const groups = waveScript(wave.value)
  spawnQueue = []
  let t = 0
  for (const grp of groups) {
    for (let i = 0; i < grp.count; i++) {
      spawnQueue.push({ type: grp.type, at: t })
      t += grp.gap
    }
    t += 0.6
  }
  waveClock = 0
  state.value = 'combat'
  selCell.value = null
  selTower.value = null
  haptics.medium()
  bump()
}
function spawnEnemy(type) {
  const def = ENEMIES[type]
  const hp = enemyHp(type, wave.value)
  enemies.push({ type, def, dist: 0, hp, maxHp: hp, slowT: 0, slowMag: 1, dead: false, x: 0, y: 0 })
  if (def.boss) haptics.heavy()
}

// ---------- combat update ----------
function update(dt) {
  if (state.value === 'combat') {
    waveClock += dt
    while (spawnQueue.length && spawnQueue[0].at <= waveClock) spawnEnemy(spawnQueue.shift().type)
  }

  for (const e of enemies) {
    if (e.dead) continue
    if (e.slowT > 0) e.slowT -= dt
    const slow = e.slowT > 0 ? (e.def.boss ? Math.max(0.85, e.slowMag) : e.slowMag) : 1
    e.dist += e.def.speed * slow * dt
    const path = e.def.air ? flySamples : samples
    const len = e.def.air ? flyPathLen : pathLen
    const p = posOn(path, len, e.dist)
    e.x = p.x
    e.y = p.y
    if (e.dist >= len) {
      e.dead = true
      lives.value -= e.def.leak
      spawnFloat(W / 2, H - 30, `-${e.def.leak} ♥`, '#ff6b6b')
      haptics.heavy()
    }
  }

  for (const t of towers) {
    t.cd -= dt
    if (t.cd > 0) continue
    const target = pickTarget(t)
    if (!target) continue
    t.angle = Math.atan2(target.y - t.y, target.x - t.x)
    fire(t, target)
    t.cd = 1 / towerRate(t)
  }

  for (const p of projectiles) {
    if (p.kind === 'lob') {
      p.t += dt / p.dur
      const tt = Math.min(1, p.t)
      p.x = p.sx + (p.tx - p.sx) * tt
      p.y = p.sy + (p.ty - p.sy) * tt - Math.sin(Math.PI * tt) * 90
      if (p.t >= 1) {
        mortarSplash(p.tx, p.ty, p.dmg, p.splash)
        p.done = true
      }
    } else {
      if (!p.target || p.target.dead) {
        p.done = true
        continue
      }
      const dx = p.target.x - p.x
      const dy = p.target.y - p.y
      const d = Math.hypot(dx, dy)
      const step = p.speed * dt
      if (d <= step) {
        applyHit(p.target, p)
        p.done = true
      } else {
        p.x += (dx / d) * step
        p.y += (dy / d) * step
      }
    }
  }
  projectiles = projectiles.filter((p) => !p.done)

  for (const b of beams) b.life -= dt
  beams = beams.filter((b) => b.life > 0)
  for (const pt of particles) {
    pt.life++
    pt.x += pt.vx
    pt.y += pt.vy
    pt.vy += 0.12
    pt.vx *= 0.95
  }
  particles = particles.filter((pt) => pt.life < pt.max)
  for (const f of floats) {
    f.y -= 0.7
    f.life++
  }
  floats = floats.filter((f) => f.life < f.max)

  enemies = enemies.filter((e) => !e.dead)

  if (lives.value <= 0 && state.value !== 'over') {
    lives.value = 0
    state.value = 'over'
    progressStore.recordTowers(wave.value, wave.value * 100 + goldEarned)
    haptics.error?.() || haptics.heavy()
  } else if (state.value === 'combat' && spawnQueue.length === 0 && enemies.length === 0) {
    const bonus = 25 + wave.value * 3
    const interest = Math.min(40, Math.floor(gold.value * 0.1))
    gold.value += bonus + interest
    goldEarned += bonus + interest
    spawnFloat(W / 2, 44, `+$${bonus + interest}`, '#ffd54f')
    state.value = 'build'
    haptics.success()
  }
  bump()
}

function progress(e) {
  return e.def.air ? e.dist / flyPathLen : e.dist / pathLen
}
function canHit(t, e) {
  return e.def.air ? TOWERS[t.key].air : true
}
function pickTarget(t) {
  const range = towerRange(t)
  let best = null
  let bestProg = -1
  for (const e of enemies) {
    if (e.dead || !canHit(t, e)) continue
    if (Math.hypot(e.x - t.x, e.y - t.y) > range) continue
    const pr = progress(e)
    if (pr > bestProg) {
      bestProg = pr
      best = e
    }
  }
  return best
}

function fire(t, target) {
  const base = TOWERS[t.key]
  const dmg = towerDmg(t)
  if (t.key === 'tesla') {
    teslaChain(t, target, dmg, base.chain)
    return
  }
  if (t.key === 'mortar') {
    projectiles.push({ kind: 'lob', sx: t.x, sy: t.y, tx: target.x, ty: target.y, t: 0, dur: 0.55, dmg, splash: base.splash, x: t.x, y: t.y })
    return
  }
  projectiles.push({ kind: 'homing', x: t.x, y: t.y, target, speed: 420, dmg, color: base.color, slow: base.slow || 0, slowDur: base.slowDur || 0 })
}

function teslaChain(t, target, dmg, chain) {
  const hit = new Set()
  let from = { x: t.x, y: t.y }
  let cur = target
  let dealt = dmg
  for (let i = 0; i <= chain && cur; i++) {
    beams.push({ x1: from.x, y1: from.y, x2: cur.x, y2: cur.y, life: 0.16, color: '#e1bee7' })
    dealDamage(cur, dealt)
    hit.add(cur)
    from = { x: cur.x, y: cur.y }
    dealt *= 0.6
    let nx = null
    let nd = 80
    for (const e of enemies) {
      if (e.dead || hit.has(e) || !canHit(t, e)) continue
      const d = Math.hypot(e.x - from.x, e.y - from.y)
      if (d < nd) {
        nd = d
        nx = e
      }
    }
    cur = nx
  }
}

function applyHit(e, p) {
  dealDamage(e, p.dmg)
  if (p.slow) {
    e.slowT = Math.max(e.slowT, p.slowDur)
    e.slowMag = p.slow
  }
  spawnSpark(e.x, e.y, p.color || '#fff')
}
function mortarSplash(x, y, dmg, radius) {
  beams.push({ ring: true, x, y, r: radius, life: 0.3, color: '#ffcc80' })
  for (const e of enemies) {
    if (e.dead || e.def.air) continue
    if (Math.hypot(e.x - x, e.y - y) <= radius) dealDamage(e, dmg)
  }
  spawnSpark(x, y, '#ffcc80', 10)
}
function dealDamage(e, dmg) {
  if (e.dead) return
  const armor = e.def.armor || 0
  const d = Math.max(1, Math.round(dmg) - armor)
  e.hp -= d
  if (e.hp <= 0) {
    e.dead = true
    gold.value += e.def.reward
    goldEarned += e.def.reward
    spawnFloat(e.x, e.y - 12, `+$${e.def.reward}`, '#ffe082')
    spawnSpark(e.x, e.y, e.def.color, e.def.boss ? 20 : 8)
  }
}

// ---------- fx ----------
function spawnSpark(x, y, color, n = 6) {
  for (let k = 0; k < n; k++) {
    const a = Math.random() * Math.PI * 2
    const sp = 1 + Math.random() * 2.4
    particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 18 + Math.random() * 8, color, r: 1.5 + Math.random() * 2 })
  }
}
function spawnFloat(x, y, text, color) {
  floats.push({ x, y, text, color, life: 0, max: 44 })
}

// ---------- render ----------
function draw() {
  if (!ctx) return
  ctx.clearRect(0, 0, W, H)
  if (staticLayer) ctx.drawImage(staticLayer, 0, 0)

  if (selTower.value) drawRange(selTower.value.x, selTower.value.y, towerRange(selTower.value), 'white')
  else if (selCell.value) {
    ctx.fillStyle = 'rgba(255,255,255,0.12)'
    ctx.fillRect(selCell.value.c * CELL + 2, selCell.value.r * CELL + 2, CELL - 4, CELL - 4)
    drawRange(cx(selCell.value.c), cy(selCell.value.r), TOWERS.cannon.range, 'gold')
  }

  for (const t of towers) drawTower(t)
  for (const e of enemies) drawEnemy(e)

  for (const p of projectiles) {
    if (p.kind === 'lob') {
      ctx.fillStyle = '#cfd8dc'
      ctx.beginPath()
      ctx.arc(p.x, p.y, 5, 0, 6.28)
      ctx.fill()
    } else {
      ctx.strokeStyle = p.color || '#fff'
      ctx.lineWidth = 3
      const back = p.target ? norm(p.x - p.target.x, p.y - p.target.y) : { x: 0, y: 0 }
      ctx.beginPath()
      ctx.moveTo(p.x, p.y)
      ctx.lineTo(p.x + back.x * 8, p.y + back.y * 8)
      ctx.stroke()
    }
  }

  for (const b of beams) {
    if (b.ring) {
      ctx.globalAlpha = Math.max(0, b.life / 0.3)
      ctx.strokeStyle = b.color
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(b.x, b.y, b.r, 0, 6.28)
      ctx.stroke()
    } else {
      ctx.globalAlpha = Math.max(0, b.life / 0.16)
      ctx.strokeStyle = b.color
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.moveTo(b.x1, b.y1)
      ctx.lineTo(b.x2, b.y2)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  for (const pt of particles) {
    const t = pt.life / pt.max
    ctx.globalAlpha = 1 - t
    ctx.fillStyle = pt.color
    ctx.beginPath()
    ctx.arc(pt.x, pt.y, pt.r * (1 - t * 0.4), 0, 6.28)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  ctx.textAlign = 'center'
  ctx.font = 'bold 15px sans-serif'
  for (const f of floats) {
    const t = f.life / f.max
    ctx.globalAlpha = t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8
    ctx.fillStyle = f.color
    ctx.shadowColor = 'rgba(0,0,0,0.6)'
    ctx.shadowBlur = 4
    ctx.fillText(f.text, f.x, f.y)
    ctx.shadowBlur = 0
  }
  ctx.globalAlpha = 1
}

function drawRange(x, y, r, tone) {
  ctx.save()
  ctx.fillStyle = tone === 'white' ? 'rgba(255,255,255,0.08)' : 'rgba(255,213,79,0.10)'
  ctx.strokeStyle = tone === 'white' ? 'rgba(255,255,255,0.4)' : 'rgba(255,213,79,0.5)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(x, y, r, 0, 6.28)
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}
function drawTower(t) {
  const base = TOWERS[t.key]
  ctx.save()
  ctx.translate(t.x, t.y)
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.beginPath()
  ctx.arc(0, 0, 20, 0, 6.28)
  ctx.fill()
  ctx.fillStyle = base.color
  ctx.beginPath()
  ctx.arc(0, 0, 16, 0, 6.28)
  ctx.fill()
  ctx.rotate(t.angle || -Math.PI / 2)
  ctx.fillStyle = 'rgba(0,0,0,0.5)'
  ctx.fillRect(0, -4, 22, 8)
  ctx.restore()
  for (let i = 0; i < t.level; i++) {
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(t.x - 8 + i * 8, t.y + 22, 2.2, 0, 6.28)
    ctx.fill()
  }
}
function drawEnemy(e) {
  const def = e.def
  if (def.air) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)'
    ctx.beginPath()
    ctx.ellipse(e.x, e.y + 12, def.r * 0.8, def.r * 0.3, 0, 0, 6.28)
    ctx.fill()
  }
  ctx.fillStyle = e.slowT > 0 ? '#80d8ff' : def.color
  ctx.beginPath()
  ctx.arc(e.x, e.y, def.r, 0, 6.28)
  ctx.fill()
  if (def.armor) {
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.arc(e.x, e.y, def.r - 2, 0, 6.28)
    ctx.stroke()
  }
  if (def.air) {
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(e.x - def.r - 4, e.y)
    ctx.lineTo(e.x + def.r + 4, e.y)
    ctx.stroke()
  }
  if (e.hp < e.maxHp) {
    const w = def.r * 2
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.fillRect(e.x - def.r, e.y - def.r - 8, w, 4)
    ctx.fillStyle = '#7cf07c'
    ctx.fillRect(e.x - def.r, e.y - def.r - 8, w * Math.max(0, e.hp / e.maxHp), 4)
  }
}

// ---------- loop ----------
function loop() {
  cancelAnimationFrame(raf)
  const step = (now) => {
    if (!lastT) lastT = now
    let dt = (now - lastT) / 1000
    lastT = now
    if (dt > 0.05) dt = 0.05
    if (state.value === 'combat') update(dt * speed.value)
    draw()
    raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)
}

// ---------- input ----------
function onTap(e) {
  if (state.value !== 'build' && state.value !== 'combat') return
  const rect = canvasEl.value.getBoundingClientRect()
  const x = ((e.clientX - rect.left) / rect.width) * W
  const y = ((e.clientY - rect.top) / rect.height) * H
  const c = Math.floor(x / CELL)
  const r = Math.floor(y / CELL)
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return
  const existing = towers.find((t) => t.r === r && t.c === c)
  if (existing) {
    selTower.value = existing
    selCell.value = null
  } else if (!pathCells.has(r * COLS + c)) {
    selCell.value = { r, c }
    selTower.value = null
  } else {
    selCell.value = null
    selTower.value = null
  }
  haptics.light()
}

function buildTower(key) {
  if (!selCell.value) return
  const base = TOWERS[key]
  if (gold.value < base.cost) return
  const { r, c } = selCell.value
  if (towers.find((t) => t.r === r && t.c === c)) return
  gold.value -= base.cost
  const t = { key, r, c, x: cx(c), y: cy(r), level: 1, cd: 0, angle: -Math.PI / 2, invested: base.cost }
  towers.push(t)
  // deselect so the Send Wave button stays one tap away; tap the tower to manage it
  selTower.value = null
  selCell.value = null
  haptics.medium()
  bump()
}
function upgradeTower() {
  const t = selTower.value
  if (!t || t.level >= 3) return
  const cost = upCost.value
  if (gold.value < cost) return
  gold.value -= cost
  t.level++
  t.invested += cost
  haptics.medium()
  bump()
}
function sellTower() {
  const t = selTower.value
  if (!t) return
  gold.value += sellVal.value
  towers = towers.filter((x) => x !== t)
  selTower.value = null
  haptics.light()
  bump()
}
function setSpeed(s) {
  speed.value = s
  haptics.light()
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
  loop()
})
onBeforeUnmount(() => cancelAnimationFrame(raf))
</script>

<style lang="scss" scoped>
.towers-page {
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
.hud {
  flex: 1;
  display: flex;
  justify-content: center;
  gap: 8px;
}
.hud-item {
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(0, 0, 0, 0.28);
  border-radius: 9px;
  padding: 4px 11px;
  color: #fff;
  font-weight: 700;
  font-size: 0.9rem;
}
.hud-item.lives { color: #ff8a80; }
.hud-item.gold { color: #ffd54f; }
.header-menu { display: flex; gap: 2px; }

.board-wrap { width: 100%; display: flex; justify-content: center; padding: 4px 10px; flex: 1; align-items: center; }
.board { position: relative; width: min(96vw, 62vh, 420px); }
.field { width: 100%; height: auto; display: block; border-radius: 12px; background: rgba(0, 0, 0, 0.25); touch-action: none; }

.speed {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 4px;
}
.speed button {
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  font-weight: 800;
  font-size: 0.78rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.speed button.on { background: #5fd0e0; color: #11343a; }

.board-overlay {
  position: absolute;
  inset: 0;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(3px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  z-index: 5;
  padding: 20px;
}
.overlay-text { font-size: 1.6rem; font-weight: 800; color: #fff; text-align: center; }
.overlay-sub { color: rgba(255, 255, 255, 0.85); margin-top: -8px; text-align: center; }
.map-list { display: flex; flex-direction: column; gap: 12px; width: 100%; max-width: 280px; }
.map-card {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  padding: 14px 16px;
  color: #fff;
  cursor: pointer;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.map-card:active { background: rgba(255, 255, 255, 0.2); }
.map-name { font-weight: 800; font-size: 1.05rem; }
.map-desc { font-size: 0.78rem; opacity: 0.8; }

.overlay-fade-enter-active { transition: opacity 0.35s ease; }
.overlay-fade-enter-from { opacity: 0; }

.controls {
  width: 100%;
  max-width: 460px;
  padding: 6px 12px max(12px, env(safe-area-inset-bottom));
  min-height: 64px;
}
.palette { display: flex; gap: 6px; }
.tchip {
  flex: 1;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(0, 0, 0, 0.3);
  border-radius: 10px;
  padding: 7px 4px;
  color: #fff;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.tchip.off { opacity: 0.4; }
.tname { font-weight: 800; font-size: 0.82rem; }
.tcost { font-weight: 700; font-size: 0.78rem; color: #ffd54f; }
.ttag { font-size: 0.6rem; opacity: 0.7; }

.manage {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: rgba(0, 0, 0, 0.28);
  border-radius: 12px;
  padding: 10px 12px;
}
.minfo { display: flex; align-items: center; gap: 10px; color: #fff; }
.mname { font-weight: 800; }
.mlvl { font-weight: 700; opacity: 0.85; }
.mstat { font-size: 0.78rem; opacity: 0.7; margin-left: auto; }
.mbtns { display: flex; gap: 8px; }
.mbtn { flex: 1; font-weight: 800; border-radius: 9px; }
.mbtn.up { background: linear-gradient(135deg, #2ecc71, #1f9d57) !important; color: #fff; }
.mbtn.sell { background: rgba(255, 255, 255, 0.15) !important; color: #fff; }

.bottombar { display: flex; justify-content: center; }
.send { width: 100%; font-weight: 800; border-radius: 12px; padding: 12px; font-size: 1rem; }
.combat-status { color: rgba(255, 255, 255, 0.85); font-size: 0.85rem; text-align: center; padding: 14px; }

.hint {
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.8rem;
  text-align: center;
  margin: 2px 24px max(10px, env(safe-area-inset-bottom));
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}
:deep(.q-btn.bg-primary) { background: linear-gradient(135deg, #5fd0e0 0%, #2e86ab 100%) !important; }
</style>
