<template>
  <q-page class="tank-page" :style="{ background: themeStore.colors.gradient }" :data-state="state" :data-shots="shotCount">
    <!-- Header -->
    <div class="game-header">
      <q-btn fab-mini flat icon="arrow_back" color="white" @click="goBack" />
      <div class="hud">
        <div class="hp">
          <span class="tag you">You</span>
          <div class="bar"><div class="fill you" :style="{ width: playerHp + '%' }"></div></div>
        </div>
        <div class="wind">
          <q-icon name="air" size="16px" />
          <span>{{ windLabel }}</span>
        </div>
        <div class="hp">
          <div class="bar"><div class="fill foe" :style="{ width: aiHp + '%' }"></div></div>
          <span class="tag foe">CPU</span>
        </div>
      </div>
      <div class="header-menu">
        <q-btn fab-mini flat icon="refresh" color="white" @click="newGame" />
        <q-btn fab-mini flat icon="help_outline" color="white" @click="howToPlay" />
      </div>
    </div>

    <!-- Battlefield -->
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

        <div class="turn-banner" v-if="state === 'aiming'">Your shot — drag to aim, release to fire</div>
        <div class="turn-banner foe" v-else-if="state === 'ai'">CPU is taking aim…</div>
        <div class="aim-readout" v-if="aiming">{{ Math.round(aimAngleDeg) }}° · {{ Math.round(aimPower * 100) }}%</div>

        <transition name="overlay-fade">
          <div v-if="state === 'over'" class="board-overlay">
            <div class="overlay-text">{{ playerHp > 0 ? 'Victory!' : 'Defeated' }}</div>
            <q-btn unelevated color="primary" text-color="white" label="New Battle" @click="newGame" />
          </div>
        </transition>
      </div>
    </div>

    <p class="hint">Drag from your tank to set angle &amp; power — mind the wind</p>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useThemeStore } from 'src/stores/theme'
import { useProgressStore } from 'src/stores/progress'
import { useHaptics } from 'src/composables/useHaptics'

const W = 900
const H = 560
const GRAV = 0.35
const MAX_V = 17.7 // power 1 @ 45° ≈ full-width range
const TANK_R = 16
const BLAST = 52

const router = useRouter()
const themeStore = useThemeStore()
const progressStore = useProgressStore()
const haptics = useHaptics()

const canvasEl = ref(null)
const state = ref('aiming') // aiming | firing | ai | over
const playerHp = ref(100)
const aiHp = ref(100)
const wind = ref(0)
const shotCount = ref(0)
const aiming = ref(false)
const aimAngleDeg = ref(45)
const aimPower = ref(0.6)

let ctx = null
let ground = new Float32Array(W) // surface y per column
let player = { x: 120, y: 0, color: '#42a5f5' }
let ai = { x: W - 120, y: 0, color: '#ef5350' }
let projectile = null
let explosion = null
let aimVec = null
let raf = null
let turn = 'player' // whose shot is currently in flight

const windLabel = computed(() => {
  const v = Math.round(Math.abs(wind.value) / 0.06 * 5)
  if (Math.abs(wind.value) < 0.005) return 'calm'
  return (wind.value < 0 ? '◀ ' : '') + v + (wind.value > 0 ? ' ▶' : '')
})

// ---------- terrain ----------
function genTerrain() {
  const base = H * 0.62
  const a1 = 60 + Math.random() * 40
  const a2 = 22 + Math.random() * 20
  const p1 = Math.random() * Math.PI * 2
  const p2 = Math.random() * Math.PI * 2
  const f1 = 1.2 + Math.random()
  const f2 = 2.5 + Math.random() * 2
  for (let x = 0; x < W; x++) {
    const t = x / W
    let y = base + Math.sin(t * Math.PI * f1 + p1) * a1 + Math.sin(t * Math.PI * f2 + p2) * a2
    y += (t - 0.5) * (Math.random() * 30 - 15)
    ground[x] = Math.max(H * 0.32, Math.min(H - 24, y))
  }
  // flatten small pads under each tank
  flatten(player.x)
  flatten(ai.x)
}
function flatten(cx) {
  const h = ground[Math.round(cx)]
  for (let x = Math.max(0, cx - 22); x < Math.min(W, cx + 22); x++) ground[x] = h
}
function groundAt(x) {
  const i = Math.max(0, Math.min(W - 1, Math.round(x)))
  return ground[i]
}
function settleTanks() {
  player.y = groundAt(player.x)
  ai.y = groundAt(ai.x)
}

