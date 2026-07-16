<template>
  <!-- Hand-drawn league portraits. One flat-color SVG per rival, sized to fit
       wherever an emoji used to sit (chips, dialogs, banners). -->
  <svg :width="size" :height="size" viewBox="0 0 64 64" class="rival-avatar" aria-hidden="true">
    <!-- Cousin Rollo, the sloth: heavy lids, fuzzy face, no worries -->
    <g v-if="id === 'rollo'">
      <circle cx="32" cy="32" r="30" fill="#8a6f52" />
      <ellipse cx="32" cy="36" rx="20" ry="17" fill="#c9b08e" />
      <path d="M14 22 Q22 30 26 34" stroke="#5f4a33" stroke-width="7" stroke-linecap="round" fill="none" />
      <path d="M50 22 Q42 30 38 34" stroke="#5f4a33" stroke-width="7" stroke-linecap="round" fill="none" />
      <path d="M20 33 q3 3 6 0" stroke="#3a2c1e" stroke-width="2.4" fill="none" stroke-linecap="round" />
      <path d="M38 33 q3 3 6 0" stroke="#3a2c1e" stroke-width="2.4" fill="none" stroke-linecap="round" />
      <ellipse cx="32" cy="41" rx="4" ry="3" fill="#3a2c1e" />
      <path d="M26 48 q6 4 12 0" stroke="#3a2c1e" stroke-width="2.4" fill="none" stroke-linecap="round" />
    </g>

    <!-- Rexxie, the t-rex: all jaw, tiny doubts -->
    <g v-else-if="id === 'rex'">
      <circle cx="32" cy="32" r="30" fill="#2e6b3f" />
      <path d="M12 30 Q14 14 32 13 Q52 12 53 28 L53 38 Q47 36 44 39 L42 34 Q38 38 34 34 L33 40 Q28 40 26 36 Q20 40 12 38 Z" fill="#4fae63" />
      <circle cx="41" cy="24" r="4.5" fill="#f4f0e8" />
      <circle cx="42.2" cy="24.6" r="2" fill="#182018" />
      <path d="M14 40 L20 40 L17 46 Z M24 41 L30 41 L27 47 Z M34 41 L40 41 L37 47 Z M44 40 L50 40 L47 46 Z" fill="#f4f0e8" />
      <path d="M12 39 Q32 46 53 38" stroke="#245231" stroke-width="2" fill="none" />
      <circle cx="49" cy="30" r="1.6" fill="#245231" />
    </g>

    <!-- SPARE-O 3000: chrome, one antenna, zero mercy -->
    <g v-else-if="id === 'sparo'">
      <circle cx="32" cy="32" r="30" fill="#39414d" />
      <rect x="14" y="20" width="36" height="30" rx="7" fill="#9aa4b2" />
      <rect x="14" y="20" width="36" height="9" rx="4.5" fill="#b9c2ce" />
      <line x1="32" y1="8" x2="32" y2="18" stroke="#b9c2ce" stroke-width="3" stroke-linecap="round" />
      <circle cx="32" cy="8" r="3.4" fill="#ff3df0" />
      <rect x="20" y="30" width="9" height="6" rx="2" fill="#28d7fe" />
      <rect x="35" y="30" width="9" height="6" rx="2" fill="#28d7fe" />
      <rect x="24" y="42" width="16" height="3" rx="1.5" fill="#39414d" />
      <rect x="27" y="46" width="10" height="2" rx="1" fill="#39414d" />
    </g>

    <!-- Granny Lois: silver bun, gold rims, 50 years of league nights -->
    <g v-else-if="id === 'lois'">
      <circle cx="32" cy="32" r="30" fill="#7a4a6a" />
      <circle cx="32" cy="15" r="9" fill="#e8e2d4" />
      <path d="M12 34 Q12 16 32 16 Q52 16 52 34 L46 30 Q40 26 32 26 Q24 26 18 30 Z" fill="#e8e2d4" />
      <ellipse cx="32" cy="38" rx="17" ry="15" fill="#f0c9a8" />
      <circle cx="25" cy="36" r="5.5" fill="none" stroke="#e8c400" stroke-width="2.2" />
      <circle cx="39" cy="36" r="5.5" fill="none" stroke="#e8c400" stroke-width="2.2" />
      <line x1="30.5" y1="36" x2="33.5" y2="36" stroke="#e8c400" stroke-width="2.2" />
      <circle cx="25" cy="36" r="1.8" fill="#3a2c1e" />
      <circle cx="39" cy="36" r="1.8" fill="#3a2c1e" />
      <path d="M27 47 q5 4 10 0" stroke="#a05a4a" stroke-width="2.4" fill="none" stroke-linecap="round" />
      <circle cx="13.5" cy="42" r="2" fill="#f4f0e8" />
      <circle cx="50.5" cy="42" r="2" fill="#f4f0e8" />
    </g>

    <!-- fallback: a pin -->
    <g v-else>
      <circle cx="32" cy="32" r="30" fill="#39414d" />
      <path d="M32 12 q8 0 6 12 q-1 7 2 12 q4 7 -2 14 q-6 6 -12 0 q-6 -7 -2 -14 q3 -5 2 -12 q-2 -12 6 -12 Z" fill="#f4f0e8" />
      <rect x="25" y="26" width="14" height="3" rx="1.5" fill="#e33a4a" />
    </g>
  </svg>
</template>

<script setup>
defineProps({
  id: { type: String, required: true },
  size: { type: [Number, String], default: 28 },
})
</script>

<style scoped>
.rival-avatar { display: block; border-radius: 50%; }
</style>
