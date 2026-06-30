<template>
  <LoadingScreen ref="loadingScreen" />
  <router-view v-slot="{ Component }">
    <component :is="Component" ref="currentPage" />
  </router-view>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useSettingsStore } from 'src/stores/settings'
import { useProgressStore } from 'src/stores/progress'
import { useThemeStore } from 'src/stores/theme'
import { useStatusBar } from 'src/composables/useStatusBar'
import LoadingScreen from 'src/components/LoadingScreen.vue'
import * as audio from 'src/game/audio'

const settingsStore = useSettingsStore()
const progressStore = useProgressStore()
const themeStore = useThemeStore()
const statusBar = useStatusBar()
const loadingScreen = ref(null)
const currentPage = ref(null)

// Load saved data on app startup
onMounted(async () => {
  console.log('[App] Starting app initialization...')
  try {
    // Load all data
    console.log('[App] Loading settings and progress...')
    await Promise.all([
      settingsStore.loadSettings(),
      progressStore.loadFromStorage()
    ])
    console.log('[App] Data loaded successfully')

    // Restore theme override preference
    const themeOverride = settingsStore.settings.themeOverride
    console.log('[App] Theme override preference:', themeOverride)
    if (themeOverride && themeOverride !== 'auto') {
      themeStore.setThemeOverride(themeOverride)
    }

    // Sync audio module with the loaded sound settings, then keep them
    // in sync so the Settings page toggle/slider is live.
    audio.setEnabled(settingsStore.settings.soundEffectsEnabled)
    audio.setVolume(settingsStore.settings.soundEffectsVolume)
    watch(
      () => settingsStore.settings.soundEffectsEnabled,
      (v) => audio.setEnabled(v),
    )
    watch(
      () => settingsStore.settings.soundEffectsVolume,
      (v) => audio.setVolume(v),
    )

    // Configure status bar for overlay mode with light content
    await statusBar.setLightContent()

    // Minimum loading time for better UX (show loading for at least 1.5 seconds)
    await new Promise(resolve => setTimeout(resolve, 1500))

    // Hide loading screen with transition
    if (loadingScreen.value) {
      loadingScreen.value.hide()
    }
  } catch (error) {
    console.error('[App] Error during app initialization:', error)
    // Hide loading screen even if there's an error
    if (loadingScreen.value) {
      loadingScreen.value.hide()
    }
  }
  console.log('[App] Initialization complete')
})
</script>
