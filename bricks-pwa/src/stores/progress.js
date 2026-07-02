import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useGameStorage } from 'src/composables/useGameStorage'

export const useProgressStore = defineStore('progress', () => {
  const storage = useGameStorage()

  // Bricks progress
  const bricks = ref({
    highestLevel: 1,
    bestScore: 0,
    gamesPlayed: 0,
  })

  function recordBricks(level, score) {
    if (level > bricks.value.highestLevel) bricks.value.highestLevel = level
    if (score > bricks.value.bestScore) bricks.value.bestScore = score
    saveToStorage()
  }

  function recordBricksGameOver() {
    bricks.value.gamesPlayed++
    saveToStorage()
  }

  async function saveToStorage() {
    try {
      await storage.saveProgress({ bricks: bricks.value })
    } catch (error) {
      console.error('[Progress Store] Failed to save progress:', error)
      throw error
    }
  }

  async function loadFromStorage() {
    try {
      const progressData = await storage.loadProgress()
      if (progressData && progressData.bricks) {
        bricks.value = { ...bricks.value, ...progressData.bricks }
        console.log('Progress loaded successfully')
      } else {
        console.log('No saved progress found, using defaults')
      }
    } catch (error) {
      console.error('Failed to load progress:', error)
    }
  }

  async function resetBricksProgress() {
    bricks.value = { highestLevel: 1, bestScore: 0, gamesPlayed: 0 }
    await saveToStorage()
  }

  return {
    bricks,
    recordBricks,
    recordBricksGameOver,
    resetBricksProgress,

    // Common
    saveToStorage,
    loadFromStorage,
  }
})
