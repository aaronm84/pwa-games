<template>
  <q-page class="snake-page" :style="{ background: themeStore.colors.gradient }">
    <!-- Header -->
    <div class="game-header">
      <q-btn fab-mini flat icon="arrow_back" color="white" @click="goBack" />

      <div class="scores">
        <div class="score-box">
          <div class="score-label">Score</div>
          <div class="score-value">{{ score }}</div>
        </div>
        <div class="score-box">
          <div class="score-label">Best</div>
          <div class="score-value">{{ bestScore }}</div>
        </div>
      </div>

      <div class="header-menu">
        <q-btn
          v-if="state === 'running' || state === 'paused'"
          fab-mini
          flat
          :icon="state === 'paused' ? 'play_arrow' : 'pause'"
          color="white"
          @click="togglePause"
        />
        <q-btn fab-mini flat icon="refresh" color="white" @click="newGame" />
        <q-btn fab-mini flat icon="help_outline" color="white" @click="howToPlay" />
      </div>
    </div>

    <!-- Board -->
    <div class="board-wrap">
      <div
        ref="boardEl"
        class="board"
        :class="{ shake: dead }"
        :style="{ '--n': N }"
        @touchstart.passive="onTouchStart"
        @touchend="onTouchEnd"
      >
        <!-- snake -->
        <div
          v-for="(seg, i) in snake"
          :key="'s' + i"
          class="seg"
          :class="{ head: i === 0 }"
          :style="segStyle(seg, i)"
        ></div>

        <!-- food -->
        <div class="food" :style="cellStyle(food)"></div>

        <!-- bonus -->
        <div v-if="bonus" class="bonus" :style="cellStyle(bonus)">★</div>

        <!-- overlays -->
        <transition name="overlay-fade">
          <div v-if="state === 'idle'" class="board-overlay" @pointerdown="startFromTap">
            <div class="overlay-text">Snake</div>
            <div class="overlay-sub">Swipe or press an arrow key to start</div>
          </div>
        </transition>
        <transition name="overlay-fade">
          <div v-if="state === 'over'" class="board-overlay">
            <div class="overlay-text">Game over</div>
            <div class="overlay-sub">Score {{ score }}{{ score >= bestScore && score > 0 ? ' · new best!' : '' }}</div>
            <q-btn unelevated color="primary" text-color="white" label="Play Again" @click="newGame" />
          </div>
        </transition>
        <transition name="overlay-fade">
          <div v-if="state === 'paused'" class="board-overlay" @pointerdown="togglePause">
            <div class="overlay-text">Paused</div>
            <div class="overlay-sub">Tap to resume</div>
          </div>
        </transition>
      </div>
    </div>

    <p class="hint">{{ wrap ? 'Walls wrap around' : 'Avoid the walls and yourself' }} · eat ★ for bonus points</p>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useThemeStore } from 'src/stores/theme'
import { useSettingsStore } from 'src/stores/settings'
import { useProgressStore } from 'src/stores/progress'
import { useHaptics } from 'src/composables/useHaptics'

const N = 15
const START_DELAY = 170
const MIN_DELAY = 80
const DELAY_STEP = 5
const BONUS_EVERY = 5
const BONUS_MS = 6000

const router = useRouter()
const themeStore = useThemeStore()
const settingsStore = useSettingsStore()
const progressStore = useProgressStore()
const { snake: stats } = storeToRefs(progressStore)
const haptics = useHaptics()

const boardEl = ref(null)
const snake = ref([])
const food = ref({ r: 7, c: 7 })
const bonus = ref(null)
const score = ref(0)
const state = ref('idle') // idle | running | paused | over
const dead = ref(false)

let dir = { r: 0, c: 1 }
let queuedDir = null
let applesEaten = 0
let bonusExpire = 0
let timer = null

const wrap = computed(() => !!settingsStore.settings.snakeWrap)
const bestScore = computed(() => Math.max(stats.value.bestScore, score.value))

function cellStyle(cell) {
  return { '--r': cell.r, '--c': cell.c }
}
function segStyle(seg, i) {
  // fade the body slightly toward the tail
  const t = snake.value.length > 1 ? i / snake.value.length : 0
  return { '--r': seg.r, '--c': seg.c, opacity: 1 - t * 0.45 }
}