function newWind() {
  wind.value = (Math.random() * 2 - 1) * 0.06
}

// ---------- rendering ----------
function draw() {
  if (!ctx) return
  ctx.clearRect(0, 0, W, H)

  // terrain
  ctx.beginPath()
  ctx.moveTo(0, H)
  for (let x = 0; x < W; x++) ctx.lineTo(x, ground[x])
  ctx.lineTo(W, H)
  ctx.closePath()
  const grad = ctx.createLinearGradient(0, H * 0.4, 0, H)
  grad.addColorStop(0, '#5d4037')
  grad.addColorStop(1, '#3e2723')
  ctx.fillStyle = grad
  ctx.fill()
  // grass edge
  ctx.beginPath()
  ctx.moveTo(0, ground[0])
  for (let x = 1; x < W; x++) ctx.lineTo(x, ground[x])
  ctx.strokeStyle = '#7cb342'
  ctx.lineWidth = 5
  ctx.stroke()

  drawTank(player)
  drawTank(ai)

  // aim preview
  if (aiming.value && aimVec) drawAimPreview()

  // projectile
  if (projectile) {
    ctx.beginPath()
    ctx.arc(projectile.x, projectile.y, 5, 0, Math.PI * 2)
    ctx.fillStyle = '#fff'
    ctx.fill()
  }
  // explosion
  if (explosion) {
    ctx.beginPath()
    ctx.arc(explosion.x, explosion.y, explosion.r, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(255,${160 - explosion.t * 120},40,${0.85 - explosion.t * 0.8})`
    ctx.fill()
  }
}
function drawTank(t) {
  const dead = (t === player ? playerHp.value : aiHp.value) <= 0
  ctx.save()
  ctx.translate(t.x, t.y)
  // body
  ctx.fillStyle = dead ? '#555' : t.color
  ctx.beginPath()
  ctx.roundRect(-TANK_R, -12, TANK_R * 2, 12, 4)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(0, -12, 9, Math.PI, 0)
  ctx.fill()
  // barrel (player aims toward current aim; ai toward player)
  const ang = t === player ? aimAngleRad() : Math.PI - aimAngleRad()
  ctx.strokeStyle = dead ? '#555' : '#cfd8dc'
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.moveTo(0, -14)
  ctx.lineTo(Math.cos(-ang) * 26, -14 + Math.sin(-ang) * 26)
  ctx.stroke()
  ctx.restore()
}
function aimAngleRad() {
  return (aimAngleDeg.value * Math.PI) / 180
}
function drawAimPreview() {
  const pts = simulate(player.x, player.y - 16, aimAngleDeg.value, aimPower.value, false, 90)
  ctx.save()
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  for (let i = 0; i < pts.length; i += 6) {
    ctx.beginPath()
    ctx.arc(pts[i].x, pts[i].y, 2.5, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

// ---------- physics ----------
// Returns trajectory points; if collide, last point is impact. maxSteps caps preview length.
function simulate(x0, y0, angleDeg, power, collideTanks, maxSteps = 4000) {
  const a = (angleDeg * Math.PI) / 180
  let x = x0
  let y = y0
  let vx = Math.cos(a) * power * MAX_V
  let vy = -Math.sin(a) * power * MAX_V
  const pts = []
  for (let s = 0; s < maxSteps; s++) {
    vx += wind.value
    vy += GRAV
    x += vx
    y += vy
    pts.push({ x, y })
    if (x < -40 || x > W + 40 || y > H + 40) {
      pts.impact = null
      return pts
    }
    if (y >= groundAt(x)) {
      pts.impact = { x, y: groundAt(x) }
      return pts
    }
    if (collideTanks) {
      if (hit(x, y, player)) {
        pts.impact = { x, y, direct: 'player' }
        return pts
      }
      if (hit(x, y, ai)) {
        pts.impact = { x, y, direct: 'ai' }
        return pts
      }
    }
  }
  pts.impact = null
  return pts
}
function hit(x, y, t) {
  return Math.hypot(x - t.x, y - t.y - 6) < TANK_R
}

function fire(angleDeg, power) {
  if (state.value === 'firing' || state.value === 'over') return
  const shooter = state.value === 'ai' ? ai : player
  const a = (angleDeg * Math.PI) / 180
  const dir = shooter === player ? 1 : -1
  projectile = {
    x: shooter.x + dir * 10,
    y: shooter.y - 16,
    vx: Math.cos(a) * power * MAX_V * dir,
    vy: -Math.sin(a) * power * MAX_V,
  }
  state.value = 'firing'
  shotCount.value++
  haptics.medium()
  loop()
}

function loop() {
  cancelAnimationFrame(raf)
  const step = () => {
    if (explosion) {
      explosion.t += 0.06
      explosion.r += 2
      if (explosion.t >= 1) {
        explosion = null
        draw()
        afterImpact()
        return
      }
      draw()
      raf = requestAnimationFrame(step)
      return
    }
    // advance projectile a few sub-steps for smoothness
    for (let k = 0; k < 2 && projectile; k++) {
      projectile.vx += wind.value
      projectile.vy += GRAV
      projectile.x += projectile.vx
      projectile.y += projectile.vy
      const off = projectile.x < -40 || projectile.x > W + 40 || projectile.y > H + 40
      const grnd = projectile.y >= groundAt(projectile.x)
      const hp = hit(projectile.x, projectile.y, player)
      const ha = hit(projectile.x, projectile.y, ai)
      if (off) {
        projectile = null
        draw()
        afterImpact()
        return
      }
      if (grnd || hp || ha) {
        startExplosion(projectile.x, grnd ? groundAt(projectile.x) : projectile.y)
        projectile = null
        break
      }
    }
    draw()
    raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)
}

function startExplosion(x, y) {
  explosion = { x, y, r: 8, t: 0 }
  haptics.heavy()
  // terrain destruction
  for (let xi = Math.max(0, Math.floor(x - BLAST)); xi < Math.min(W, Math.ceil(x + BLAST)); xi++) {
    const dx = xi - x
    const d2 = BLAST * BLAST - dx * dx
    if (d2 <= 0) continue
    const bottom = y + Math.sqrt(d2)
    ground[xi] = Math.min(H - 4, Math.max(ground[xi], bottom))
  }
  // damage
  applyDamage(player, x, y)
  applyDamage(ai, x, y)
  settleTanks()
}
function applyDamage(t, x, y) {
  const d = Math.hypot(x - t.x, y - t.y)
  const reach = BLAST + TANK_R
  if (d < reach) {
    const dmg = Math.round(46 * (1 - d / reach)) + (d < TANK_R ? 25 : 0)
    if (t === player) playerHp.value = Math.max(0, playerHp.value - dmg)
    else aiHp.value = Math.max(0, aiHp.value - dmg)
  }
}

function afterImpact() {
  if (playerHp.value <= 0 || aiHp.value <= 0) {
    state.value = 'over'
    progressStore.recordTankGame(playerHp.value > 0)
    draw()
    return
  }
  newWind()
  if (turn === 'player') {
    turn = 'ai'
    state.value = 'ai'
    draw()
    setTimeout(aiTurn, 700)
  } else {
    turn = 'player'
    state.value = 'aiming'
    draw()
  }
}

// ---------- AI ----------
function aiTurn() {
  if (state.value !== 'ai') return
  let best = null
  for (let ang = 25; ang <= 78; ang += 4) {
    for (let pw = 0.3; pw <= 1; pw += 0.05) {
      const pts = simulate(ai.x - 10, ai.y - 16, 180 - ang, pw, false, 4000)
      const imp = pts.impact
      if (!imp) continue
      const dist = Math.abs(imp.x - player.x)
      if (!best || dist < best.dist) best = { ang, pw, dist }
    }
  }
  if (!best) best = { ang: 50, pw: 0.7 }
  // add miss noise (moderate difficulty)
  const ang = best.ang + (Math.random() * 2 - 1) * 5
  const pw = Math.min(1, Math.max(0.25, best.pw + (Math.random() * 2 - 1) * 0.07))
  aimAngleDeg.value = ang
  fire(ang, pw)
}

// ---------- input ----------
function toLocal(e) {
  const r = canvasEl.value.getBoundingClientRect()
  return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H }
}
function onDown(e) {
  if (state.value !== 'aiming') return
  aiming.value = true
  updateAim(e)
}
function onMove(e) {
  if (!aiming.value) return
  e.preventDefault()
  updateAim(e)
}
function updateAim(e) {
  const p = toLocal(e)
  aimVec = { x: p.x - player.x, y: p.y - (player.y - 16) }
  const dist = Math.hypot(aimVec.x, aimVec.y)
  let ang = (Math.atan2(-(aimVec.y), Math.abs(aimVec.x)) * 180) / Math.PI
  ang = Math.max(5, Math.min(89, ang))
  aimAngleDeg.value = ang
  aimPower.value = Math.max(0.12, Math.min(1, dist / 260))
  draw()
}
function onUp() {
  if (!aiming.value) return
  aiming.value = false
  fire(aimAngleDeg.value, aimPower.value)
}

// ---------- lifecycle ----------
function newGame() {
  haptics.light()
  cancelAnimationFrame(raf)
  projectile = null
  explosion = null
  playerHp.value = 100
  aiHp.value = 100
  aimAngleDeg.value = 45
  aimPower.value = 0.6
  shotCount.value = 0
  turn = 'player'
  genTerrain()
  settleTanks()
  newWind()
  state.value = 'aiming'
  draw()
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
.tank-page {
  min-height: 100vh;
  transition: background 2s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow: hidden;
}
.game-header {
  width: 100%;
  max-width: 640px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px;
  padding-top: max(56px, calc(env(safe-area-inset-top) + 16px));
}
.hud {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  color: #fff;
}
.hp {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
}
.tag {
  font-size: 0.72rem;
  font-weight: 700;
}
.tag.you { color: #90caf9; }
.tag.foe { color: #ef9a9a; }
.bar {
  flex: 1;
  height: 10px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.3);
  overflow: hidden;
}
.fill {
  height: 100%;
  transition: width 0.3s ease;
}
.fill.you { background: linear-gradient(90deg, #42a5f5, #90caf9); }
.fill.foe { background: linear-gradient(90deg, #ef9a9a, #ef5350); }
.wind {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.header-menu { display: flex; gap: 2px; }

.board-wrap {
  width: 100%;
  display: flex;
  justify-content: center;
  padding: 8px 12px;
  flex: 1;
  align-items: center;
}
.board {
  position: relative;
  width: min(96vw, 640px);
}
.field {
  width: 100%;
  height: auto;
  display: block;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.12);
  touch-action: none;
}
.turn-banner {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.8rem;
  color: #fff;
  background: rgba(0, 0, 0, 0.35);
  padding: 4px 12px;
  border-radius: 999px;
  white-space: nowrap;
}
.turn-banner.foe { color: #ef9a9a; }
.aim-readout {
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 1rem;
  font-weight: 700;
  color: #fff;
  background: rgba(0, 0, 0, 0.4);
  padding: 4px 14px;
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
  gap: 16px;
}
.overlay-text {
  font-size: 2rem;
  font-weight: 800;
  color: #fff;
}
.overlay-fade-enter-active { transition: opacity 0.4s ease; }
.overlay-fade-enter-from { opacity: 0; }
.hint {
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.82rem;
  text-align: center;
  margin: 8px 24px max(16px, env(safe-area-inset-bottom));
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}
:deep(.q-btn.bg-primary) {
  background: linear-gradient(135deg, #ef5350 0%, #42a5f5 100%) !important;
}
</style>
