<template>
  <q-page class="solitaire-page" :style="{ background: themeStore.colors.gradient }">
    <!-- Whimsical Floating Particles -->
    <div class="floating-particles">
      <!-- Butterflies during day, fireflies at night -->
      <div
        v-for="particle in floatingParticles"
        :key="'particle-' + particle.id"
        :class="['floating-particle', particleType]"
        :style="{
          left: particle.x + '%',
          top: particle.y + '%',
          animationDelay: particle.delay + 's',
          animationDuration: particle.duration + 's',
        }"
      ></div>
    </div>

    <!-- Placement Sparkles -->
    <div class="placement-sparkles">
      <div
        v-for="sparkle in placementSparkles"
        :key="'sparkle-' + sparkle.id"
        class="sparkle"
        :style="{
          left: sparkle.x + 'px',
          top: sparkle.y + 'px',
        }"
      >
        <div class="sparkle-particle"></div>
        <div class="sparkle-particle"></div>
        <div class="sparkle-particle"></div>
        <div class="sparkle-particle"></div>
      </div>
    </div>

    <!-- Drag Trail -->
    <div class="drag-trail">
      <div
        v-for="particle in dragTrail"
        :key="'trail-' + particle.id"
        class="trail-particle"
        :style="{
          left: particle.x + 'px',
          top: particle.y + 'px',
        }"
      ></div>
    </div>

    <!-- Game Header -->
    <div class="game-header">
      <q-btn fab-mini flat icon="arrow_back" color="white" @click="goBack" />

      <q-space />

      <div v-if="showStats" class="game-stats">
        <div class="stat-item">
          <q-icon name="schedule" size="16px" />
          <span>{{ formattedTime }}</span>
        </div>
        <div class="stat-item">
          <q-icon name="touch_app" size="16px" />
          <span>{{ moveCount }}</span>
        </div>
      </div>

      <q-space />

      <q-btn
        v-if="canAutoComplete"
        flat
        dense
        color="white"
        label="Auto-Complete"
        icon="bolt"
        class="auto-complete-btn"
        @click="autoComplete"
      />

      <div class="header-menu">
        <q-btn
          fab-mini
          flat
          icon="more_vert"
          color="white"
          @click="toggleMenu"
          :class="['menu-button', { 'menu-button-active': showMenu }]"
        />

        <transition-group name="menu-fade" tag="div" :class="['menu-buttons-container', { 'has-items': showMenu }]">
          <q-btn
            v-if="showMenu"
            key="refresh"
            fab-mini
            flat
            icon="refresh"
            color="white"
            class="menu-item menu-item-1"
            @click="newGame"
          />
          <q-btn
            v-if="showMenu"
            key="undo"
            fab-mini
            flat
            icon="undo"
            color="white"
            class="menu-item menu-item-2"
            @click="undo"
            :disable="!canUndo"
          />
          <q-btn
            v-if="showMenu"
            key="stats"
            fab-mini
            flat
            :icon="showStats ? 'visibility_off' : 'visibility'"
            color="white"
            class="menu-item menu-item-3"
            @click="toggleStats"
          />
          <q-btn
            v-if="showMenu"
            key="hints"
            fab-mini
            flat
            :icon="hintsEnabled ? 'lightbulb' : 'lightbulb_outline'"
            color="white"
            :class="['menu-item', 'menu-item-4', { 'hint-enabled': hintsEnabled }]"
            @click="toggleHints"
          />
          <q-btn
            v-if="showMenu"
            key="help"
            fab-mini
            flat
            icon="help_outline"
            color="white"
            class="menu-item menu-item-5"
            @click="showInstructions = true"
          />
        </transition-group>
      </div>
    </div>

    <!-- Game Board -->
    <div class="game-board">
      <div class="top-row">
        <!-- Stock and Waste -->
        <div class="left-piles">
          <div class="stock-pile" @click="dealFromStock">
            <div v-if="stock.length > 0" class="card-placeholder">
              <div class="card-back"></div>
            </div>
            <div v-else class="card-placeholder empty">
              <q-icon name="refresh" size="32px" color="white" />
            </div>
          </div>

          <div class="waste-pile">
            <div v-if="waste.length === 0" class="card-placeholder empty"></div>
            <div v-else class="card-stack">
              <div
                v-for="(card, index) in visibleWaste"
                :key="card.id"
                class="card"
                :class="{
                  draggable: index === visibleWaste.length - 1,
                  'red-card': isRedCard(card),
                  'being-dragged': isDragging && draggedCard && draggedCard.id === card.id,
                  'impatient': hintCards.has(card.id),
                }"
                :style="{ transform: `translateX(${index * 20}px)` }"
                @mousedown="
                  index === visibleWaste.length - 1 &&
                  handleCardClick($event, { type: 'waste' }, card)
                "
                @touchstart="
                  index === visibleWaste.length - 1 &&
                  handleCardClick($event, { type: 'waste' }, card)
                "
              >
                <div class="card-content">
                  <div class="card-corner top-left">
                    {{ getCardDisplay(card) }}
                  </div>
                  <div class="card-corner top-right">
                    {{ getCardSuit(card) }}
                  </div>
                  <div class="card-center">
                    <div class="suit-large">{{ getCardSuit(card) }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Foundation Piles -->
        <div class="foundation-piles">
          <div
            v-for="(pile, index) in foundation"
            :key="index"
            class="foundation-pile"
            data-drop-zone
            data-drop-type="foundation"
            :data-drop-index="index"
          >
            <div
              v-if="pile.length === 0"
              class="card-placeholder empty"
              :class="{ 'drop-target': draggedCard && canDropOnFoundation(index, draggedCard) }"
            >
              <div class="suit-icon">{{ getSuitIcon(index) }}</div>
            </div>
            <div v-else class="card-stack">
              <div
                class="card"
                :class="{ 'red-card': isRedCard(pile[pile.length - 1]) }"
                @mousedown="handleCardClick($event, { type: 'foundation', index }, pile[pile.length - 1])"
                @touchstart="handleCardClick($event, { type: 'foundation', index }, pile[pile.length - 1])"
              >
                <div class="card-content">
                  <div class="card-corner top-left">
                    {{ getCardDisplay(pile[pile.length - 1]) }}
                  </div>
                  <div class="card-corner top-right">
                    {{ getCardSuit(pile[pile.length - 1]) }}
                  </div>
                  <div class="card-center">
                    <div class="suit-large">{{ getCardSuit(pile[pile.length - 1]) }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tableau -->
      <div class="tableau">
        <div
          v-for="(pile, pileIndex) in tableau"
          :key="pileIndex"
          class="tableau-pile"
          data-drop-zone
          data-drop-type="tableau"
          :data-drop-index="pileIndex"
        >
          <div
            v-if="pile.length === 0"
            class="card-placeholder empty"
            :class="{ 'drop-target': draggedCard && canDropOnTableau(pileIndex, draggedCards[0]) }"
          ></div>
          <div v-else class="card-stack">
            <div
              v-for="(card, cardIndex) in pile"
              :key="card.id"
              class="card"
              :class="{
                'face-down': !card.faceUp,
                draggable: card.faceUp,
                'red-card': card.faceUp && isRedCard(card),
                'being-dragged': isDragging && draggedCard && draggedCard.id === card.id,
                'impatient': hintCards.has(card.id),
              }"
              :style="{ transform: `translateY(${cardIndex * 30}px)` }"
              @mousedown="
                card.faceUp &&
                handleCardClick(
                  $event,
                  { type: 'tableau', index: pileIndex, cardIndex },
                  card,
                  pile.slice(cardIndex),
                )
              "
              @touchstart="
                card.faceUp &&
                handleCardClick(
                  $event,
                  { type: 'tableau', index: pileIndex, cardIndex },
                  card,
                  pile.slice(cardIndex),
                )
              "
            >
              <div v-if="card.faceUp" class="card-content">
                <div class="card-corner top-left">
                  {{ getCardDisplay(card) }}
                </div>
                <div class="card-corner top-right">
                  {{ getCardSuit(card) }}
                </div>
                <div class="card-center">
                  <div class="suit-large">{{ getCardSuit(card) }}</div>
                </div>
              </div>
              <div v-else class="card-back"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Auto-moving Card to Foundation -->
    <div v-if="autoMovingCard" class="auto-moving-card"
      :style="{
        left: `${autoMoveStart.x}px`,
        top: `${autoMoveStart.y}px`,
        '--end-x': `${autoMoveEnd.x - autoMoveStart.x}px`,
        '--end-y': `${autoMoveEnd.y - autoMoveStart.y}px`,
      }">
      <div class="card" :class="{ 'red-card': isRedCard(autoMovingCard) }">
        <div class="card-content">
          <div class="card-corner top-left">
            {{ getCardDisplay(autoMovingCard) }}
          </div>
          <div class="card-corner top-right">
            {{ getCardSuit(autoMovingCard) }}
          </div>
          <div class="card-center">
            <div class="suit-large">{{ getCardSuit(autoMovingCard) }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Animating Card from Stock to Waste -->
    <div v-if="animatingCard" class="animating-card">
      <div class="card card-flip-container animating">
        <div class="card-content" :class="{ 'red-card': isRedCard(animatingCard) }">
          <div class="card-corner top-left">
            {{ getCardDisplay(animatingCard) }}
          </div>
          <div class="card-corner top-right">
            {{ getCardSuit(animatingCard) }}
          </div>
          <div class="card-center">
            <div class="suit-large">{{ getCardSuit(animatingCard) }}</div>
          </div>
        </div>
        <div class="card-back"></div>
      </div>
    </div>

    <!-- Dragging Card Preview -->
    <div
      v-if="isDragging && draggedCard"
      class="drag-preview"
      :style="{
        left: `${dragPosition.x}px`,
        top: `${dragPosition.y}px`,
      }"
    >
      <div
        v-for="(card, index) in draggedCards"
        :key="card.id"
        class="card"
        :class="{ 'red-card': isRedCard(card) }"
        :style="{ transform: `translateY(${index * 30}px)` }"
      >
        <div class="card-content">
          <div class="card-corner top-left">
            {{ getCardDisplay(card) }}
          </div>
          <div class="card-corner top-right">
            {{ getCardSuit(card) }}
          </div>
          <div class="card-center">
            <div class="suit-large">{{ getCardSuit(card) }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Win Dialog -->
    <q-dialog v-model="showWinDialog" persistent>
      <!-- Celebration particles -->
      <div class="celebration-particles">
        <div v-for="n in 20" :key="n" class="particle" :style="{
          '--delay': `${n * 0.1}s`,
          '--x': `${Math.random() * 100}vw`,
          '--y-start': `${100 + Math.random() * 20}vh`,
        }"></div>
      </div>

      <q-card class="win-card">
        <q-card-section class="text-center">
          <div class="text-h5 q-mb-md text-white celebration-text">
            <span class="zen-symbol">✨</span>
            Well Done
            <span class="zen-symbol">✨</span>
          </div>
          <div class="win-stats text-white">
            <div class="win-stat">
              <q-icon name="schedule" size="20px" />
              <span>{{ formattedTime }}</span>
            </div>
            <div class="win-stat">
              <q-icon name="touch_app" size="20px" />
              <span>{{ moveCount }} moves</span>
            </div>
          </div>
        </q-card-section>

        <q-card-actions align="center">
          <q-btn flat color="white" label="Back" @click="goBack" />
          <q-btn unelevated color="primary" label="New Game" @click="startNewGame" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Instructions Dialog -->
    <q-dialog v-model="showInstructions">
      <q-card class="instructions-card">
        <q-card-section>
          <div class="text-h6 q-mb-md text-white">How to Play</div>
          <div class="text-body2 text-white">
            <p><strong>Goal:</strong> Move all cards to the foundation piles (top right).</p>
            <p><strong>Tableau:</strong> Build down in descending rank with alternating colors.</p>
            <p><strong>Foundation:</strong> Build up from Ace to King by suit.</p>
            <p><strong>Stock:</strong> Click to deal cards when stuck.</p>
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat color="white" label="Close" @click="showInstructions = false" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useThemeStore } from 'src/stores/theme'
import { useSettingsStore } from 'src/stores/settings'
import { useProgressStore } from 'src/stores/progress'
import { useHaptics } from 'src/composables/useHaptics'

