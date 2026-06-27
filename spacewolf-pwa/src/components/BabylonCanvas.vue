<template>
  <canvas ref="canvasEl" class="babylon-canvas" />
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useInputStore } from 'src/stores/input'
import { createGameScene } from 'src/game/scene'

const canvasEl = ref(null)
const inputStore = useInputStore()
let game = null

onMounted(() => {
  if (!canvasEl.value) return
  game = createGameScene(canvasEl.value, inputStore)
})

onBeforeUnmount(() => {
  if (game) {
    game.dispose()
    game = null
  }
})
</script>

<style scoped>
.babylon-canvas {
  display: block;
  width: 100%;
  height: 100%;
  outline: none;
  touch-action: none;
  -webkit-tap-highlight-color: transparent;
}
</style>
