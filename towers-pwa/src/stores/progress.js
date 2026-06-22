import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useGameStorage } from 'src/composables/useGameStorage'

export const useProgressStore = defineStore('progress', () => {
  const storage = useGameStorage()

  // Towers progress
  const towers = ref({
    bestWave: 0,
    bestScore: 0,
    gamesPlayed: 0,
  })

  function recordTowers(wave, score) {
    if (wave > towers.value.bestWave) towers.value.bestWave = wave
    if (score > towers.value.bestScore) towers.value.bestScore = score
    towers.value.gamesPlayed++
    saveToStorage()
  }

  async function saveToStorage() {
    try {
      await storage.saveProgress({ towers: towers.value })
    } catch (error) {
      console.error('[Progress Store] Failed to save progress:', error)
      throw error
    }
  }

  async function loadFromStorage() {
    try {
      const progressData = await storage.loadProgress()
      if (progressData && progressData.towers) {
        towers.value = { ...towers.value, ...progressData.towers }
        console.log('Progress loaded successfully')
      } else {
        console.log('No saved progress found, using defaults')
      }
    } catch (error) {
      console.error('Failed to load progress:', error)
    }
  }

  async function resetTowersProgress() {
    towers.value = { bestWave: 0, bestScore: 0, gamesPlayed: 0 }
    await saveToStorage()
  }

  return {
    towers,
    recordTowers,
    resetTowersProgress,

    // Common
    saveToStorage,
    loadFromStorage,
  }
})
