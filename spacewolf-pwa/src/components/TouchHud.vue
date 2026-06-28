<template>
  <div class="touch-hud" :class="{ 'is-portrait': isPortrait }">
    <!-- Left side: roll-left above, steer-left below -->
    <div class="side">
      <button
        class="hud-btn roll roll-left"
        @pointerdown.prevent="onRoll(-1)"
        aria-label="Barrel roll left"
      >
        <span class="roll-icon">↺</span>
        <span class="roll-label">Roll</span>
      </button>
      <button
        class="hud-btn steer left"
        :class="{ pressed: pressed.steerLeft }"
        @pointerdown.prevent="onDown('steerLeft', $event)"
        @pointerup.prevent="onUp('steerLeft', $event)"
        @pointercancel.prevent="onUp('steerLeft', $event)"
        @pointerleave.prevent="onUp('steerLeft', $event)"
        aria-label="Steer left"
      >
        <span class="arrow">‹</span>
      </button>
    </div>

    <!-- Center action row: Fire | Cycle | Special | Turbo | Fire.
         Two Fire buttons so either thumb can reach without crossing.
         Both buttons feed the same fire input via ref-counted sources. -->
    <div class="actions">
      <button
        class="hud-btn action fire"
        :class="{ pressed: fireSrc.left }"
        @pointerdown.prevent="onFireDown('left', $event)"
        @pointerup.prevent="onFireUp('left', $event)"
        @pointercancel.prevent="onFireUp('left', $event)"
        @pointerleave.prevent="onFireUp('left', $event)"
        aria-label="Fire main cannon (left)"
      >
        <span class="label">Fire</span>
      </button>

      <button
        class="hud-btn action cycle"
        @pointerdown.prevent="onPulse('cycleSpecial')"
        aria-label="Cycle special weapon"
      >
        <span class="label">Cycle</span>
      </button>

      <button
        class="hud-btn action special"
        @pointerdown.prevent="onPulse('special')"
        aria-label="Fire special weapon"
      >
        <span class="label">Special</span>
        <span class="sub">{{ activeSpecial }}</span>
      </button>

      <button
        class="hud-btn action turbo"
        @pointerdown.prevent="onPulse('turbo')"
        aria-label="Turbo boost"
      >
        <span class="label">Turbo</span>
      </button>

      <button
        class="hud-btn action fire"
        :class="{ pressed: fireSrc.right }"
        @pointerdown.prevent="onFireDown('right', $event)"
        @pointerup.prevent="onFireUp('right', $event)"
        @pointercancel.prevent="onFireUp('right', $event)"
        @pointerleave.prevent="onFireUp('right', $event)"
        aria-label="Fire main cannon (right)"
      >
        <span class="label">Fire</span>
      </button>
    </div>

    <!-- Right side: roll-right above, steer-right below -->
    <div class="side">
      <button
        class="hud-btn roll roll-right"
        @pointerdown.prevent="onRoll(1)"
        aria-label="Barrel roll right"
      >
        <span class="roll-icon">↻</span>
        <span class="roll-label">Roll</span>
      </button>
      <button
        class="hud-btn steer right"
        :class="{ pressed: pressed.steerRight }"
        @pointerdown.prevent="onDown('steerRight', $event)"
        @pointerup.prevent="onUp('steerRight', $event)"
        @pointercancel.prevent="onUp('steerRight', $event)"
        @pointerleave.prevent="onUp('steerRight', $event)"
        aria-label="Steer right"
      >
        <span class="arrow">›</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { reactive, onMounted, onBeforeUnmount, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useInputStore } from 'src/stores/input'
import { useHaptics } from 'src/composables/useHaptics'

const inputStore = useInputStore()
const { activeSpecial } = storeToRefs(inputStore)
const haptics = useHaptics()

const pressed = reactive({
  steerLeft: false,
  steerRight: false,
})

// Each independent fire source tracks its own down state. The held flag
// stays true as long as ANY source is down — so releasing the left Fire
// button while the right is still held doesn't stop firing, and the
// keyboard Space behaves like a third source.
const fireSrc = reactive({
  left: false,
  right: false,
  key: false,
})
function setFireSrc(name, down) {
  fireSrc[name] = down
  inputStore.setHeld('fire', fireSrc.left || fireSrc.right || fireSrc.key)
}

