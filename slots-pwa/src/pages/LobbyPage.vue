<template>
  <q-page class="lobby-page" :style="{ background: themeStore.colors.gradient }">
    <!-- Header -->
    <div class="game-header">
      <q-btn fab-mini flat icon="arrow_back" color="white" @click="goBack" />
      <div class="title">Casino Floor</div>
      <div class="header-menu">
        <q-btn fab-mini flat icon="help_outline" color="white" @click="howToPlay" />
      </div>
    </div>

    <!-- Bankroll -->
    <div class="bankroll">
      <div class="bk-box">
        <div class="bk-label">Credits</div>
        <div class="bk-val">{{ casino.credits.toLocaleString() }}</div>
      </div>
      <div class="bk-box jp">
        <div class="bk-label">💎 Jackpot</div>
        <div class="bk-val">{{ casino.jackpot.toLocaleString() }}</div>
      </div>
    </div>

    <!-- Machines -->
    <div class="machines">
      <button
        v-for="m in machines"
        :key="m.id"
        class="machine-card"
        :class="{ soon: m.soon }"
        :style="{ '--accent': m.accent }"
        :disabled="m.soon"
        @click="pick(m)"
      >
        <div class="mc-icon">{{ m.emoji }}</div>
        <div class="mc-text">
          <div class="mc-name">{{ m.name }}</div>
          <div class="mc-tag">{{ m.tag }}</div>
        </div>
        <div class="mc-cta">{{ m.soon ? 'Soon' : 'Play ›' }}</div>
      </button>
    </div>

    <p class="hint">One bankroll across every machine · play for fun, no real money</p>

    <!-- Daily bonus -->
    <q-dialog v-model="showDaily">
      <q-card class="dlg">
        <q-card-section class="text-center">
          <div class="dlg-title">🎁 Daily Bonus</div>
          <div class="dlg-sub">Welcome back — here's a fresh stack of credits.</div>
        </q-card-section>
        <q-card-actions align="center">
          <q-btn unelevated color="primary" text-color="white" :label="`Collect +${DAILY.toLocaleString()}`" @click="collectDaily" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useThemeStore } from 'src/stores/theme'
import { useProgressStore } from 'src/stores/progress'
import { useHaptics } from 'src/composables/useHaptics'

const DAILY = 1000

const router = useRouter()
const themeStore = useThemeStore()
const progressStore = useProgressStore()
const { casino } = storeToRefs(progressStore)
const haptics = useHaptics()

const showDaily = ref(false)

const machines = [
  { id: 'gem', name: 'Gem Fortune', tag: '5×3 · 20 lines · Free Spins', emoji: '💎', accent: '#8e5fc8', route: 'gem-fortune' },
  { id: 'lucky', name: 'Lucky 7s', tag: 'Classic 3-reel · Hold', emoji: '7️⃣', accent: '#ff4d6d', route: 'lucky-sevens' },
  { id: 'sugar', name: 'Sugar Tumble', tag: '6×5 · Cascading combos', emoji: '🍬', accent: '#ff8ac6', soon: true },
  { id: 'wild', name: 'Wild Ways', tag: 'Megaways · ~100k ways', emoji: '🌟', accent: '#f5c542', soon: true },
]

function pick(m) {
  if (m.soon) return
  haptics.medium()
  router.push({ name: m.route })
}
function collectDaily() {
  progressStore.addCredits(DAILY)
  casino.value.lastDaily = todayNum()
  progressStore.save()
  showDaily.value = false
  haptics.success()
}
function todayNum() {
  return Math.floor(Date.now() / 86400000)
}
function goBack() {
  haptics.light()
  router.push({ name: 'menu' })
}
function howToPlay() {
  haptics.light()
  router.push({ name: 'how-to-play' })
}

onMounted(() => {
  if (casino.value.lastDaily !== todayNum()) showDaily.value = true
})
</script>

<style lang="scss" scoped>
.lobby-page {
  min-height: 100vh;
  transition: background 2s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow: hidden;
}
.game-header {
  width: 100%;
  max-width: 540px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  padding-top: max(52px, calc(env(safe-area-inset-top) + 12px));
}
.title { flex: 1; text-align: center; color: #fff; font-weight: 800; font-size: 1.2rem; letter-spacing: 0.03em; }
.header-menu { display: flex; gap: 2px; }

.bankroll {
  width: 100%;
  max-width: 460px;
  display: flex;
  gap: 10px;
  padding: 4px 16px 10px;
}
.bk-box {
  flex: 1;
  background: rgba(0, 0, 0, 0.28);
  border-radius: 14px;
  padding: 10px 16px;
  text-align: center;
  color: #fff;
}
.bk-box.jp { border: 1px solid rgba(255, 220, 120, 0.4); }
.bk-label { font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.75; }
.bk-val { font-size: 1.4rem; font-weight: 800; font-variant-numeric: tabular-nums; }
.bk-box.jp .bk-val { color: #ffe08a; text-shadow: 0 0 10px rgba(255, 210, 120, 0.6); }

.machines {
  width: 100%;
  max-width: 460px;
  flex: 1;
  overflow-y: auto;
  padding: 6px 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.machine-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.11), rgba(255, 255, 255, 0.05));
  border-left: 5px solid var(--accent);
  color: #fff;
  cursor: pointer;
  transition: transform 0.12s ease, background 0.2s ease;
}
.machine-card:not(.soon):active { transform: scale(0.98); }
.machine-card:not(.soon):hover { background: rgba(255, 255, 255, 0.16); }
.machine-card.soon { opacity: 0.5; cursor: default; }
.mc-icon {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background: rgba(0, 0, 0, 0.28);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.7rem;
  flex-shrink: 0;
}
.mc-text { flex: 1; min-width: 0; text-align: left; }
.mc-name { font-weight: 800; font-size: 1.1rem; }
.mc-tag { font-size: 0.8rem; opacity: 0.75; }
.mc-cta { font-weight: 800; color: var(--accent); flex-shrink: 0; }
.machine-card.soon .mc-cta { color: rgba(255, 255, 255, 0.5); }

.hint {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.8rem;
  text-align: center;
  margin: 4px 24px max(16px, env(safe-area-inset-bottom));
}
.dlg {
  background: rgba(40, 18, 60, 0.97);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 18px;
  color: #fff;
  min-width: 280px;
  :deep(*) { color: #fff; }
}
.dlg-title { font-size: 1.4rem; font-weight: 800; }
.dlg-sub { opacity: 0.8; margin-top: 6px; }
:deep(.q-btn.bg-primary) { background: linear-gradient(135deg, #ff8a3d 0%, #ff4d6d 100%) !important; }
</style>
