import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useGameStorage } from 'src/composables/useGameStorage'

export const useProgressStore = defineStore('progress', () => {
  const storage = useGameStorage()

  // Dots progress — per-mode bests
  const dots = ref({
    gamesPlayed: 0,
    bestScore: 0, // overall best score (legacy / max across score modes)
    zenBest: 0,
    blitzBest: 0,
    challengeLevel: 0, // highest challenge level ever reached
    challengeSaved: 1, // the challenge level to resume from
  })

  // record a finished run; payload = { score, level }
  function recordDots(mode, { score = 0, level = 0 } = {}) {
    dots.value.gamesPlayed++
    if (mode === 'zen') dots.value.zenBest = Math.max(dots.value.zenBest, score)
    else if (mode === 'blitz') dots.value.blitzBest = Math.max(dots.value.blitzBest, score)
    else if (mode === 'challenge') dots.value.challengeLevel = Math.max(dots.value.challengeLevel, level)
    dots.value.bestScore = Math.max(dots.value.bestScore, score)
    saveToStorage()
  }

  // remember the challenge level to resume from (and track the best reached)
  function saveChallengeLevel(level) {
    dots.value.challengeSaved = level
    dots.value.challengeLevel = Math.max(dots.value.challengeLevel, level)
    saveToStorage()
  }
  function resetChallenge() {
    dots.value.challengeSaved = 1
    saveToStorage()
  }

  async function saveToStorage() {
    try {
      await storage.saveProgress({ dots: dots.value })
    } catch (error) {
      console.error('[Progress Store] Failed to save progress:', error)
      throw error
    }
  }

  async function loadFromStorage() {
    try {
      const progressData = await storage.loadProgress()
      if (progressData && progressData.dots) {
        dots.value = { ...dots.value, ...progressData.dots }
      }
    } catch (error) {
      console.error('Failed to load progress:', error)
    }
  }

  async function resetDotsProgress() {
    dots.value = { gamesPlayed: 0, bestScore: 0, zenBest: 0, blitzBest: 0, challengeLevel: 0, challengeSaved: 1 }
    await saveToStorage()
  }

  return {
    dots,
    recordDots,
    saveChallengeLevel,
    resetChallenge,
    resetDotsProgress,

    // Common
    saveToStorage,
    loadFromStorage,
  }
})