const router = useRouter()
const themeStore = useThemeStore()
const settingsStore = useSettingsStore()
const progressStore = useProgressStore()
const haptics = useHaptics()

// Game state
const stock = ref([])
const waste = ref([])
const foundation = ref([[], [], [], []]) // Hearts, Diamonds, Clubs, Spades
const tableau = ref([[], [], [], [], [], [], []])
const score = ref(0)
const moves = ref([])
const showMenu = ref(false)
const showWinDialog = ref(false)
const showInstructions = ref(false)
const dealingCard = ref(false)
const animatingCard = ref(null)
const autoMovingCard = ref(null)
const autoMoveStart = ref({ x: 0, y: 0 })
const autoMoveEnd = ref({ x: 0, y: 0 })
const moveCount = ref(0)
const elapsedTime = ref(0)
const timerInterval = ref(null)
const showStats = ref(true)

// Drag state
const draggedCard = ref(null)
const dragSource = ref(null) // { type: 'tableau'|'waste'|'foundation', index: number, cardIndex: number }
const draggedCards = ref([]) // For tableau sequences
const isDragging = ref(false)
const dragPosition = ref({ x: 0, y: 0 })
const dragOffset = ref({ x: 0, y: 0 })
const dragStartPos = ref({ x: 0, y: 0 })
const lastClickTime = ref(0)
const lastClickedCard = ref(null)

// Whimsical floating particles
const floatingParticles = ref([])
const particleType = computed(() => {
  const period = themeStore.period.key
  if (period === 'night' || period === 'dusk') return 'firefly'
  return 'butterfly'
})

// Hint system - wiggles cards that can be moved
const hintCards = ref(new Set())
const hintsEnabled = ref(true)
let lastMoveTime = Date.now()
const INACTIVITY_THRESHOLD = 15000 // 15 seconds of no moves before showing hints