function randomEmptyCell() {
  const occupied = new Set(snake.value.map((s) => s.r * N + s.c))
  occupied.add(food.value.r * N + food.value.c)
  if (bonus.value) occupied.add(bonus.value.r * N + bonus.value.c)
  const free = []
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!occupied.has(r * N + c)) free.push({ r, c })
  if (!free.length) return null
  return free[Math.floor(Math.random() * free.length)]
}

function reset() {
  stopLoop()
  snake.value = [
    { r: 7, c: 5 },
    { r: 7, c: 4 },
    { r: 7, c: 3 },
  ]
  dir = { r: 0, c: 1 }
  queuedDir = null
  food.value = { r: 7, c: 10 }
  bonus.value = null
  bonusExpire = 0
  applesEaten = 0
  score.value = 0
  dead.value = false
  state.value = 'idle'
}

function delay() {
  return Math.max(MIN_DELAY, START_DELAY - applesEaten * DELAY_STEP)
}

function startLoop() {
  stopLoop()
  timer = setTimeout(tick, delay())
}
function stopLoop() {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
}

function setDirection(r, c) {
  // ignore reversal onto the immediate neck
  if (r === -dir.r && c === -dir.c) return
  queuedDir = { r, c }
  if (state.value === 'idle') {
    state.value = 'running'
    startLoop()
  }
}

function tick() {
  if (state.value !== 'running') return
  if (queuedDir) {
    dir = queuedDir
    queuedDir = null
  }

  let nr = snake.value[0].r + dir.r
  let nc = snake.value[0].c + dir.c

  if (wrap.value) {
    nr = (nr + N) % N
    nc = (nc + N) % N
  } else if (nr < 0 || nr >= N || nc < 0 || nc >= N) {
    return die()
  }

  const head = { r: nr, c: nc }
  const eating = food.value.r === nr && food.value.c === nc
  const eatingBonus = bonus.value && bonus.value.r === nr && bonus.value.c === nc

  // self-collision (the tail cell is free unless we're growing)
  const body = eating || eatingBonus ? snake.value : snake.value.slice(0, -1)
  if (body.some((s) => s.r === nr && s.c === nc)) return die()

  snake.value.unshift(head)

  if (eating) {
    applesEaten++
    score.value += 10
    haptics.light()
    food.value = randomEmptyCell() || food.value
    if (applesEaten % BONUS_EVERY === 0) {
      bonus.value = randomEmptyCell()
      bonusExpire = Date.now() + BONUS_MS
    }
  } else if (eatingBonus) {
    score.value += 50
    haptics.medium()
    bonus.value = null
  } else {
    snake.value.pop()
  }

  if (bonus.value && Date.now() > bonusExpire) bonus.value = null

  startLoop()
}

function die() {
  stopLoop()
  dead.value = true
  state.value = 'over'
  haptics.error?.() || haptics.heavy()
  progressStore.recordSnakeGame(score.value)
}

function newGame() {
  haptics.light()
  reset()
}

function togglePause() {
  if (state.value === 'running') {
    state.value = 'paused'
    stopLoop()
  } else if (state.value === 'paused') {
    state.value = 'running'
    startLoop()
  }
}

function startFromTap() {
  // tapping the idle overlay starts moving in the current (rightward) direction
  if (state.value === 'idle') {
    state.value = 'running'
    startLoop()
  }
}

function goBack() {
  haptics.light()
  router.back()
}
function howToPlay() {
  haptics.light()
  router.push({ name: 'how-to-play' })
}

// keyboard
const KEYS = {
  ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1],
  w: [-1, 0], s: [1, 0], a: [0, -1], d: [0, 1],
}
function onKeyDown(e) {
  const k = KEYS[e.key]
  if (!k) return
  e.preventDefault()
  if (state.value === 'over') return
  setDirection(k[0], k[1])
}

