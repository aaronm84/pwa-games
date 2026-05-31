import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useGameStorage } from 'src/composables/useGameStorage'

export const useProgressStore = defineStore('progress', () => {
  const storage = useGameStorage()

  // 2048 progress
  const game2048 = ref({
    bestScore: 0,
    bestTile: 0,
    gamesPlayed: 0,
    gamesWon: 0, // games where the 2048 tile was reached
  })

  function update2048Best(score, tile) {
    let changed = false
    if (score > game2048.value.bestScore) {
      game2048.value.bestScore = score
      changed = true
    }
    if (tile > game2048.value.bestTile) {
      game2048.value.bestTile = tile
      changed = true
    }
    if (changed) saveToStorage()
  }

  function record2048Win() {
    game2048.value.gamesWon++
    saveToStorage()
  }

  function record2048GameOver(score, tile) {
    game2048.value.gamesPlayed++
    update2048Best(score, tile) // also persists
    saveToStorage()
  }

  async function saveToStorage() {
    try {
      await storage.saveProgress({ game2048: game2048.value })
    } catch (error) {
      console.error('[Progress Store] Failed to save progress:', error)
      throw error
    }
  }

  async function loadFromStorage() {
    try {
      const progressData = await storage.loadProgress()
      if (progressData && progressData.game2048) {
        // Merge over defaults so newly-added fields keep their default value
        game2048.value = { ...game2048.value, ...progressData.game2048 }
        console.log('Progress loaded successfully')
      } else {
        console.log('No saved progress found, using defaults')
      }
    } catch (error) {
      console.error('Failed to load progress:', error)
    }
  }

  async function reset2048Progress() {
    game2048.value = { bestScore: 0, bestTile: 0, gamesPlayed: 0, gamesWon: 0 }
    await saveToStorage()
  }

  return {
    game2048,
    update2048Best,
    record2048Win,
    record2048GameOver,
    reset2048Progress,

    // Common
    saveToStorage,
    loadFromStorage,
  }
})
