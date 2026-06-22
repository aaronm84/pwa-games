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
              Each <strong>blind</strong> sets a chip target. Play poker hands from the
              cards you're dealt to score enough chips before your hands run out.
              Clear all three blinds in an <strong>ante</strong>, then push your luck
              through eight antes to win the run.
            </p>
          </div>

          <!-- How to Play -->
          <div class="instruction-card">
            <div class="card-icon">
              <q-icon name="touch_app" size="xl" color="primary" />
            </div>
            <h2>How to Play</h2>
            <ol>
              <li><strong>Tap cards</strong> to select up to <strong>five</strong> from your hand</li>
              <li><strong>Play Hand</strong> scores them as a poker hand: <em>chips × mult</em></li>
              <li><strong>Discard</strong> cards you don't want to draw replacements (limited)</li>
              <li>Beat the target to clear the blind and earn <strong>cash</strong></li>
              <li>The third blind each ante is a <strong>Boss Blind</strong> — it adds a twist (fewer hands, a dead suit, halved scores…). Read it before you play</li>
            </ol>
          </div>

          <!-- Rules -->
          <div class="instruction-card">
            <div class="card-icon">
              <q-icon name="rule" size="xl" color="amber" />
            </div>
            <h2>Scoring</h2>
            <ul>
              <li>Each hand type has a <strong>base chips &amp; mult</strong> (a Flush beats a Pair)</li>
              <li>Every scoring card adds its rank in <strong>chips</strong> (face = 10, ace = 11)</li>
              <li><strong>Jokers</strong> add chips, mult, or multiply your mult</li>
              <li>Final score = <strong>(base + card chips) × total mult</strong></li>
            </ul>
          </div>

          <!-- Tips -->
          <div class="instruction-card">
            <div class="card-icon">
              <q-icon name="lightbulb" size="xl" color="green" />
            </div>
            <h2>Tips</h2>
            <ul>
              <li>Spend cash in the <strong>shop</strong> between blinds on jokers</li>
              <li><strong>×mult</strong> jokers scale hardest once your mult is already high</li>
              <li>Hold spare <strong>hands</strong> at a blind — leftover hands pay a bonus</li>
              <li>Discards refill your hand — fish for a <strong>Flush</strong> or <strong>Straight</strong></li>
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
  router.push({ name: 'wildcard' })
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
