import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * Live in-run state — score, lives, status, and the scene-ready flag.
 * Distinct from the progress store, which holds persistent best scores
 * across runs.
 *
 * status:
 *   'idle'    — boot screen up; either still loading or waiting for the
 *               player to tap Launch (sceneReady distinguishes the two).
 *   'playing' — combat tick is active.
 *   'over'    — lives ran out; overlay shown, awaiting restart.
 *
 * sceneReady is set true by BabylonCanvas once Babylon's
 * scene.whenReadyAsync() resolves — that's the signal that engines,
 * materials, meshes, and the starfield point cloud are all built and
 * the first render will be solid. The UI uses it to flip the boot
 * overlay from a spinner to the Launch button.
 */
export const useGameStateStore = defineStore('gameState', () => {
  const score = ref(0)
  const lives = ref(3)
  const status = ref('idle')
  const sceneReady = ref(false)
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

  function markSceneReady() {
    sceneReady.value = true
  }

  // Called by GamePage when it mounts (or remounts after a back-and-forth
  // through the menu) — resets everything to a clean boot state so the
  // overlay shows again and we wait for the scene to load.
  function resetToBoot() {
    status.value = 'idle'
    sceneReady.value = false
    score.value = 0
    lives.value = startingLives
  }

  return {
    score,
    lives,
    status,
    sceneReady,
    startingLives,
    startRun,
    addScore,
    loseLife,
    markSceneReady,
    resetToBoot,
  }
})
