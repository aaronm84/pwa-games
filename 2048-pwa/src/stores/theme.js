import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useTimeOfDay } from 'src/composables/useTimeOfDay'

export const useThemeStore = defineStore('theme', () => {
  const timeOfDay = useTimeOfDay()

  // Expose time-of-day colors
  const colors = computed(() => timeOfDay.colors.value)
  const period = computed(() => timeOfDay.currentPeriod.value)

  // Function to set theme override
  function setThemeOverride(themeName) {
    timeOfDay.setThemeOverride(themeName)
  }

  return {
    colors,
    period,
    setThemeOverride,
    manualOverride: timeOfDay.manualOverride,
    timeSchemes: timeOfDay.timeSchemes,
  }
})
