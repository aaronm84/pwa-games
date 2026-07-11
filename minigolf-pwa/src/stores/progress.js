import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useGameStorage } from 'src/composables/useGameStorage'

export const useProgressStore = defineStore('progress', () => {
  const storage = useGameStorage()

  // Mini Golf progress. In golf, lower is better — so bests start null and only
  // fill in once a full course has been completed.
  const minigolf = ref({
    bestTotal: null, // fewest total strokes for a full round
    bestToPar: null, // best score relative to par (can be negative)
    holesInOne: 0,
    coursesCompleted: 0,
  })

  // Called once when a full course is finished.
  function recordCourse(totalStrokes, totalPar) {
    const g = minigolf.value
    const toPar = totalStrokes - totalPar
    if (g.bestTotal === null || totalStrokes < g.bestTotal) g.bestTotal = totalStrokes
    if (g.bestToPar === null || toPar < g.bestToPar) g.bestToPar = toPar
    g.coursesCompleted++
    saveToStorage()
  }

  function recordHoleInOne() {
    minigolf.value.holesInOne++
    saveToStorage()
  }

  async function saveToStorage() {
    try {
      await storage.saveProgress({ minigolf: minigolf.value })
    } catch (error) {
      console.error('[Progress Store] Failed to save progress:', error)
      throw error
    }
  }

  async function loadFromStorage() {
    try {
      const progressData = await storage.loadProgress()
      if (progressData && progressData.minigolf) {
        minigolf.value = { ...minigolf.value, ...progressData.minigolf }
        console.log('Progress loaded successfully')
      } else {
        console.log('No saved progress found, using defaults')
      }
    } catch (error) {
      console.error('Failed to load progress:', error)
    }
  }

  async function resetMinigolfProgress() {
    minigolf.value = {
      bestTotal: null,
      bestToPar: null,
      holesInOne: 0,
      coursesCompleted: 0,
    }
    await saveToStorage()
  }

  return {
    minigolf,
    recordCourse,
    recordHoleInOne,
    resetMinigolfProgress,

    // Common
    saveToStorage,
    loadFromStorage,
  }
})
