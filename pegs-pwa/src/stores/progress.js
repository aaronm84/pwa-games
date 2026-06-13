import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useGameStorage } from 'src/composables/useGameStorage'

export const useProgressStore = defineStore('progress', () => {
  const storage = useGameStorage()

  // Pegs progress
  const pegs = ref({
    highestLevel: 1,
    bestScore: 0,
    gamesPlayed: 0,
  })

  function recordPegs(level, score) {
    if (level > pegs.value.highestLevel) pegs.value.highestLevel = level
    if (score > pegs.value.bestScore) pegs.value.bestScore = score
    saveToStorage()
  }

  function recordPegsGameOver() {
    pegs.value.gamesPlayed++
    saveToStorage()
  }

  async function saveToStorage() {
    try {
      await storage.saveProgress({ pegs: pegs.value })
    } catch (error) {
      console.error('[Progress Store] Failed to save progress:', error)
      throw error
    }
  }

  async function loadFromStorage() {
    try {
      const progressData = await storage.loadProgress()
      if (progressData && progressData.pegs) {
        pegs.value = { ...pegs.value, ...progressData.pegs }
        console.log('Progress loaded successfully')
      } else {
        console.log('No saved progress found, using defaults')
      }
    } catch (error) {
      console.error('Failed to load progress:', error)
    }
  }

  async function resetPegsProgress() {
    pegs.value = { highestLevel: 1, bestScore: 0, gamesPlayed: 0 }
    await saveToStorage()
  }

  return {
    pegs,
    recordPegs,
    recordPegsGameOver,
    resetPegsProgress,

    // Common
    saveToStorage,
    loadFromStorage,
  }
})
