<template>
  <q-page
    class="wildcard-page"
    :style="{ background: themeStore.colors.gradient }"
    :data-state="state"
    :data-ante="ante"
    :data-blindindex="blindIndex"
    :data-target="target"
    :data-score="roundScore"
    :data-hands="hands"
    :data-discards="discards"
    :data-money="money"
    :data-jokers="jokers.length"
    :data-selected="selected.length"
    :data-hand="preview ? preview.ev.name : ''"
  >
    <!-- Header -->
    <div class="game-header">
      <q-btn fab-mini flat icon="arrow_back" color="white" @click="goBack" />
      <div class="ante-title">Ante {{ ante }}<span class="of">/ 8</span></div>
      <div class="header-menu">
        <q-btn fab-mini flat icon="refresh" color="white" @click="newRun" />
        <q-btn fab-mini flat icon="help_outline" color="white" @click="howToPlay" />
      </div>
    </div>

    <!-- HUD -->
    <div class="hud">
      <div class="blind-box" :class="'b' + blindIndex">
        <div class="blind-name">{{ blindName }}</div>
        <div v-if="boss" class="blind-debuff">{{ boss.desc }}</div>
        <div class="blind-target">Target {{ target.toLocaleString() }}</div>
      </div>
      <div class="score-now">
        <div class="score-label">Score</div>
        <div class="score-big" :class="{ hit: roundScore >= target, pop: showGain }">{{ displayScore.toLocaleString() }}</div>
        <transition name="gain-fade">
          <div v-if="showGain" class="score-gain">+{{ gainText }}</div>
        </transition>
      </div>
      <div class="meta">
        <div class="meta-item"><q-icon name="back_hand" size="16px" /> {{ hands }}</div>
        <div class="meta-item"><q-icon name="recycling" size="16px" /> {{ discards }}</div>
        <div class="meta-item money"><q-icon name="paid" size="16px" /> {{ money }}</div>
      </div>
    </div>

    <!-- Jokers -->
    <div class="jokers">
      <div
        v-for="j in jokers"
        :key="j.id"
        class="joker-chip"
        @click="showJoker(j)"
      >{{ j.name }}</div>
      <div v-if="!jokers.length" class="joker-empty">No jokers yet — buy some in the shop</div>
    </div>

    <!-- Hand preview -->
    <div class="preview" :class="{ active: !!preview }">
      <template v-if="preview">
        <span class="pv-name">{{ preview.ev.name }}</span>
        <span class="pv-calc">{{ preview.chips.toLocaleString() }} <span class="x">×</span> {{ fmtMult(preview.mult) }}
          <span class="eq">=</span> <span class="pv-total">{{ preview.total.toLocaleString() }}</span></span>
      </template>
      <template v-else>
        <span class="pv-hint">{{ playHint }}</span>
      </template>
    </div>

    <!-- Hand of cards -->
    <div class="hand-wrap">
      <div class="hand">
        <button
          v-for="c in handCards"
          :key="c.id"
          class="card"
          :class="{ sel: selected.includes(c.id), red: isRed(c), scoring: scoringIds.has(c.id) }"
          @click="toggle(c.id)"
        >
          <span class="rank">{{ label(c) }}</span>
          <span class="suit">{{ suit(c) }}</span>
        </button>
      </div>
    </div>

    <!-- Actions -->
    <div class="actions">
      <q-btn unelevated class="act play" :disable="!canPlay" label="Play Hand" @click="playHand" />
      <q-btn unelevated class="act discard" :disable="!canDiscard" label="Discard" @click="discardSel" />
      <q-btn flat round class="act sort" icon="swap_vert" color="white" @click="toggleSort" />
    </div>

    <!-- Shop overlay -->
    <transition name="overlay-fade">
      <div v-if="state === 'shop'" class="overlay shop">
        <div class="overlay-card">
          <div class="overlay-title">Blind Cleared!</div>
          <div class="overlay-sub">Earned ${{ lastReward }} · Cash ${{ money }}</div>
          <div class="shop-offers">
            <div v-for="o in shopOffers" :key="o.id" class="offer">
              <div class="offer-top">
                <div class="offer-name">{{ o.name }}</div>
                <div class="offer-desc">{{ o.desc }}</div>
              </div>
              <q-btn
                dense unelevated class="buy"
                :disable="money < o.cost || jokers.length >= 5"
                :label="`$${o.cost}`"
                @click="buy(o)"
              />
            </div>
            <div v-if="!shopOffers.length" class="offer empty">Sold out</div>
          </div>
          <div v-if="jokers.length" class="owned">
            <div class="owned-label">Your jokers — tap to sell</div>
            <div class="owned-list">
              <button v-for="j in jokers" :key="j.id" class="owned-joker" @click="sell(j)">
                {{ j.name }} <span class="sell-val">+${{ sellValue(j) }}</span>
              </button>
            </div>
          </div>
          <div class="shop-actions">
            <q-btn flat color="white" :disable="money < rerollCost" :label="`Reroll $${rerollCost}`" @click="reroll" />
            <q-btn unelevated color="primary" text-color="white" label="Next Blind" @click="nextBlind" />
          </div>
        </div>
      </div>
    </transition>

    <!-- End overlay -->
    <transition name="overlay-fade">
      <div v-if="state === 'won' || state === 'over'" class="overlay end">
        <div class="overlay-card">
          <div class="overlay-title">{{ state === 'won' ? 'Run Won! 🏆' : 'Run Over' }}</div>
          <div class="overlay-sub">
            {{ state === 'won' ? 'You cleared all eight antes' : `Knocked out at Ante ${ante}, ${blindName}` }}
          </div>
          <div class="overlay-sub small">Banked {{ (runTotal + roundScore).toLocaleString() }} chips this run</div>
          <q-btn unelevated color="primary" text-color="white" label="New Run" @click="newRun" />
        </div>
      </div>
    </transition>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useThemeStore } from 'src/stores/theme'
