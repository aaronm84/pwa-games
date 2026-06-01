<template>
  <q-page class="menu-page">
    <!-- Dynamic Background Component -->
    <DynamicBackground />

    <!-- Menu Content -->
    <div class="menu-content">
      <!-- Title -->
      <div class="title-section">
        <h1 class="game-title">
          <span class="title-emphasis">Minesweeper</span>
        </h1>
        <p class="game-subtitle">Clear the field, flag the mines</p>
      </div>

      <!-- Difficulty selector -->
      <div class="difficulty-row">
        <q-btn-toggle
          v-model="difficulty"
          spread
          no-caps
          unelevated
          toggle-color="primary"
          color="dark"
          text-color="white"
          :options="[
            { label: 'Easy', value: 'easy' },
            { label: 'Medium', value: 'medium' },
            { label: 'Hard', value: 'hard' },
          ]"
          @update:model-value="setDifficulty"
        />
      </div>

      <!-- Menu Buttons -->
      <div class="menu-buttons">
        <q-btn
          unelevated
          size="xl"
          color="primary"
          text-color="white"
          class="menu-btn"
          @click="playGame"
        >
          <div class="btn-content">
            <q-icon name="play_arrow" size="md" class="btn-icon" />
            <div class="btn-text">
              <div class="btn-label">Play</div>
              <div class="btn-sublabel">{{ diffMeta }}</div>
            </div>
          </div>
        </q-btn>

        <q-btn
          unelevated
          size="xl"
          color="primary"
          text-color="white"
          class="menu-btn"
          @click="howToPlay"
        >
          <div class="btn-content">
            <q-icon name="help_outline" size="md" class="btn-icon" />
            <div class="btn-text">
              <div class="btn-label">How to Play</div>
              <div class="btn-sublabel">Learn the basics</div>
            </div>
          </div>
        </q-btn>

        <q-btn
          unelevated
          size="xl"
          color="primary"
          text-color="white"
          class="menu-btn"
          @click="openSettings"
        >
          <div class="btn-content">
            <q-icon name="settings" size="md" class="btn-icon" />
            <div class="btn-text">
              <div class="btn-label">Settings</div>
              <div class="btn-sublabel">Haptics & theme</div>
            </div>
          </div>
        </q-btn>
      </div>

      <!-- Progress Info -->
      <div v-if="minesweeper.gamesPlayed > 0" class="progress-info">
        <div class="progress-stat">
          <q-icon name="emoji_events" size="sm" color="yellow-6" />
          <span>{{ minesweeper.gamesWon }} of {{ minesweeper.gamesPlayed }} games won</span>
        </div>
        <div class="progress-stat">
          <q-icon name="schedule" size="sm" color="green-6" />
          <span>Best ({{ diffLabel }}): {{ bestTimeDisplay }}</span>
        </div>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useProgressStore } from 'src/stores/progress'
import { useSettingsStore } from 'src/stores/settings'
import { useHaptics } from 'src/composables/useHaptics'
import DynamicBackground from 'src/components/DynamicBackground.vue'

const DIFF_META = {
  easy: { label: 'Easy', meta: '8×8 · 10 mines' },
  medium: { label: 'Medium', meta: '12×12 · 26 mines' },
  hard: { label: 'Hard', meta: '14×14 · 45 mines' },
}

const router = useRouter()
const progressStore = useProgressStore()
const settingsStore = useSettingsStore()
const { minesweeper } = storeToRefs(progressStore)
const haptics = useHaptics()

const difficulty = ref(settingsStore.settings.minesweeperDifficulty || 'medium')
const diffLabel = computed(() => DIFF_META[difficulty.value].label)
const diffMeta = computed(() => DIFF_META[difficulty.value].meta)

const bestTimeDisplay = computed(() => {
  const t = minesweeper.value.bestTimes[difficulty.value]
  if (t == null) return '—'
  const m = Math.floor(t / 60)
  const s = t % 60
  return `${m}:${s.toString().padStart(2, '0')}`
})

function setDifficulty(val) {
  haptics.light()
  settingsStore.updateSetting('minesweeperDifficulty', val)
}

function playGame() {
  haptics.medium()
  router.push({ name: 'minesweeper' })
}

function howToPlay() {
  haptics.light()
  router.push({ name: 'how-to-play' })
}

function openSettings() {
  haptics.light()
  router.push({ name: 'settings' })
}
</script>

<style lang="scss" scoped>
.menu-page {
  position: relative;
  overflow: hidden;
  min-height: 100vh;
}

.menu-content {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 32px 24px;
  padding-bottom: max(32px, env(safe-area-inset-bottom));
  gap: 48px;
}

.title-section {
  text-align: center;
  animation: fadeInDown 0.8s ease-out;
}

.game-title {
  font-family: 'Quicksand', sans-serif;
  font-size: 4rem;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: white;
  text-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  letter-spacing: -0.02em;

  .title-emphasis {
    color: white;
  }
}

.game-subtitle {
  font-size: 1.1rem;
  color: rgba(255, 255, 255, 0.8);
  margin: 0;
  font-weight: 400;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.difficulty-row {
  width: 100%;
  max-width: 400px;
  border-radius: 12px;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.18);
  backdrop-filter: blur(10px);
  animation: fadeInUp 0.8s ease-out 0.1s backwards;
}

.menu-buttons {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: 400px;
  animation: fadeInUp 0.8s ease-out 0.2s backwards;
}

.menu-btn {
  height: auto;
  padding: 20px 24px;
  border-radius: 16px;
  font-size: 1.1rem;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.15) !important;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.25);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-2px);
    background: rgba(255, 255, 255, 0.2) !important;
    border: 1px solid rgba(255, 255, 255, 0.35);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
  }

  &:active {
    transform: translateY(0);
    background: rgba(255, 255, 255, 0.25) !important;
  }
}

.btn-content {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
}

.btn-icon {
  flex-shrink: 0;
}

.btn-text {
  flex: 1;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.btn-label {
  font-size: 1.1rem;
  font-weight: 600;
  line-height: 1.2;
}

.btn-sublabel {
  font-size: 0.85rem;
  opacity: 0.8;
  font-weight: 400;
  line-height: 1.2;
}

.progress-info {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  width: 100%;
  max-width: 400px;
  animation: fadeInUp 0.8s ease-out 0.4s backwards;
}

.progress-stat {
  display: flex;
  align-items: center;
  gap: 12px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.95rem;
  font-weight: 500;

  span {
    flex: 1;
  }
}

@keyframes fadeInDown {
  from {
    opacity: 0;
    transform: translateY(-30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

// Mobile responsive
@media (max-width: 600px) {
  .game-title {
    font-size: 3rem;
  }

  .menu-content {
    gap: 32px;
  }

  .menu-btn {
    padding: 18px 20px;
  }

  .btn-label {
    font-size: 1rem;
  }

  .btn-sublabel {
    font-size: 0.8rem;
  }
}
</style>
