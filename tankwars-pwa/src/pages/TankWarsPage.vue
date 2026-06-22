<template>
  <q-page
    class="tank-page"
    :style="{ background: themeStore.colors.gradient }"
    :data-state="state"
    :data-shots="shotCount"
    :data-round="round"
  >
    <!-- Header -->
    <div class="game-header">
      <q-btn fab-mini flat icon="arrow_back" color="white" @click="goBack" />
      <div class="hud">
        <div class="hp">
          <span class="tag you">You {{ playerHp }}<small v-if="playerShield">+{{ playerShield }}🛡</small></span>
          <div class="bar"><div class="fill you" :style="{ width: playerHp + '%' }"></div></div>
        </div>
        <div class="mid">
          <div class="round">Round {{ round }} · {{ playerWins }}–{{ aiWins }}</div>
          <div class="wind"><q-icon name="air" size="14px" /><span>{{ windLabel }}</span></div>
        </div>
        <div class="hp">
          <div class="bar"><div class="fill foe" :style="{ width: aiHp + '%' }"></div></div>
          <span class="tag foe">CPU {{ aiHp }}<small v-if="aiShield">+{{ aiShield }}🛡</small></span>
        </div>
      </div>
      <div class="header-menu">
        <q-btn fab-mini flat icon="restart_alt" color="white" @click="newMatch" />
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
        <div class="turn-banner" v-if="state === 'aiming'">${{ money }} · {{ weapons[selected].label }}</div>
        <div class="turn-banner foe" v-else-if="state === 'ai'">CPU is taking aim…</div>
      </div>
    </div>

    <!-- Controls -->
    <div class="controls" v-if="state === 'aiming'">
      <div class="weapons">
        <button
          v-for="(w, key) in weapons"
          :key="key"
          class="wchip"
          :class="{ sel: selected === key, out: !w.infinite && inv[key] <= 0 }"
          :disabled="!w.infinite && inv[key] <= 0"
          @click="selectWeapon(key)"
        >
          {{ w.label }}<span v-if="!w.infinite" class="ammo">{{ inv[key] }}</span>
        </button>
      </div>
      <div class="dial">
        <span class="dlabel">Angle</span>
        <q-btn flat dense round icon="remove" color="white" @click="bump('angle', -1)" />
        <q-slider v-model="angleDeg" :min="0" :max="180" :step="1" dense color="amber" class="col" @update:model-value="draw" />
        <q-btn flat dense round icon="add" color="white" @click="bump('angle', 1)" />
        <span class="dval">{{ angleDeg }}°</span>
      </div>
      <div class="dial">
        <span class="dlabel">Power</span>
        <q-btn flat dense round icon="remove" color="white" @click="bump('power', -10)" />
        <q-slider v-model="power" :min="50" :max="1000" :step="5" dense color="amber" class="col" @update:model-value="draw" />
        <q-btn flat dense round icon="add" color="white" @click="bump('power', 10)" />
        <span class="dval">{{ power }}</span>
      </div>
      <div class="actions">
        <q-btn dense unelevated color="grey-8" text-color="white" icon="chevron_left" :disable="fuel <= 0" @click="moveTank(-1)" />
        <q-btn dense unelevated color="grey-8" text-color="white" :label="`Repair ${inv.repair}`" :disable="inv.repair <= 0 || playerHp >= 100" @click="useRepair" />
        <q-btn dense unelevated color="grey-8" text-color="white" :label="`Shield ${inv.shield}`" :disable="inv.shield <= 0" @click="useShield" />
        <q-btn dense unelevated color="grey-8" text-color="white" icon="chevron_right" :disable="fuel <= 0" @click="moveTank(1)" />
        <q-btn dense unelevated color="primary" text-color="white" label="Fire" class="fire" @click="playerFire" />
      </div>
      <div class="fuelrow">Fuel {{ fuel }} · drag the battlefield to aim too</div>
    </div>

    <!-- Shop between rounds -->
    <q-dialog v-model="shopOpen" persistent>
      <q-card class="shop-card">
        <q-card-section>
          <div class="text-h6 text-white">
            {{ roundWinner === 'player' ? 'Round won!' : 'Round lost' }} — Armoury
          </div>
          <div class="text-caption text-white q-mb-sm" style="opacity:.85">You have ${{ money }}</div>
          <div class="shop-grid">
            <div v-for="item in shopItems" :key="item.key" class="shop-item">
              <div class="si-name">{{ item.label }} <span class="si-own">×{{ invOf(item.key) }}</span></div>
              <q-btn
                dense unelevated color="primary" text-color="white"
                :label="`$${item.cost}`"
                :disable="money < item.cost"
                @click="buy(item)"
              />
            </div>
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat color="white" label="Next Round" @click="startRound" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Match over -->
    <q-dialog v-model="matchOver" persistent>
      <q-card class="shop-card">
        <q-card-section class="text-center">
          <div class="text-h5 text-white">{{ playerWins > aiWins ? 'You win the war!' : 'CPU wins the war' }}</div>
          <div class="text-body2 text-white q-mt-sm">Final score {{ playerWins }}–{{ aiWins }}</div>
        </q-card-section>
        <q-card-actions align="center">
          <q-btn unelevated color="primary" text-color="white" label="New Match" @click="newMatch" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <p class="hint" v-if="state !== 'aiming'">Artillery duel — destroy the enemy tank to win the round</p>
  </q-page>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useThemeStore } from 'src/stores/theme'
