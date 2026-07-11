import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { useSettingsStore } from 'src/stores/settings'

export function useHaptics() {
  const settingsStore = useSettingsStore()

  async function light() {
    if (!settingsStore.settings.hapticsEnabled) return
    try {
      await Haptics.impact({ style: ImpactStyle.Light })
    } catch (error) {
      console.log('Haptics not available:', error)
    }
  }

  async function medium() {
    if (!settingsStore.settings.hapticsEnabled) return
    try {
      await Haptics.impact({ style: ImpactStyle.Medium })
    } catch (error) {
      console.log('Haptics not available:', error)
    }
  }

  async function heavy() {
    if (!settingsStore.settings.hapticsEnabled) return
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy })
    } catch (error) {
      console.log('Haptics not available:', error)
    }
  }

  async function success() {
    if (!settingsStore.settings.hapticsEnabled) return
    try {
      await Haptics.notification({ type: NotificationType.Success })
    } catch (error) {
      console.log('Haptics not available:', error)
    }
  }

  async function warning() {
    if (!settingsStore.settings.hapticsEnabled) return
    try {
      await Haptics.notification({ type: NotificationType.Warning })
    } catch (error) {
      console.log('Haptics not available:', error)
    }
  }

  async function error() {
    if (!settingsStore.settings.hapticsEnabled) return
    try {
      await Haptics.notification({ type: NotificationType.Error })
    } catch (err) {
      console.log('Haptics not available:', err)
    }
  }

  async function selection() {
    if (!settingsStore.settings.hapticsEnabled) return
    try {
      await Haptics.selectionStart()
    } catch (error) {
      console.log('Haptics not available:', error)
    }
  }

  return {
    light,
    medium,
    heavy,
    success,
    warning,
    error,
    selection,
  }
}
