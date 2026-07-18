<template>
  <q-page class="settings-page" :style="{ background: themeStore.colors.gradient }">
    <div class="settings-container">
      <h3 class="text-h4 text-white q-mb-lg q-pt-md">Settings</h3>

      <!-- Sound -->
      <q-card class="settings-card q-mb-md">
        <q-card-section>
          <div class="text-h6 q-mb-md text-white">Sound</div>
          <q-toggle v-model="settings.soundEffectsEnabled" label="Sound effects (synth — rolls, crashes, stingers)" @update:model-value="saveSettings" />
          <div class="text-caption text-white q-mt-sm" style="opacity: 0.8;">Volume</div>
          <q-slider v-model="settings.soundEffectsVolume" :min="0" :max="1" :step="0.05" :disable="!settings.soundEffectsEnabled" color="green" @change="saveSettings" />
        </q-card-section>
      </q-card>

      <!-- Haptics Settings -->
      <q-card class="settings-card q-mb-md">
        <q-card-section>
          <div class="text-h6 q-mb-md text-white">Haptics</div>

          <q-toggle
            v-model="settings.hapticsEnabled"
            label="Haptic Feedback"
            @update:model-value="saveSettings"
          />

          <q-select
            v-model="settings.hapticsIntensity"
            :options="['light', 'medium', 'heavy']"
            label="Intensity"
            :disable="!settings.hapticsEnabled"
            class="q-mt-md"
            @update:model-value="saveSettings"
          />
        </q-card-section>
      </q-card>

      <!-- Lane & Graphics -->
      <q-card class="settings-card q-mb-md">
        <q-card-section>
          <div class="text-h6 q-mb-md text-white">Lane &amp; Graphics</div>

          <q-toggle v-model="settings.reflections" label="Mirror-polished lane" @update:model-value="saveSettings" />
          <q-toggle v-model="settings.glowFx" label="Neon glow" @update:model-value="saveSettings" />
          <q-toggle v-model="settings.showTrace" label="Trace the ball's path" @update:model-value="saveSettings" />
          <q-toggle v-model="settings.snappySweep" label="Snappy pinsetter (quicker frames)" @update:model-value="saveSettings" />
          <q-toggle v-model="settings.instantReplay" label="Instant replay on strikes (tap to skip)" @update:model-value="saveSettings" />
          <q-toggle v-model="settings.ghostRace" label="Ghost race — chase your best game" @update:model-value="saveSettings" />
          <q-toggle v-model="settings.sharpRender" label="Sharp rendering (high-res + smoothing)" @update:model-value="saveSettings" />

          <div class="text-caption text-white q-mt-md" style="opacity: 0.8;">Lane hazards — stuff lands on the boards and you bowl around it</div>
          <q-btn-toggle
            v-model="settings.hazardLevel"
            spread no-caps unelevated
            toggle-color="green"
            color="grey-9"
            text-color="white"
            :options="[
              { label: 'Off', value: 'off' },
              { label: 'Light', value: 'light' },
              { label: 'Wild', value: 'wild' },
            ]"
            @update:model-value="saveSettings"
          />

          <div class="text-caption text-white q-mt-md" style="opacity: 0.8;">Hook sensitivity</div>
          <q-slider v-model="settings.hookSens" :min="0.6" :max="1.4" :step="0.1" label color="green" @change="saveSettings" />

          <div class="text-caption text-white" style="opacity: 0.8;">Swing power</div>
          <q-slider v-model="settings.powerSens" :min="0.8" :max="1.2" :step="0.05" label color="green" @change="saveSettings" />

          <div class="text-caption text-white q-mt-sm" style="opacity: 0.6;">
            Graphics changes apply the next time you enter the alley.
          </div>
        </q-card-section>
      </q-card>

      <!-- Display Settings -->
      <q-card class="settings-card q-mb-md">
        <q-card-section>
          <div class="text-h6 q-mb-md text-white">Display</div>

          <div class="text-caption text-white q-mb-md" style="opacity: 0.8;">
            The background theme automatically changes throughout the day based on the time. However, feel free to change it to whatever theme fits your mood.
          </div>

          <q-select
            v-model="selectedTheme"
            :options="themeOptions"
            option-label="label"
            option-value="value"
            emit-value
            map-options
            label="Theme"
            @update:model-value="updateTheme"
          />

          <q-toggle
            v-model="settings.reducedMotion"
            label="Reduced Motion"
            class="q-mt-md"
            @update:model-value="saveSettings"
          />
        </q-card-section>
      </q-card>

      <!-- Stats -->
      <q-card class="settings-card q-mb-md">
        <q-card-section>
          <div class="text-h6 q-mb-md text-white">Statistics</div>

          <div class="text-body2 text-white q-mb-md" style="opacity: 0.9;">
            <template v-if="progressStore.bowling.games > 0">
              Best game: {{ progressStore.bowling.bestScore }}<br />
              Games bowled: {{ progressStore.bowling.games }} ·
              Strikes: {{ progressStore.bowling.totalStrikes }}
            </template>
            <template v-else>No rounds finished yet — play the Front Nine!</template>
          </div>

          <q-btn
            outline
            color="white"
            label="Reset Statistics"
            icon="delete_outline"
            @click="confirmReset"
          />
        </q-card-section>
      </q-card>
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useSettingsStore } from 'src/stores/settings'
import { useThemeStore } from 'src/stores/theme'
import { useProgressStore } from 'src/stores/progress'
import { useHaptics } from 'src/composables/useHaptics'

const $q = useQuasar()
const settingsStore = useSettingsStore()
const themeStore = useThemeStore()
const progressStore = useProgressStore()
const haptics = useHaptics()

const settings = computed(() => settingsStore.settings)

// Theme selection
const selectedTheme = ref('auto')

const themeOptions = computed(() => {
  const options = [
    { label: 'Auto (Based on time)', value: 'auto' }
  ]

  // Add all time-of-day themes
  Object.entries(themeStore.timeSchemes).forEach(([key, scheme]) => {
    options.push({
      label: scheme.name,
      value: key
    })
  })

  return options
})

function updateTheme(value) {
  haptics.light()
  if (value === 'auto') {
    themeStore.setThemeOverride(null)
  } else {
    themeStore.setThemeOverride(value)
  }
  selectedTheme.value = value

  // Save theme preference to settings
  settingsStore.updateSetting('themeOverride', value)
}

onMounted(() => {
  // Initialize selected theme based on saved preference
  selectedTheme.value = settingsStore.settings.themeOverride || 'auto'
})

async function saveSettings() {
  haptics.light()
  await settingsStore.saveSettings()
}

function confirmReset() {
  haptics.light()
  $q.dialog({
    title: 'Reset Statistics',
    message: 'This permanently clears your best game and strike totals. Continue?',
    cancel: true,
    persistent: true,
    dark: true,
  }).onOk(async () => {
    await progressStore.resetProgress()
    haptics.success()
  })
}
</script>

<style lang="scss" scoped>
.settings-page {
  min-height: 100vh;
  transition: background 2s ease;
}

.settings-container {
  width: 100%;
  max-width: 600px;
  padding: 24px;
  padding-top: max(40px, env(safe-area-inset-top) + 24px);
  margin: 0 auto;
}

.settings-card {
  border-radius: 12px;
  background: v-bind('themeStore.colors.cardBg');
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;

  // Make all text white
  :deep(*) {
    color: white !important;
  }

  // Style the separator
  :deep(.q-separator) {
    background-color: rgba(255, 255, 255, 0.2);
  }
}
</style>
