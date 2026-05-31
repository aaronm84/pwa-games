<template>
  <q-page class="level-select-page">
    <DynamicBackground />

    <div class="content">
      <div class="header">
        <q-btn fab-mini flat icon="arrow_back" color="white" @click="goBack" />
        <h1 class="title">Select Level</h1>
        <div style="width: 40px"></div>
      </div>

      <p class="subtitle">{{ highestLevel }} level{{ highestLevel === 1 ? '' : 's' }} unlocked</p>

      <div class="level-grid">
        <button
          v-for="lvl in displayCount"
          :key="lvl"
          class="level-tile"
          :class="{ locked: lvl > highestLevel, current: lvl === highestLevel }"
          :disabled="lvl > highestLevel"
          @click="playLevel(lvl)"
        >
          <q-icon v-if="lvl > highestLevel" name="lock" size="20px" />
          <template v-else>
            <span class="lvl-num">{{ lvl }}</span>
            <span class="lvl-size">{{ sizeLabel(lvl) }}</span>
          </template>
        </button>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useProgressStore } from 'src/stores/progress'
import { useHaptics } from 'src/composables/useHaptics'
import DynamicBackground from 'src/components/DynamicBackground.vue'

const router = useRouter()
const progressStore = useProgressStore()
const { flow } = storeToRefs(progressStore)
const haptics = useHaptics()

const highestLevel = computed(() => flow.value.highestLevel)

// Show all unlocked levels plus a few locked ones as a preview, filling rows of 5.
const displayCount = computed(() => {
  const target = highestLevel.value + 3
  return Math.max(15, Math.ceil(target / 5) * 5)
})

// Mirror of FlowPage's difficulty curve, for the board-size hint on each tile.
function sizeLabel(lvl) {
  const stages = []
  for (const s of [5, 6, 7, 8, 9]) for (let i = 0; i < 3; i++) stages.push(s)
  const n = lvl - 1 < stages.length ? stages[lvl - 1] : 9
  return `${n}×${n}`
}

function playLevel(lvl) {
  if (lvl > highestLevel.value) return
  haptics.medium()
  router.push({ name: 'flow', query: { level: lvl } })
}

function goBack() {
  haptics.light()
  router.back()
}
</script>

<style lang="scss" scoped>
.level-select-page {
  position: relative;
  overflow: auto;
  min-height: 100vh;
}
.content {
  position: relative;
  z-index: 2;
  max-width: 540px;
  margin: 0 auto;
  padding: 16px 20px;
  padding-top: max(56px, calc(env(safe-area-inset-top) + 16px));
  padding-bottom: max(24px, env(safe-area-inset-bottom));
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.title {
  font-size: 1.6rem;
  font-weight: 700;
  color: #fff;
  margin: 0;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}
.subtitle {
  text-align: center;
  color: rgba(255, 255, 255, 0.8);
  margin: 4px 0 20px;
  font-size: 0.9rem;
}
.level-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
}
.level-tile {
  aspect-ratio: 1;
  border: none;
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  cursor: pointer;
  color: #fff;
  background: linear-gradient(135deg, #4363d8 0%, #42d4f4 100%);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.level-tile:hover:not(.locked) {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
}
.level-tile:active:not(.locked) {
  transform: translateY(0);
}
.level-tile.current {
  outline: 3px solid rgba(255, 255, 255, 0.9);
  outline-offset: 2px;
}
.level-tile.locked {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.4);
  cursor: not-allowed;
  box-shadow: none;
}
.lvl-num {
  font-size: 1.3rem;
  font-weight: 800;
  line-height: 1;
}
.lvl-size {
  font-size: 0.62rem;
  opacity: 0.85;
}
</style>
