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

    <!-- Center action cluster -->
    <div class="actions">
      <button
        class="hud-btn action fire"
        :class="{ pressed: pressed.fire }"
        @pointerdown.prevent="onDown('fire', $event)"
        @pointerup.prevent="onUp('fire', $event)"
        @pointercancel.prevent="onUp('fire', $event)"
        @pointerleave.prevent="onUp('fire', $event)"
        aria-label="Fire main cannon"
      >
        <span class="label">Fire</span>
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
        class="hud-btn action cycle"
        @pointerdown.prevent="onPulse('cycleSpecial')"
        aria-label="Cycle special weapon"
      >
        <span class="label">Cycle</span>
      </button>

      <button
        class="hud-btn action turbo"
        @pointerdown.prevent="onPulse('turbo')"
        aria-label="Turbo boost"
      >
        <span class="label">Turbo</span>
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
import { reactive, computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useInputStore } from 'src/stores/input'
import { useHaptics } from 'src/composables/useHaptics'

const inputStore = useInputStore()
const { activeSpecial } = storeToRefs(inputStore)
const haptics = useHaptics()

const pressed = reactive({
  steerLeft: false,
  steerRight: false,
  fire: false,
})

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
  Space: 'fire',
}
const pulseKeyMap = {
  KeyJ: 'special',
  KeyK: 'cycleSpecial',
  KeyU: 'turbo',
}
// Roll keys: Q = left, E = right
const rollKeyMap = {
  KeyQ: -1,
  KeyE: 1,
}

function onKeyDown(e) {
  if (e.repeat) return
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
  // Grid keeps the steer arrows in fixed-size columns at the edges so the
  // centre action cluster can never push them off-screen.
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: stretch;
  gap: 12px;
  padding: 14px;
  padding-bottom: max(14px, env(safe-area-inset-bottom));
  padding-left: max(14px, env(safe-area-inset-left));
  padding-right: max(14px, env(safe-area-inset-right));
  pointer-events: none;

  // Subtle gradient backdrop so buttons read against bright space
  background: linear-gradient(to top, rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0));
}

.hud-btn {
  pointer-events: auto;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  border: 1px solid rgba(255, 255, 255, 0.28);
  background: rgba(20, 30, 60, 0.55);
  backdrop-filter: blur(6px);
  color: white;
  border-radius: 14px;
  font-family: 'Quicksand', sans-serif;
  font-weight: 600;
  padding: 10px 14px;
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
  gap: 6px;
  align-items: stretch;
  width: 84px;
}

.roll {
  // Smaller secondary button above the steer arrow
  flex: 0 0 auto;
  padding: 6px 8px;
  background: rgba(80, 50, 120, 0.5);
  border-color: rgba(200, 170, 240, 0.5);
}

.roll:active {
  background: rgba(140, 90, 220, 0.8);
}

.roll-icon {
  font-size: 20px;
  line-height: 1;
  font-weight: 700;
}

.roll-label {
  font-size: 0.65rem;
  opacity: 0.85;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.steer {
  // Steer is the dominant target — fills the rest of the side column.
  flex: 1 1 auto;
  font-size: 36px;
  // Min-height ensures a comfortable touch target even when content is short.
  min-height: 64px;
}

.steer .arrow {
  line-height: 1;
  font-size: 44px;
  font-weight: 700;
}

.actions {
  // Centre column: take whatever space the grid gives it, never overflow it.
  min-width: 0;
  display: flex;
  gap: 8px;
  justify-content: center;
  align-items: stretch;
  overflow: hidden;
}

.action {
  min-width: 0;
  flex: 0 1 auto;
  padding: 8px 10px;
  font-size: 0.85rem;
}

.action .label {
  font-size: 0.85rem;
  line-height: 1;
}

.action .sub {
  font-size: 0.65rem;
  opacity: 0.7;
  margin-top: 2px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.fire {
  background: rgba(220, 60, 60, 0.55);
  border-color: rgba(255, 180, 180, 0.6);
}
.fire:active,
.fire.pressed {
  background: rgba(255, 80, 80, 0.85);
}

.turbo {
  background: rgba(255, 180, 0, 0.45);
  border-color: rgba(255, 220, 120, 0.7);
  color: #1a1200;
}
.turbo:active {
  background: rgba(255, 210, 60, 0.85);
}

// Tighter layout on small phones / portrait
@media (max-width: 700px) {
  .touch-hud {
    gap: 8px;
    padding: 10px;
  }
  .side {
    width: 64px;
    gap: 5px;
  }
  .steer .arrow {
    font-size: 36px;
  }
  .roll-icon {
    font-size: 18px;
  }
  .roll-label {
    font-size: 0.6rem;
  }
  .action {
    padding: 6px 8px;
  }
  .actions {
    gap: 6px;
  }
  .action .label {
    font-size: 0.75rem;
  }
  .action .sub {
    font-size: 0.58rem;
  }
}

@media (max-width: 480px) {
  .side {
    width: 56px;
    gap: 4px;
  }
  .steer .arrow {
    font-size: 32px;
  }
  .roll {
    padding: 4px 6px;
  }
  .roll-icon {
    font-size: 16px;
  }
  .roll-label {
    display: none;
  }
  .actions {
    gap: 4px;
  }
  .action {
    padding: 6px 6px;
  }
  .action .label {
    font-size: 0.7rem;
  }
  // Hide the sub-label on very small screens — actions get too cramped
  .action .sub {
    display: none;
  }
}

.touch-hud.is-portrait .actions {
  gap: 4px;
}
</style>
