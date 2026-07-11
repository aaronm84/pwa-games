import { Preferences } from '@capacitor/preferences'

export function useGameStorage() {
  const KEYS = {
    SETTINGS: 'minigolf_settings',
    PROGRESS: 'minigolf_progress',
    STATS: 'minigolf_stats',
  }

  async function saveSettings(settings) {
    try {
      const settingsJson = JSON.stringify(settings)
      console.log('[Storage] Saving settings:', settingsJson.substring(0, 100) + '...')
      await Preferences.set({
        key: KEYS.SETTINGS,
        value: settingsJson,
      })
      console.log('[Storage] Settings saved successfully to key:', KEYS.SETTINGS)
    } catch (error) {
      console.error('[Storage] Error saving settings:', error)
      throw error
    }
  }

  async function loadSettings() {
    try {
      console.log('[Storage] Loading settings from key:', KEYS.SETTINGS)
      const { value } = await Preferences.get({ key: KEYS.SETTINGS })
      console.log('[Storage] Raw value retrieved:', value ? value.substring(0, 100) + '...' : 'null')
      const parsed = value ? JSON.parse(value) : null
      console.log('[Storage] Settings loaded successfully:', parsed ? Object.keys(parsed) : 'null')
      return parsed
    } catch (error) {
      console.error('[Storage] Error loading settings:', error)
      return null
    }
  }

  async function saveProgress(progress) {
    try {
      const progressJson = JSON.stringify(progress)
      console.log('[Storage] Saving progress:', progressJson.substring(0, 100) + '...')
      await Preferences.set({
        key: KEYS.PROGRESS,
        value: progressJson,
      })
      console.log('[Storage] Progress saved successfully to key:', KEYS.PROGRESS)
    } catch (error) {
      console.error('[Storage] Error saving progress:', error)
      throw error
    }
  }

  async function loadProgress() {
    try {
      console.log('[Storage] Loading progress from key:', KEYS.PROGRESS)
      const { value } = await Preferences.get({ key: KEYS.PROGRESS })
      console.log('[Storage] Raw value retrieved:', value ? value.substring(0, 100) + '...' : 'null')
      const parsed = value ? JSON.parse(value) : null
      console.log('[Storage] Progress loaded successfully:', parsed ? Object.keys(parsed) : 'null')
      return parsed
    } catch (error) {
      console.error('[Storage] Error loading progress:', error)
      return null
    }
  }

  async function clearAll() {
    try {
      await Preferences.clear()
    } catch (error) {
      console.error('Error clearing storage:', error)
    }
  }

  return {
    saveSettings,
    loadSettings,
    saveProgress,
    loadProgress,
    clearAll,
  }
}
