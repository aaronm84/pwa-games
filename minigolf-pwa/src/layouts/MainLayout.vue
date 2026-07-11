<template>
  <q-layout view="lHh lpR fFf" style="background: transparent;">
    <!-- Dynamic gradient header (hidden for game pages) - overlay mode -->
    <div v-if="!isGamePage" class="main-header">
      <q-btn
        v-if="showBackButton"
        fab-mini
        flat
        icon="arrow_back"
        color="white"
        @click="goBack"
      />

      <q-space />

      <q-btn
        v-if="route.name === 'home'"
        fab-mini
        flat
        icon="settings"
        color="white"
        @click="goToSettings"
      />
    </div>

    <!-- Main Content -->
    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useHaptics } from 'src/composables/useHaptics'

const router = useRouter()
const route = useRoute()
const haptics = useHaptics()

const showBackButton = computed(() => {
  return route.name !== 'home' && route.name !== 'menu'
})

const isGamePage = computed(() => {
  // Hide header for game pages that have their own custom header
  return route.name === 'minigolf'
})

function goBack() {
  haptics.light()
  router.back()
}

function goToSettings() {
  haptics.light()
  router.push({ name: 'settings' })
}
</script>

<style lang="scss">
// Force layout to be transparent and fill screen
.q-layout {
  background: transparent !important;
  height: 100%;
}

.q-page-container {
  height: 100%;
}

.main-header {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
  padding: 16px;
  padding-top: max(56px, calc(env(safe-area-inset-top) + 16px));
  padding-left: max(16px, env(safe-area-inset-left));
  padding-right: max(16px, env(safe-area-inset-right));
  display: flex;
  justify-content: space-between;
  align-items: center;
  pointer-events: none;

  // Allow interaction with buttons only
  > * {
    pointer-events: all;
  }
}
</style>
