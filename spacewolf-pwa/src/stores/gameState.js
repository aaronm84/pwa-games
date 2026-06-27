import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * Live in-run state — score, lives, status. Distinct from the progress
 * store, which holds persistent best scores across runs.
 *
 * status:
 *   'idle'    — fresh page, run hasn't started yet
 *   'playing' — combat tick is active
 *   'over'    — lives ran out; overlay shown, awaiting restart
 */
export const useGameStateStore = defineStore('gameState', () => {
  const score = ref(0)
  const lives = ref(3)
  const status = ref('idle')
  const startingLives = 3

  function startRun() {
    score.value = 0
    lives.value = startingLives
    status.value = 'playing'
  }

  function addScore(n) {
    if (status.value !== 'playing') return
    score.value += n
  }

  function loseLife() {
    if (status.value !== 'playing') return
    lives.value = Math.max(0, lives.value - 1)
    if (lives.value === 0) {
      status.value = 'over'
    }
  }

  return {
    score,
    lives,
    status,
    startingLives,
    startRun,
    addScore,
    loseLife,
  }
})
