<template>
  <transition name="fade-screen">
    <div
      v-if="isLoading || isTransitioning"
      class="loading-screen"
      :style="{ background: isTransitioning ? 'transparent' : themeStore.colors.gradient }"
    >
      <div class="loading-content">
        <!-- SpaceWolf Logo with Animation -->
        <div v-if="!isTransitioning" class="logo-container">
          <h1 class="app-title">
            <span class="title-emphasis">SpaceWolf</span>
          </h1>
          <div class="tagline">All ships, report in</div>
        </div>

        <!-- Animated Zen Circle (Enso) - instantly hide during transition -->
        <div v-if="!isTransitioning" class="zen-circle-container">
          <svg class="zen-circle" viewBox="0 0 100 100" width="120" height="120">
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-dasharray="280"
              stroke-dashoffset="280"
              class="circle-path"
            />
          </svg>
        </div>

        <!-- Loading Text - instantly hide during transition -->
        <div v-if="!isTransitioning" class="loading-text">
          {{ loadingMessage }}
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useThemeStore } from 'src/stores/theme'

const themeStore = useThemeStore()
const isLoading = ref(true)
const isTransitioning = ref(false)
const loadingMessage = ref('Spinning up the engines...')

const loadingMessages = [
  'Spinning up the engines...',
  'Plotting the sector...',
  'Charging the lasers...',
  'Calibrating the G-diffuser...',
]

let messageIndex = 0
let messageInterval = null

onMounted(() => {
  // Cycle through loading messages
  messageInterval = setInterval(() => {
    messageIndex = (messageIndex + 1) % loadingMessages.length
    loadingMessage.value = loadingMessages[messageIndex]
  }, 2000)
})

// Function to hide loading screen (will be called from parent)
function hide() {
  if (messageInterval) {
    clearInterval(messageInterval)
  }

  // Start transition - fade out circle and text, move title up
  isTransitioning.value = true

  // After the transition completes, hide the loading screen completely
  setTimeout(() => {
    isLoading.value = false
    isTransitioning.value = false
  }, 850) // 800ms transition + 50ms overlap
}

// Once the initial transition is complete, never show the loading screen again
// The route watcher is removed - loading screen only shows on initial app load

// Expose hide method to parent
defineExpose({ hide })
</script>

<style lang="scss" scoped>
// Fade transitions for elements (faster fade out)
.fade-enter-active {
  transition: opacity 0.3s ease;
}

.fade-leave-active {
  transition: opacity 0.15s ease; // Faster fade out
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

// Fade transition for entire screen
.fade-screen-enter-active,
.fade-screen-leave-active {
  transition: opacity 0.5s ease;
}

.fade-screen-enter-from,
.fade-screen-leave-to {
  opacity: 0;
}

.loading-screen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.5s ease;
  pointer-events: none; // Allow clicks to pass through
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32px;
  width: 100%;
}

.logo-container {
  text-align: center;
  position: relative;

  // Initial fade in
  opacity: 0;
  animation: fadeIn 1s ease-out forwards;
}

.title-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 500px;
  height: 150px;
  background: radial-gradient(ellipse at center, rgba(255, 255, 255, 0.6) 0%, rgba(255, 255, 255, 0.2) 50%, transparent 70%);
  filter: blur(40px);
  opacity: 0;
  pointer-events: none;
  z-index: 0; // Above background but below text

  &.glow-active {
    animation: glowInOut 3s ease 0.8s forwards; // Wait 0.8s for title to reach position, then glow
  }
}

@keyframes glowInOut {
  0% {
    opacity: 0;
  }
  15% {
    opacity: 1; // Fade in over 0.45s
  }
  65% {
    opacity: 1; // Stay at full glow
  }
  100% {
    opacity: 0; // Fade out over 1.05s
  }
}

@keyframes glowFadeOut {
  0% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.app-title {
  font-family: 'Quicksand', sans-serif;
  font-size: 4rem;
  font-weight: 600;
  margin: 0;
  padding: 0;
  letter-spacing: -0.02em;
  color: white;
  text-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  line-height: 1;

  .title-emphasis {
    color: white;
  }
}

.tagline {
  font-size: 1.1rem;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.8);
  margin: 0;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.zen-circle-container {
  position: relative;
  animation: fadeIn 1s ease-out 0.5s backwards;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.zen-circle {
  color: rgba(255, 255, 255, 0.9);
  filter: drop-shadow(0 0 20px rgba(255, 255, 255, 0.5));
}

.circle-path {
  animation: drawCircle 2s ease-in-out infinite;
}

@keyframes drawCircle {
  0% {
    stroke-dashoffset: 280;
    opacity: 0.5;
  }
  50% {
    stroke-dashoffset: 0;
    opacity: 1;
  }
  100% {
    stroke-dashoffset: -280;
    opacity: 0.5;
  }
}

.loading-text {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
  letter-spacing: 1px;
  animation: pulse 2s ease-in-out infinite;
  text-align: center;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 0.5;
  }
  50% {
    opacity: 1;
  }
}

// Mobile responsiveness
@media (max-width: 600px) {
  .app-title {
    font-size: 48px !important;
  }

  .tagline {
    font-size: 14px;
  }
}
</style>
