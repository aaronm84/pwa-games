<template>
  <canvas ref="canvasEl" class="babylon-canvas" />
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, defineExpose } from 'vue'
import { useInputStore } from 'src/stores/input'
import { useGameStateStore } from 'src/stores/gameState'
import { createGameScene } from 'src/game/scene'

const canvasEl = ref(null)
const inputStore = useInputStore()
const gameStateStore = useGameStateStore()
let game = null

onMounted(() => {
  if (!canvasEl.value) return
  game = createGameScene(canvasEl.value, inputStore, gameStateStore)
  game.startRun()
})

onBeforeUnmount(() => {
  if (game) {
    game.dispose()
    game = null
  }
})

function startRun() {
  if (game) game.startRun()
}

defineExpose({ startRun })
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
