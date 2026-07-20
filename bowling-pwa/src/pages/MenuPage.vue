<template>
  <q-page class="menu-page">
    <!-- the house at night — custom CSS scene, not the template orbs -->
    <AlleyBackdrop />

    <!-- Menu Content -->
    <div class="menu-content">
      <!-- Title: a buzzing neon sign -->
      <div class="title-section">
        <h1 class="game-title neon-sign">
          <span class="neon-word">ALLEY</span>
          <span class="neon-word neon-word-alt">NIGHTS</span>
        </h1>
        <p class="game-subtitle">Cosmic ten-pin · real physics</p>
      </div>

      <!-- pick a house: compact tile grid, then one big Bowl button -->
      <div class="menu-buttons">
        <div class="alley-grid">
          <button
            v-for="a in alleys"
            :key="a.id"
            class="alley-tile"
            :class="{ sel: a.id === settings.settings.selectedAlley }"
            @click="selectAlley(a.id)"
          >
            <span class="tile-icon">{{ a.icon }}</span>
            <span class="tile-name">{{ a.name }}</span>
          </button>
        </div>
        <div class="alley-tagline">{{ selectedAlleyObj.tagline }}</div>

        <q-btn unelevated size="xl" color="primary" text-color="white" class="bowl-btn" @click="playSelected">
          <span class="bowl-label">🎳 Bowl at {{ selectedAlleyObj.name }}</span>
        </q-btn>

        <div class="pair-row">
          <q-btn unelevated color="secondary" text-color="white" class="pair-btn" @click="showRivals = true">
            <div class="pair-content"><span class="pair-icon">🤜</span><span>Rival</span></div>
          </q-btn>
          <q-btn unelevated color="secondary" text-color="white" class="pair-btn" @click="playTournament">
            <div class="pair-content">
              <RivalAvatar :id="nextTournamentRival.id" :size="22" />
              <span>Tournament <small>R{{ bowling.tournamentStage + 1 }}/3</small></span>
            </div>
          </q-btn>
        </div>
        <div class="pair-row">
          <q-btn flat text-color="white" class="pair-btn pair-quiet" icon="help_outline" label="How to Play" @click="howToPlay" />
          <q-btn flat text-color="white" class="pair-btn pair-quiet" icon="settings" label="Settings" @click="openSettings" />
        </div>
      </div>

      <!-- one-line progress strip -->
      <div v-if="bowling.games > 0" class="progress-line">
        <span>🏆 Best {{ bowling.bestScore }}</span>
        <span v-if="bowling.totalStrikes > 0">⚡ {{ bowling.totalStrikes }} strikes</span>
        <span v-if="bowling.rivalWins > 0">🤜 {{ bowling.rivalWins }} rival wins</span>
        <span v-if="bowling.perfectGames > 0">⭐ {{ bowling.perfectGames }}×300</span>
      </div>
    </div>
    <q-dialog v-model="showRivals">
      <q-card class="rival-card">
        <q-card-section class="text-h6 text-white">Pick your rival</q-card-section>
        <q-card-section class="q-pt-none">
          <q-btn v-for="r in rivals" :key="r.id" flat no-caps class="rival-row" @click="playRival(r.id)">
            <RivalAvatar :id="r.id" :size="38" />
            <span class="r-text">
              <span class="r-name">{{ r.name }}</span>
              <span class="r-blurb">{{ r.blurb }}</span>
            </span>
          </q-btn>
          <div class="alley-pick">
            <span class="ap-label">Where</span>
            <button
              v-for="a in alleys"
              :key="a.id"
              class="ap-chip"
              :class="{ sel: a.id === settings.settings.selectedAlley }"
              :title="a.name"
              @click="pickAlley(a.id)"
            >{{ a.icon }}</button>
          </div>
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useProgressStore } from 'src/stores/progress'
import { useSettingsStore } from 'src/stores/settings'
import { useHaptics } from 'src/composables/useHaptics'
import { ref, computed } from 'vue'
import { alleys, alleyById } from 'src/game/alleys'
import { rivals, rivalById, TOURNAMENT } from 'src/game/rivals'
import AlleyBackdrop from 'src/components/AlleyBackdrop.vue'
import RivalAvatar from 'src/components/RivalAvatar.vue'

