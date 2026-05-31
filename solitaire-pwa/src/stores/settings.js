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
    // Solitaire-specific
    solitaireDealCount: 1, // cards dealt from stock at a time (1 or 3)
    solitaireHintsEnabled: true,
  })

  function updateSetting(key, value) {
    settings.value[key] = value
    saveSettings()
  }

  async function loadSettings() {
    try {
      const savedSettings = await storage.loadSettings()
      if (savedSettings) {
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