function findMovableCards() {
  const movableCards = []

  // Check waste pile card - can it move to foundation or tableau?
  if (waste.value.length > 0) {
    const card = waste.value[waste.value.length - 1]

    // Check if can move to foundation
    const foundationIndex = card.suit
    if (canDropOnFoundation(foundationIndex, card)) {
      movableCards.push({ id: card.id, priority: 'high' }) // Foundation moves are high priority
    } else {
      // Check if can move to any tableau pile
      for (let i = 0; i < 7; i++) {
        if (canDropOnTableau(i, card)) {
          movableCards.push({ id: card.id, priority: 'medium' })
          break
        }
      }
    }
  }

  // Check tableau piles for movable cards
  tableau.value.forEach((pile, pileIndex) => {
    if (pile.length > 0) {
      // Find the first face-up card in this pile
      const firstFaceUpIndex = pile.findIndex(c => c.faceUp)
      if (firstFaceUpIndex !== -1) {
        const card = pile[firstFaceUpIndex]

        // Check if can move to foundation (only single cards)
        if (firstFaceUpIndex === pile.length - 1) {
          const foundationIndex = card.suit
          if (canDropOnFoundation(foundationIndex, card)) {
            movableCards.push({ id: card.id, priority: 'high' })
            return
          }
        }

        // Check if can move to another tableau pile
        for (let i = 0; i < 7; i++) {
          if (i !== pileIndex && canDropOnTableau(i, card)) {
            movableCards.push({ id: card.id, priority: 'medium' })
            return
          }
        }
      }
    }
  })

  return movableCards
}

function triggerHint() {
  if (!hintsEnabled.value) return

  // Only show hints if user has been inactive
  const timeSinceLastMove = Date.now() - lastMoveTime
  if (timeSinceLastMove < INACTIVITY_THRESHOLD) return

  const movableCards = findMovableCards()

  if (movableCards.length > 0) {
    // Prioritize high-priority moves (foundation moves)
    const highPriority = movableCards.filter(c => c.priority === 'high')
    const toShow = highPriority.length > 0 ? highPriority : movableCards

    // Show 1-2 hints
    const numToShow = Math.random() < 0.3 ? Math.min(2, toShow.length) : 1
    const shuffled = [...toShow].sort(() => Math.random() - 0.5)
    const selected = shuffled.slice(0, numToShow)

    selected.forEach(card => {
      hintCards.value.add(card.id)
      // Remove after animation completes (0.6 seconds)
      setTimeout(() => {
        hintCards.value.delete(card.id)
      }, 600)
    })
  }
}

// Track user activity - call this whenever the user makes a move
function trackMove() {
  lastMoveTime = Date.now()
}

// Trigger hints every 8-15 seconds
let hintInterval = null
function startHintInterval() {
  function scheduleNext() {
    const delay = 8000 + Math.random() * 7000 // 8-15 seconds
    hintInterval = setTimeout(() => {
      triggerHint()
      scheduleNext()
    }, delay)
  }
  scheduleNext()
}

function stopHintInterval() {
  if (hintInterval) {
    clearTimeout(hintInterval)
    hintInterval = null
  }
}

function toggleHints() {
  haptics.light()
  hintsEnabled.value = !hintsEnabled.value

  if (hintsEnabled.value) {
    startHintInterval()
  } else {
    stopHintInterval()
    hintCards.value.clear()
  }
}

// Initialize floating particles
function initFloatingParticles() {
  floatingParticles.value = []
  for (let i = 0; i < 8; i++) {
    floatingParticles.value.push({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      delay: Math.random() * 10,
      duration: 15 + Math.random() * 10,
    })
  }
}

// Whimsical effects
const placementSparkles = ref([])
const dragTrail = ref([])
let sparkleIdCounter = 0
let trailIdCounter = 0

// Create sparkle effect at position
function createSparkle(x, y) {
  const sparkleId = sparkleIdCounter++
  const sparkle = {
    id: sparkleId,
    x,
    y,
  }
  placementSparkles.value.push(sparkle)

  // Remove after animation completes
  setTimeout(() => {
    placementSparkles.value = placementSparkles.value.filter((s) => s.id !== sparkleId)
  }, 800)
}

// Create trail particle
function createTrailParticle(x, y) {
  const trailId = trailIdCounter++
  const particle = {
    id: trailId,
    x,
    y,
  }
  dragTrail.value.push(particle)

  setTimeout(() => {
    dragTrail.value = dragTrail.value.filter((p) => p.id !== trailId)
  }, 600)
}

const dealCount = computed(() => settingsStore.settings.solitaireDealCount || 1)
const canUndo = computed(() => moves.value.length > 0)
const visibleWaste = computed(() => {
  if (waste.value.length === 0) return []
  const count = Math.min(dealCount.value, waste.value.length)
  return waste.value.slice(-count)
})
const formattedTime = computed(() => {
  const minutes = Math.floor(elapsedTime.value / 60)
  const seconds = elapsedTime.value % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
})

const canAutoComplete = computed(() => {
  // Check if all tableau cards are face-up and stock/waste are empty
  const allTableauFaceUp = tableau.value.every(pile =>
    pile.every(card => card.faceUp)
  )
  const stockEmpty = stock.value.length === 0
  const wasteEmpty = waste.value.length === 0

  return allTableauFaceUp && stockEmpty && wasteEmpty
})

// Card suits and ranks
const suits = ['♥', '♦', '♣', '♠']
const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

function goBack() {
  haptics.light()
  router.back()
}

function toggleMenu() {
  haptics.light()
  showMenu.value = !showMenu.value
}

function toggleStats() {
  haptics.light()
  showStats.value = !showStats.value
  showMenu.value = false
}

function getSuitIcon(index) {
  return suits[index]
}

function getCardDisplay(card) {
  if (!card) return ''
  return ranks[card.rank]
}

function getCardSuit(card) {
  if (!card) return ''
  return suits[card.suit]
}

function isRedCard(card) {
  return card.suit === 0 || card.suit === 1 // Hearts or Diamonds
}

// Initialize deck
function createDeck() {
  const deck = []
  let id = 0
  for (let suit = 0; suit < 4; suit++) {
    for (let rank = 0; rank < 13; rank++) {
      deck.push({
        id: id++,
        suit,
        rank,
        faceUp: false,
      })
    }
  }

  // Validate deck
  if (deck.length !== 52) {
    console.error(`Invalid deck size: ${deck.length} cards (should be 52)`)
  }

  // Check for duplicates
  const uniqueCards = new Set(deck.map(c => `${c.suit}-${c.rank}`))
  if (uniqueCards.size !== 52) {
    console.error(`Duplicate cards detected! Unique cards: ${uniqueCards.size}`)
  }

  console.log('Deck created with', deck.length, 'cards')
  return shuffleDeck(deck)
}