const router = useRouter()
const progressStore = useProgressStore()
const settings = useSettingsStore()
const { bowling } = storeToRefs(progressStore)
const haptics = useHaptics()

const showRivals = ref(false)
const selectedAlleyObj = computed(() => alleyById(settings.settings.selectedAlley))
const nextTournamentRival = computed(() => rivalById(TOURNAMENT[Math.min(2, bowling.value.tournamentStage)]) || rivals[1])

function pickAlley(id) {
  haptics.light()
  settings.updateSetting('selectedAlley', id)
}
function playRival(id) {
  haptics.medium()
  showRivals.value = false
  router.push({ name: 'bowl', query: { vs: id } })
}
function playTournament() {
  haptics.medium()
  router.push({ name: 'bowl', query: { vs: nextTournamentRival.value.id, tour: 1 } })
}

function selectAlley(id) {
  haptics.light()
  settings.updateSetting('selectedAlley', id)
}
function playSelected() {
  haptics.medium()
  router.push({ name: 'bowl' })
}

function howToPlay() {
  haptics.light()
  router.push({ name: 'how-to-play' })
}

function openSettings() {
  haptics.light()
  router.push({ name: 'settings' })
}
</script>

<style lang="scss" scoped>
.rival-card { background: #1c2530; min-width: 300px; }
.rival-row { display: flex; width: 100%; justify-content: flex-start; text-align: left; color: #fff; padding: 10px 12px; }
.rival-row :deep(.q-btn__content) { justify-content: flex-start; gap: 12px; }
.alley-pick { display: flex; align-items: center; gap: 8px; margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.12); }
.ap-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.06em; color: rgba(255,255,255,0.6); }
.ap-chip { width: 38px; height: 38px; border-radius: 50%; border: 2px solid transparent; background: rgba(255,255,255,0.08); font-size: 1.15rem; cursor: pointer; }
.ap-chip.sel { border-color: #6ee07a; background: rgba(110,224,122,0.15); }
.r-text { display: flex; flex-direction: column; }
.r-name { font-weight: 700; }
.r-blurb { font-size: 0.75rem; opacity: 0.7; }

.menu-page {
  position: relative;
  overflow: hidden;
  min-height: 100vh;
}

.menu-content {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 32px 24px;
  padding-bottom: max(32px, env(safe-area-inset-bottom));
  gap: 48px;
}

.title-section {
  text-align: center;
  animation: fadeInDown 0.8s ease-out;
}

.game-title {
  font-family: 'Quicksand', sans-serif;
  font-size: 3.4rem;
  font-weight: 700;
  margin: 0 0 8px 0;
  letter-spacing: 0.08em;
  display: flex;
  flex-direction: column;
  line-height: 1.05;
}

// the sign out front: two neon tubes, one of them slightly on the fritz
.neon-word {
  color: #ffe9fd;
  text-shadow:
    0 0 6px #ff3df0,
    0 0 18px #ff3df0,
    0 0 42px rgba(255, 61, 240, 0.7),
    0 2px 4px rgba(0, 0, 0, 0.6);
}
.neon-word-alt {
  color: #eafcff;
  text-shadow:
    0 0 6px #28d7fe,
    0 0 18px #28d7fe,
    0 0 42px rgba(40, 215, 254, 0.7),
    0 2px 4px rgba(0, 0, 0, 0.6);
  animation: neonflicker 6.5s linear infinite;
}
@keyframes neonflicker {
  0%, 41%, 44.5%, 100% { opacity: 1; }
  41.5%, 42.4% { opacity: 0.35; }
  42.5%, 43.4% { opacity: 0.85; }
  43.5%, 44.4% { opacity: 0.45; }
}

.game-subtitle {
  font-size: 1.1rem;
  color: rgba(255, 255, 255, 0.8);
  margin: 0;
  font-weight: 400;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.menu-buttons {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
  max-width: 400px;
  animation: fadeInUp 0.8s ease-out 0.2s backwards;
}

.alley-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
// with ten houses the last tile would dangle left — park it in the center
.alley-tile:last-child:nth-child(3n + 1) {
  grid-column: 2;
}
.alley-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 4px 10px;
  border-radius: 14px;
  border: 2px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.09);
  backdrop-filter: blur(8px);
  color: #fff;
  cursor: pointer;
  transition: all 0.2s ease;
}
.alley-tile.sel {
  border-color: #6ee07a;
  background: rgba(110, 224, 122, 0.14);
  box-shadow: 0 0 18px rgba(110, 224, 122, 0.35);
}
.tile-icon { font-size: 1.6rem; line-height: 1; }
.tile-name { font-size: 0.72rem; font-weight: 600; letter-spacing: 0.01em; }