import { useProgressStore } from 'src/stores/progress'
import { useHaptics } from 'src/composables/useHaptics'

const router = useRouter()
const $q = useQuasar()
const themeStore = useThemeStore()
const progressStore = useProgressStore()
const haptics = useHaptics()

// ---------- card / poker model ----------
const SUITS = ['♠', '♥', '♦', '♣']
const SUIT_RED = [false, true, true, false]
const RANK_LABEL = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' }
const HAND_TYPES = {
  HIGH: { name: 'High Card', chips: 5, mult: 1 },
  PAIR: { name: 'Pair', chips: 10, mult: 2 },
  TWOPAIR: { name: 'Two Pair', chips: 20, mult: 2 },
  THREE: { name: 'Three of a Kind', chips: 30, mult: 3 },
  STRAIGHT: { name: 'Straight', chips: 30, mult: 4 },
  FLUSH: { name: 'Flush', chips: 35, mult: 4 },
  FULL: { name: 'Full House', chips: 40, mult: 4 },
  FOUR: { name: 'Four of a Kind', chips: 60, mult: 7 },
  SF: { name: 'Straight Flush', chips: 100, mult: 8 },
}
const TIER = { HIGH: 1, PAIR: 2, TWOPAIR: 3, THREE: 4, STRAIGHT: 5, FLUSH: 6, FULL: 7, FOUR: 8, SF: 9 }

