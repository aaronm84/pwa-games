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
    splashes: 0, // times Otto found the water (a badge of honour)
    abductions: 0, // times aliens made off with the ball
    records: {}, // per-course best: { [courseId]: { total, toPar } }
  })

  // Called once when a full course is finished.
  function recordCourse(courseId, totalStrokes, totalPar) {
    const g = minigolf.value
    const toPar = totalStrokes - totalPar
    if (g.bestTotal === null || totalStrokes < g.bestTotal) g.bestTotal = totalStrokes
    if (g.bestToPar === null || toPar < g.bestToPar) g.bestToPar = toPar
    if (!g.records) g.records = {}
    const prev = g.records[courseId]
    if (!prev || totalStrokes < prev.total) g.records[courseId] = { total: totalStrokes, toPar }
    g.coursesCompleted++
    saveToStorage()
  }

  function recordAbduction() {
    minigolf.value.abductions++
    saveToStorage()
  }

  function recordHoleInOne() {
    minigolf.value.holesInOne++
    saveToStorage()
  }

  function recordSplash() {
    minigolf.value.splashes++
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
      splashes: 0,
      abductions: 0,
      records: {},
    }
    await saveToStorage()
  }

  return {
    minigolf,
    recordCourse,
    recordHoleInOne,
    recordSplash,
    recordAbduction,
    resetMinigolfProgress,

    // Common
    saveToStorage,
    loadFromStorage,
  }
})