import { useProgressStore } from 'src/stores/progress'
import { useHaptics } from 'src/composables/useHaptics'

const W = 900
const H = 480
const GRAV = 0.35
const PV = 0.0177 // power → initial speed (power 1000 ≈ full-width range at 45°)
const TANK_R = 16
const WIN_ROUNDS = 3

const router = useRouter()
const themeStore = useThemeStore()
const progressStore = useProgressStore()
const haptics = useHaptics()

const weapons = {
  tracer: { label: 'Tracer', blast: 0, dmg: 0, infinite: true },
  missile: { label: 'Missile', blast: 46, dmg: 40, infinite: true },
  nuke: { label: 'Big Nuke', blast: 92, dmg: 78 },
  mirv: { label: 'MIRV', blast: 40, dmg: 30, split: 5 },
  roller: { label: 'Roller', blast: 50, dmg: 44, roller: true },
}
const shopItems = [
  { key: 'nuke', label: 'Big Nuke', cost: 120 },
  { key: 'mirv', label: 'MIRV', cost: 150 },
  { key: 'roller', label: 'Roller', cost: 100 },
  { key: 'repair', label: 'Repair kit (+45)', cost: 70 },
  { key: 'shield', label: 'Shield (+50)', cost: 90 },
  { key: 'parachute', label: 'Parachute', cost: 40 },
]

const canvasEl = ref(null)
const state = ref('aiming') // aiming | firing | ai | shop | matchover
const round = ref(1)
const playerWins = ref(0)
const aiWins = ref(0)
const playerHp = ref(100)
const aiHp = ref(100)
const playerShield = ref(0)
const aiShield = ref(0)
const money = ref(100)
const fuel = ref(4)
const wind = ref(0)
const shotCount = ref(0)
const selected = ref('missile')
const angleDeg = ref(50)
const power = ref(600)
const shopOpen = ref(false)
const matchOver = ref(false)
const roundWinner = ref('player')

const inv = reactive({ nuke: 1, mirv: 1, roller: 1, repair: 1, shield: 1, parachute: 1 })
// the CPU has its own stock + wallet so the shop economy is symmetric, not a
// free, infinite arsenal it never has to ration
const aiInv = reactive({ nuke: 1, mirv: 1, roller: 1, repair: 1, shield: 1, parachute: 1 })
const aiMoney = ref(0)

let tracerShot = false
let ctx = null
let ground = new Float32Array(W)
let player = { x: 120, y: 0 }
let ai = { x: W - 120, y: 0 }
let projectiles = []
let explosions = []
let floats = [] // floating damage / cash popups
let tracerMark = null
let shooter = 'player'
let aimDragging = false
let aiAngle = 130
let raf = null

