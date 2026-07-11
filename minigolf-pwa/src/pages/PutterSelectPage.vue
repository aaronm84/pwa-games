<template>
  <q-page class="select-page">
    <DynamicBackground />
    <div class="wrap">
      <div class="head">
        <q-btn flat round icon="arrow_back" color="white" @click="goBack" />
        <h1>The Bag</h1>
      </div>
      <p class="sub">Each putter plays differently. Unlock more by finishing rounds and sinking aces.</p>

      <div class="putters">
        <button
          v-for="p in putters"
          :key="p.id"
          class="putter-card"
          :class="{ equipped: p.id === selected, locked: !unlocked(p) }"
          :disabled="!unlocked(p)"
          @click="equip(p)"
        >
          <span class="pc-emoji">{{ unlocked(p) ? p.emoji : '🔒' }}</span>
          <span class="pc-body">
            <span class="pc-name">{{ p.name }}</span>
            <span class="pc-blurb">{{ p.blurb }}</span>
            <span v-if="!unlocked(p)" class="pc-lock">Locked · {{ p.unlock.label }}</span>
          </span>
          <span v-if="p.id === selected" class="pc-tag">Equipped</span>
        </button>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { putters, isUnlocked } from 'src/game/putters'
import { useSettingsStore } from 'src/stores/settings'
import { useProgressStore } from 'src/stores/progress'
import { useHaptics } from 'src/composables/useHaptics'
import DynamicBackground from 'src/components/DynamicBackground.vue'

const router = useRouter()
const settings = useSettingsStore()
const progress = useProgressStore()
const { minigolf } = storeToRefs(progress)
const haptics = useHaptics()

const selected = computed(() => settings.settings.selectedPutter)

function unlocked(p) {
  return isUnlocked(p, minigolf.value)
}
function equip(p) {
  if (!unlocked(p)) {
    haptics.light()
    return
  }
  haptics.medium()
  settings.updateSetting('selectedPutter', p.id)
  router.back()
}
function goBack() {
  haptics.light()
  router.back()
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
.head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.head h1 { font-size: 1.6rem; font-weight: 800; color: #fff; margin: 0; text-shadow: 0 3px 10px rgba(0,0,0,0.3); }
.sub { color: rgba(255,255,255,0.85); font-size: 0.9rem; margin: 0 0 18px; text-shadow: 0 1px 4px rgba(0,0,0,0.3); }

.putters { display: flex; flex-direction: column; gap: 12px; }
.putter-card {
  display: flex;
  align-items: center;
  gap: 14px;
  text-align: left;
  padding: 14px 16px;
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 16px;
  background: rgba(255,255,255,0.12);
  backdrop-filter: blur(10px);
  color: #fff;
  cursor: pointer;
}
.putter-card.equipped { border-color: #ffd54f; background: rgba(255,213,79,0.16); }
.putter-card.locked { opacity: 0.55; cursor: default; }
.pc-emoji { font-size: 2rem; flex-shrink: 0; width: 40px; text-align: center; }
.pc-body { display: flex; flex-direction: column; gap: 2px; flex: 1; }
.pc-name { font-size: 1.1rem; font-weight: 700; }
.pc-blurb { font-size: 0.85rem; opacity: 0.88; line-height: 1.35; }
.pc-lock { font-size: 0.78rem; color: #ffd54f; margin-top: 3px; font-weight: 600; }
.pc-tag { font-size: 0.72rem; font-weight: 800; color: #ffd54f; text-transform: uppercase; letter-spacing: 0.05em; }
</style>
