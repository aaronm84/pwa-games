import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useGameStorage } from 'src/composables/useGameStorage'

export const useProgressStore = defineStore('progress', () => {
  const storage = useGameStorage()

  // Solitaire progress
  const solitaire = ref({
    gamesPlayed: 0,
    gamesWon: 0,
    fastestTime: null, // in seconds
    totalMoves: 0,
    bestMoveCount: null, // fewest moves to win
    currentStreak: 0,
    longestStreak: 0,
  })

  const solitaireWinRate = computed(() => {
    if (solitaire.value.gamesPlayed === 0) return 0
    return Math.round((solitaire.value.gamesWon / solitaire.value.gamesPlayed) * 100)
  })

  // Solitaire methods
  function updateSolitaireStats(won, timeInSeconds, moveCount) {
    solitaire.value.gamesPlayed++

    if (won) {
      solitaire.value.gamesWon++
      solitaire.value.currentStreak++
      solitaire.value.longestStreak = Math.max(
        solitaire.value.longestStreak,
        solitaire.value.currentStreak,
      )

      // Update fastest time
      if (!solitaire.value.fastestTime || timeInSeconds < solitaire.value.fastestTime) {
        solitaire.value.fastestTime = timeInSeconds
      }

      // Update best move count
      if (!solitaire.value.bestMoveCount || moveCount < solitaire.value.bestMoveCount) {
        solitaire.value.bestMoveCount = moveCount
      }
    } else {
      solitaire.value.currentStreak = 0
    }

    solitaire.value.totalMoves += moveCount
    saveToStorage()
  }

  async function saveToStorage() {
    try {
      const progressData = {
        solitaire: solitaire.value,
      }
      await storage.saveProgress(progressData)
    } catch (error) {
      console.error('[Progress Store] Failed to save progress:', error)
      throw error
    }
  }

  async function loadFromStorage() {
    try {
      const progressData = await storage.loadProgress()
      if (progressData && progressData.solitaire) {
        // Merge over defaults so newly-added fields keep their default value
        solitaire.value = { ...solitaire.value, ...progressData.solitaire }
        console.log('Progress loaded successfully')
      } else {
        console.log('No saved progress found, using defaults')
      }
    } catch (error) {
      console.error('Failed to load progress:', error)
    }
  }

  async function resetSolitaireProgress() {
    solitaire.value = {
      gamesPlayed: 0,
      gamesWon: 0,
      fastestTime: null,
      totalMoves: 0,
      bestMoveCount: null,
      currentStreak: 0,
      longestStreak: 0,
    }
    await saveToStorage()
  }

  return {
    solitaire,
    solitaireWinRate,
    updateSolitaireStats,
    resetSolitaireProgress,

    // Common
    saveToStorage,
    loadFromStorage,
  }
})