function chipValue(rank) {
  if (rank >= 11 && rank <= 13) return 10
  if (rank === 14) return 11
  return rank
}
function straightOf(cards) {
  const rs = [...new Set(cards.map((c) => c.rank))]
  if (rs.length !== 5) return null
  rs.sort((a, b) => a - b)
  if (rs[4] - rs[0] === 4) return cards
  if (rs[0] === 2 && rs[1] === 3 && rs[2] === 4 && rs[3] === 5 && rs[4] === 14) return cards
  return null
}
function evaluate(cards) {
  const n = cards.length
  const byRank = {}
  cards.forEach((c) => {
    ;(byRank[c.rank] = byRank[c.rank] || []).push(c)
  })
  const groups = Object.entries(byRank)
    .map(([r, cs]) => ({ rank: +r, cards: cs }))
    .sort((a, b) => b.cards.length - a.cards.length || b.rank - a.rank)
  const isFlush = n === 5 && cards.every((c) => c.suit === cards[0].suit)
  const straightCards = n === 5 ? straightOf(cards) : null
  const four = groups.find((g) => g.cards.length === 4)
  const three = groups.find((g) => g.cards.length === 3)
  const twos = groups.filter((g) => g.cards.length === 2)
  let key
  let sc
  if (isFlush && straightCards) {
    key = 'SF'
    sc = cards.slice()
  } else if (four) {
    key = 'FOUR'
    sc = four.cards.slice()
  } else if (three && twos.length >= 1) {
    key = 'FULL'
    sc = cards.slice()
  } else if (isFlush) {
    key = 'FLUSH'
    sc = cards.slice()
  } else if (straightCards) {
    key = 'STRAIGHT'
    sc = cards.slice()
  } else if (three) {
    key = 'THREE'
    sc = three.cards.slice()
  } else if (twos.length >= 2) {
    key = 'TWOPAIR'
    sc = [...twos[0].cards, ...twos[1].cards]
  } else if (twos.length === 1) {
    key = 'PAIR'
    sc = twos[0].cards.slice()
  } else {
    key = 'HIGH'
    sc = [cards.reduce((a, b) => (b.rank > a.rank ? b : a))]
  }
  const t = HAND_TYPES[key]
  return { key, name: t.name, chips: t.chips, mult: t.mult, scoringCards: sc, tier: TIER[key] }
}

// ---------- jokers ----------
const JOKERS = [
  { id: 'joker', name: 'Joker', desc: '+4 Mult', cost: 2, eff: () => ({ mult: 4 }) },
  { id: 'chips', name: 'Chip Stack', desc: '+50 Chips', cost: 4, eff: () => ({ chips: 50 }) },
  {
    id: 'hearts',
    name: 'Lovers',
    desc: '+3 Mult per ♥ scored',
    cost: 5,
    eff: (c) => ({ mult: 3 * c.scoringCards.filter((x) => x.suit === 1).length }),
  },
  {
    id: 'faces',
    name: 'Royalty',
    desc: '+15 Chips per face card scored',
    cost: 5,
    eff: (c) => ({ chips: 15 * c.scoringCards.filter((x) => x.rank >= 11 && x.rank <= 13).length }),
  },
  {
    id: 'seven',
    name: 'Lucky 7s',
    desc: '+20 Mult if a 7 is scored',
    cost: 5,
    eff: (c) => ({ mult: c.scoringCards.some((x) => x.rank === 7) ? 20 : 0 }),
  },
  {
    id: 'five',
    name: 'Full Throttle',
    desc: '+30 Mult if 5 cards played',
    cost: 6,
    eff: (c) => ({ mult: c.played.length === 5 ? 30 : 0 }),
  },
  {
    id: 'pairs',
    name: 'Twin Talent',
    desc: 'Pairs & Two Pair: +25 Chips, +6 Mult',
    cost: 5,
    eff: (c) => (c.tier === 2 || c.tier === 3 ? { chips: 25, mult: 6 } : {}),
  },
  {
    id: 'aces',
    name: 'Ace Up Sleeve',
    desc: 'Each Ace scored: +12 Chips & +2 Mult',
    cost: 6,
    eff: (c) => {
      const a = c.scoringCards.filter((x) => x.rank === 14).length
      return { chips: 12 * a, mult: 2 * a }
    },
  },
  {
    id: 'straightj',
    name: 'Tightrope',
    desc: '+40 Chips on a Straight',
    cost: 6,
    eff: (c) => (c.tier === 5 || c.tier === 9 ? { chips: 40 } : {}),
  },
  { id: 'glass', name: 'Glass Cannon', desc: '×1.5 Mult', cost: 6, eff: () => ({ xmult: 1.5 }) },
  {
    id: 'polish',
    name: 'High Society',
    desc: '×2 Mult on a Flush or better',
    cost: 8,
    eff: (c) => (c.tier >= 6 ? { xmult: 2 } : {}),
  },
  { id: 'cash', name: 'Rainy Day', desc: 'Earn $4 each blind cleared', cost: 5, onClear: 4, eff: () => ({}) },
]

