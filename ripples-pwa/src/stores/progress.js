import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useGameStorage } from 'src/composables/useGameStorage'

export const useProgressStore = defineStore('progress', () => {
  const storage = useGameStorage()

  // Ripples progress
  const ripples = ref({
    currentLevel: 1,
    totalScore: 0,
    levelsCompleted: 0,
    perfectLevels: 0,
  })

  function recordLevelComplete(nextLevel, stars, isPerfect) {
    if (nextLevel > ripples.value.currentLevel) ripples.value.currentLevel = nextLevel
    ripples.value.totalScore += stars
    ripples.value.levelsCompleted++
    if (isPerfect) ripples.value.perfectLevels++
    saveToStorage()
  }

  function recordFailurePenalty() {
    ripples.value.totalScore = Math.max(0, ripples.value.totalScore - 1)
    saveToStorage()
  }

  async function saveToStorage() {
    try {
      await storage.saveProgress({ ripples: ripples.value })
    } catch (error) {
      console.error('[Progress Store] Failed to save progress:', error)
      throw error
    }
  }

  async function loadFromStorage() {
    try {
      const progressData = await storage.loadProgress()
      if (progressData && progressData.ripples) {
        ripples.value = { ...ripples.value, ...progressData.ripples }
        console.log('Progress loaded successfully')
      } else {
        console.log('No saved progress found, using defaults')
      }
    } catch (error) {
      console.error('Failed to load progress:', error)
    }
  }

  async function resetRipplesProgress() {
    ripples.value = { currentLevel: 1, totalScore: 0, levelsCompleted: 0, perfectLevels: 0 }
    await saveToStorage()
  }

  return {
    ripples,
    recordLevelComplete,
    recordFailurePenalty,
    resetRipplesProgress,

    // Common
    saveToStorage,
    loadFromStorage,
  }
})