.alley-tagline {
  min-height: 2.2em;
  text-align: center;
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.75);
  padding: 0 8px;
}

.bowl-btn {
  border-radius: 16px;
  padding: 16px 12px;
  background: linear-gradient(120deg, rgba(123, 47, 240, 0.85), rgba(40, 120, 254, 0.85)) !important;
  box-shadow: 0 8px 30px rgba(123, 47, 240, 0.45);
}
.bowl-label { font-size: 1.15rem; font-weight: 700; letter-spacing: 0.02em; }

.pair-row { display: flex; gap: 10px; }
.pair-btn {
  flex: 1;
  border-radius: 12px;
  padding: 10px 6px;
  background: rgba(255, 255, 255, 0.12) !important;
  border: 1px solid rgba(255, 255, 255, 0.2);
}
.pair-btn.pair-quiet { background: transparent !important; border: none; opacity: 0.85; }
.pair-content { display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 600; }
.pair-content small { opacity: 0.7; font-weight: 400; }
.pair-icon { font-size: 1.1rem; }

.progress-line {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px 18px;
  color: rgba(255, 255, 255, 0.85);
  font-size: 0.85rem;
  animation: fadeInUp 0.8s ease-out 0.4s backwards;
}

.menu-btn {
  height: auto;
  padding: 20px 24px;
  border-radius: 16px;
  font-size: 1.1rem;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.15) !important;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.25);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-2px);
    background: rgba(255, 255, 255, 0.2) !important;
    border: 1px solid rgba(255, 255, 255, 0.35);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
  }

  &:active {
    transform: translateY(0);
    background: rgba(255, 255, 255, 0.25) !important;
  }
}

.btn-content {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
}

.btn-icon {
  flex-shrink: 0;
}

.btn-text {
  flex: 1;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.btn-label {
  font-size: 1.1rem;
  font-weight: 600;
  line-height: 1.2;
}

.btn-sublabel {
  font-size: 0.85rem;
  opacity: 0.8;
  font-weight: 400;
  line-height: 1.2;
}

.progress-info {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  width: 100%;
  max-width: 400px;
  animation: fadeInUp 0.8s ease-out 0.4s backwards;
}

.progress-stat {
  display: flex;
  align-items: center;
  gap: 12px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.95rem;
  font-weight: 500;

  span {
    flex: 1;
  }
}

@keyframes fadeInDown {
  from {
    opacity: 0;
    transform: translateY(-30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
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
  .game-title {
    font-size: 3rem;
  }

  .menu-content {
    gap: 32px;
  }

  .menu-btn {
    padding: 18px 20px;
  }

  .btn-label {
    font-size: 1rem;
  }

  .btn-sublabel {
    font-size: 0.8rem;
  }
}
</style>