function scoreHand(played) {
  const ev = evaluate(played)
  const b = boss.value
  let chips = b?.chipMul ? ev.chips * b.chipMul : ev.chips
  let mult = b?.multMul ? ev.mult * b.multMul : ev.mult
  for (const card of ev.scoringCards) {
    if (b?.debuffSuit === card.suit) continue // debuffed suit scores no chips
    chips += chipValue(card.rank)
  }
  const ctx = { scoringCards: ev.scoringCards, played, tier: ev.tier }
  for (const j of jokers.value) {
    const e = j.eff(ctx)
    if (e.chips) chips += e.chips
    if (e.mult) mult += e.mult
  }
  for (const j of jokers.value) {
    const e = j.eff(ctx)
    if (e.xmult) mult *= e.xmult
  }
  return { ev, chips, mult, total: Math.floor(chips * mult) }
}

// ---------- deck ----------
function buildDeck() {
  const d = []
  let id = 0
  for (let s = 0; s < 4; s++) for (let r = 2; r <= 14; r++) d.push({ id: id++, rank: r, suit: s })
  return d
}
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ---------- run state ----------
const BLIND_NAMES = ['Small Blind', 'Big Blind', 'Boss Blind']
const BLIND_MULT = [1, 1.5, 2]
const BLIND_REWARD = [4, 5, 6]
const HAND_SIZE = 8
// Lower base + steeper ramp than before: early blinds are reachable without a
// strong build, late blinds still scale past a snowballed joker engine.
const BASE_TARGET = 200
const ANTE_GROWTH = 1.7

// Boss Blind debuffs — one is rolled per Boss Blind. targetMul overrides the
// normal ×2 boss target so heavier debuffs come with a lighter score goal.
const BOSSES = [
  { id: 'needle', name: 'The Needle', desc: 'Only one hand to beat the blind', hands: 1, targetMul: 1 },
  { id: 'water', name: 'The Water', desc: 'Start with no discards', discards: 0, targetMul: 2 },
  { id: 'manacle', name: 'The Manacle', desc: 'Draw one fewer card', handSize: HAND_SIZE - 1, targetMul: 1.8 },
  { id: 'psychic', name: 'The Psychic', desc: 'Every hand must play 5 cards', mustPlay: 5, targetMul: 1.6 },
  { id: 'flint', name: 'The Flint', desc: 'Base Chips and Mult are halved', chipMul: 0.5, multMul: 0.5, targetMul: 1.4 },
  { id: 'goad', name: 'The Goad', desc: '♠ cards score no chips', debuffSuit: 0, targetMul: 2 },
  { id: 'head', name: 'The Head', desc: '♥ cards score no chips', debuffSuit: 1, targetMul: 2 },
  { id: 'window', name: 'The Window', desc: '♦ cards score no chips', debuffSuit: 2, targetMul: 2 },
  { id: 'club', name: 'The Club', desc: '♣ cards score no chips', debuffSuit: 3, targetMul: 2 },
]
function pickBoss() {
  return BOSSES[Math.floor(Math.random() * BOSSES.length)]
}

const state = ref('playing')
const ante = ref(1)
const blindIndex = ref(0)
const money = ref(4)
const roundScore = ref(0)
const runTotal = ref(0)
const hands = ref(4)
const discards = ref(3)
const handCards = ref([])
const selected = ref([])
const jokers = ref([])
const shopOffers = ref([])
const rerollCost = ref(5)
const lastPlay = ref(null)
const lastReward = ref(0)
const sortMode = ref('rank')
const boss = ref(null)
const displayScore = ref(0) // animated round score (ticks up to roundScore)
const scoringIds = ref(new Set()) // cards currently flashing as they score
const gainText = ref('') // floating "+N" popup
const showGain = ref(false)
const busyPlay = ref(false) // locks input during the scoring beat
let scoreRaf = null
let deck = []