const windLabel = computed(() => {
  const v = Math.round((Math.abs(wind.value) / 0.06) * 5)
  if (Math.abs(wind.value) < 0.004) return 'calm'
  return (wind.value < 0 ? '◀' : '') + v + (wind.value > 0 ? '▶' : '')
})
function invOf(k) {
  return inv[k] === undefined ? 0 : inv[k]
}

// ---------- terrain ----------
function genTerrain() {
  const base = H * 0.6
  const a1 = 55 + Math.random() * 35
  const a2 = 20 + Math.random() * 18
  const p1 = Math.random() * 6.28
  const p2 = Math.random() * 6.28
  const f1 = 1.2 + Math.random()
  const f2 = 2.5 + Math.random() * 2
  for (let x = 0; x < W; x++) {
    const t = x / W
    const y = base + Math.sin(t * Math.PI * f1 + p1) * a1 + Math.sin(t * Math.PI * f2 + p2) * a2
    ground[x] = Math.max(H * 0.3, Math.min(H - 20, y))
  }
  flatten(player.x)
  flatten(ai.x)
}
function flatten(cx) {
  const h = ground[Math.round(cx)]
  for (let x = Math.max(0, cx - 20); x < Math.min(W, cx + 20); x++) ground[x] = h
}
function groundAt(x) {
  return ground[Math.max(0, Math.min(W - 1, Math.round(x)))]
}
function settleTanks(fall = false) {
  for (const t of [player, ai]) {
    const ny = groundAt(t.x)
    if (fall && ny - t.y > 18) {
      const drop = ny - t.y
      const chutes = t === player ? inv : aiInv
      if (chutes.parachute > 0) {
        chutes.parachute--
      } else {
        damageTank(t, Math.min(45, Math.round((drop - 18) * 0.4)))
      }
    }
    t.y = ny
  }
}
function newWind() {
  wind.value = (Math.random() * 2 - 1) * 0.06
}

// ---------- rendering ----------
function draw() {
  if (!ctx) return
  ctx.clearRect(0, 0, W, H)
  ctx.beginPath()
  ctx.moveTo(0, H)
  for (let x = 0; x < W; x++) ctx.lineTo(x, ground[x])
  ctx.lineTo(W, H)
  ctx.closePath()
  const g = ctx.createLinearGradient(0, H * 0.35, 0, H)
  g.addColorStop(0, '#5d4037')
  g.addColorStop(1, '#3e2723')
  ctx.fillStyle = g
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(0, ground[0])
  for (let x = 1; x < W; x++) ctx.lineTo(x, ground[x])
  ctx.strokeStyle = '#7cb342'
  ctx.lineWidth = 4
  ctx.stroke()

  drawTank(player, '#42a5f5', playerHp.value, playerShield.value)
  drawTank(ai, '#ef5350', aiHp.value, aiShield.value)

  if (state.value === 'aiming') drawAimPreview()
  if (tracerMark) {
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(tracerMark.x - 8, tracerMark.y - 8)
    ctx.lineTo(tracerMark.x + 8, tracerMark.y + 8)
    ctx.moveTo(tracerMark.x + 8, tracerMark.y - 8)
    ctx.lineTo(tracerMark.x - 8, tracerMark.y + 8)
    ctx.stroke()
  }
  for (const p of projectiles) {
    ctx.beginPath()
    ctx.arc(p.x, p.y, 5, 0, 6.28)
    ctx.fillStyle = '#fff'
    ctx.fill()
  }
  for (const e of explosions) {
    ctx.beginPath()
    ctx.arc(e.x, e.y, e.r, 0, 6.28)
    ctx.fillStyle = `rgba(255,${Math.round(170 - e.t * 130)},40,${(0.85 - e.t * 0.8).toFixed(3)})`
    ctx.fill()
  }
  drawFloats()
}
function drawTank(t, color, hp, shield) {
  ctx.save()
  ctx.translate(t.x, t.y)
  if (shield > 0) {
    ctx.beginPath()
    ctx.arc(0, -8, 30, 0, 6.28)
    ctx.strokeStyle = 'rgba(120,220,255,0.7)'
    ctx.lineWidth = 3
    ctx.stroke()
  }
  ctx.fillStyle = hp <= 0 ? '#555' : color
  ctx.beginPath()
  ctx.roundRect(-TANK_R, -12, TANK_R * 2, 12, 4)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(0, -12, 9, Math.PI, 0)
  ctx.fill()
  const ang = (t === player ? angleDeg.value : aiAngle) * (Math.PI / 180)
  ctx.strokeStyle = hp <= 0 ? '#555' : '#cfd8dc'
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.moveTo(0, -14)
  ctx.lineTo(Math.cos(ang) * 26, -14 - Math.sin(ang) * 26)
  ctx.stroke()
  ctx.restore()
}
function drawAimPreview() {
  const pts = trajectory(player.x, player.y - 16, angleDeg.value, power.value, 70)
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  for (let i = 0; i < pts.length; i += 5) {
    ctx.beginPath()
    ctx.arc(pts[i].x, pts[i].y, 2.4, 0, 6.28)
    ctx.fill()
  }
}

