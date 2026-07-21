<template>
  <q-page class="settings-page">
    <AlleyBackdrop />
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

      <!-- Kooky physics -->
      <q-card class="settings-card q-mb-md">
        <q-card-section>
          <div class="text-h6 text-white">Kooky physics 🤪</div>
          <div class="text-caption text-white q-mb-md" style="opacity: 0.7;">
            Optional nonsense. Scores still count — records don't.
          </div>
          <button
            v-for="m in KOOKY_MODES"
            :key="m.id"
            class="kooky-row"
            :class="{ sel: m.id === (settings.kookyMode || 'off') }"
            @click="setKooky(m.id)"
          >
            <span class="k-icon">{{ m.icon }}</span>
            <span class="k-text">
              <span class="k-name">{{ m.name }}</span>
              <span class="k-blurb">{{ m.blurb }}</span>
            </span>
          </button>
        </q-card-section>
      </q-card>

      <!-- Extras -->
      <q-card class="settings-card q-mb-md">
        <q-card-section>
          <div class="text-h6 q-mb-md text-white">Extras</div>
          <q-toggle
            v-model="settings.reducedMotion"
            label="Reduced Motion"
            @update:model-value="saveSettings"
          />
          <div class="text-caption text-white q-mt-md q-mb-sm" style="opacity: 0.8;">
            The beginner coach walks you through your first throws.
          </div>
          <q-btn outline color="white" icon="school" label="Replay the beginner coach" @click="replayCoach" />
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
            <template v-else>No games finished yet — go bowl one!</template>
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
import { computed } from 'vue'
import { useQuasar } from 'quasar'
import { useSettingsStore } from 'src/stores/settings'
import { KOOKY_MODES } from 'src/game/kooky'
import AlleyBackdrop from 'src/components/AlleyBackdrop.vue'
import { useProgressStore } from 'src/stores/progress'
import { useHaptics } from 'src/composables/useHaptics'

const $q = useQuasar()
const settingsStore = useSettingsStore()
const progressStore = useProgressStore()
const haptics = useHaptics()

const settings = computed(() => settingsStore.settings)

function setKooky(id) {
  haptics.light()
  settingsStore.updateSetting('kookyMode', id)
}

function replayCoach() {
  haptics.light()
  settingsStore.updateSetting('coachDone', false)
  $q.notify({ message: 'Coach is back on — he meets you at the lane.', color: 'positive', timeout: 1800 })
}

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
  position: relative;
}

.settings-container {
  position: relative;
  z-index: 2;
  width: 100%;
  max-width: 600px;
  padding: 24px;
  padding-top: max(40px, env(safe-area-inset-top) + 24px);
  margin: 0 auto;
}

.kooky-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  text-align: left;
  padding: 9px 12px;
  margin-bottom: 6px;
  border-radius: 12px;
  border: 2px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  cursor: pointer;
  transition: all 0.15s ease;
}
.kooky-row.sel {
  border-color: #6ee07a;
  background: rgba(110, 224, 122, 0.14);
}
.k-icon { font-size: 1.4rem; line-height: 1; }
.k-text { display: flex; flex-direction: column; }
.k-name { font-weight: 700; font-size: 0.92rem; }
.k-blurb { font-size: 0.74rem; opacity: 0.7; }

.settings-card {
  border-radius: 12px;
  background: rgba(18, 14, 34, 0.78);
  border: 1px solid rgba(255, 255, 255, 0.12);
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
