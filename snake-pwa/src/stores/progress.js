import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useGameStorage } from 'src/composables/useGameStorage'

export const useProgressStore = defineStore('progress', () => {
  const storage = useGameStorage()

  // Snake progress
  const snake = ref({
    bestScore: 0,
    gamesPlayed: 0,
  })

  function recordSnakeGame(score) {
    snake.value.gamesPlayed++
    if (score > snake.value.bestScore) snake.value.bestScore = score
    saveToStorage()
  }

  async function saveToStorage() {
    try {
      await storage.saveProgress({ snake: snake.value })
    } catch (error) {
      console.error('[Progress Store] Failed to save progress:', error)
      throw error
    }
  }

  async function loadFromStorage() {
    try {
      const progressData = await storage.loadProgress()
      if (progressData && progressData.snake) {
        snake.value = { ...snake.value, ...progressData.snake }
        console.log('Progress loaded successfully')
      } else {
        console.log('No saved progress found, using defaults')
      }
    } catch (error) {
      console.error('Failed to load progress:', error)
    }
  }

  async function resetSnakeProgress() {
    snake.value = { bestScore: 0, gamesPlayed: 0 }
    await saveToStorage()
  }

  return {
    snake,
    recordSnakeGame,
    resetSnakeProgress,

    // Common
    saveToStorage,
    loadFromStorage,
  }
})