function shuffleDeck(deck) {
  const shuffled = [...deck]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

function newGame() {
  haptics.light()
  showMenu.value = false
  clearGameState()
  initializeGame()
}

function startTimer() {
  // Clear any existing timer
  if (timerInterval.value) {
    clearInterval(timerInterval.value)
  }

  // Start new timer
  timerInterval.value = setInterval(() => {
    elapsedTime.value++
  }, 1000)
}

function stopTimer() {
  if (timerInterval.value) {
    clearInterval(timerInterval.value)
    timerInterval.value = null
  }
}

function initializeGame() {
  const deck = createDeck()

  // Deal to tableau
  tableau.value = [[], [], [], [], [], [], []]
  let deckIndex = 0

  for (let col = 0; col < 7; col++) {
    for (let row = 0; row <= col; row++) {
      const card = deck[deckIndex++]
      card.faceUp = row === col // Only top card is face up
      tableau.value[col].push(card)
    }
  }

  // Remaining cards go to stock
  stock.value = deck.slice(deckIndex).map((card) => ({ ...card, faceUp: false }))
  waste.value = []
  foundation.value = [[], [], [], []]
  score.value = 0
  moves.value = []
  moveCount.value = 0
  elapsedTime.value = 0
  showWinDialog.value = false

  // Start the timer
  startTimer()
}

async function dealFromStock() {
  if (dealingCard.value) return // Prevent multiple clicks during animation

  haptics.light()
  pushUndoState()

  if (stock.value.length === 0) {
    // Recycle waste back to stock - counts as a move
    stock.value = waste.value.reverse().map((card) => ({ ...card, faceUp: false }))
    waste.value = []
    moveCount.value++
    trackMove()
  } else {
    // Deal cards from stock to waste with animation
    dealingCard.value = true

    const count = Math.min(dealCount.value, stock.value.length)
    for (let i = 0; i < count; i++) {
      const card = stock.value.pop()
      card.faceUp = false

      // Show the card in animation state
      animatingCard.value = card

      // Wait for the card to fly and flip
      await new Promise((resolve) => setTimeout(resolve, 250))

      // Add to waste pile
      card.faceUp = true
      waste.value.push(card)
      animatingCard.value = null

      if (i < count - 1) {
        await new Promise((resolve) => setTimeout(resolve, 150))
      }
    }

    // Count dealing as a move
    moveCount.value++
    trackMove()
    dealingCard.value = false
  }

  // Save game state after dealing
  saveGameState()
}

// Snapshot the full board before a move so it can be reverted. Cards are plain
// { id, suit, rank, faceUp } objects, so a JSON deep-clone is safe and isolates
// the snapshot from later mutations (e.g. flipping a newly-exposed card).
const MAX_UNDO = 200
function pushUndoState() {
  moves.value.push({
    stock: JSON.parse(JSON.stringify(stock.value)),
    waste: JSON.parse(JSON.stringify(waste.value)),
    foundation: JSON.parse(JSON.stringify(foundation.value)),
    tableau: JSON.parse(JSON.stringify(tableau.value)),
    score: score.value,
    moveCount: moveCount.value,
  })
  if (moves.value.length > MAX_UNDO) moves.value.shift()
}

function undo() {
  if (!canUndo.value) return
  haptics.light()
  const prev = moves.value.pop()
  // Snapshots are unique clones, so assigning them straight in is safe.
  stock.value = prev.stock
  waste.value = prev.waste
  foundation.value = prev.foundation
  tableau.value = prev.tableau
  score.value = prev.score
  moveCount.value = prev.moveCount
  clearDrag()
  trackMove()
  saveGameState()
}

// Auto-move to foundation on double-click
async function tryAutoMoveToFoundation(card, source, sourceElement) {
  // Only the top card of a pile may be sent to a foundation — guards against a
  // double-tap on a buried card popping the wrong (top) card.
  if (source.type === 'tableau') {
    const pile = tableau.value[source.index]
    if (pile[pile.length - 1]?.id !== card.id) return false
  } else if (source.type === 'waste') {
    if (waste.value[waste.value.length - 1]?.id !== card.id) return false
  } else if (source.type === 'foundation') {
    if (foundation.value[source.index][foundation.value[source.index].length - 1]?.id !== card.id) return false
  }

  // Find the correct foundation pile for this card
  const foundationIndex = card.suit

  if (canDropOnFoundation(foundationIndex, card)) {
    haptics.success()
    pushUndoState()

    // Get source position
    const sourceRect = sourceElement.getBoundingClientRect()

    // Get destination position (foundation pile)
    const foundationPiles = document.querySelectorAll('.foundation-pile')
    const destRect = foundationPiles[foundationIndex]?.getBoundingClientRect()

    if (destRect) {
      // Set up animation
      autoMovingCard.value = card
      autoMoveStart.value = { x: sourceRect.left, y: sourceRect.top }
      autoMoveEnd.value = { x: destRect.left, y: destRect.top }

      // Wait for animation to complete
      await new Promise(resolve => setTimeout(resolve, 200))
    }

    // Remove card from source
    if (source.type === 'waste') {
      waste.value.pop()
    } else if (source.type === 'tableau') {
      const pile = tableau.value[source.index]
      pile.pop()
      // Flip top card if exists - part of the same move, not a separate move
      if (pile.length > 0 && !pile[pile.length - 1].faceUp) {
        pile[pile.length - 1].faceUp = true
      }
    } else if (source.type === 'foundation') {
      // Remove card from foundation pile
      foundation.value[source.index].pop()
    }

    // Add to foundation
    foundation.value[foundationIndex].push(card)

    // Clear animation
    autoMovingCard.value = null

    // Increment move counter (only once for the entire action)
    moveCount.value++
    trackMove()

    checkWin()
    return true
  }

  return false
}

async function handleCardClick(event, source, card, cards = [card]) {
  const now = Date.now()
  const timeSinceLastClick = now - lastClickTime.value

  // Check for double-click (within 300ms)
  if (timeSinceLastClick < 300 && lastClickedCard.value?.id === card.id) {
    // Prevent drag
    event.preventDefault()
    event.stopPropagation()

    // Try to auto-move to foundation
    if (await tryAutoMoveToFoundation(card, source, event.currentTarget)) {
      lastClickTime.value = 0
      lastClickedCard.value = null
      return
    }
  }

  // Update last click tracking
  lastClickTime.value = now
  lastClickedCard.value = card

  // Start drag immediately
  handleDragStart(event, source, card, cards)
}

// A grabbed tableau run is only legal if every card sits on a face-up card of
// the opposite colour and one rank lower (standard Klondike).
function isValidTableauRun(cards) {
  for (let i = 0; i < cards.length - 1; i++) {
    const upper = cards[i]
    const lower = cards[i + 1]
    if (!upper.faceUp || !lower.faceUp) return false
    if (isRedCard(upper) === isRedCard(lower)) return false
    if (lower.rank !== upper.rank - 1) return false
  }
  return true
}

// Drag and drop handlers
function handleDragStart(event, source, card, cards = [card]) {
  event.preventDefault()

  // Can't pick up an illegal pile of cards from the tableau
  if (source.type === 'tableau' && cards.length > 1 && !isValidTableauRun(cards)) {
    return
  }

  const clientX = event.touches ? event.touches[0].clientX : event.clientX
  const clientY = event.touches ? event.touches[0].clientY : event.clientY

  // Get the card element's position
  const rect = event.currentTarget.getBoundingClientRect()

  draggedCard.value = card
  dragSource.value = source
  draggedCards.value = cards
  isDragging.value = true
  dragStartPos.value = { x: clientX, y: clientY }
  dragPosition.value = { x: rect.left, y: rect.top }
  dragOffset.value = {
    x: clientX - rect.left,
    y: clientY - rect.top,
  }

  haptics.light()

  // Add global listeners for drag and release
  if (event.touches) {
    document.addEventListener('touchmove', handleDragMove, { passive: false })
    document.addEventListener('touchend', handleDragEnd)
  } else {
    document.addEventListener('mousemove', handleDragMove)
    document.addEventListener('mouseup', handleDragEnd)
  }
}

function handleDragMove(event) {
  if (!isDragging.value) return

  event.preventDefault()

  const clientX = event.touches ? event.touches[0].clientX : event.clientX
  const clientY = event.touches ? event.touches[0].clientY : event.clientY

  dragPosition.value = {
    x: clientX - dragOffset.value.x,
    y: clientY - dragOffset.value.y,
  }

  // Create gentle trail particles (only occasionally to avoid too many)
  if (Math.random() < 0.5) {
    createTrailParticle(clientX, clientY)
  }
}

function handleDragEnd(event) {
  if (!isDragging.value) return

  const clientX = event.changedTouches ? event.changedTouches[0].clientX : event.clientX
  const clientY = event.changedTouches ? event.changedTouches[0].clientY : event.clientY

  // Find what element is under the drop position
  let element = document.elementFromPoint(clientX, clientY)
  let dropZone = element?.closest('[data-drop-zone]')

  // If no drop zone found, search in a wider radius (more forgiving)
  if (!dropZone) {
    const searchRadius = 80 // pixels - increased for more liberal drop zones
    const offsets = [
      // Cardinal directions
      [0, searchRadius], [0, -searchRadius],
      [searchRadius, 0], [-searchRadius, 0],
      // Diagonals
      [searchRadius, searchRadius], [-searchRadius, -searchRadius],
      [searchRadius, -searchRadius], [-searchRadius, searchRadius],
      // Mid-range checks for better coverage
      [searchRadius / 2, searchRadius / 2], [-searchRadius / 2, -searchRadius / 2],
      [searchRadius / 2, -searchRadius / 2], [-searchRadius / 2, searchRadius / 2],
      [searchRadius / 2, 0], [-searchRadius / 2, 0],
      [0, searchRadius / 2], [0, -searchRadius / 2]
    ]

    for (const [dx, dy] of offsets) {
      element = document.elementFromPoint(clientX + dx, clientY + dy)
      dropZone = element?.closest('[data-drop-zone]')
      if (dropZone) break
    }
  }

  if (dropZone) {
    const dropType = dropZone.getAttribute('data-drop-type')
    const dropIndex = parseInt(dropZone.getAttribute('data-drop-index'))

    if (dropType === 'foundation') {
      dropOnFoundation(dropIndex)
    } else if (dropType === 'tableau') {
      dropOnTableau(dropIndex)
    }
  } else {
    // Invalid drop - return to source
    haptics.warning()
    clearDrag()
  }

  // Remove global listeners
  document.removeEventListener('mousemove', handleDragMove)
  document.removeEventListener('mouseup', handleDragEnd)
  document.removeEventListener('touchmove', handleDragMove)
  document.removeEventListener('touchend', handleDragEnd)
}

function canDropOnFoundation(foundationIndex, card) {
  const pile = foundation.value[foundationIndex]

  // Foundation must match suit
  if (card.suit !== foundationIndex) return false

  // First card must be Ace
  if (pile.length === 0) {
    return card.rank === 0 // Ace
  }

  // Must be next rank up
  const topCard = pile[pile.length - 1]
  return card.rank === topCard.rank + 1
}

function canDropOnTableau(tableauIndex, card) {
  const pile = tableau.value[tableauIndex]

  // Empty pile - only King allowed
  if (pile.length === 0) {
    return card.rank === 12 // King
  }

  // Must be descending rank and alternating colors
  const topCard = pile[pile.length - 1]
  if (!topCard.faceUp) return false

  const isDifferentColor = isRedCard(card) !== isRedCard(topCard)
  const isDescending = card.rank === topCard.rank - 1

  return isDifferentColor && isDescending
}

function dropOnFoundation(foundationIndex) {
  if (!draggedCard.value || draggedCards.value.length > 1) return

  if (!canDropOnFoundation(foundationIndex, draggedCard.value)) {
    haptics.warning()
    clearDrag()
    return
  }

  haptics.success()
  pushUndoState()

  // Remove card from source
  if (dragSource.value.type === 'waste') {
    waste.value.pop()
  } else if (dragSource.value.type === 'tableau') {
    const pile = tableau.value[dragSource.value.index]
    pile.pop()
    // Flip top card if exists - part of the same move, not a separate move
    if (pile.length > 0 && !pile[pile.length - 1].faceUp) {
      pile[pile.length - 1].faceUp = true
    }
  } else if (dragSource.value.type === 'foundation') {
    // Remove card from foundation pile
    foundation.value[dragSource.value.index].pop()
  }

  // Add to foundation
  foundation.value[foundationIndex].push(draggedCard.value)

  // Create sparkle effect at drop location
  createSparkle(dragPosition.value.x, dragPosition.value.y)

  // Check if suit is complete (13 cards) for celebration
  if (foundation.value[foundationIndex].length === 13) {
    // Create extra celebration sparkles
    setTimeout(() => createSparkle(dragPosition.value.x - 30, dragPosition.value.y - 20), 100)
    setTimeout(() => createSparkle(dragPosition.value.x + 30, dragPosition.value.y - 20), 200)
    setTimeout(() => createSparkle(dragPosition.value.x, dragPosition.value.y - 40), 300)
    haptics.medium() // Extra haptic feedback
  }

  // Increment move counter (only once for the entire action)
  moveCount.value++
  trackMove()

  clearDrag()
  checkWin()
}

function dropOnTableau(tableauIndex) {
  if (!draggedCard.value) return

  // Check if first card in sequence can be placed
  const firstCard = draggedCards.value[0]
  if (!canDropOnTableau(tableauIndex, firstCard)) {
    haptics.warning()
    clearDrag()
    return
  }

  haptics.success()
  pushUndoState()

  // Remove cards from source
  if (dragSource.value.type === 'waste') {
    waste.value.pop()
  } else if (dragSource.value.type === 'tableau') {
    const sourcePile = tableau.value[dragSource.value.index]
    sourcePile.splice(dragSource.value.cardIndex)
    // Flip top card if exists - part of the same move, not a separate move
    if (sourcePile.length > 0 && !sourcePile[sourcePile.length - 1].faceUp) {
      sourcePile[sourcePile.length - 1].faceUp = true
    }
  } else if (dragSource.value.type === 'foundation') {
    // Remove card from foundation pile (only single cards can be moved from foundation)
    foundation.value[dragSource.value.index].pop()
  }

  // Add to tableau
  tableau.value[tableauIndex].push(...draggedCards.value)

  // Create sparkle effect at drop location
  createSparkle(dragPosition.value.x, dragPosition.value.y)

  // Increment move counter (only once for the entire action)
  moveCount.value++
  trackMove()

  clearDrag()
}

function clearDrag() {
  draggedCard.value = null
  dragSource.value = null
  draggedCards.value = []
  isDragging.value = false
  dragPosition.value = { x: 0, y: 0 }
}

async function autoComplete() {
  if (!canAutoComplete.value) return

  haptics.light()
  pushUndoState()

  // Continuously move cards to foundation until done
  let movedCard = true
  while (movedCard) {
    movedCard = false

    // Try to move cards from tableau
    for (let pileIndex = 0; pileIndex < tableau.value.length; pileIndex++) {
      const pile = tableau.value[pileIndex]
      if (pile.length === 0) continue

      const topCard = pile[pile.length - 1]
      if (!topCard.faceUp) continue

      const foundationIndex = topCard.suit
      if (canDropOnFoundation(foundationIndex, topCard)) {
        // Move card to foundation
        pile.pop()
        foundation.value[foundationIndex].push(topCard)
        moveCount.value++
        movedCard = true

        // Small delay for visual effect
        await new Promise(resolve => setTimeout(resolve, 100))
        break
      }
    }
  }

  checkWin()
}

function checkWin() {
  // Check if all foundation piles have 13 cards (complete)
  const isWin = foundation.value.every((pile) => pile.length === 13)
  if (isWin) {
    stopTimer()

    // Update progress stats
    progressStore.updateSolitaireStats(true, elapsedTime.value, moveCount.value)

    clearGameState() // Clear saved game on win
    showWinDialog.value = true
  } else {
    // Save game state after each move
    saveGameState()
  }
}

function startNewGame() {
  showWinDialog.value = false
  clearGameState()
  initializeGame()
}

function saveGameState() {
  const gameState = {
    stock: stock.value,
    waste: waste.value,
    foundation: foundation.value,
    tableau: tableau.value,
    moveCount: moveCount.value,
    elapsedTime: elapsedTime.value,
    showStats: showStats.value,
  }
  localStorage.setItem('solitaire-game-state', JSON.stringify(gameState))
}

function loadGameState() {
  const savedState = localStorage.getItem('solitaire-game-state')
  if (savedState) {
    try {
      const gameState = JSON.parse(savedState)
      stock.value = gameState.stock || []
      waste.value = gameState.waste || []
      foundation.value = gameState.foundation || [[], [], [], []]
      tableau.value = gameState.tableau || [[], [], [], [], [], [], []]
      moveCount.value = gameState.moveCount || 0
      elapsedTime.value = gameState.elapsedTime || 0
      showStats.value = gameState.showStats !== undefined ? gameState.showStats : true

      // Validate loaded state - count all cards
      const totalCards =
        stock.value.length +
        waste.value.length +
        foundation.value.reduce((sum, pile) => sum + pile.length, 0) +
        tableau.value.reduce((sum, pile) => sum + pile.length, 0)

      console.log('Loaded game state:', {
        stock: stock.value.length,
        waste: waste.value.length,
        foundation: foundation.value.map(p => p.length),
        tableau: tableau.value.map(p => p.length),
        total: totalCards
      })

      if (totalCards !== 52) {
        console.error(`Invalid saved game state! Total cards: ${totalCards} (should be 52)`)
        console.log('Discarding corrupted save and starting new game')
        clearGameState()
        return false
      }

      // Check for duplicate cards
      const allCards = [
        ...stock.value,
        ...waste.value,
        ...foundation.value.flat(),
        ...tableau.value.flat()
      ]
      const uniqueCards = new Set(allCards.map(c => `${c.suit}-${c.rank}`))
      if (uniqueCards.size !== 52) {
        console.error(`Duplicate cards in saved state! Unique cards: ${uniqueCards.size}`)
        console.log('Discarding corrupted save and starting new game')
        clearGameState()
        return false
      }

      // Start timer if there's a saved game
      startTimer()
      return true
    } catch (e) {
      console.error('Failed to load game state:', e)
      return false
    }
  }
  return false
}

function clearGameState() {
  localStorage.removeItem('solitaire-game-state')
}

onMounted(() => {
  // Try to load saved game, otherwise start new game
  const loaded = loadGameState()
  if (!loaded) {
    initializeGame()
  }

  // Initialize whimsical particles
  initFloatingParticles()

  // Start hint system
  startHintInterval()
})

onBeforeUnmount(() => {
  stopTimer()
  stopHintInterval()
  saveGameState()
})
</script>

<style lang="scss" scoped>
.solitaire-page {
  min-height: 100vh;
  transition: background 2s ease;
  position: relative;
  overflow: hidden;
}

.game-header {
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
  align-items: flex-start;
  pointer-events: none;

  > * {
    pointer-events: all;
  }
}

.game-info {
  text-align: center;
  padding: 8px 16px;
  background: rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(10px);
  border-radius: 20px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.header-menu {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;

  .menu-button {
    background: transparent;
    transition: background 0.2s ease;
  }
}

.menu-button-active {
  background: rgba(255, 255, 255, 0.15) !important;
  backdrop-filter: blur(10px);
}

.menu-buttons-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: all 0.2s ease;

  &.has-items {
    padding: 8px;
    background: rgba(0, 0, 0, 0.2);
    backdrop-filter: blur(10px);
    border-radius: 12px;
  }
}

.menu-item {
  background: rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(10px);

  &.hint-enabled {
    background: rgba(255, 215, 0, 0.3);
    box-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
    animation: hint-glow 2s ease-in-out infinite;
  }
}

@keyframes hint-glow {
  0%, 100% {
    box-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
  }
  50% {
    box-shadow: 0 0 20px rgba(255, 215, 0, 0.8);
  }
}

// Menu fade transitions
.menu-fade-enter-active {
  transition: all 0.2s ease-out;
}

.menu-fade-leave-active {
  transition: all 0.15s ease-in;
}

.menu-fade-enter-from {
  opacity: 0;
  transform: translateY(-10px) scale(0.8);
}

.menu-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.8);
}