// ---------- physics helpers ----------
function trajectory(x0, y0, angle, pw, maxSteps) {
  const a = angle * (Math.PI / 180)
  let x = x0
  let y = y0
  let vx = Math.cos(a) * pw * PV
  let vy = -Math.sin(a) * pw * PV
  const pts = []
  for (let s = 0; s < maxSteps; s++) {
    vx += wind.value
    vy += GRAV
    x += vx
    y += vy
    if (x < 0 || x > W || y > H) break
    pts.push({ x, y })
    if (y >= groundAt(x)) break
  }
  return pts
}
function aiSolve() {
  let best = null
  for (let ang = 95; ang <= 170; ang += 3) {
    for (let pw = 250; pw <= 1000; pw += 30) {
      const a = ang * (Math.PI / 180)
      let x = ai.x - 10
      let y = ai.y - 16
      let vx = Math.cos(a) * pw * PV
      let vy = -Math.sin(a) * pw * PV
      let imp = null
      for (let s = 0; s < 4000; s++) {
        vx += wind.value
        vy += GRAV
        x += vx
        y += vy
        if (x < -40 || x > W + 40 || y > H + 40) break
        if (y >= groundAt(x)) {
          imp = x
          break
        }
      }
      if (imp == null) continue
      const d = Math.abs(imp - player.x)
      if (!best || d < best.d) best = { ang, pw, d }
    }
  }
  return best || { ang: 130, pw: 600 }
}

// ---------- firing ----------
function spawn(t, angle, pw, weaponKey, dir) {
  const a = angle * (Math.PI / 180)
  return {
    x: t.x + dir * 12,
    y: t.y - 16,
    vx: Math.cos(a) * pw * PV,
    vy: -Math.sin(a) * pw * PV,
    w: weapons[weaponKey],
    didSplit: false,
    rolling: false,
    rollDist: 0,
  }
}
function selectWeapon(key) {
  selected.value = key
  draw()
}
function playerFire() {
  if (state.value !== 'aiming') return
  const key = selected.value
  const w = weapons[key]
  if (!w.infinite && inv[key] <= 0) return
  if (!w.infinite) inv[key]--
  shooter = 'player'
  tracerShot = key === 'tracer'
  if (!tracerShot) tracerMark = null
  fireProjectile(spawn(player, angleDeg.value, power.value, key, 1))
}
function fireProjectile(p) {
  projectiles = [p]
  explosions = []
  state.value = 'firing'
  shotCount.value++
  haptics.medium()
  loop()
}