const isBoss = computed(() => blindIndex.value === 2 && !!boss.value)
const blindName = computed(() => (isBoss.value ? boss.value.name : BLIND_NAMES[blindIndex.value]))
const curHandSize = computed(() => boss.value?.handSize ?? HAND_SIZE)
const target = computed(() => {
  const base = Math.round(BASE_TARGET * Math.pow(ANTE_GROWTH, ante.value - 1))
  const mult = isBoss.value ? boss.value.targetMul : BLIND_MULT[blindIndex.value]
  return Math.round(base * mult)
})
const selectedCards = computed(() => handCards.value.filter((c) => selected.value.includes(c.id)))
const preview = computed(() => {
  const s = selectedCards.value
  return s.length >= 1 && s.length <= 5 ? scoreHand(s) : null
})
const canPlay = computed(() => {
  if (state.value !== 'playing' || busyPlay.value) return false
  const n = selected.value.length
  if (n < 1 || n > 5) return false
  if (boss.value?.mustPlay && n !== boss.value.mustPlay) return false
  return true
})
const playHint = computed(() => {
  if (boss.value?.mustPlay && selected.value.length && selected.value.length !== boss.value.mustPlay)
    return `Play exactly ${boss.value.mustPlay} cards`
  return lastPlay.value
    ? `Last: ${lastPlay.value.name} +${lastPlay.value.total.toLocaleString()}`
    : 'Select 1–5 cards to play'
})
const canDiscard = computed(
  () => state.value === 'playing' && !busyPlay.value && discards.value > 0 && selected.value.length >= 1,
)

function isRed(c) {
  return SUIT_RED[c.suit]
}
function label(c) {
  return RANK_LABEL[c.rank] || String(c.rank)
}
function suit(c) {
  return SUITS[c.suit]
}
function fmtMult(m) {
  return Number.isInteger(m) ? String(m) : m.toFixed(1)
}

function sortHand() {
  handCards.value.sort((a, b) =>
    sortMode.value === 'rank' ? b.rank - a.rank || a.suit - b.suit : a.suit - b.suit || b.rank - a.rank,
  )
}
function drawUpTo(n) {
  while (handCards.value.length < n && deck.length) handCards.value.push(deck.pop())
  sortHand()
}
function toggle(id) {
  if (state.value !== 'playing') return
  const sel = selected.value
  if (sel.includes(id)) selected.value = sel.filter((x) => x !== id)
  else if (sel.length < 5) selected.value = [...sel, id]
  haptics.light()
}
function toggleSort() {
  sortMode.value = sortMode.value === 'rank' ? 'suit' : 'rank'
  sortHand()
  haptics.light()
}

function startBlind() {
  boss.value = blindIndex.value === 2 ? pickBoss() : null
  deck = shuffle(buildDeck())
  handCards.value = []
  selected.value = []
  roundScore.value = 0
  displayScore.value = 0
  scoringIds.value = new Set()
  showGain.value = false
  busyPlay.value = false
  hands.value = boss.value?.hands ?? 4
  discards.value = boss.value?.discards ?? 3
  lastPlay.value = null
  state.value = 'playing'
  drawUpTo(curHandSize.value)
}
function newRun() {
  haptics.light()
  money.value = 4
  jokers.value = [JOKERS[0]] // start with the basic +4 Mult Joker so Ante 1 isn't pure RNG
  ante.value = 1
  blindIndex.value = 0
  runTotal.value = 0
  boss.value = null
  startBlind()
}