// Staggered delays for sequential appearance
.menu-item-1 {
  &.menu-fade-enter-active {
    transition-delay: 0ms;
  }
  &.menu-fade-leave-active {
    transition-delay: 150ms;
  }
}

.menu-item-2 {
  &.menu-fade-enter-active {
    transition-delay: 50ms;
  }
  &.menu-fade-leave-active {
    transition-delay: 100ms;
  }
}

.menu-item-3 {
  &.menu-fade-enter-active {
    transition-delay: 100ms;
  }
  &.menu-fade-leave-active {
    transition-delay: 50ms;
  }
}

.menu-item-4 {
  &.menu-fade-enter-active {
    transition-delay: 150ms;
  }
  &.menu-fade-leave-active {
    transition-delay: 0ms;
  }
}

.menu-item-5 {
  &.menu-fade-enter-active {
    transition-delay: 200ms;
  }
  &.menu-fade-leave-active {
    transition-delay: 0ms;
  }
}

// Prevent layout shift during transition
.menu-fade-move {
  transition: transform 0.2s ease;
}

.game-stats {
  display: flex;
  gap: 16px;
  padding: 8px 16px;
  background: rgba(0, 0, 0, 0.08); // More subtle
  backdrop-filter: blur(8px);
  border-radius: 20px;
  opacity: 0.7; // Softer overall appearance
  transition: opacity 0.3s ease;

  &:hover {
    opacity: 1; // Full opacity on hover for visibility
  }
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 6px;
  color: white;
  font-size: 14px;
  font-weight: 500;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.auto-complete-btn {
  background: rgba(76, 175, 80, 0.2);
  backdrop-filter: blur(10px);
  border-radius: 20px;
  padding: 8px 16px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  animation: gentleGlow 2s ease-in-out infinite;

  &:hover {
    background: rgba(76, 175, 80, 0.3);
  }
}

@keyframes gentleGlow {
  0%, 100% {
    box-shadow: 0 0 10px rgba(76, 175, 80, 0.3);
  }
  50% {
    box-shadow: 0 0 20px rgba(76, 175, 80, 0.5);
  }
}

.game-board {
  padding: 100px 16px 16px;
  max-width: 1200px;
  margin: 0 auto;
  min-height: 100vh;
}

.top-row {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
  margin-bottom: 32px;
  width: 100%;
}

.left-piles {
  display: contents;
}

.stock-pile {
  grid-column: 1;
}

.waste-pile {
  grid-column: 2;
}

.foundation-piles {
  grid-column: 4 / 8;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.stock-pile,
.waste-pile,
.foundation-pile {
  width: 100%;
  position: relative;
}

.card-placeholder {
  width: 100%;
  padding-bottom: 143%; // 143% creates 7:10 aspect ratio (1000/700)
  position: relative;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 2px dashed rgba(255, 255, 255, 0.3);
  cursor: pointer;
  transition: all 0.3s ease;

  > * {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &.empty {
    cursor: default;
  }

  &:hover:not(.empty) {
    background: rgba(255, 255, 255, 0.15);
    transform: scale(1.05);
  }

  &.drop-target {
    background: rgba(76, 175, 80, 0.3);
    border-color: #4caf50;
    border-style: solid;
  }
}

.card {
  width: 100%;
  padding-bottom: 143%; // 143% creates 7:10 aspect ratio (1000/700)
  border-radius: 8px;
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  cursor: pointer;
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1); // Smoother, more graceful
  color: #000;

  &.red-card {
    color: #e74c3c;
  }

  // Only apply hover effect on non-touch devices
  @media (hover: hover) and (pointer: fine) {
    &.draggable:hover:not(.being-dragged) {
      transform: translateY(-4px) !important;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }
  }

  &.face-down {
    cursor: default;
  }

  &.selected {
    transform: translateY(-8px) !important;
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.4);
    z-index: 100;
  }

  &.being-dragged {
    opacity: 0.3;
  }
}

.card-flip-container {
  transform-style: preserve-3d;
  transition: transform 0.3s ease;

  &:not(.flipped) {
    transform: rotateY(180deg);
  }

  &.flipped {
    transform: rotateY(0deg);
  }

  .card-content,
  .card-back {
    backface-visibility: hidden;
  }

  .card-back {
    transform: rotateY(180deg);
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background:
      linear-gradient(135deg, v-bind('themeStore.colors.primary') 0%, v-bind('themeStore.colors.secondary') 50%, v-bind('themeStore.colors.primary') 100%);
    transition: background 2s ease; // Smooth transition between time periods

    // Add decorative pattern
    &::before {
      content: '';
      position: absolute;
      inset: 8px;
      border: 3px solid rgba(255, 255, 255, 0.5);
      border-radius: 6px;
      background:
        repeating-linear-gradient(
          45deg,
          transparent,
          transparent 8px,
          rgba(255, 255, 255, 0.15) 8px,
          rgba(255, 255, 255, 0.15) 16px
        ),
        repeating-linear-gradient(
          -45deg,
          transparent,
          transparent 8px,
          rgba(255, 255, 255, 0.15) 8px,
          rgba(255, 255, 255, 0.15) 16px
        );
      box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.2);
    }

    // Add center ornament
    &::after {
      content: '♠';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 40px;
      font-weight: bold;
      color: rgba(255, 255, 255, 0.6);
      text-shadow:
        0 0 15px rgba(255, 255, 255, 0.5),
        0 2px 4px rgba(0, 0, 0, 0.3);
    }
  }
}