function loop() {
  cancelAnimationFrame(raf)
  const step = () => {
    for (let k = 0; k < 2; k++) advance()
    for (const e of explosions) {
      e.t += 0.06
      e.r = e.maxR * Math.min(1, e.t * 1.6)
    }
    explosions = explosions.filter((e) => e.t < 1)
    updateFloats()
    draw()
    if (projectiles.length === 0 && explosions.length === 0 && floats.length === 0) {
      afterVolley()
      return
    }
    raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)
}
function advance() {
  const next = []
  for (const p of projectiles) {
    if (p.rolling) {
      p.x += p.vx
      p.rollDist += Math.abs(p.vx)
      if (p.x < 4 || p.x > W - 4) {
        explode(p)
        continue
      }
      p.y = groundAt(p.x) - 2
      if (Math.abs(p.x - player.x) < TANK_R || Math.abs(p.x - ai.x) < TANK_R) {
        explode(p)
        continue
      }
      const ahead = groundAt(p.x + Math.sign(p.vx) * 7)
      if (ahead < p.y - 4 || p.rollDist > 340) {
        explode(p)
        continue
      }
      next.push(p)
      continue
    }
    p.vx += wind.value
    p.vy += GRAV
    p.x += p.vx
    p.y += p.vy
    if (p.w.split && !p.didSplit && p.vy >= 0 && p.y < groundAt(p.x) - 40) {
      for (let i = 0; i < p.w.split; i++) {
        next.push({
          x: p.x,
          y: p.y,
          vx: p.vx + (i - (p.w.split - 1) / 2) * 1.5,
          vy: p.vy - Math.random() * 1.2,
          w: { blast: p.w.blast, dmg: p.w.dmg },
          didSplit: true,
          rolling: false,
          rollDist: 0,
        })
      }
      continue
    }
    if (p.x < -40 || p.x > W + 40 || p.y > H + 40) continue
    if (Math.abs(p.x - player.x) < TANK_R && Math.abs(p.y - (player.y - 6)) < TANK_R) {
      explode(p)
      continue
    }
    if (Math.abs(p.x - ai.x) < TANK_R && Math.abs(p.y - (ai.y - 6)) < TANK_R) {
      explode(p)
      continue
    }
    if (p.y >= groundAt(p.x)) {
      if (p.w.roller && !p.rolling) {
        p.rolling = true
        p.y = groundAt(p.x) - 2
        p.vx = (groundAt(p.x + 7) > groundAt(p.x - 7) ? 1 : -1) * 4.2
        next.push(p)
        continue
      }
      explode(p)
      continue
    }
    next.push(p)
  }
  projectiles = next
}
function explode(p) {
  const x = p.x
  const y = Math.min(p.y, groundAt(p.x))
  if (p.w.dmg === 0) {
    tracerMark = { x, y: groundAt(x) }
    return
  }
  explosions.push({ x, y, r: 6, maxR: p.w.blast, t: 0 })
  haptics.heavy()
  for (let xi = Math.max(0, Math.floor(x - p.w.blast)); xi < Math.min(W, Math.ceil(x + p.w.blast)); xi++) {
    const dx = xi - x
    const d2 = p.w.blast * p.w.blast - dx * dx
    if (d2 <= 0) continue
    ground[xi] = Math.min(H - 4, Math.max(ground[xi], y + Math.sqrt(d2)))
  }
  blastDamage(x, y, p.w.blast, p.w.dmg)
  settleTanks(true)
}
function blastDamage(x, y, blast, dmg) {
  for (const t of [player, ai]) {
    const d = Math.hypot(x - t.x, y - t.y)
    const reach = blast + TANK_R
    if (d < reach) {
      const dm = Math.round(dmg * (1 - d / reach)) + (d < TANK_R ? 22 : 0)
      const before = t === player ? playerHp.value : aiHp.value
      damageTank(t, dm)
      const dealt = before - (t === player ? playerHp.value : aiHp.value)
      if (dm > 0) {
        if (dealt > 0) spawnFloat(t.x, t.y - 30, '-' + dealt, '#ff5252')
        else spawnFloat(t.x, t.y - 30, '🛡', '#7fdfff') // shield ate it all
      }
      if (shooter === 'player' && t === ai && dealt > 0) {
        money.value += dealt * 2
        spawnFloat(ai.x, ai.y - 52, '+$' + dealt * 2, '#ffd54f')
      }
      if (shooter === 'ai' && t === player && dealt > 0) aiMoney.value += dealt * 2
    }
  }
}
function spawnFloat(x, y, text, color) {
  floats.push({ x, y, text, color, life: 0, max: 34 })
}
function updateFloats() {
  for (const f of floats) {
    f.y -= 1.1
    f.life++
  }
  floats = floats.filter((f) => f.life < f.max)
}
function drawFloats() {
  ctx.textAlign = 'center'
  ctx.font = 'bold 22px sans-serif'
  for (const f of floats) {
    const t = f.life / f.max
    ctx.globalAlpha = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85
    ctx.fillStyle = f.color
    ctx.shadowColor = 'rgba(0,0,0,0.7)'
    ctx.shadowBlur = 6
    ctx.fillText(f.text, f.x, f.y)
    ctx.shadowBlur = 0
  }
  ctx.globalAlpha = 1
}
function damageTank(t, dmg) {
  if (dmg <= 0) return
  if (t === player) {
    const s = Math.min(playerShield.value, dmg)
    playerShield.value -= s
    playerHp.value = Math.max(0, playerHp.value - (dmg - s))
  } else {
    const s = Math.min(aiShield.value, dmg)
    aiShield.value -= s
    aiHp.value = Math.max(0, aiHp.value - (dmg - s))
  }
}

