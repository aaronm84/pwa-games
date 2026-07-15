<template>
  <q-page class="how-to-play-page">
    <!-- Dynamic Background -->
    <DynamicBackground />

    <!-- Content -->
    <div class="content-wrapper">
      <div class="content-container">
        <h1 class="page-title">How to Play</h1>

        <div class="instructions">
          <!-- Objective -->
          <div class="instruction-card">
            <div class="card-icon">
              <q-icon name="emoji_events" size="xl" color="primary" />
            </div>
            <h2>Objective</h2>
            <p>
              Bowl a full <strong>ten-frame game</strong> and post the biggest score
              you can. Two throws per frame (three in the tenth if you earn them),
              real <strong>strike and spare bonuses</strong>, and a maximum of
              <strong>300</strong>. Pick an <strong>alley</strong> for the vibe and a
              <strong>ball</strong> from the rack for the feel.
            </p>
          </div>

          <!-- How to Play -->
          <div class="instruction-card">
            <div class="card-icon">
              <q-icon name="touch_app" size="xl" color="primary" />
            </div>
            <h2>How to Play</h2>
            <ol>
              <li><strong>Drag back</strong> to wind up — further is <strong>more power</strong></li>
              <li>Drag <strong>sideways</strong> while winding up to add <strong>hook</strong> — the ball bends down-lane</li>
              <li><strong>Release</strong> to bowl</li>
              <li>Swap balls anytime from the <strong>rack</strong> (bottom-right)</li>
            </ol>
          </div>

          <!-- Rules -->
          <div class="instruction-card">
            <div class="card-icon">
              <q-icon name="rule" size="xl" color="amber" />
            </div>
            <h2>Scoring</h2>
            <ul>
              <li><strong>Strike</strong> (X): all ten on the first throw — scores 10 + your next <strong>two</strong> throws</li>
              <li><strong>Spare</strong> (/): the rest on your second throw — scores 10 + your next throw</li>
              <li>The <strong>tenth frame</strong> gives bonus throws if you strike or spare</li>
              <li>Twelve strikes in a row = a <strong>300</strong>. Good luck.</li>
            </ul>
          </div>

          <!-- Hazards -->
          <div class="instruction-card">
            <div class="card-icon">
              <q-icon name="waves" size="xl" color="light-blue-4" />
            </div>
            <h2>The Alleys</h2>
            <ul>
              <li>🪩 <strong>Disco Nova</strong> — cosmic lanes; strikes drop the mirror-ball confetti</li>
              <li>🌋 <strong>Lava Lanes</strong> — the gutters are molten; gutter balls <em>sizzle</em></li>
              <li>🛸 <strong>Zero-G Lanes</strong> — station gravity: pins topple in glorious slow motion</li>
              <li>🎳 <strong>The rack</strong> — the Boulder scatters, the Comet and Glitterball hook hard</li>
            </ul>
          </div>

          <!-- Tips -->
          <div class="instruction-card">
            <div class="card-icon">
              <q-icon name="lightbulb" size="xl" color="green" />
            </div>
            <h2>Tips</h2>
            <ul>
              <li>Aim the hook <strong>into the pocket</strong> — between the head pin and its neighbor</li>
              <li>Heavy balls <strong>plow through</strong>; light balls <strong>bend more</strong></li>
              <li>Straight at the head pin often leaves a <strong>split</strong> — the pros curve it</li>
              <li>For spares, play <strong>straight and simple</strong>. Save the style for fresh racks.</li>
            </ul>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="action-buttons">
          <q-btn
            unelevated
            size="lg"
            color="primary"
            text-color="white"
            label="Start Playing"
            icon="play_arrow"
            @click="startPlaying"
          />
          <q-btn
            flat
            size="lg"
            color="white"
            label="Back to Menu"
            @click="goBack"
          />
        </div>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { useHaptics } from 'src/composables/useHaptics'
import DynamicBackground from 'src/components/DynamicBackground.vue'

const router = useRouter()
const haptics = useHaptics()

function startPlaying() {
  haptics.medium()
  router.push({ name: 'minigolf' })
}

function goBack() {
  haptics.light()
  router.back()
}
</script>

<style lang="scss" scoped>
.how-to-play-page {
  position: relative;
  overflow: auto;
}

.content-wrapper {
  position: relative;
  z-index: 2;
  min-height: 100vh;
  padding: 24px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

.content-container {
  width: 100%;
  max-width: 800px;
  padding: 32px 0;
  animation: fadeIn 0.6s ease-out;
}

.page-title {
  font-size: 2.5rem;
  font-weight: 800;
  text-align: center;
  margin: 0 0 40px 0;
  color: white;
  text-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.instructions {
  display: flex;
  flex-direction: column;
  gap: 24px;
  margin-bottom: 40px;
}

.instruction-card {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 24px;
  color: white;
  animation: fadeInUp 0.6s ease-out backwards;

  &:nth-child(1) { animation-delay: 0.1s; }
  &:nth-child(2) { animation-delay: 0.2s; }
  &:nth-child(3) { animation-delay: 0.3s; }
  &:nth-child(4) { animation-delay: 0.4s; }
  &:nth-child(5) { animation-delay: 0.5s; }
}

.card-icon {
  text-align: center;
  margin-bottom: 16px;
}

.instruction-card h2 {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 16px 0;
  text-align: center;
}

.instruction-card p {
  font-size: 1rem;
  line-height: 1.6;
  margin: 0 0 12px 0;
  opacity: 0.95;

  &:last-child {
    margin-bottom: 0;
  }
}

.instruction-card ol,
.instruction-card ul {
  margin: 0;
  padding-left: 24px;
  font-size: 1rem;
  line-height: 1.6;
  opacity: 0.95;
}

.instruction-card li {
  margin-bottom: 8px;

  &:last-child {
    margin-bottom: 0;
  }
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
  animation: fadeInUp 0.6s ease-out 0.6s backwards;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

// Mobile responsive
@media (max-width: 600px) {
  .page-title {
    font-size: 2rem;
  }

  .instruction-card {
    padding: 20px;
  }

  .instruction-card h2 {
    font-size: 1.3rem;
  }

  .instruction-card p,
  .instruction-card ol,
  .instruction-card ul {
    font-size: 0.95rem;
  }
}
</style>
