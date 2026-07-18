<template>
  <transition name="fade-screen">
    <div v-if="isLoading || isTransitioning" class="loading-screen" :class="{ ghosting: isTransitioning }">
      <div class="loading-content">
        <!-- the sign flickers on while the house warms up -->
        <div v-if="!isTransitioning" class="logo-container">
          <h1 class="app-title">
            <span class="neon-word">ALLEY</span>
            <span class="neon-word neon-word-alt">NIGHTS</span>
          </h1>
          <div class="tagline">Wind up, hook it, strike</div>
        </div>

        <!-- a little ball rolls the strip; the pins hop when it lands -->
        <div v-if="!isTransitioning" class="lane-loader">
          <span class="ll-ball" />
          <span v-for="p in 3" :key="p" class="ll-pin" :style="{ animationDelay: 0.1 * p + 's' }" />
        </div>

        <div v-if="!isTransitioning" class="loading-text">
          {{ loadingMessage }}
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const isLoading = ref(true)
const isTransitioning = ref(false)
const loadingMessage = ref('Oiling the lane…')

const loadingMessages = [
  'Oiling the lane…',
  'Racking the pins…',
  'Warming up the neon…',
  'Lacing the rentals…',
]

let messageIndex = 0
let messageInterval = null

onMounted(() => {
  messageInterval = setInterval(() => {
    messageIndex = (messageIndex + 1) % loadingMessages.length
    loadingMessage.value = loadingMessages[messageIndex]
  }, 2000)
})

// Function to hide loading screen (will be called from parent)
function hide() {
  if (messageInterval) clearInterval(messageInterval)
  isTransitioning.value = true
  setTimeout(() => {
    isLoading.value = false
    isTransitioning.value = false
  }, 850)
}

defineExpose({ hide })
</script>

<style lang="scss" scoped>
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
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  background:
    radial-gradient(ellipse 120% 70% at 50% 110%, rgba(123, 47, 240, 0.4), transparent 62%),
    linear-gradient(180deg, #060410 0%, #150f2e 60%, #241b4a 100%);

  &.ghosting {
    background: transparent;
  }
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 30px;
  width: 100%;
}

.logo-container {
  text-align: center;
  opacity: 0;
  animation: fadeIn 0.9s ease-out forwards;
}

.app-title {
  font-family: 'Quicksand', sans-serif;
  font-size: 3.2rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  line-height: 1.05;
  margin: 0 0 10px;
  display: flex;
  flex-direction: column;
}

/* the same neon sign that hangs over the menu */
.neon-word {
  color: #ffe9fd;
  text-shadow:
    0 0 6px #ff3df0,
    0 0 18px #ff3df0,
    0 0 42px rgba(255, 61, 240, 0.7),
    0 2px 4px rgba(0, 0, 0, 0.6);
}
.neon-word-alt {
  color: #eafcff;
  text-shadow:
    0 0 6px #28d7fe,
    0 0 18px #28d7fe,
    0 0 42px rgba(40, 215, 254, 0.7),
    0 2px 4px rgba(0, 0, 0, 0.6);
  animation: neonflicker 4.5s linear infinite;
}
@keyframes neonflicker {
  0%, 56%, 60.5%, 100% { opacity: 1; }
  56.5%, 57.4% { opacity: 0.35; }
  57.5%, 58.4% { opacity: 0.85; }
  58.5%, 59.4% { opacity: 0.45; }
}

.tagline {
  font-size: 1rem;
  color: rgba(255, 255, 255, 0.75);
  letter-spacing: 0.04em;
}

/* the loader: ball rolls the strip, pins hop */
.lane-loader {
  position: relative;
  width: 210px;
  height: 44px;
  border-bottom: 2px solid rgba(255, 255, 255, 0.35);
  box-shadow: 0 10px 22px -10px rgba(123, 47, 240, 0.8);
  overflow: hidden;
  opacity: 0;
  animation: fadeIn 0.9s ease-out 0.2s forwards;
}
.ll-ball {
  position: absolute;
  bottom: 2px;
  left: -26px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: radial-gradient(circle at 32% 28%, #6f9fe0, #2a5db0 60%, #142c56);
  animation: llroll 1.5s cubic-bezier(0.35, 0, 0.7, 1) infinite;
}
@keyframes llroll {
  0% { transform: translateX(0) rotate(0); }
  100% { transform: translateX(236px) rotate(540deg); }
}
.ll-pin {
  position: absolute;
  bottom: 2px;
  width: 8px;
  height: 22px;
  border-radius: 4px 4px 3px 3px;
  background: #f4f0ff;
  box-shadow: 0 0 8px rgba(244, 240, 255, 0.7);
  animation: llhop 1.5s ease-in-out infinite;
}
.ll-pin:nth-child(2) { right: 34px; }
.ll-pin:nth-child(3) { right: 22px; }
.ll-pin:nth-child(4) { right: 10px; }
@keyframes llhop {
  0%, 78%, 100% { transform: translateY(0) rotate(0); }
  86% { transform: translateY(-14px) rotate(18deg); }
  93% { transform: translateY(-4px) rotate(-8deg); }
}

.loading-text {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.7);
  letter-spacing: 0.03em;
  opacity: 0;
  animation: fadeIn 0.9s ease-out 0.35s forwards;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
</style>
