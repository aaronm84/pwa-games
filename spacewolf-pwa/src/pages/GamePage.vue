<template>
  <q-page class="game-page">
    <BabylonCanvas class="canvas" />
    <TouchHud />

    <!-- Floating back button -->
    <button class="back-btn" @click="goBack" aria-label="Back to menu">
      <q-icon name="arrow_back" size="22px" />
    </button>
  </q-page>
</template>

<script setup>
import { useRouter } from 'vue-router'
import BabylonCanvas from 'src/components/BabylonCanvas.vue'
import TouchHud from 'src/components/TouchHud.vue'
import { useHaptics } from 'src/composables/useHaptics'

const router = useRouter()
const haptics = useHaptics()

function goBack() {
  haptics.light()
  router.push({ name: 'menu' })
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

.back-btn {
  position: absolute;
  top: max(14px, env(safe-area-inset-top));
  left: max(14px, env(safe-area-inset-left));
  z-index: 10;
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
</style>