function afterVolley() {
  if (playerHp.value <= 0 || aiHp.value <= 0) {
    endRound()
    return
  }
  // a tracer is a free ranging shot — keep the turn (and the same wind) so the
  // mark actually helps you line up the real shot
  if (shooter === 'player' && tracerShot) {
    tracerShot = false
    state.value = 'aiming'
    draw()
    return
  }
  newWind()
  if (shooter === 'player') {
    state.value = 'ai'
    draw()
    setTimeout(aiTurn, 700)
  } else {
    state.value = 'aiming'
    fuel.value = 4
    draw()
  }
}

function aiChooseWeapon() {
  // favour a nuke while the player is healthy; otherwise sometimes another
  // special — but only what's actually in stock, else the infinite missile
  if (aiInv.nuke > 0 && playerHp.value > 55 && Math.random() < 0.6) return 'nuke'
  const specials = []
  if (aiInv.nuke > 0) specials.push('nuke')
  if (aiInv.mirv > 0) specials.push('mirv')
  if (aiInv.roller > 0) specials.push('roller')
  if (specials.length && Math.random() < 0.45) return specials[Math.floor(Math.random() * specials.length)]
  return 'missile'
}

function aiTurn() {
  if (state.value !== 'ai') return
  // defensive utilities before firing
  if (aiHp.value <= 45 && aiInv.repair > 0) {
    aiInv.repair--
    aiHp.value = Math.min(100, aiHp.value + 45)
  }
  if (aiHp.value <= 60 && aiShield.value === 0 && aiInv.shield > 0 && Math.random() < 0.7) {
    aiInv.shield--
    aiShield.value += 50
  }
  const sol = aiSolve()
  // aim tightens as the match wears on, so a best-of-5 escalates in tension
  const acc = Math.max(0.4, 1 - (round.value - 1) * 0.13)
  aiAngle = sol.ang + (Math.random() * 2 - 1) * 5 * acc
  const pw = Math.min(1000, Math.max(120, sol.pw + (Math.random() * 2 - 1) * 70 * acc))
  const key = aiChooseWeapon()
  if (key !== 'missile' && key !== 'tracer') aiInv[key]--
  shooter = 'ai'
  fireProjectile(spawn(ai, aiAngle, pw, key, -1))
}

