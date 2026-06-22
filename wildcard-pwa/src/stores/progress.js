import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useGameStorage } from 'src/composables/useGameStorage'

export const useProgressStore = defineStore('progress', () => {
  const storage = useGameStorage()

  // Wildcard progress
  const wildcard = ref({
    bestAnte: 0,
    bestScore: 0,
    runsWon: 0,
    runsPlayed: 0,
  })

  // ante = furthest ante reached this run, score = total chips banked, won = cleared ante 8
  function recordWildcard(ante, score, won) {
    if (ante > wildcard.value.bestAnte) wildcard.value.bestAnte = ante
    if (score > wildcard.value.bestScore) wildcard.value.bestScore = score
    wildcard.value.runsPlayed++
    if (won) wildcard.value.runsWon++
    saveToStorage()
  }

  async function saveToStorage() {
    try {
      await storage.saveProgress({ wildcard: wildcard.value })
    } catch (error) {
      console.error('[Progress Store] Failed to save progress:', error)
      throw error
    }
  }

  async function loadFromStorage() {
    try {
      const progressData = await storage.loadProgress()
      if (progressData && progressData.wildcard) {
        wildcard.value = { ...wildcard.value, ...progressData.wildcard }
        console.log('Progress loaded successfully')
      } else {
        console.log('No saved progress found, using defaults')
      }
    } catch (error) {
      console.error('Failed to load progress:', error)
    }
  }

  async function resetWildcardProgress() {
    wildcard.value = { bestAnte: 0, bestScore: 0, runsWon: 0, runsPlayed: 0 }
    await saveToStorage()
  }

  return {
    wildcard,
    recordWildcard,
    resetWildcardProgress,

    // Common
    saveToStorage,
    loadFromStorage,
  }
})
