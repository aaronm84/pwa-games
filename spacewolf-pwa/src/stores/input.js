import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'

/**
 * Shared input state — Touch HUD writes, Babylon update loop reads each frame.
 *
 * Held flags (steerLeft, steerRight, fire) reflect button-down state.
 * Edge events (cycleSpecial, turbo, special) are one-shot pulses that the
 * game loop consumes via `consume*` helpers so a single tap triggers a
 * single action regardless of frame rate.
 *
 * barrelRoll carries a direction (-1 left / +1 right / 0 none) so the
 * roll-left and roll-right buttons can both feed the same channel.
 */
export const useInputStore = defineStore('input', () => {
  const held = reactive({
    steerLeft: false,
    steerRight: false,
    fire: false,
  })

  const pending = reactive({
    special: false,
    cycleSpecial: false,
    turbo: false,
  })

  // Roll direction: -1 = left, +1 = right, 0 = none
  const pendingRollDir = ref(0)

  const activeSpecial = ref('bombs')

  function setHeld(key, value) {
    if (key in held) held[key] = value
  }

  function pulse(key) {
    if (key in pending) pending[key] = true
  }

  function pulseBarrelRoll(dir) {
    if (dir !== -1 && dir !== 1) return
    pendingRollDir.value = dir
  }

  function consumeSpecial() {
    const v = pending.special
    pending.special = false
    return v
  }
  function consumeCycleSpecial() {
    const v = pending.cycleSpecial
    pending.cycleSpecial = false
    return v
  }
  function consumeBarrelRoll() {
    const v = pendingRollDir.value
    pendingRollDir.value = 0
    return v
  }
  function consumeTurbo() {
    const v = pending.turbo
    pending.turbo = false
    return v
  }

  return {
    held,
    pending,
    activeSpecial,
    setHeld,
    pulse,
    pulseBarrelRoll,
    consumeSpecial,
    consumeCycleSpecial,
    consumeBarrelRoll,
    consumeTurbo,
  }
})