.card-content {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  padding: 6px;
}

.card-corner {
  position: absolute;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;

  &.top-left {
    top: 6px;
    left: 6px;
  }

  &.top-right {
    top: 6px;
    right: 6px;
  }
}

.card-center {
  position: absolute;
  top: 65%;
  left: 50%;
  transform: translate(-50%, -50%);

  .suit-large {
    font-size: 32px;
  }
}

.card-back {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
}

.card-stack {
  position: relative;
  width: 100%;
  padding-bottom: 143%; // Default height for single cards

  .card {
    position: absolute;
    top: 0;
    left: 0;
    padding-bottom: 0;
    height: auto;
    aspect-ratio: 0.7;
  }
}

.tableau {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
  width: 100%;
}

.tableau-pile {
  position: relative;
  min-width: 0;

  .card-stack {
    padding-bottom: 0;
    min-height: 300px;
  }
}

.suit-icon {
  font-size: 32px;
  opacity: 0.5;
  color: white;
}

.win-card,
.instructions-card {
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.08);

  :deep(*) {
    color: white !important;
  }
}

.win-stats {
  display: flex;
  justify-content: center;
  gap: 24px;
  margin-top: 16px;
}

.win-stat {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 500;
}

.celebration-text {
  animation: fadeInScale 0.5s ease-out;
}