// ---------- round / match flow ----------
function endRound() {
  roundWinner.value = aiHp.value <= 0 ? 'player' : 'ai'
  if (roundWinner.value === 'player') {
    playerWins.value++
    money.value += 70
    aiMoney.value += 25
  } else {
    aiWins.value++
    money.value += 25
    aiMoney.value += 70
  }
  draw()
  if (playerWins.value >= WIN_ROUNDS || aiWins.value >= WIN_ROUNDS) {
    state.value = 'matchover'
    matchOver.value = true
    progressStore.recordTankGame(playerWins.value > aiWins.value)
  } else {
    setTimeout(() => {
      shopOpen.value = true
      state.value = 'shop'
    }, 900)
  }
}
function startRound() {
  shopOpen.value = false
  aiAutoBuy()
  round.value++
  playerHp.value = 100
  aiHp.value = 100
  playerShield.value = 0
  aiShield.value = 0
  fuel.value = 4
  projectiles = []
  explosions = []
  floats = []
  tracerMark = null
  shooter = 'player'
  genTerrain()
  settleTanks()
  newWind()
  state.value = 'aiming'
  draw()
}
function newMatch() {
  haptics.light()
  cancelAnimationFrame(raf)
  matchOver.value = false
  shopOpen.value = false
  round.value = 1
  playerWins.value = 0
  aiWins.value = 0
  money.value = 100
  Object.assign(inv, { nuke: 1, mirv: 1, roller: 1, repair: 1, shield: 1, parachute: 1 })
  Object.assign(aiInv, { nuke: 1, mirv: 1, roller: 1, repair: 1, shield: 1, parachute: 1 })
  aiMoney.value = 0
  tracerShot = false
  playerHp.value = 100
  aiHp.value = 100
  playerShield.value = 0
  aiShield.value = 0
  fuel.value = 4
  projectiles = []
  explosions = []
  floats = []
  tracerMark = null
  shooter = 'player'
  selected.value = 'missile'
  angleDeg.value = 50
  power.value = 600
  shotCount.value = 0
  genTerrain()
  settleTanks()
  newWind()
  state.value = 'aiming'
  draw()
}

// ---------- shop / utilities ----------
function buy(item) {
  if (money.value < item.cost) return
  money.value -= item.cost
  inv[item.key] = (inv[item.key] || 0) + 1
  haptics.light()
}
function aiAutoBuy() {
  // the CPU spends its winnings on a simple priority list between rounds
  const plan = [
    { key: 'shield', cost: 90, max: 2 },
    { key: 'nuke', cost: 120, max: 2 },
    { key: 'repair', cost: 70, max: 2 },
    { key: 'roller', cost: 100, max: 1 },
    { key: 'mirv', cost: 150, max: 1 },
    { key: 'parachute', cost: 40, max: 1 },
  ]
  let bought = true
  while (bought) {
    bought = false
    for (const it of plan) {
      if (aiMoney.value >= it.cost && (aiInv[it.key] || 0) < it.max) {
        aiMoney.value -= it.cost
        aiInv[it.key]++
        bought = true
      }
    }
  }
}
function useRepair() {
  if (inv.repair <= 0 || playerHp.value >= 100) return
  inv.repair--
  playerHp.value = Math.min(100, playerHp.value + 45)
  haptics.success()
  draw()
}
function useShield() {
  if (inv.shield <= 0) return
  inv.shield--
  playerShield.value += 50
  haptics.success()
  draw()
}
function moveTank(dir) {
  if (fuel.value <= 0 || state.value !== 'aiming') return
  player.x = Math.max(40, Math.min(ai.x - 70, player.x + dir * 16))
  player.y = groundAt(player.x)
  fuel.value--
  haptics.light()
  draw()
}
function bump(which, delta) {
  if (which === 'angle') angleDeg.value = Math.max(0, Math.min(180, angleDeg.value + delta))
  else power.value = Math.max(50, Math.min(1000, power.value + delta))
  draw()
}

