import { ref, computed } from 'vue'

// Create singleton refs that persist across all usages
const currentHour = ref(new Date().getHours())
const currentMinute = ref(new Date().getMinutes())
const manualOverride = ref(null) // Stores manual theme override ('night', 'dawn', etc. or null for auto)
let isInitialized = false

export function useTimeOfDay() {
  // Time periods with color schemes
  const timeSchemes = {
    night: {
      name: 'Night',
      hours: [21, 22, 23, 0, 1, 2, 3, 4],
      colors: {
        primary: '#1a1a2e',
        secondary: '#16213e',
        accent: '#4a5568',
        gradient: 'linear-gradient(135deg, #0a0a15 0%, #1a1a2e 25%, #16213e 60%, #1e3a5f 100%)',
        text: '#e2e8f0',
        cardBg: 'rgba(255, 255, 255, 0.05)',
      },
    },
    dawn: {
      name: 'Dawn',
      hours: [5, 6, 7],
      colors: {
        primary: '#ff6b9d',
        secondary: '#ffa07a',
        accent: '#ffd700',
        gradient: 'linear-gradient(135deg, #4a148c 0%, #ff6b9d 50%, #ffa07a 100%)',
        text: '#ffffff',
        cardBg: 'rgba(255, 255, 255, 0.1)',
      },
    },
    morning: {
      name: 'Morning',
      hours: [8, 9, 10, 11],
      colors: {
        primary: '#4fc3f7',
        secondary: '#81c784',
        accent: '#ffeb3b',
        gradient: 'linear-gradient(135deg, #42a5f5 0%, #66bb6a 50%, #fff176 100%)',
        text: '#ffffff',
        cardBg: 'rgba(255, 255, 255, 0.15)',
      },
    },
    midday: {
      name: 'Midday',
      hours: [12, 13, 14],
      colors: {
        primary: '#2196f3',
        secondary: '#64b5f6',
        accent: '#ffd54f',
        gradient:
          'linear-gradient(135deg, #0d47a1 0%, #1976d2 25%, #42a5f5 50%, #4dd0e1 75%, #80deea 100%)',
        text: '#ffffff',
        cardBg: 'rgba(255, 255, 255, 0.2)',
      },
    },
    afternoon: {
      name: 'Afternoon',
      hours: [15, 16],
      colors: {
        primary: '#87CEEB',
        secondary: '#B0D4E3',
        accent: '#FFE4B5',
        gradient: 'linear-gradient(135deg, #87CEEB 0%, #A8D5BA 30%, #B0D4E3 60%, #FFE4B5 100%)',
        text: '#ffffff',
        cardBg: 'rgba(255, 255, 255, 0.15)',
      },
    },
    evening: {
      name: 'Evening',
      hours: [17, 18],
      colors: {
        primary: '#ff9a56',
        secondary: '#d84315',
        accent: '#ffb74d',
        gradient:
          'linear-gradient(135deg, #1a237e 0%, #3949ab 20%, #ff6f00 50%, #ffa726 70%, #ffb74d 100%)',
        text: '#ffffff',
        cardBg: 'rgba(255, 255, 255, 0.1)',
      },
    },
    dusk: {
      name: 'Dusk',
      hours: [19, 20],
      colors: {
        primary: '#5e35b1',
        secondary: '#4a148c',
        accent: '#7e57c2',
        gradient: 'linear-gradient(135deg, #1a0033 0%, #2a0845 25%, #4a148c 60%, #7e57c2 100%)',
        text: '#ffffff',
        cardBg: 'rgba(255, 255, 255, 0.08)',
      },
    },
  }

  // Get current time period (respects manual override)
  const currentPeriod = computed(() => {
    // If manual override is set, use that
    if (manualOverride.value && timeSchemes[manualOverride.value]) {
      return { key: manualOverride.value, ...timeSchemes[manualOverride.value] }
    }

    // Otherwise use automatic time-based selection
    const hour = currentHour.value

    for (const [key, scheme] of Object.entries(timeSchemes)) {
      if (scheme.hours.includes(hour)) {
        return { key, ...scheme }
      }
    }

    return { key: 'night', ...timeSchemes.night }
  })

  // Current colors
  const colors = computed(() => currentPeriod.value.colors)

  // Update time
  function updateTime() {
    const now = new Date()
    currentHour.value = now.getHours()
    currentMinute.value = now.getMinutes()
  }

  // Initialize the interval only once (singleton pattern)
  function init() {
    if (!isInitialized) {
      updateTime()
      // Update every minute
      setInterval(updateTime, 60000)
      isInitialized = true
    }
  }

  // Auto-initialize on first use
  init()

  // Function to set manual theme override
  function setThemeOverride(themeName) {
    manualOverride.value = themeName
  }

  return {
    currentHour,
    currentMinute,
    currentPeriod,
    colors,
    updateTime,
    setThemeOverride,
    manualOverride,
    timeSchemes, // Expose schemes for settings UI
  }
}