const isPortrait = ref(false)
function recalcOrientation() {
  isPortrait.value = window.innerHeight > window.innerWidth
}

function onDown(key, ev) {
  if (ev?.target?.setPointerCapture && ev.pointerId != null) {
    try {
      ev.target.setPointerCapture(ev.pointerId)
    } catch {
      // setPointerCapture can throw on detached targets; safe to ignore
    }
  }
  pressed[key] = true
  inputStore.setHeld(key, true)
  haptics.light()
}

function onUp(key, ev) {
  if (!pressed[key]) return
  if (ev?.target?.releasePointerCapture && ev.pointerId != null) {
    try {
      ev.target.releasePointerCapture(ev.pointerId)
    } catch {
      // releasePointerCapture can throw if capture was already released
    }
  }
  pressed[key] = false
  inputStore.setHeld(key, false)
}

function onFireDown(side, ev) {
  if (ev?.target?.setPointerCapture && ev.pointerId != null) {
    try {
      ev.target.setPointerCapture(ev.pointerId)
    } catch {
      // ignore
    }
  }
  if (fireSrc[side]) return
  setFireSrc(side, true)
  haptics.light()
}

function onFireUp(side, ev) {
  if (!fireSrc[side]) return
  if (ev?.target?.releasePointerCapture && ev.pointerId != null) {
    try {
      ev.target.releasePointerCapture(ev.pointerId)
    } catch {
      // ignore
    }
  }
  setFireSrc(side, false)
}

function onPulse(key) {
  inputStore.pulse(key)
  haptics.medium()
}

function onRoll(dir) {
  inputStore.pulseBarrelRoll(dir)
  haptics.medium()
}

// Keyboard fallback for desktop testing
const keyMap = {
  ArrowLeft: 'steerLeft',
  KeyA: 'steerLeft',
  ArrowRight: 'steerRight',
  KeyD: 'steerRight',
}
const pulseKeyMap = {
  KeyJ: 'special',
  KeyK: 'cycleSpecial',
  KeyU: 'turbo',
}
const rollKeyMap = {
  KeyQ: -1,
  KeyE: 1,
}

function onKeyDown(e) {
  if (e.repeat) return
  if (e.code === 'Space') {
    setFireSrc('key', true)
    e.preventDefault()
    return
  }
  const held = keyMap[e.code]
  if (held) {
    pressed[held] = true
    inputStore.setHeld(held, true)
    e.preventDefault()
    return
  }
  const pulse = pulseKeyMap[e.code]
  if (pulse) {
    inputStore.pulse(pulse)
    e.preventDefault()
    return
  }
  const rollDir = rollKeyMap[e.code]
  if (rollDir) {
    inputStore.pulseBarrelRoll(rollDir)
    e.preventDefault()
  }
}
function onKeyUp(e) {
  if (e.code === 'Space') {
    setFireSrc('key', false)
    return
  }
  const held = keyMap[e.code]
  if (held) {
    pressed[held] = false
    inputStore.setHeld(held, false)
  }
}

onMounted(() => {
  recalcOrientation()
  window.addEventListener('resize', recalcOrientation)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', recalcOrientation)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  // Clear any held inputs on unmount
  inputStore.setHeld('steerLeft', false)
  inputStore.setHeld('steerRight', false)
  inputStore.setHeld('fire', false)
})
</script>

<style lang="scss" scoped>
.touch-hud {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 5;
  // 3-column grid: side stacks anchor the edges, actions fill the middle.
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: stretch;
  gap: 14px;
  padding: 18px;
  padding-bottom: max(18px, env(safe-area-inset-bottom));
  padding-left: max(18px, env(safe-area-inset-left));
  padding-right: max(18px, env(safe-area-inset-right));
  pointer-events: none;

  background: linear-gradient(to top, rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0));
}

.hud-btn {
  pointer-events: auto;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  border: 1px solid rgba(255, 255, 255, 0.28);
  background: rgba(20, 30, 60, 0.55);
  backdrop-filter: blur(6px);
  color: white;
  border-radius: 16px;
  font-family: 'Quicksand', sans-serif;
  font-weight: 600;
  padding: 12px 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 2px;
  transition:
    background 0.08s ease,
    transform 0.08s ease,
    border-color 0.08s ease;
  cursor: pointer;
  outline: none;
}

