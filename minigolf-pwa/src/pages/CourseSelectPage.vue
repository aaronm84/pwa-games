<template>
  <q-page class="select-page">
    <DynamicBackground />
    <div class="wrap">
      <div class="head">
        <q-btn flat round icon="arrow_back" color="white" @click="goBack" />
        <h1>Choose a Course</h1>
      </div>

      <!-- Equipped putter -->
      <button class="putter-row" @click="pickPutter">
        <span class="pr-emoji">{{ putter.emoji }}</span>
        <span class="pr-text">
          <span class="pr-label">Putter</span>
          <span class="pr-name">{{ putter.name }}</span>
        </span>
        <span class="pr-change">Change ›</span>
      </button>

      <!-- Course cards -->
      <div class="courses">
        <button
          v-for="c in courses"
          :key="c.id"
          class="course-card"
          :style="{ background: c.theme.sky }"
          @click="play(c)"
        >
          <div class="cc-top">
            <span class="cc-name">{{ c.name }}</span>
            <span class="cc-meta">{{ c.holes.length }} holes · par {{ par(c) }}</span>
          </div>
          <p class="cc-tag">{{ c.tagline }}</p>
          <div class="cc-foot">
            <span v-if="best(c)" class="cc-best">🏆 Best {{ best(c).total }} ({{ toPar(best(c).toPar) }})</span>
            <span v-else class="cc-best muted">Not played yet</span>
            <span class="cc-play">Play ▸</span>
          </div>
        </button>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { courses, coursePar } from 'src/game/courses'
import { putterById } from 'src/game/putters'
import { useSettingsStore } from 'src/stores/settings'
import { useProgressStore } from 'src/stores/progress'
import { useHaptics } from 'src/composables/useHaptics'
import DynamicBackground from 'src/components/DynamicBackground.vue'

const router = useRouter()
const settings = useSettingsStore()
const progress = useProgressStore()
const { minigolf } = storeToRefs(progress)
const haptics = useHaptics()

const putter = computed(() => putterById(settings.settings.selectedPutter))

function par(c) {
  return coursePar(c)
}
function best(c) {
  return minigolf.value.records?.[c.id] || null
}
function toPar(t) {
  if (t === 0) return 'E'
  return t > 0 ? `+${t}` : `${t}`
}
function play(c) {
  haptics.medium()
  settings.updateSetting('selectedCourse', c.id)
  router.push({ name: 'minigolf' })
}
function pickPutter() {
  haptics.light()
  router.push({ name: 'putter-select' })
}
function goBack() {
  haptics.light()
  router.push({ name: 'menu' })
}
</script>

<style lang="scss" scoped>
.select-page { position: relative; min-height: 100vh; overflow: auto; }
.wrap {
  position: relative;
  z-index: 2;
  max-width: 560px;
  margin: 0 auto;
  padding: 24px 18px max(24px, env(safe-area-inset-bottom));
  padding-top: max(48px, calc(env(safe-area-inset-top) + 20px));
}
.head { display: flex; align-items: center; gap: 8px; margin-bottom: 18px; }
.head h1 { font-size: 1.6rem; font-weight: 800; color: #fff; margin: 0; text-shadow: 0 3px 10px rgba(0,0,0,0.3); }

.putter-row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  margin-bottom: 18px;
  border: 1px solid rgba(255,255,255,0.22);
  border-radius: 14px;
  background: rgba(255,255,255,0.12);
  backdrop-filter: blur(10px);
  color: #fff;
  cursor: pointer;
}
.pr-emoji { font-size: 1.6rem; }
.pr-text { display: flex; flex-direction: column; text-align: left; flex: 1; }
.pr-label { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.7; }
.pr-name { font-size: 1.05rem; font-weight: 700; }
.pr-change { font-size: 0.85rem; opacity: 0.85; font-weight: 600; }

.courses { display: flex; flex-direction: column; gap: 14px; }
.course-card {
  text-align: left;
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 18px;
  padding: 18px;
  color: #fff;
  cursor: pointer;
  box-shadow: 0 10px 30px rgba(0,0,0,0.22);
  transition: transform 0.15s ease;
}
.course-card:active { transform: scale(0.985); }
.cc-top { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.cc-name { font-size: 1.35rem; font-weight: 800; text-shadow: 0 2px 8px rgba(0,0,0,0.4); }
.cc-meta { font-size: 0.8rem; opacity: 0.9; white-space: nowrap; }
.cc-tag { margin: 8px 0 14px; font-size: 0.92rem; opacity: 0.92; line-height: 1.4; text-shadow: 0 1px 4px rgba(0,0,0,0.3); }
.cc-foot { display: flex; justify-content: space-between; align-items: center; }
.cc-best { font-size: 0.85rem; font-weight: 700; background: rgba(0,0,0,0.28); padding: 4px 10px; border-radius: 999px; }
.cc-best.muted { font-weight: 500; opacity: 0.8; }
.cc-play { font-weight: 800; font-size: 1rem; }
</style>
