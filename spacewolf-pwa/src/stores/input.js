import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'

/**
 * Shared input state — Touch HUD writes, Babylon update loop reads each frame.
 *
 * Held flags (steerLeft, steerRight, fire) reflect button-down state.
 * Edge events (cycleSpecial, barrelRoll, turbo, special) are one-shot pulses
 * that the game loop consumes via `consume*` helpers so a single tap
 * triggers a single action regardless of frame rate.
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
    barrelRoll: false,
    turbo: false,
  })

  const activeSpecial = ref('bombs')

  function setHeld(key, value) {
    if (key in held) held[key] = value
  }

  function pulse(key) {
    if (key in pending) pending[key] = true
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
    const v = pending.barrelRoll
    pending.barrelRoll = false
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
    consumeSpecial,
    consumeCycleSpecial,
    consumeBarrelRoll,
    consumeTurbo,
  }
})
