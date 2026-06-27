import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useGameStorage } from 'src/composables/useGameStorage'

export const useProgressStore = defineStore('progress', () => {
  const storage = useGameStorage()

  const game = ref({
    bestScore: 0,
    runsCompleted: 0,
  })

  function recordRun(score) {
    if (score > game.value.bestScore) game.value.bestScore = score
    game.value.runsCompleted++
    saveToStorage()
  }

  async function saveToStorage() {
    try {
      await storage.saveProgress({ game: game.value })
    } catch (error) {
      console.error('[Progress Store] Failed to save progress:', error)
      throw error
    }
  }

  async function loadFromStorage() {
    try {
      const progressData = await storage.loadProgress()
      if (progressData && progressData.game) {
        game.value = { ...game.value, ...progressData.game }
      }
    } catch (error) {
      console.error('Failed to load progress:', error)
    }
  }

  async function resetProgress() {
    game.value = { bestScore: 0, runsCompleted: 0 }
    await saveToStorage()
  }

  return {
    game,
    recordRun,
    resetProgress,
    saveToStorage,
    loadFromStorage,
  }
})
