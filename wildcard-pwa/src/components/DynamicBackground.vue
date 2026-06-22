<template>
  <div
    class="dynamic-background"
    :style="{ background: themeStore.colors.gradient }"
  >
    <!-- Animated floating orbs -->
    <div class="floating-orbs">
      <div
        v-for="(orb, index) in orbs"
        :key="index"
        class="floating-orb"
        :style="{
          left: orb.x + '%',
          top: orb.y + '%',
          width: orb.size + 'px',
          height: orb.size + 'px',
          animationDuration: orb.duration + 's',
          animationDelay: orb.delay + 's',
        }"
      ></div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useThemeStore } from 'src/stores/theme'

const themeStore = useThemeStore()

// Generate random floating orbs
const orbs = ref([
  { x: 10, y: 20, size: 80, duration: 15, delay: 0 },
  { x: 70, y: 15, size: 60, duration: 18, delay: 2 },
  { x: 30, y: 60, size: 100, duration: 20, delay: 4 },
  { x: 80, y: 70, size: 70, duration: 16, delay: 1 },
  { x: 50, y: 35, size: 50, duration: 22, delay: 3 },
])
</script>

<style lang="scss" scoped>
.dynamic-background {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  transition: background 1s ease;
  overflow: hidden;
}

.floating-orbs {
  position: absolute;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.floating-orb {
  position: absolute;
  border-radius: 50%;
  background: radial-gradient(
    circle at 30% 30%,
    rgba(255, 255, 255, 0.25),
    rgba(255, 255, 255, 0.08)
  );
  backdrop-filter: blur(2px);
  animation: float infinite ease-in-out;
  opacity: 0.6;
}

@keyframes float {
  0%,
  100% {
    transform: translate(0, 0) scale(1);
  }
  25% {
    transform: translate(30px, -40px) scale(1.1);
  }
  50% {
    transform: translate(-20px, 30px) scale(0.9);
  }
  75% {
    transform: translate(40px, 20px) scale(1.05);
  }
}
</style>
