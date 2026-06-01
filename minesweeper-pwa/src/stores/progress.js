import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useGameStorage } from 'src/composables/useGameStorage'

export const useProgressStore = defineStore('progress', () => {
  const storage = useGameStorage()

  // Minesweeper progress
  const minesweeper = ref({
    gamesPlayed: 0,
    gamesWon: 0,
    bestTimes: { easy: null, medium: null, hard: null },
  })

  function recordMinesweeper(diff, won, timeSeconds) {
    minesweeper.value.gamesPlayed++
    if (won) {
      minesweeper.value.gamesWon++
      const best = minesweeper.value.bestTimes[diff]
      if (best == null || timeSeconds < best) minesweeper.value.bestTimes[diff] = timeSeconds
    }
    saveToStorage()
  }

  async function saveToStorage() {
    try {
      await storage.saveProgress({ minesweeper: minesweeper.value })
    } catch (error) {
      console.error('[Progress Store] Failed to save progress:', error)
      throw error
    }
  }

  async function loadFromStorage() {
    try {
      const progressData = await storage.loadProgress()
      if (progressData && progressData.minesweeper) {
        const m = progressData.minesweeper
        minesweeper.value = {
          ...minesweeper.value,
          ...m,
          bestTimes: { ...minesweeper.value.bestTimes, ...(m.bestTimes || {}) },
        }
        console.log('Progress loaded successfully')
      } else {
        console.log('No saved progress found, using defaults')
      }
    } catch (error) {
      console.error('Failed to load progress:', error)
    }
  }

  async function resetMinesweeperProgress() {
    minesweeper.value = {
      gamesPlayed: 0,
      gamesWon: 0,
      bestTimes: { easy: null, medium: null, hard: null },
    }
    await saveToStorage()
  }

  return {
    minesweeper,
    recordMinesweeper,
    resetMinesweeperProgress,

    // Common
    saveToStorage,
    loadFromStorage,
  }
})
