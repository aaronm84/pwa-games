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
              An <strong>artillery duel</strong>: you and the CPU sit on opposite
              ends of the battlefield. Take turns lobbing shells until one tank's
              health hits zero. Last tank standing wins.
            </p>
          </div>

          <!-- How to Play -->
          <div class="instruction-card">
            <div class="card-icon">
              <q-icon name="touch_app" size="xl" color="primary" />
            </div>
            <h2>How to Play</h2>
            <ol>
              <li>Set your <strong>angle</strong> and <strong>power</strong> with the sliders (or the −/+ steppers for fine control)</li>
              <li>Or just <strong>drag the battlefield</strong> from your tank — direction = angle, distance = power</li>
              <li>Pick a <strong>weapon</strong>, watch the dotted arc preview, then tap <strong>Fire</strong></li>
              <li>Fire a free <strong>Tracer</strong> first to range a target without doing damage</li>
            </ol>
          </div>

          <!-- Weapons -->
          <div class="instruction-card">
            <div class="card-icon">
              <q-icon name="rocket_launch" size="xl" color="primary" />
            </div>
            <h2>Weapons</h2>
            <ul>
              <li><strong>Missile</strong> — your reliable, unlimited shell</li>
              <li><strong>Big Nuke</strong> — huge blast radius and damage</li>
              <li><strong>MIRV</strong> — splits at the top of its arc into a spread of warheads</li>
              <li><strong>Roller</strong> — lands and rolls downhill into dug-in tanks</li>
              <li><strong>Tracer</strong> — free ranging shot, no damage</li>
            </ul>
          </div>

          <!-- Rules -->
          <div class="instruction-card">
            <div class="card-icon">
              <q-icon name="rule" size="xl" color="amber" />
            </div>
            <h2>Battle &amp; Armoury</h2>
            <ul>
              <li>Shells fall under <strong>gravity</strong> and drift with the <strong>wind</strong> (shown up top)</li>
              <li>Blasts <strong>carve the terrain</strong>; lose the ground under you and you take <strong>fall damage</strong></li>
              <li>Spend <strong>fuel</strong> to reposition, and use <strong>Repair</strong> / <strong>Shield</strong> / <strong>Parachute</strong></li>
              <li>Earn <strong>cash</strong> for the damage you deal; spend it in the <strong>Armoury</strong> between rounds</li>
              <li>Best of five rounds wins the war</li>
            </ul>
          </div>

          <!-- Tips -->
          <div class="instruction-card">
            <div class="card-icon">
              <q-icon name="lightbulb" size="xl" color="green" />
            </div>
            <h2>Tips</h2>
            <ul>
              <li><strong>Tracer, then commit</strong> — range with a free shot, then fire for real</li>
              <li>Nudge <strong>power by 10</strong> with the steppers to walk shots onto a target</li>
              <li>Save <strong>Nukes and MIRVs</strong> for when the enemy is exposed or low</li>
              <li><strong>Shield up</strong> when you're ahead; <strong>repair</strong> when you're hurt</li>
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
  router.push({ name: 'tankwars' })
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
