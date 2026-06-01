import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useGameStorage } from 'src/composables/useGameStorage'

export const useProgressStore = defineStore('progress', () => {
  const storage = useGameStorage()

  // Tank Wars progress
  const tankwars = ref({
    gamesPlayed: 0,
    gamesWon: 0,
    streak: 0,
    bestStreak: 0,
  })

  function recordTankGame(won) {
    tankwars.value.gamesPlayed++
    if (won) {
      tankwars.value.gamesWon++
      tankwars.value.streak++
      tankwars.value.bestStreak = Math.max(tankwars.value.bestStreak, tankwars.value.streak)
    } else {
      tankwars.value.streak = 0
    }
    saveToStorage()
  }

  async function saveToStorage() {
    try {
      await storage.saveProgress({ tankwars: tankwars.value })
    } catch (error) {
      console.error('[Progress Store] Failed to save progress:', error)
      throw error
    }
  }

  async function loadFromStorage() {
    try {
      const progressData = await storage.loadProgress()
      if (progressData && progressData.tankwars) {
        tankwars.value = { ...tankwars.value, ...progressData.tankwars }
        console.log('Progress loaded successfully')
      } else {
        console.log('No saved progress found, using defaults')
      }
    } catch (error) {
      console.error('Failed to load progress:', error)
    }
  }

  async function resetTankProgress() {
    tankwars.value = { gamesPlayed: 0, gamesWon: 0, streak: 0, bestStreak: 0 }
    await saveToStorage()
  }

  return {
    tankwars,
    recordTankGame,
    resetTankProgress,

    // Common
    saveToStorage,
    loadFromStorage,
  }
})
