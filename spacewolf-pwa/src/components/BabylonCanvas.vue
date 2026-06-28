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

// Block iOS-specific gesture events that can still surface a callout on
// long press / two-finger pinch even when CSS suppresses the rest.
function blockEvent(e) {
  e.preventDefault()
}

// Document-level safety net while this component is mounted — some iOS
// versions dispatch the contextmenu event at the document level even
// when the page-level @contextmenu.prevent handler is attached.
function blockDocContextMenu(e) {
  e.preventDefault()
}

onMounted(() => {
  if (!canvasEl.value) return
  const canvas = canvasEl.value

  // iOS-specific gesture events (non-standard, only fired by WebKit).
  canvas.addEventListener('gesturestart', blockEvent, { passive: false })
  canvas.addEventListener('gesturechange', blockEvent, { passive: false })
  canvas.addEventListener('gestureend', blockEvent, { passive: false })

  // Belt-and-suspenders contextmenu blocker at the document level. This
  // catches any contextmenu event the browser might dispatch outside
  // the component tree (e.g. from a system long-press in Safari PWA mode).
  document.addEventListener('contextmenu', blockDocContextMenu)

  game = createGameScene(canvas, inputStore, gameStateStore)
  game.startRun()
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
  /* Block iOS pinch / double-tap zoom on the canvas. */
  touch-action: none;
  -webkit-tap-highlight-color: transparent;
  /* Apply the long-press callout suppression DIRECTLY on the canvas.
     CSS inheritance covers most browsers, but iOS Safari sometimes
     ignores inherited values on canvas elements specifically. */
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
  /* Prevent iOS treating the canvas as a draggable image. */
  -webkit-user-drag: none;
  user-drag: none;
}
</style>
