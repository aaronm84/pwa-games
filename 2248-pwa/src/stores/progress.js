import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useGameStorage } from 'src/composables/useGameStorage'

export const useProgressStore = defineStore('progress', () => {
  const storage = useGameStorage()

  // 2248 progress
  const game2248 = ref({
    bestScore: 0,
    bestTile: 0,
    gamesPlayed: 0,
  })

  function update2248Best(score, tile) {
    let changed = false
    if (score > game2248.value.bestScore) {
      game2248.value.bestScore = score
      changed = true
    }
    if (tile > game2248.value.bestTile) {
      game2248.value.bestTile = tile
      changed = true
    }
    if (changed) saveToStorage()
  }

  function record2248GameOver(score, tile) {
    game2248.value.gamesPlayed++
    update2248Best(score, tile) // also persists
    saveToStorage()
  }

  async function saveToStorage() {
    try {
      await storage.saveProgress({ game2248: game2248.value })
    } catch (error) {
      console.error('[Progress Store] Failed to save progress:', error)
      throw error
    }
  }

  async function loadFromStorage() {
    try {
      const progressData = await storage.loadProgress()
      if (progressData && progressData.game2248) {
        // Merge over defaults so newly-added fields keep their default value
        game2248.value = { ...game2248.value, ...progressData.game2248 }
        console.log('Progress loaded successfully')
      } else {
        console.log('No saved progress found, using defaults')
      }
    } catch (error) {
      console.error('Failed to load progress:', error)
    }
  }

  async function reset2248Progress() {
    game2248.value = { bestScore: 0, bestTile: 0, gamesPlayed: 0 }
    await saveToStorage()
  }

  return {
    game2248,
    update2248Best,
    record2248GameOver,
    reset2248Progress,

    // Common
    saveToStorage,
    loadFromStorage,
  }
})