.zen-symbol {
  display: inline-block;
  animation: gentlePulse 2s ease-in-out infinite;
}

@keyframes fadeInScale {
  0% {
    opacity: 0;
    transform: scale(0.9);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes gentlePulse {
  0%, 100% {
    opacity: 0.7;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.1);
  }
}

.celebration-particles {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
  z-index: 9999;
  overflow: hidden;
}

.particle {
  position: absolute;
  width: 8px;
  height: 8px;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.8) 0%, rgba(255, 255, 255, 0) 70%);
  border-radius: 50%;
  left: var(--x);
  bottom: var(--y-start);
  animation: floatUp 4s ease-out infinite;
  animation-delay: var(--delay);
  opacity: 0;
}

@keyframes floatUp {
  0% {
    transform: translateY(0) scale(0);
    opacity: 0;
  }
  10% {
    opacity: 0.8;
    transform: translateY(-10vh) scale(1);
  }
  90% {
    opacity: 0.6;
  }
  100% {
    transform: translateY(-120vh) scale(0.5);
    opacity: 0;
  }
}

// Make primary button visible
:deep(.q-btn.bg-primary) {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
}

.drag-preview {
  position: fixed;
  pointer-events: none;
  z-index: 1000;
  width: 60px;
  transform: rotate(5deg);
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3));
  opacity: 0.9;

  .card {
    position: absolute;
    width: 60px;
    padding-bottom: 143%;
    top: 0;
    left: 0;
  }
}

