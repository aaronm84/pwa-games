import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useGameStorage } from 'src/composables/useGameStorage'

const START_CREDITS = 5000
const JACKPOT_SEED = 5000

export const useProgressStore = defineStore('progress', () => {
  const storage = useGameStorage()

  // Casino-wide persistent state, shared across every machine
  const casino = ref({
    credits: START_CREDITS,
    jackpot: JACKPOT_SEED,
    bestWin: 0,
    spins: 0,
    lastDaily: 0, // epoch day-number of the last claimed daily bonus
  })

  function save() {
    storage.saveProgress({ casino: casino.value }).catch((e) => console.error('[Slots] save failed', e))
  }

  async function loadFromStorage() {
    try {
      const data = await storage.loadProgress()
      if (data && data.casino) casino.value = { ...casino.value, ...data.casino }
    } catch (e) {
      console.error('Failed to load progress:', e)
    }
  }

  function setCredits(v) {
    casino.value.credits = Math.max(0, Math.round(v))
    save()
  }
  function addCredits(v) {
    setCredits(casino.value.credits + v)
  }
  function setJackpot(v) {
    casino.value.jackpot = Math.round(v)
    save()
  }
  function recordSpin(win) {
    casino.value.spins++
    if (win > casino.value.bestWin) casino.value.bestWin = win
    save()
  }
  function resetCasino() {
    casino.value = { credits: START_CREDITS, jackpot: JACKPOT_SEED, bestWin: 0, spins: 0, lastDaily: 0 }
    save()
  }

  return {
    casino,
    START_CREDITS,
    JACKPOT_SEED,
    setCredits,
    addCredits,
    setJackpot,
    recordSpin,
    resetCasino,
    save,
    loadFromStorage,
  }
})
