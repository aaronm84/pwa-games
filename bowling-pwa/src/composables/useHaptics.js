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

  // A pin-crash buzz scaled by how many went down. Uses the vibration API
  // directly for a pattern (Capacitor's plugin wraps the same API on web —
  // note: iOS browsers expose no vibration API at all, so web haptics are
  // Android-only; the native Capacitor build gets true haptics everywhere).
  async function crash(intensity = 1) {
    if (!settingsStore.settings.hapticsEnabled) return
    try {
      const d = Math.round(20 + Math.min(1, Math.max(0, intensity)) * 55)
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([d, 30, Math.round(d * 0.5)])
      } else {
        await Haptics.impact({ style: ImpactStyle.Heavy })
      }
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
    crash,
  }
}