.hud-btn:active,
.hud-btn.pressed {
  background: rgba(80, 140, 255, 0.6);
  border-color: rgba(180, 210, 255, 0.9);
  transform: translateY(1px);
}

.side {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: stretch;
  width: 112px;
}

.roll {
  flex: 0 0 auto;
  min-height: 76px;
  padding: 10px;
  background: rgba(80, 50, 120, 0.55);
  border-color: rgba(200, 170, 240, 0.55);
}

.roll:active {
  background: rgba(140, 90, 220, 0.85);
}

.roll-icon {
  font-size: 32px;
  line-height: 1;
  font-weight: 700;
}

.roll-label {
  font-size: 0.85rem;
  opacity: 0.85;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  margin-top: 3px;
}

.steer {
  flex: 1 1 auto;
  font-size: 36px;
  min-height: 92px;
}

.steer .arrow {
  line-height: 1;
  font-size: 58px;
  font-weight: 700;
}

.actions {
  min-width: 0;
  display: flex;
  gap: 10px;
  align-items: stretch;
  justify-content: center;
}

.action {
  min-width: 0;
  flex: 0 1 auto;
  padding: 11px 14px;
  font-size: 1.1rem;
}

.action .label {
  font-size: 1.1rem;
  line-height: 1;
  font-weight: 700;
}

.action .sub {
  font-size: 0.85rem;
  opacity: 0.7;
  margin-top: 3px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.fire {
  background: rgba(220, 60, 60, 0.65);
  border-color: rgba(255, 180, 180, 0.65);
  box-shadow: 0 0 12px rgba(255, 80, 80, 0.3);
}
.fire:active,
.fire.pressed {
  background: rgba(255, 80, 80, 0.9);
  box-shadow: 0 0 16px rgba(255, 100, 100, 0.55);
}

.turbo {
  background: rgba(255, 180, 0, 0.45);
  border-color: rgba(255, 220, 120, 0.7);
  color: #1a1200;
}
.turbo:active {
  background: rgba(255, 210, 60, 0.85);
}

// Phone landscape — keep all controls big enough to slap, scale slightly
// down from the iPad/desktop defaults but still meaningfully bigger
// than the previous layout.
@media (max-width: 820px) {
  .touch-hud {
    gap: 10px;
    padding: 14px;
  }
  .side {
    width: 92px;
    gap: 6px;
  }
  .roll {
    min-height: 64px;
  }
  .steer {
    min-height: 82px;
  }
  .steer .arrow {
    font-size: 50px;
  }
  .roll-icon {
    font-size: 26px;
  }
  .roll-label {
    font-size: 0.72rem;
  }
  .action {
    padding: 9px 12px;
  }
  .actions {
    gap: 8px;
  }
  .action .label {
    font-size: 0.98rem;
  }
  .action .sub {
    font-size: 0.7rem;
  }
}

@media (max-width: 600px) {
  .touch-hud {
    gap: 8px;
    padding: 10px;
  }
  .side {
    width: 76px;
    gap: 5px;
  }
  .roll {
    min-height: 56px;
    padding: 7px 8px;
  }
  .steer {
    min-height: 72px;
  }
  .steer .arrow {
    font-size: 42px;
  }
  .roll-icon {
    font-size: 22px;
  }
  .roll-label {
    font-size: 0.62rem;
  }
  .action {
    padding: 8px 9px;
  }
  .actions {
    gap: 6px;
  }
  .action .label {
    font-size: 0.85rem;
  }
  .action .sub {
    font-size: 0.6rem;
  }
}

@media (max-width: 480px) {
  .side {
    width: 64px;
    gap: 4px;
  }
  .roll {
    min-height: 48px;
    padding: 5px 6px;
  }
  .steer {
    min-height: 64px;
  }
  .steer .arrow {
    font-size: 38px;
  }
  .roll-icon {
    font-size: 20px;
  }
  .roll-label {
    display: none;
  }
  .actions {
    gap: 4px;
  }
  .action {
    padding: 7px 7px;
  }
  .action .label {
    font-size: 0.78rem;
  }
  .action .sub {
    display: none;
  }
}

.touch-hud.is-portrait .actions {
  gap: 6px;
}
</style>