.animating-card {
  position: fixed;
  z-index: 999;
  pointer-events: none;
  perspective: 1000px;

  // Calculate position based on grid columns
  // Stock is in column 1, waste is in column 2
  // Start at stock pile position
  top: calc(100px + 16px); // Header height + padding
  left: calc((100vw - min(1200px, 100vw)) / 2 + 16px); // Centered content + padding
  width: calc((min(1200px, 100vw) - 32px - 6 * 8px) / 7); // One column width

  .card-flip-container.animating {
    width: 100%;
    transform-style: preserve-3d;
    transform-origin: center center;
    animation: cardDealFlipAnimation 0.25s ease-in-out forwards;
  }
}

@keyframes cardDealFlipAnimation {
  0% {
    transform: translateX(0) rotateY(180deg);
  }
  100% {
    transform: translateX(calc(100% + 8px)) rotateY(0deg);
  }
}

.auto-moving-card {
  position: fixed;
  z-index: 1000;
  pointer-events: none;
  animation: autoMoveAnimation 0.2s ease-out forwards;

  .card {
    width: 100%;
  }
}

@keyframes autoMoveAnimation {
  0% {
    transform: translate(0, 0) scale(1);
    opacity: 1;
  }
  100% {
    transform: translate(var(--end-x), var(--end-y)) scale(0.8);
    opacity: 0.8;
  }
}

// Whimsical floating particles
.floating-particles {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: hidden;
  z-index: 0; // Behind the game board
}

.floating-particle {
  position: absolute;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  animation: floatAround ease-in-out infinite;
  opacity: 0.7;

  &.butterfly {
    background: radial-gradient(
      circle at 50% 50%,
      rgba(255, 255, 255, 0.8) 0%,
      rgba(255, 200, 150, 0.6) 40%,
      rgba(255, 180, 200, 0.4) 100%
    );
    box-shadow: 0 0 6px rgba(255, 200, 150, 0.5);
    animation: floatAround ease-in-out infinite, butterfly-flutter 1.5s ease-in-out infinite;
  }

  &.firefly {
    background: radial-gradient(
      circle at 50% 50%,
      rgba(255, 255, 150, 0.9) 0%,
      rgba(200, 255, 150, 0.5) 60%,
      rgba(150, 200, 255, 0.2) 100%
    );
    box-shadow: 0 0 10px rgba(255, 255, 150, 0.6), 0 0 16px rgba(200, 255, 150, 0.3);
    animation: floatAround ease-in-out infinite, firefly-glow 2.5s ease-in-out infinite;
  }
}

@keyframes floatAround {
  0% {
    transform: translate(0, 0);
  }
  25% {
    transform: translate(15vw, -10vh);
  }
  50% {
    transform: translate(10vw, 15vh);
  }
  75% {
    transform: translate(-10vw, 5vh);
  }
  100% {
    transform: translate(0, 0);
  }
}

@keyframes butterfly-flutter {
  0%,
  100% {
    opacity: 0.4;
  }
  50% {
    opacity: 0.7;
  }
}

@keyframes firefly-glow {
  0%,
  100% {
    opacity: 0.3;
    box-shadow: 0 0 6px rgba(255, 255, 150, 0.3);
  }
  50% {
    opacity: 0.7;
    box-shadow: 0 0 12px rgba(255, 255, 150, 0.7), 0 0 20px rgba(200, 255, 150, 0.5);
  }
}

// Card placement sparkles
.placement-sparkles {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1000;
}

.sparkle {
  position: absolute;
  width: 40px;
  height: 40px;
  transform: translate(-20px, -20px);
  animation: sparkle-fade 0.8s ease-out forwards;
}

.sparkle-particle {
  position: absolute;
  width: 10px;
  height: 10px;
  background: radial-gradient(circle, rgba(255, 255, 255, 1) 0%, rgba(255, 220, 150, 0.8) 100%);
  border-radius: 50%;
  box-shadow: 0 0 15px rgba(255, 255, 255, 1), 0 0 25px rgba(255, 220, 150, 0.8);

  &:nth-child(1) {
    top: 0;
    left: 50%;
    animation: sparkle-burst-up 0.8s ease-out forwards;
  }

  &:nth-child(2) {
    top: 50%;
    right: 0;
    animation: sparkle-burst-right 0.8s ease-out forwards;
  }

  &:nth-child(3) {
    bottom: 0;
    left: 50%;
    animation: sparkle-burst-down 0.8s ease-out forwards;
  }

  &:nth-child(4) {
    top: 50%;
    left: 0;
    animation: sparkle-burst-left 0.8s ease-out forwards;
  }
}

@keyframes sparkle-fade {
  0% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}

@keyframes sparkle-burst-up {
  0% {
    transform: translate(-50%, 0) scale(0);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -40px) scale(2);
    opacity: 0;
  }
}

@keyframes sparkle-burst-right {
  0% {
    transform: translate(0, -50%) scale(0);
    opacity: 1;
  }
  100% {
    transform: translate(40px, -50%) scale(2);
    opacity: 0;
  }
}

@keyframes sparkle-burst-down {
  0% {
    transform: translate(-50%, 0) scale(0);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, 40px) scale(2);
    opacity: 0;
  }
}

@keyframes sparkle-burst-left {
  0% {
    transform: translate(0, -50%) scale(0);
    opacity: 1;
  }
  100% {
    transform: translate(-40px, -50%) scale(2);
    opacity: 0;
  }
}

// Drag trail
.drag-trail {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 999;
}

.trail-particle {
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgba(255, 255, 255, 0.9) 0%,
    rgba(200, 220, 255, 0.7) 50%,
    rgba(150, 200, 255, 0.3) 100%
  );
  box-shadow: 0 0 8px rgba(200, 220, 255, 0.6);
  transform: translate(-3px, -3px);
  animation: trail-fade 0.6s ease-out forwards;
}

@keyframes trail-fade {
  0% {
    opacity: 0.8;
    transform: translate(-3px, -3px) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate(-3px, -3px) scale(0.3);
  }
}

// Impatient card wiggle animation
.card.impatient {
  animation: card-wiggle 0.6s ease-in-out;
}

@keyframes card-wiggle {
  0%, 100% {
    rotate: 0deg;
  }
  10% {
    rotate: -3deg;
  }
  30% {
    rotate: 3deg;
  }
  50% {
    rotate: -3deg;
  }
  70% {
    rotate: 3deg;
  }
  90% {
    rotate: -2deg;
  }
}

// Disable animation when dragging
.being-dragged {
  animation: none !important;
}
</style>