// ---------- input (drag aim) ----------
function toLocal(e) {
  const r = canvasEl.value.getBoundingClientRect()
  return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H }
}
function onDown(e) {
  if (state.value !== 'aiming') return
  aimDragging = true
  updateAim(e)
}
function onMove(e) {
  if (!aimDragging) return
  e.preventDefault()
  updateAim(e)
}
function updateAim(e) {
  const p = toLocal(e)
  const dx = p.x - player.x
  const dy = p.y - (player.y - 16)
  let ang = (Math.atan2(-dy, dx) * 180) / Math.PI
  ang = Math.max(1, Math.min(179, ang))
  angleDeg.value = Math.round(ang)
  power.value = Math.round(Math.max(50, Math.min(1000, (Math.hypot(dx, dy) / 380) * 1000)))
  draw()
}
function onUp() {
  aimDragging = false
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
  newMatch()
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
  max-width: 680px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  padding-top: max(52px, calc(env(safe-area-inset-top) + 12px));
}
.hud { flex: 1; display: flex; align-items: center; gap: 8px; color: #fff; }
.hp { flex: 1; display: flex; align-items: center; gap: 6px; min-width: 0; }
.tag { font-size: 0.68rem; font-weight: 700; white-space: nowrap; }
.tag small { opacity: 0.85; }
.tag.you { color: #90caf9; }
.tag.foe { color: #ef9a9a; }
.bar { flex: 1; height: 9px; border-radius: 6px; background: rgba(0, 0, 0, 0.3); overflow: hidden; }
.fill { height: 100%; transition: width 0.3s ease; }
.fill.you { background: linear-gradient(90deg, #42a5f5, #90caf9); }
.fill.foe { background: linear-gradient(90deg, #ef9a9a, #ef5350); }
.mid { text-align: center; color: #fff; }
.round { font-size: 0.7rem; font-weight: 700; white-space: nowrap; }
.wind { display: flex; align-items: center; gap: 3px; font-size: 0.72rem; justify-content: center; }
.header-menu { display: flex; gap: 2px; }

.board-wrap { width: 100%; display: flex; justify-content: center; padding: 4px 10px; }
.board { position: relative; width: min(96vw, 680px); }
.field { width: 100%; height: auto; display: block; border-radius: 10px; background: rgba(0, 0, 0, 0.12); touch-action: none; }
.turn-banner {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.78rem;
  color: #fff;
  background: rgba(0, 0, 0, 0.4);
  padding: 3px 12px;
  border-radius: 999px;
  white-space: nowrap;
}
.turn-banner.foe { color: #ef9a9a; }

.controls {
  width: 100%;
  max-width: 680px;
  padding: 6px 14px max(12px, env(safe-area-inset-bottom));
  color: #fff;
}
.weapons { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px; }
.wchip {
  flex: 0 0 auto;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  border-radius: 999px;
  padding: 5px 12px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 5px;
}
.wchip.sel { background: #f2b179; color: #2a2620; border-color: #f2b179; }
.wchip.out { opacity: 0.4; }
.wchip .ammo { font-size: 0.7rem; background: rgba(0, 0, 0, 0.25); border-radius: 8px; padding: 0 5px; }
.wchip.sel .ammo { background: rgba(0, 0, 0, 0.18); }
.dial { display: flex; align-items: center; gap: 6px; margin-top: 2px; }
.dlabel { width: 48px; font-size: 0.72rem; opacity: 0.85; }
.dial .col { flex: 1; }
.dval { width: 46px; text-align: right; font-variant-numeric: tabular-nums; font-weight: 700; font-size: 0.82rem; }
.actions { display: flex; gap: 6px; margin-top: 6px; align-items: stretch; }
.actions .fire { flex: 1; font-weight: 800; }
.fuelrow { font-size: 0.68rem; opacity: 0.7; text-align: center; margin-top: 4px; }

.shop-card {
  background: #2a2620;
  color: #fff;
  border-radius: 14px;
  min-width: 300px;
  :deep(*) { color: #fff; }
}
.shop-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.shop-item {
  background: rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.si-name { font-size: 0.8rem; }
.si-own { opacity: 0.7; }

.hint {
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.82rem;
  text-align: center;
  margin: 8px 24px max(16px, env(safe-area-inset-bottom));
}
:deep(.q-btn.bg-primary) { background: linear-gradient(135deg, #ef5350 0%, #42a5f5 100%) !important; }
</style>
