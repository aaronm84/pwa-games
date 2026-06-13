import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useGameStorage } from 'src/composables/useGameStorage'

export const useProgressStore = defineStore('progress', () => {
  const storage = useGameStorage()

  // Fling progress
  const fling = ref({
    highestLevel: 1,
    bestScore: 0,
    gamesPlayed: 0,
  })

  function recordFling(level, score, won) {
    if (level > fling.value.highestLevel) fling.value.highestLevel = level
    if (score > fling.value.bestScore) fling.value.bestScore = score
    if (!won) fling.value.gamesPlayed++
    saveToStorage()
  }

  async function saveToStorage() {
    try {
      await storage.saveProgress({ fling: fling.value })
    } catch (error) {
      console.error('[Progress Store] Failed to save progress:', error)
      throw error
    }
  }

  async function loadFromStorage() {
    try {
      const progressData = await storage.loadProgress()
      if (progressData && progressData.fling) {
        fling.value = { ...fling.value, ...progressData.fling }
        console.log('Progress loaded successfully')
      } else {
        console.log('No saved progress found, using defaults')
      }
    } catch (error) {
      console.error('Failed to load progress:', error)
    }
  }

  async function resetFlingProgress() {
    fling.value = { highestLevel: 1, bestScore: 0, gamesPlayed: 0 }
    await saveToStorage()
  }

  return {
    fling,
    recordFling,
    resetFlingProgress,

    // Common
    saveToStorage,
    loadFromStorage,
  }
})
