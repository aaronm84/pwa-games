import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useGameStorage } from 'src/composables/useGameStorage'

export const useProgressStore = defineStore('progress', () => {
  const storage = useGameStorage()

  // Flow progress
  const flow = ref({
    highestLevel: 1, // highest level reached/unlocked
    levelsSolved: 0,
  })

  function recordFlowSolved(level) {
    flow.value.levelsSolved++
    if (level + 1 > flow.value.highestLevel) {
      flow.value.highestLevel = level + 1
    }
    saveToStorage()
  }

  async function saveToStorage() {
    try {
      await storage.saveProgress({ flow: flow.value })
    } catch (error) {
      console.error('[Progress Store] Failed to save progress:', error)
      throw error
    }
  }

  async function loadFromStorage() {
    try {
      const progressData = await storage.loadProgress()
      if (progressData && progressData.flow) {
        flow.value = { ...flow.value, ...progressData.flow }
        console.log('Progress loaded successfully')
      } else {
        console.log('No saved progress found, using defaults')
      }
    } catch (error) {
      console.error('Failed to load progress:', error)
    }
  }

  async function resetFlowProgress() {
    flow.value = { highestLevel: 1, levelsSolved: 0 }
    await saveToStorage()
  }

  return {
    flow,
    recordFlowSolved,
    resetFlowProgress,

    // Common
    saveToStorage,
    loadFromStorage,
  }
})