function animateScore() {
  cancelAnimationFrame(scoreRaf)
  const tick = () => {
    const diff = roundScore.value - displayScore.value
    if (Math.abs(diff) < 1) {
      displayScore.value = roundScore.value
      return
    }
    displayScore.value = Math.round(displayScore.value + diff * 0.2)
    scoreRaf = requestAnimationFrame(tick)
  }
  scoreRaf = requestAnimationFrame(tick)
}

async function playHand() {
  if (!canPlay.value) return
  busyPlay.value = true
  const played = selectedCards.value.slice()
  const playedIds = new Set(selected.value)
  const res = scoreHand(played)
  // scoring beat: flash the cards that actually count, show the gain, tick up
  scoringIds.value = new Set(res.ev.scoringCards.map((c) => c.id))
  gainText.value = res.total.toLocaleString()
  showGain.value = true
  haptics.medium()
  await new Promise((r) => setTimeout(r, 420))
  scoringIds.value = new Set()
  lastPlay.value = { name: res.ev.name, total: res.total }
  roundScore.value += res.total
  animateScore()
  hands.value--
  handCards.value = handCards.value.filter((c) => !playedIds.has(c.id))
  selected.value = []
  setTimeout(() => (showGain.value = false), 480)
  busyPlay.value = false
  if (roundScore.value >= target.value) {
    clearBlind()
    return
  }
  if (hands.value <= 0) {
    lose()
    return
  }
  drawUpTo(curHandSize.value)
}
function discardSel() {
  if (!canDiscard.value) return
  discards.value--
  handCards.value = handCards.value.filter((c) => !selected.value.includes(c.id))
  selected.value = []
  drawUpTo(curHandSize.value)
  haptics.light()
}

function clearBlind() {
  runTotal.value += roundScore.value
  let reward = BLIND_REWARD[blindIndex.value]
  reward += Math.max(0, hands.value)
  reward += Math.min(5, Math.floor(money.value / 5))
  for (const j of jokers.value) if (j.onClear) reward += j.onClear
  lastReward.value = reward
  money.value += reward
  haptics.success()
  openShop()
}
function rollShop() {
  const owned = new Set(jokers.value.map((j) => j.id))
  const pool = shuffle(JOKERS.filter((j) => !owned.has(j.id)).slice())
  shopOffers.value = pool.slice(0, 3)
}
function openShop() {
  rollShop()
  rerollCost.value = 5
  state.value = 'shop'
}
function reroll() {
  if (money.value < rerollCost.value) return
  money.value -= rerollCost.value
  rollShop()
  rerollCost.value += 1
  haptics.light()
}
function buy(o) {
  if (money.value < o.cost || jokers.value.length >= 5) return
  money.value -= o.cost
  jokers.value.push(o)
  shopOffers.value = shopOffers.value.filter((x) => x.id !== o.id)
  haptics.medium()
}
function sellValue(j) {
  return Math.max(1, Math.floor((j.cost || 2) / 2))
}
function sell(j) {
  const i = jokers.value.findIndex((x) => x.id === j.id)
  if (i === -1) return
  money.value += sellValue(j)
  jokers.value.splice(i, 1) // freed joker can reappear in the pool on next reroll
  haptics.light()
}
function nextBlind() {
  blindIndex.value++
  if (blindIndex.value > 2) {
    blindIndex.value = 0
    ante.value++
  }
  if (ante.value > 8) {
    win()
    return
  }
  startBlind()
}

function win() {
  state.value = 'won'
  progressStore.recordWildcard(8, runTotal.value, true)
}
function lose() {
  state.value = 'over'
  progressStore.recordWildcard(ante.value, runTotal.value + roundScore.value, false)
}

function showJoker(j) {
  haptics.light()
  $q.notify({ message: `${j.name} — ${j.desc}`, color: 'dark', position: 'top', timeout: 1600 })
}
function goBack() {
  haptics.light()
  router.back()
}
function howToPlay() {
  haptics.light()
  router.push({ name: 'how-to-play' })
}

onMounted(() => {
  newRun()
})
onBeforeUnmount(() => cancelAnimationFrame(scoreRaf))
</script>

