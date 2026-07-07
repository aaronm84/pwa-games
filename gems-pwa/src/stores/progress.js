import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useGameStorage } from 'src/composables/useGameStorage'

export const useProgressStore = defineStore('progress', () => {
  const storage = useGameStorage()

  // Gems progress — per-mode bests
  const gems = ref({
    gamesPlayed: 0,
    bestScore: 0, // overall best score (legacy / max across score modes)
    zenBest: 0,
    blitzBest: 0,
    challengeLevel: 0, // highest challenge level reached
  })

  // record a finished run; payload = { score, level }
  function recordGems(mode, { score = 0, level = 0 } = {}) {
    gems.value.gamesPlayed++
    if (mode === 'zen') gems.value.zenBest = Math.max(gems.value.zenBest, score)
    else if (mode === 'blitz') gems.value.blitzBest = Math.max(gems.value.blitzBest, score)
    else if (mode === 'challenge') gems.value.challengeLevel = Math.max(gems.value.challengeLevel, level)
    gems.value.bestScore = Math.max(gems.value.bestScore, score)
    saveToStorage()
  }

  async function saveToStorage() {
    try {
      await storage.saveProgress({ gems: gems.value })
    } catch (error) {
      console.error('[Progress Store] Failed to save progress:', error)
      throw error
    }
  }

  async function loadFromStorage() {
    try {
      const progressData = await storage.loadProgress()
      if (progressData && progressData.gems) {
        gems.value = { ...gems.value, ...progressData.gems }
        console.log('Progress loaded successfully')
      } else {
        console.log('No saved progress found, using defaults')
      }
    } catch (error) {
      console.error('Failed to load progress:', error)
    }
  }

  async function resetGemsProgress() {
    gems.value = { gamesPlayed: 0, bestScore: 0, zenBest: 0, blitzBest: 0, challengeLevel: 0 }
    await saveToStorage()
  }

  return {
    gems,
    recordGems,
    resetGemsProgress,

    // Common
    saveToStorage,
    loadFromStorage,
  }
})