// touch swipe
let tsx = 0
let tsy = 0
function onTouchStart(e) {
  const t = e.touches[0]
  tsx = t.clientX
  tsy = t.clientY
}
function onTouchEnd(e) {
  const t = e.changedTouches[0]
  const dx = t.clientX - tsx
  const dy = t.clientY - tsy
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return
  if (state.value === 'over') return
  if (Math.abs(dx) > Math.abs(dy)) setDirection(0, dx > 0 ? 1 : -1)
  else setDirection(dy > 0 ? 1 : -1, 0)
}

function onVisibility() {
  if (document.hidden && state.value === 'running') togglePause()
}

onMounted(() => {
  reset()
  window.addEventListener('keydown', onKeyDown)
  document.addEventListener('visibilitychange', onVisibility)
})
onBeforeUnmount(() => {
  stopLoop()
  window.removeEventListener('keydown', onKeyDown)
  document.removeEventListener('visibilitychange', onVisibility)
})
</script>

<style lang="scss" scoped>
.snake-page {
  min-height: 100vh;
  transition: background 2s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow: hidden;
}
.game-header {
  width: 100%;
  max-width: 520px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  padding-top: max(56px, calc(env(safe-area-inset-top) + 16px));
}
.scores {
  flex: 1;
  display: flex;
  justify-content: center;
  gap: 12px;
}
.score-box {
  min-width: 84px;
  padding: 8px 14px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.22);
  backdrop-filter: blur(8px);
  text-align: center;
  color: #fff;
}
.score-label {
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.75;
}
.score-value {
  font-size: 1.35rem;
  font-weight: 700;
  line-height: 1.2;
}
.header-menu {
  display: flex;
  gap: 4px;
}

.board-wrap {
  width: 100%;
  display: flex;
  justify-content: center;
  padding: 8px 16px;
}
.board {
  position: relative;
  width: min(92vw, 64vh, 460px);
  aspect-ratio: 1;
  border-radius: 14px;
  background: rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(6px);
  touch-action: none;
  overflow: hidden;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px);
  background-size: calc(100% / 15) calc(100% / 15);
}
.board.shake {
  animation: shake 0.4s;
}
@keyframes shake {
  0%, 100% { transform: translate(0, 0); }
  20% { transform: translate(-6px, 4px); }
  40% { transform: translate(6px, -3px); }
  60% { transform: translate(-4px, -4px); }
  80% { transform: translate(4px, 3px); }
}

.seg,
.food,
.bonus {
  position: absolute;
  width: calc(100% / var(--n));
  height: calc(100% / var(--n));
  left: calc(var(--c) * 100% / var(--n));
  top: calc(var(--r) * 100% / var(--n));
}
.seg {
  padding: 1.5px;
  background-clip: content-box;
  border-radius: 6px;
  background-color: #66bb6a;
  transition: opacity 0.1s linear;
}
.seg::after {
  content: '';
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 5px;
  background: #66bb6a;
}
.seg.head::after {
  background: #b9f6ca;
  box-shadow: 0 0 8px rgba(185, 246, 202, 0.7);
}
.food::after,
.bonus {
  content: '';
}
.food::after {
  content: '';
  position: absolute;
  inset: 18%;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #ff8a80, #e53935);
  box-shadow: 0 0 8px rgba(229, 57, 53, 0.6);
}
.bonus {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff59d;
  font-size: clamp(0.9rem, 4.5vw, 1.7rem);
  text-shadow: 0 0 10px rgba(255, 235, 59, 0.9);
  animation: pulse 0.8s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.25); }
}

.board-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(3px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  z-index: 5;
  text-align: center;
  padding: 16px;
}
.overlay-text {
  font-size: 2rem;
  font-weight: 800;
  color: #fff;
}
.overlay-sub {
  color: rgba(255, 255, 255, 0.85);
  margin-top: -6px;
}
.overlay-fade-enter-active {
  transition: opacity 0.3s ease;
}
.overlay-fade-enter-from {
  opacity: 0;
}

.hint {
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.85rem;
  text-align: center;
  margin: 12px 24px max(16px, env(safe-area-inset-bottom));
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

:deep(.q-btn.bg-primary) {
  background: linear-gradient(135deg, #66bb6a 0%, #43a047 100%) !important;
}
</style>
