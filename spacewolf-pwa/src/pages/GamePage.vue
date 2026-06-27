<template>
  <q-page class="game-page">
    <BabylonCanvas ref="canvas" class="canvas" />
    <TouchHud />

    <!-- Top-left: back button + lives -->
    <div class="top-left">
      <button class="back-btn" @click="goBack" aria-label="Back to menu">
        <q-icon name="arrow_back" size="22px" />
      </button>
      <div class="lives" aria-label="Lives remaining">
        <span
          v-for="i in gameStateStore.startingLives"
          :key="i"
          class="life-pip"
          :class="{ lost: i > gameStateStore.lives }"
        ></span>
      </div>
    </div>

    <!-- Top-right: score -->
    <div class="top-right">
      <div class="score-label">Score</div>
      <div class="score-value">{{ gameStateStore.score.toLocaleString() }}</div>
    </div>

    <!-- Game over overlay -->
    <transition name="overlay-fade">
      <div v-if="gameStateStore.status === 'over'" class="game-over">
        <div class="game-over-card">
          <div class="go-title">Wing Down</div>
          <div class="go-stat">Score</div>
          <div class="go-score">{{ gameStateStore.score.toLocaleString() }}</div>
          <div v-if="isNewBest" class="go-best">New best!</div>
          <div v-else-if="bestScore > 0" class="go-best-prev">
            Best: {{ bestScore.toLocaleString() }}
          </div>
          <div class="go-actions">
            <q-btn
              unelevated
              size="md"
              color="primary"
              text-color="white"
              label="Play Again"
              icon="restart_alt"
              @click="restart"
            />
            <q-btn flat color="white" label="Menu" @click="goBack" />
          </div>
        </div>
      </div>
    </transition>
  </q-page>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import BabylonCanvas from 'src/components/BabylonCanvas.vue'
import TouchHud from 'src/components/TouchHud.vue'
import { useHaptics } from 'src/composables/useHaptics'
import { useGameStateStore } from 'src/stores/gameState'
import { useProgressStore } from 'src/stores/progress'

const router = useRouter()
const haptics = useHaptics()
const gameStateStore = useGameStateStore()
const progressStore = useProgressStore()
const canvas = ref(null)

const bestScore = computed(() => progressStore.game.bestScore)
const isNewBest = ref(false)

// When a run ends, record it and check for a new best.
watch(
  () => gameStateStore.status,
  (s) => {
    if (s === 'over') {
      const beat = gameStateStore.score > progressStore.game.bestScore
      isNewBest.value = beat
      progressStore.recordRun(gameStateStore.score)
      haptics.warning?.()
    }
  },
)

function goBack() {
  haptics.light()
  router.push({ name: 'menu' })
}

function restart() {
  haptics.medium()
  isNewBest.value = false
  if (canvas.value) canvas.value.startRun()
}
</script>

<style lang="scss" scoped>
.game-page {
  position: fixed;
  inset: 0;
  background: #05071a;
  overflow: hidden;
}

.canvas {
  position: absolute;
  inset: 0;
}

.top-left,
.top-right {
  position: absolute;
  top: max(14px, env(safe-area-inset-top));
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 12px;
  pointer-events: none;
}

.top-left {
  left: max(14px, env(safe-area-inset-left));
}

.top-right {
  right: max(14px, env(safe-area-inset-right));
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  padding: 8px 14px;
  background: rgba(20, 30, 60, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.18);
  backdrop-filter: blur(6px);
  border-radius: 12px;
  color: white;
  font-family: 'Quicksand', sans-serif;
}

.score-label {
  font-size: 0.65rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  opacity: 0.7;
  line-height: 1;
}

.score-value {
  font-size: 1.4rem;
  font-weight: 700;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}

.back-btn {
  pointer-events: auto;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: rgba(20, 30, 60, 0.55);
  backdrop-filter: blur(6px);
  color: white;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;

  &:active {
    background: rgba(80, 140, 255, 0.6);
  }
}

.lives {
  display: flex;
  gap: 6px;
  padding: 8px 12px;
  background: rgba(20, 30, 60, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.18);
  backdrop-filter: blur(6px);
  border-radius: 12px;
}

.life-pip {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #ff4d6d;
  box-shadow: 0 0 8px rgba(255, 77, 109, 0.6);
  transition: background 0.2s ease, box-shadow 0.2s ease;

  &.lost {
    background: rgba(255, 255, 255, 0.18);
    box-shadow: none;
  }
}

.game-over {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(2px);
}

.game-over-card {
  max-width: 360px;
  width: calc(100% - 48px);
  padding: 28px 32px;
  background: rgba(15, 20, 50, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 18px;
  text-align: center;
  color: white;
  font-family: 'Quicksand', sans-serif;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
}

.go-title {
  font-size: 1.8rem;
  font-weight: 700;
  margin-bottom: 18px;
  letter-spacing: -0.01em;
}

.go-stat {
  font-size: 0.7rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  opacity: 0.7;
}

.go-score {
  font-size: 2.6rem;
  font-weight: 700;
  margin: 4px 0 8px;
  font-variant-numeric: tabular-nums;
}

.go-best {
  color: #ffd400;
  font-weight: 600;
  margin-bottom: 18px;
  letter-spacing: 0.05em;
}

.go-best-prev {
  opacity: 0.7;
  margin-bottom: 18px;
  font-size: 0.9rem;
}

.go-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 8px;
}

.overlay-fade-enter-active,
.overlay-fade-leave-active {
  transition: opacity 0.25s ease;
}
.overlay-fade-enter-from,
.overlay-fade-leave-to {
  opacity: 0;
}
</style>
