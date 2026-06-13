import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useGameStorage } from 'src/composables/useGameStorage'

export const useProgressStore = defineStore('progress', () => {
  const storage = useGameStorage()

  // Marbles progress
  const marbles = ref({
    highestLevel: 1,
    bestScore: 0,
    gamesPlayed: 0,
  })

  function recordMarbles(level, score, won) {
    if (level > marbles.value.highestLevel) marbles.value.highestLevel = level
    if (score > marbles.value.bestScore) marbles.value.bestScore = score
    if (!won) marbles.value.gamesPlayed++
    saveToStorage()
  }

  async function saveToStorage() {
    try {
      await storage.saveProgress({ marbles: marbles.value })
    } catch (error) {
      console.error('[Progress Store] Failed to save progress:', error)
      throw error
    }
  }

  async function loadFromStorage() {
    try {
      const progressData = await storage.loadProgress()
      if (progressData && progressData.marbles) {
        marbles.value = { ...marbles.value, ...progressData.marbles }
        console.log('Progress loaded successfully')
      } else {
        console.log('No saved progress found, using defaults')
      }
    } catch (error) {
      console.error('Failed to load progress:', error)
    }
  }

  async function resetMarblesProgress() {
    marbles.value = { highestLevel: 1, bestScore: 0, gamesPlayed: 0 }
    await saveToStorage()
  }

  return {
    marbles,
    recordMarbles,
    resetMarblesProgress,

    // Common
    saveToStorage,
    loadFromStorage,
  }
})
