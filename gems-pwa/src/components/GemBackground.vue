<template>
  <div class="gem-bg">
    <!-- slowly drifting translucent gem facets -->
    <div
      v-for="(g, i) in facets"
      :key="i"
      class="facet"
      :style="{
        left: g.x + '%',
        top: g.y + '%',
        width: g.size + 'px',
        height: g.size + 'px',
        background: g.color,
        animationDuration: g.dur + 's',
        animationDelay: g.delay + 's',
      }"
    ></div>
    <!-- twinkles -->
    <div
      v-for="(t, i) in twinkles"
      :key="'t' + i"
      class="twinkle"
      :style="{ left: t.x + '%', top: t.y + '%', animationDuration: t.dur + 's', animationDelay: t.delay + 's' }"
    ></div>
  </div>
</template>

<script setup>
const COLORS = [
  'rgba(231,76,60,0.35)',
  'rgba(52,152,219,0.35)',
  'rgba(46,204,113,0.35)',
  'rgba(241,196,15,0.35)',
  'rgba(155,89,182,0.4)',
  'rgba(230,126,34,0.35)',
]
const facets = [
  { x: 12, y: 18, size: 90, color: COLORS[4], dur: 20, delay: 0 },
  { x: 74, y: 12, size: 64, color: COLORS[1], dur: 24, delay: 2 },
  { x: 28, y: 64, size: 110, color: COLORS[0], dur: 26, delay: 4 },
  { x: 82, y: 68, size: 76, color: COLORS[3], dur: 22, delay: 1 },
  { x: 54, y: 38, size: 56, color: COLORS[2], dur: 28, delay: 3 },
  { x: 8, y: 84, size: 70, color: COLORS[5], dur: 25, delay: 5 },
  { x: 90, y: 44, size: 50, color: COLORS[4], dur: 30, delay: 2.5 },
]
const twinkles = [
  { x: 22, y: 30, dur: 3.2, delay: 0 },
  { x: 66, y: 24, dur: 4.1, delay: 1.2 },
  { x: 40, y: 72, dur: 3.6, delay: 0.6 },
  { x: 84, y: 56, dur: 4.6, delay: 2.1 },
  { x: 14, y: 52, dur: 3.9, delay: 1.6 },
  { x: 58, y: 84, dur: 4.3, delay: 0.9 },
  { x: 48, y: 14, dur: 3.4, delay: 2.6 },
]
</script>

<style lang="scss" scoped>
.gem-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  background:
    radial-gradient(circle at 25% 15%, rgba(155, 89, 182, 0.55), transparent 55%),
    radial-gradient(circle at 85% 85%, rgba(214, 93, 177, 0.45), transparent 55%),
    linear-gradient(160deg, #1a1136 0%, #2a1552 45%, #431a5e 100%);
}
.facet {
  position: absolute;
  border-radius: 22% 78% 30% 70% / 70% 30% 70% 30%;
  transform: rotate(45deg);
  filter: blur(4px);
  animation: drift infinite ease-in-out;
  mix-blend-mode: screen;
}
@keyframes drift {
  0%, 100% { transform: translate(0, 0) rotate(45deg) scale(1); opacity: 0.55; }
  50% { transform: translate(14px, -22px) rotate(70deg) scale(1.12); opacity: 0.85; }
}
.twinkle {
  position: absolute;
  width: 10px;
  height: 10px;
  background: radial-gradient(circle, #fff, transparent 70%);
  animation: twinkle infinite ease-in-out;
  opacity: 0;
}
.twinkle::before,
.twinkle::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(currentColor, currentColor) center/2px 100% no-repeat,
    linear-gradient(currentColor, currentColor) center/100% 2px no-repeat;
  color: rgba(255, 255, 255, 0.9);
}
@keyframes twinkle {
  0%, 100% { opacity: 0; transform: scale(0.4); }
  50% { opacity: 0.9; transform: scale(1); }
}
</style>
