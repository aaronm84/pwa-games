<template>
  <canvas
    ref="canvasEl"
    class="babylon-canvas"
    @contextmenu.prevent
    @selectstart.prevent
    @dragstart.prevent
  />
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

function blockEvent(e) {
  e.preventDefault()
}

function blockDocContextMenu(e) {
  e.preventDefault()
}

onMounted(async () => {
  if (!canvasEl.value) return
  const canvas = canvasEl.value

  canvas.addEventListener('gesturestart', blockEvent, { passive: false })
  canvas.addEventListener('gesturechange', blockEvent, { passive: false })
  canvas.addEventListener('gestureend', blockEvent, { passive: false })
  document.addEventListener('contextmenu', blockDocContextMenu)

  try {
    game = createGameScene(canvas, inputStore, gameStateStore)
  } catch (err) {
    console.error('[BabylonCanvas] Failed to create scene:', err)
    return
  }

  // Wait until Babylon reports the scene is fully ready (materials
  // compiled, meshes built, point cloud meshed, first render frame
  // valid). Until this resolves, the boot overlay in GamePage shows a
  // spinner; once it does, the overlay swaps to a Launch button.
  try {
    await game.scene.whenReadyAsync()
  } catch (err) {
    console.error('[BabylonCanvas] Scene.whenReadyAsync failed:', err)
  }
  // One extra frame so the engine has rendered at least once — avoids
  // the "first tap on Launch shows a black screen for a beat" feel.
  await new Promise((resolve) => requestAnimationFrame(() => resolve()))

  gameStateStore.markSceneReady()
})

onBeforeUnmount(() => {
  if (canvasEl.value) {
    canvasEl.value.removeEventListener('gesturestart', blockEvent)
    canvasEl.value.removeEventListener('gesturechange', blockEvent)
    canvasEl.value.removeEventListener('gestureend', blockEvent)
  }
  document.removeEventListener('contextmenu', blockDocContextMenu)
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
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
  -webkit-user-drag: none;
  user-drag: none;
}
</style>
