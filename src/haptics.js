// engine-kit / haptics — framework-free vibration helpers with graceful
// no-ops where the API is missing (iOS Safari has no web vibration).
export function createHaptics({ enabled = true, intensity = 'medium' } = {}) {
  const scale = () => (intensity === 'light' ? 0.6 : intensity === 'heavy' ? 1.5 : 1)
  const buzz = (pattern) => {
    if (!enabled || typeof navigator === 'undefined' || !navigator.vibrate) return
    const k = scale()
    navigator.vibrate(Array.isArray(pattern) ? pattern.map((v) => Math.round(v * k)) : Math.round(pattern * k))
  }
  return {
    configure(opts = {}) {
      if (opts.enabled !== undefined) enabled = opts.enabled
      if (opts.intensity) intensity = opts.intensity
    },
    light() { buzz(12) },
    medium() { buzz(24) },
    heavy() { buzz(45) },
    success() { buzz([18, 40, 26]) },
    // an impact scaled 0..1 (pin crashes, collisions)
    crash(k = 1) { buzz([Math.round(14 + 30 * Math.min(1, Math.max(0, k)))]) },
  }
}
