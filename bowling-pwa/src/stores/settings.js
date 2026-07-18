import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useGameStorage } from 'src/composables/useGameStorage'

export const useSettingsStore = defineStore('settings', () => {
  const storage = useGameStorage()

  const settings = ref({
    soundEffectsEnabled: true,
    soundEffectsVolume: 0.7,
    musicEnabled: true,
    musicVolume: 0.5,
    hapticsEnabled: true,
    hapticsIntensity: 'medium',
    theme: 'auto',
    themeOverride: 'auto', // 'auto' or specific theme name ('night', 'dawn', etc.)
    reducedMotion: false,
    showTutorials: true,
    confirmations: true,
    selectedAlley: 'disco', // which alley to bowl
    selectedBall: 'house', // which ball is equipped
    hazardLevel: 'light', // lane hazards: 'off' | 'light' (sometimes) | 'wild' (every frame)
    ballColor: null, // custom ball color (null = ball type's own)
    customBall: { mass: 6.5, power: 1.0, hook: 1.2, color: '#7b2ff0' }, // the pro-shop build
    reflections: true, // mirror-polished lane
    glowFx: true, // neon bloom
    instantReplay: true, // pin-cam replay on strikes
    sharpRender: true, // full-retina resolution + FXAA edge smoothing
    ghostRace: true, // race your best game's scorecard in solo play
    coachDone: false, // the beginner coach runs until a first game is walked through
    showTrace: true, // draw the last ball's path
    snappySweep: false, // shorter pinsetter pause (quick sessions)
    hookSens: 1, // hook sensitivity multiplier
    powerSens: 1, // swing power multiplier
  })

  function updateSetting(key, value) {
    settings.value[key] = value
    saveSettings()
  }

  async function loadSettings() {
    try {
      const savedSettings = await storage.loadSettings()
      if (savedSettings) {
        // migrate the old on/off hazard toggle to the leveled setting
        if (savedSettings.laneHazards !== undefined && savedSettings.hazardLevel === undefined) {
          savedSettings.hazardLevel = savedSettings.laneHazards ? 'light' : 'off'
          delete savedSettings.laneHazards
        }
        settings.value = { ...settings.value, ...savedSettings }
        console.log('Settings loaded successfully')
      } else {
        console.log('No saved settings found, using defaults')
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }

  async function saveSettings() {
    try {
      await storage.saveSettings(settings.value)
      console.log('Settings saved successfully')
    } catch (error) {
      console.error('Failed to save settings:', error)
    }
  }

  return {
    settings,
    updateSetting,
    loadSettings,
    saveSettings,
  }
})