<style lang="scss" scoped>
.wildcard-page {
  min-height: 100vh;
  transition: background 2s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow: hidden;
  padding-bottom: max(12px, env(safe-area-inset-bottom));
}
.game-header {
  width: 100%;
  max-width: 540px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px;
  padding-top: max(54px, calc(env(safe-area-inset-top) + 14px));
}
.ante-title {
  flex: 1;
  text-align: center;
  color: #fff;
  font-weight: 800;
  font-size: 1.15rem;
  letter-spacing: 0.02em;
  .of { opacity: 0.6; font-weight: 600; margin-left: 4px; }
}
.header-menu { display: flex; gap: 2px; }

.hud {
  width: 100%;
  max-width: 460px;
  display: flex;
  align-items: stretch;
  gap: 8px;
  padding: 0 12px;
}
.blind-box {
  flex: 1;
  border-radius: 12px;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.28);
  border-left: 4px solid #5fd0e0;
  color: #fff;
  &.b1 { border-left-color: #f1c40f; }
  &.b2 { border-left-color: #e8503a; }
}
.blind-name { font-weight: 700; font-size: 0.95rem; }
.blind-debuff { font-size: 0.72rem; color: #ffd2c4; font-weight: 600; line-height: 1.15; margin-top: 1px; }
.blind-target { font-size: 0.78rem; opacity: 0.8; }
.score-now {
  position: relative;
  min-width: 96px;
  border-radius: 12px;
  padding: 6px 12px;
  background: rgba(0, 0, 0, 0.28);
  text-align: center;
  color: #fff;
}
.score-label { font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.7; }
.score-big { font-size: 1.5rem; font-weight: 800; line-height: 1.1; transition: color 0.2s; }
.score-big.hit { color: #5ee08a; }
.score-big.pop { animation: scorepop 0.4s ease; }
@keyframes scorepop {
  0% { transform: scale(1); }
  35% { transform: scale(1.28); color: #ffe06a; }
  100% { transform: scale(1); }
}
.score-gain {
  position: absolute;
  top: -10px;
  right: 8px;
  font-size: 1.1rem;
  font-weight: 800;
  color: #ffe06a;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
  pointer-events: none;
}
.gain-fade-enter-active { animation: gainfloat 0.9s ease-out forwards; }
.gain-fade-leave-active { transition: opacity 0.2s; opacity: 0; }
@keyframes gainfloat {
  0% { opacity: 0; transform: translateY(6px) scale(0.7); }
  25% { opacity: 1; transform: translateY(0) scale(1.1); }
  100% { opacity: 0; transform: translateY(-26px) scale(1); }
}
.meta {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
}
.meta-item {
  display: flex;
  align-items: center;
  gap: 5px;
  background: rgba(0, 0, 0, 0.28);
  border-radius: 8px;
  padding: 3px 9px;
  color: #fff;
  font-weight: 700;
  font-size: 0.85rem;
  &.money { color: #f1c40f; }
}

.jokers {
  width: 100%;
  max-width: 460px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 10px 12px 4px;
  min-height: 26px;
}
.joker-chip {
  background: linear-gradient(135deg, #6a4fb0, #8e5fc8);
  color: #fff;
  border-radius: 8px;
  padding: 4px 10px;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}
.joker-empty { color: rgba(255, 255, 255, 0.55); font-size: 0.78rem; font-style: italic; }

.preview {
  width: 100%;
  max-width: 460px;
  margin: 6px 0 2px;
  padding: 8px 14px;
  text-align: center;
  color: #fff;
  min-height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  flex-wrap: wrap;
}
.preview.active { background: rgba(0, 0, 0, 0.2); border-radius: 12px; }
.pv-name { font-weight: 800; font-size: 1.05rem; }
.pv-calc { font-weight: 700; opacity: 0.95; }
.pv-calc .x { opacity: 0.6; }
.pv-calc .eq { opacity: 0.6; margin: 0 2px; }
.pv-total { color: #5ee08a; font-size: 1.15rem; }
.pv-hint { opacity: 0.6; font-style: italic; font-size: 0.9rem; }

.hand-wrap { width: 100%; display: flex; justify-content: center; padding: 8px 8px; flex: 1; align-items: center; }
.hand {
  display: flex;
  gap: clamp(3px, 1.4vw, 8px);
  justify-content: center;
  flex-wrap: wrap;
  max-width: 480px;
}
.card {
  width: clamp(40px, 11vw, 52px);
  height: clamp(58px, 16vw, 74px);
  border-radius: 9px;
  background: #fdfdfb;
  border: none;
  box-shadow: 0 3px 7px rgba(0, 0, 0, 0.35);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  cursor: pointer;
  color: #2b2b2b;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
  position: relative;
  padding: 0;
  &.red { color: #d8352a; }
  &.sel {
    transform: translateY(-14px);
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.4);
    outline: 3px solid #5fd0e0;
  }
  &.scoring {
    animation: cardscore 0.42s ease;
    outline: 3px solid #ffe06a;
    z-index: 2;
  }
  .rank { font-size: clamp(1rem, 4.5vw, 1.4rem); font-weight: 800; line-height: 1; }
  .suit { font-size: clamp(0.9rem, 4vw, 1.25rem); line-height: 1; }
}

@keyframes cardscore {
  0% { transform: translateY(-14px); }
  40% { transform: translateY(-30px) scale(1.12); box-shadow: 0 0 18px rgba(255, 224, 106, 0.9); }
  100% { transform: translateY(-14px); }
}

.actions {
  width: 100%;
  max-width: 460px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 8px 12px 4px;
}
.act { border-radius: 12px; font-weight: 800; padding: 10px 22px; }
.act.play { background: linear-gradient(135deg, #2ecc71, #1f9d57) !important; color: #fff; }
.act.discard { background: linear-gradient(135deg, #e8503a, #c43622) !important; color: #fff; }
.act.play:disabled, .act.discard:disabled { opacity: 0.4; }

.overlay {
  position: fixed;
  inset: 0;
  z-index: 20;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.overlay-card {
  background: rgba(46, 33, 64, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 18px;
  padding: 24px;
  width: 100%;
  max-width: 380px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: #fff;
}
.overlay-title { font-size: 1.5rem; font-weight: 800; text-align: center; }
.overlay-sub { opacity: 0.85; text-align: center; }
.overlay-sub.small { font-size: 0.82rem; opacity: 0.6; margin-top: -6px; }
.shop-offers { width: 100%; display: flex; flex-direction: column; gap: 10px; margin: 6px 0; }
.offer {
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 10px 12px;
}
.offer-top { flex: 1; }
.offer-name { font-weight: 800; }
.offer-desc { font-size: 0.8rem; opacity: 0.8; }
.offer.empty { justify-content: center; opacity: 0.6; font-style: italic; }
.buy { background: #f1c40f !important; color: #2b2b2b !important; font-weight: 800; border-radius: 9px; min-width: 52px; }
.buy:disabled { opacity: 0.4; }
.owned { width: 100%; margin: 2px 0 4px; }
.owned-label { font-size: 0.72rem; opacity: 0.6; margin-bottom: 6px; text-align: center; }
.owned-list { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
.owned-joker {
  background: rgba(142, 95, 200, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.18);
  color: #fff;
  border-radius: 8px;
  padding: 4px 9px;
  font-size: 0.74rem;
  font-weight: 700;
  cursor: pointer;
}
.owned-joker .sell-val { color: #f1c40f; font-weight: 800; }
.shop-actions { display: flex; gap: 10px; width: 100%; justify-content: space-between; }

.overlay-fade-enter-active { transition: opacity 0.3s ease; }
.overlay-fade-enter-from { opacity: 0; }
:deep(.q-btn.bg-primary) { background: linear-gradient(135deg, #8e5fc8 0%, #5fd0e0 100%) !important; }
</style>
