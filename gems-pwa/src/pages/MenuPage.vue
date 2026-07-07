<template>
  <q-page class="menu-page">
    <GemBackground />

    <!-- Menu Content -->
    <div class="menu-content">
      <!-- Title -->
      <div class="title-section">
        <h1 class="game-title">
          <span class="title-emphasis">Gems</span>
        </h1>
        <p class="game-subtitle">Swap, match three, chain combos</p>
      </div>

      <!-- Mode select -->
      <div class="menu-buttons">
        <button
          v-for="m in modes"
          :key="m.id"
          class="mode-btn"
          :style="{ '--accent': m.accent }"
          @click="play(m.id)"
        >
          <q-icon :name="m.icon" size="28px" class="mode-icon" />
          <div class="mode-text">
            <div class="mode-label">{{ m.label }}</div>
            <div class="mode-sub">{{ m.sub }}</div>
          </div>
          <div class="mode-best">{{ bestFor(m.id) }}</div>
        </button>
      </div>

      <!-- secondary actions -->
      <div class="secondary">
        <q-btn flat no-caps color="white" icon="help_outline" label="How to Play" @click="howToPlay" />
        <q-btn flat no-caps color="white" icon="settings" label="Settings" @click="openSettings" />
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useProgressStore } from 'src/stores/progress'
import { useHaptics } from 'src/composables/useHaptics'
import GemBackground from 'src/components/GemBackground.vue'

const router = useRouter()
const progressStore = useProgressStore()
const { gems } = storeToRefs(progressStore)
const haptics = useHaptics()

const modes = [
  { id: 'zen', label: 'Zen', sub: 'Endless — relax and match', icon: 'spa', accent: '#2ecc71' },
  { id: 'challenge', label: 'Challenge', sub: 'Beat the target each level', icon: 'military_tech', accent: '#f1c40f' },
  { id: 'blitz', label: 'Blitz', sub: '60-second score sprint', icon: 'bolt', accent: '#e74c3c' },
]

function bestFor(id) {
  if (id === 'zen') return gems.value.zenBest ? `Best ${gems.value.zenBest}` : ''
  if (id === 'blitz') return gems.value.blitzBest ? `Best ${gems.value.blitzBest}` : ''
  return gems.value.challengeLevel ? `Lvl ${gems.value.challengeLevel}` : ''
}

function play(mode) {
  haptics.medium()
  router.push({ name: 'gems', query: { mode } })
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

.menu-buttons {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
  max-width: 400px;
  animation: fadeInUp 0.8s ease-out 0.2s backwards;
}

.mode-btn {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
  padding: 18px 20px;
  border-radius: 16px;
  cursor: pointer;
  color: #fff;
  text-align: left;
  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-left: 5px solid var(--accent);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.18);
  transition: transform 0.2s ease, background 0.2s ease;
}
.mode-btn:hover {
  transform: translateY(-2px);
  background: rgba(255, 255, 255, 0.18);
}
.mode-btn:active { transform: translateY(0); }
.mode-icon { color: var(--accent); flex-shrink: 0; }
.mode-text { flex: 1; min-width: 0; }
.mode-label { font-size: 1.25rem; font-weight: 700; line-height: 1.2; }
.mode-sub { font-size: 0.85rem; opacity: 0.8; }
.mode-best { font-size: 0.8rem; font-weight: 700; color: var(--accent); flex-shrink: 0; }

.secondary {
  display: flex;
  gap: 8px;
  animation: fadeInUp 0.8s ease-out 0.4s backwards;
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
