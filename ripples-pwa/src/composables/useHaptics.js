// Haptics for Ripples ride the engine-kit's vibration helpers instead of the
// Capacitor plugin: same call sites as the sibling games (light/medium/…), but
// web-first and no-op-safe everywhere, with the settings store as the gate.
import { createHaptics } from '@aaronm84/engine-kit/2d'
import { useSettingsStore } from 'src/stores/settings'

const kit = createHaptics()

export function useHaptics() {
  const settingsStore = useSettingsStore()

  function configured() {
    kit.configure({
      enabled: settingsStore.settings.hapticsEnabled,
      intensity: settingsStore.settings.hapticsIntensity || 'medium',
    })
    return kit
  }

  return {
    light() { configured().light() },
    medium() { configured().medium() },
    heavy() { configured().heavy() },
    success() { configured().success() },
    // the kit has no notification-style taxonomy; map the old names onto
    // nearby intensities so existing call sites keep their feel
    warning() { configured().heavy() },
    error() { configured().crash(1) },
    selection() { configured().light() },
  }
}
