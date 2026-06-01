import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useGameStorage } from 'src/composables/useGameStorage'

export const useProgressStore = defineStore('progress', () => {
  const storage = useGameStorage()

  // Dots progress
  const dots = ref({
    bestScore: 0,
    gamesPlayed: 0,
  })

  function recordDotsGame(score) {
    dots.value.gamesPlayed++
    if (score > dots.value.bestScore) dots.value.bestScore = score
    saveToStorage()
  }

  async function saveToStorage() {
    try {
      await storage.saveProgress({ dots: dots.value })
    } catch (error) {
      console.error('[Progress Store] Failed to save progress:', error)
      throw error
    }
  }

  async function loadFromStorage() {
    try {
      const progressData = await storage.loadProgress()
      if (progressData && progressData.dots) {
        dots.value = { ...dots.value, ...progressData.dots }
        console.log('Progress loaded successfully')
      } else {
        console.log('No saved progress found, using defaults')
      }
    } catch (error) {
      console.error('Failed to load progress:', error)
    }
  }

  async function resetDotsProgress() {
    dots.value = { bestScore: 0, gamesPlayed: 0 }
    await saveToStorage()
  }

  return {
    dots,
    recordDotsGame,
    resetDotsProgress,

    // Common
    saveToStorage,
    loadFromStorage,
  }
})
