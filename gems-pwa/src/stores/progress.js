import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useGameStorage } from 'src/composables/useGameStorage'

export const useProgressStore = defineStore('progress', () => {
  const storage = useGameStorage()

  // Gems progress
  const gems = ref({
    bestScore: 0,
    gamesPlayed: 0,
  })

  function recordGemsGame(score) {
    gems.value.gamesPlayed++
    if (score > gems.value.bestScore) gems.value.bestScore = score
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
    gems.value = { bestScore: 0, gamesPlayed: 0 }
    await saveToStorage()
  }

  return {
    gems,
    recordGemsGame,
    resetGemsProgress,

    // Common
    saveToStorage,
    loadFromStorage,
  }
})
