<template>
  <!-- The house at night: a neon lane rushing to its vanishing point, a rack
       of glowing pins on the horizon, a ball forever rolling out, and dust
       motes drifting through the beams. Pure CSS — no assets, no canvas. -->
  <div class="alley-backdrop">
    <div class="sky" />
    <div class="stars">
      <span v-for="s in stars" :key="s.id" class="star" :style="s.style" />
    </div>
    <div class="floor">
      <div class="lane">
        <div class="rail rail-l" />
        <div class="rail rail-r" />
        <div class="board" v-for="b in 5" :key="b" :style="{ left: 26 + b * 8 + '%' }" />
        <div class="pins">
          <span v-for="p in 7" :key="p" class="pin" :style="{ animationDelay: p * 0.35 + 's' }" />
        </div>
        <div class="ball" />
      </div>
      <div class="glow-pool" />
    </div>
    <div class="arc arc-a" />
    <div class="arc arc-b" />
  </div>
</template>

<script setup>
// deterministic scatter — same sky every visit, no Math.random in render
const stars = Array.from({ length: 26 }, (_, i) => {
  const x = (i * 137.5) % 100
  const y = (i * 61.8) % 58
  const s = 1.5 + ((i * 7) % 3)
  return {
    id: i,
    style: {
      left: x + '%',
      top: y + '%',
      width: s + 'px',
      height: s + 'px',
      animationDelay: ((i * 1.7) % 6) + 's',
      animationDuration: 3 + ((i * 2.3) % 4) + 's',
    },
  }
})
</script>

<style lang="scss" scoped>
.alley-backdrop {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  background: #0b0817;
}

.sky {
  position: absolute;
  inset: 0 0 34% 0;
  background:
    radial-gradient(ellipse 120% 90% at 50% 115%, rgba(123, 47, 240, 0.35), transparent 60%),
    linear-gradient(180deg, #060410 0%, #150f2e 70%, #241b4a 100%);
}

.star {
  position: absolute;
  border-radius: 50%;
  background: #cdd3ff;
  opacity: 0.25;
  animation: twinkle ease-in-out infinite;
}
@keyframes twinkle {
  0%, 100% { opacity: 0.15; }
  50% { opacity: 0.85; }
}

/* the floor plane, lit from the lane */
.floor {
  position: absolute;
  inset: 66% 0 0 0;
  background: linear-gradient(180deg, #17102c 0%, #0b0817 100%);
}

/* the lane: a trapezoid rushing to the horizon line */
.lane {
  position: absolute;
  left: 50%;
  bottom: 0;
  width: min(78vw, 480px);
  height: 100%;
  transform: translateX(-50%);
  clip-path: polygon(50% 0%, 50% 0%, 100% 100%, 0% 100%);
  background: linear-gradient(180deg, rgba(90, 62, 160, 0.55) 0%, rgba(52, 36, 96, 0.5) 55%, rgba(36, 27, 58, 0.55) 100%);
}
.lane::before {
  // vanishing-point widening: repaint the clip a touch wider up top
  content: '';
  position: absolute;
  inset: 0;
  clip-path: polygon(44% 0%, 56% 0%, 100% 100%, 0% 100%);
  background: linear-gradient(180deg, rgba(123, 90, 200, 0.35), transparent 70%);
}

.rail {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 3px;
  filter: blur(0.5px);
}
.rail-l {
  left: 6%;
  transform: skewX(17deg);
  transform-origin: bottom;
  background: linear-gradient(180deg, transparent, #ff3df0 30%, #ff3df0);
  box-shadow: 0 0 12px #ff3df0, 0 0 32px rgba(255, 61, 240, 0.6);
  animation: railpulse 5s ease-in-out infinite;
}
.rail-r {
  right: 6%;
  transform: skewX(-17deg);
  transform-origin: bottom;
  background: linear-gradient(180deg, transparent, #28d7fe 30%, #28d7fe);
  box-shadow: 0 0 12px #28d7fe, 0 0 32px rgba(40, 215, 254, 0.6);
  animation: railpulse 5s ease-in-out infinite 2.5s;
}
@keyframes railpulse {
  0%, 100% { opacity: 0.85; }
  50% { opacity: 0.5; }
}

.board {
  position: absolute;
  top: 12%;
  bottom: 0;
  width: 1px;
  background: linear-gradient(180deg, transparent, rgba(255, 255, 255, 0.06));
}

/* the rack on the horizon */
.pins {
  position: absolute;
  top: -3px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 5px;
}
.pin {
  width: 5px;
  height: 14px;
  border-radius: 3px 3px 2px 2px;
  background: #f4f0ff;
  box-shadow: 0 0 8px rgba(244, 240, 255, 0.9);
  animation: pinshine ease-in-out infinite 4s;
}
@keyframes pinshine {
  0%, 100% { box-shadow: 0 0 6px rgba(244, 240, 255, 0.5); }
  50% { box-shadow: 0 0 14px rgba(244, 240, 255, 1); }
}

/* the ball, forever rolling away down the boards */
.ball {
  position: absolute;
  left: 50%;
  bottom: 6%;
  width: 46px;
  height: 46px;
  margin-left: -23px;
  border-radius: 50%;
  background: radial-gradient(circle at 32% 28%, #6f9fe0, #2a5db0 55%, #142c56);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.6), inset -4px -6px 14px rgba(0, 0, 0, 0.5);
  animation: rollout 7s cubic-bezier(0.3, 0, 0.6, 1) infinite;
}
@keyframes rollout {
  0% { transform: scale(1) translateY(0); opacity: 0; }
  8% { opacity: 1; }
  92% { opacity: 1; }
  100% { transform: scale(0.06) translateY(-64vh); opacity: 0; }
}

/* soft neon spill where the lane meets the floor */
.glow-pool {
  position: absolute;
  left: 50%;
  bottom: -12%;
  width: 130%;
  height: 42%;
  transform: translateX(-50%);
  background: radial-gradient(ellipse at 50% 100%, rgba(123, 47, 240, 0.4), transparent 65%);
}

/* big slow neon arcs framing the room */
.arc {
  position: absolute;
  border-radius: 50%;
  border: 2px solid transparent;
  pointer-events: none;
}
.arc-a {
  width: 150vmax;
  height: 150vmax;
  left: 50%;
  top: 18%;
  transform: translateX(-50%);
  border-top-color: rgba(255, 61, 240, 0.5);
  box-shadow: 0 -6px 30px -6px rgba(255, 61, 240, 0.35);
  animation: arcdrift 11s ease-in-out infinite alternate;
}
.arc-b {
  width: 170vmax;
  height: 170vmax;
  left: 50%;
  top: 22%;
  transform: translateX(-50%);
  border-top-color: rgba(40, 215, 254, 0.4);
  box-shadow: 0 -6px 30px -6px rgba(40, 215, 254, 0.3);
  animation: arcdrift 13s ease-in-out infinite alternate-reverse;
}
@keyframes arcdrift {
  from { margin-top: 0; }
  to { margin-top: -3vh; }
}
</style>
