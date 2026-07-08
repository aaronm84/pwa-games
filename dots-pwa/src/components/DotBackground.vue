<template>
  <div class="dot-bg">
    <!-- faint connecting line threading through the dots -->
    <svg class="thread" viewBox="0 0 100 100" preserveAspectRatio="none">
      <polyline
        points="12,20 32,44 66,26 84,58 40,74 18,88"
        fill="none"
        stroke="rgba(255,255,255,0.12)"
        stroke-width="0.5"
        stroke-linecap="round"
      />
    </svg>
    <!-- drifting coloured dots -->
    <div
      v-for="(d, i) in dots"
      :key="i"
      class="bg-dot"
      :style="{
        left: d.x + '%',
        top: d.y + '%',
        width: d.size + 'px',
        height: d.size + 'px',
        background: d.color,
        animationDuration: d.dur + 's',
        animationDelay: d.delay + 's',
      }"
    ></div>
  </div>
</template>

<script setup>
const C = ['#ef5350', '#42a5f5', '#66bb6a', '#ffca28', '#ab47bc']
const dots = [
  { x: 12, y: 20, size: 46, color: C[0], dur: 20, delay: 0 },
  { x: 32, y: 44, size: 34, color: C[1], dur: 24, delay: 2 },
  { x: 66, y: 26, size: 52, color: C[2], dur: 22, delay: 1 },
  { x: 84, y: 58, size: 40, color: C[3], dur: 26, delay: 3 },
  { x: 40, y: 74, size: 58, color: C[4], dur: 23, delay: 4 },
  { x: 18, y: 88, size: 36, color: C[1], dur: 28, delay: 1.5 },
  { x: 90, y: 16, size: 30, color: C[0], dur: 25, delay: 2.5 },
  { x: 58, y: 90, size: 44, color: C[2], dur: 27, delay: 0.5 },
]
</script>

<style lang="scss" scoped>
.dot-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  background:
    radial-gradient(circle at 22% 18%, rgba(66, 165, 245, 0.4), transparent 55%),
    radial-gradient(circle at 82% 82%, rgba(171, 71, 188, 0.4), transparent 55%),
    linear-gradient(160deg, #10203a 0%, #16123a 50%, #241442 100%);
}
.thread {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.bg-dot {
  position: absolute;
  border-radius: 50%;
  filter: blur(2px);
  opacity: 0.5;
  box-shadow: 0 0 20px currentColor;
  animation: bob infinite ease-in-out;
  mix-blend-mode: screen;
}
@keyframes bob {
  0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.45; }
  50% { transform: translate(10px, -18px) scale(1.15); opacity: 0.75; }
}
</style>
