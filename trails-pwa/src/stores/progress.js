import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useGameStorage } from 'src/composables/useGameStorage'

export const useProgressStore = defineStore('progress', () => {
  const storage = useGameStorage()

  // Trails progress
  const trails = ref({
    gamesPlayed: 0,
    gamesWon: 0,
    streak: 0,
    bestStreak: 0,
  })

  function recordTrailsGame(won) {
    trails.value.gamesPlayed++
    if (won) {
      trails.value.gamesWon++
      trails.value.streak++
      trails.value.bestStreak = Math.max(trails.value.bestStreak, trails.value.streak)
    } else {
      trails.value.streak = 0
    }
    saveToStorage()
  }

  async function saveToStorage() {
    try {
      await storage.saveProgress({ trails: trails.value })
    } catch (error) {
      console.error('[Progress Store] Failed to save progress:', error)
      throw error
    }
  }

  async function loadFromStorage() {
    try {
      const progressData = await storage.loadProgress()
      if (progressData && progressData.trails) {
        trails.value = { ...trails.value, ...progressData.trails }
        console.log('Progress loaded successfully')
      } else {
        console.log('No saved progress found, using defaults')
      }
    } catch (error) {
      console.error('Failed to load progress:', error)
    }
  }

  async function resetTrailsProgress() {
    trails.value = { gamesPlayed: 0, gamesWon: 0, streak: 0, bestStreak: 0 }
    await saveToStorage()
  }

  return {
    trails,
    recordTrailsGame,
    resetTrailsProgress,

    // Common
    saveToStorage,
    loadFromStorage,
  }
})
