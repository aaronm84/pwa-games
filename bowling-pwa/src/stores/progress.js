import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useGameStorage } from 'src/composables/useGameStorage'

export const useProgressStore = defineStore('progress', () => {
  const storage = useGameStorage()

  // Bowling progress. Higher is better here, unlike golf.
  const bowling = ref({
    games: 0,
    bestScore: null,
    totalStrikes: 0,
    perfectGames: 0,
    rivalWins: 0,
    tournamentStage: 0, // 0..2 — which tournament round is next
    tournamentsWon: 0,
  })

  // Called once when a full ten-frame game finishes. Returns { newBest }.
  function recordGame(total, strikes) {
    const g = bowling.value
    g.games++
    g.totalStrikes += strikes
    if (total === 300) g.perfectGames++
    const newBest = g.bestScore === null || total > g.bestScore
    if (newBest) g.bestScore = total
    saveToStorage()
    return { newBest }
  }

  async function saveToStorage() {
    try {
      await storage.saveProgress({ bowling: bowling.value })
    } catch (error) {
      console.error('[Progress Store] Failed to save progress:', error)
      throw error
    }
  }

  async function loadFromStorage() {
    try {
      const progressData = await storage.loadProgress()
      if (progressData && progressData.bowling) {
        bowling.value = { ...bowling.value, ...progressData.bowling }
      }
    } catch (error) {
      console.error('Failed to load progress:', error)
    }
  }

  // Returns 'champion' when the win closes out the final round.
  function recordMatch(won, inTournament) {
    const g = bowling.value
    if (won) g.rivalWins++
    if (inTournament) {
      if (won) {
        g.tournamentStage++
        if (g.tournamentStage > 2) {
          g.tournamentStage = 0
          g.tournamentsWon++
          saveToStorage()
          return 'champion'
        }
      } else {
        g.tournamentStage = 0
      }
    }
    saveToStorage()
    return won ? 'advance' : 'reset'
  }

  async function resetProgress() {
    bowling.value = { games: 0, bestScore: null, totalStrikes: 0, perfectGames: 0, rivalWins: 0, tournamentStage: 0, tournamentsWon: 0 }
    await saveToStorage()
  }

  return { bowling, recordGame, recordMatch, resetProgress, saveToStorage, loadFromStorage }
})
