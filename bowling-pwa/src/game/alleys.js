// The alleys. Each is a vibe: colors for the 3D scene, its own gravity (!),
// a signature strike celebration, and an announcer with opinions.
export const alleys = [
  {
    id: 'disco',
    name: 'Disco Nova',
    tagline: 'Cosmic bowling. The lane is a dance floor and the pins know it.',
    icon: '🪩',
    gravity: -9.81,
    fx: 'discoball', // mirror ball drops the confetti on strikes
    pit: 'open', // no backer — the mirror ball hangs over the pit
    sweepStyle: 'neon', // the arm is twin neon tubes with sparkle beads
    pin: { body: '#f4f0ff', bands: [{ y: 0.66, c: '#ff3df0' }, { y: 0.735, c: '#28d7fe' }] },
    hazards: ['mirrorball', 'discoshoe'],
    colors: {
      clear: '#0b0817',
      lane: '#241b3a',
      laneEdgeA: '#ff3df0',
      laneEdgeB: '#28d7fe',
      gutter: '#141021',
      backstop: '#07050e',
      pin: '#f4f0ff',
      pinStripe: '#ff3df0',
      arrow: '#28d7fe',
      sweep: '#2a2340',
      sweepGlow: '#ff3df0',
    },
    sky: 'linear-gradient(160deg,#2a1b4a 0%,#0b0817 100%)',
    lines: {
      strike: ['STRIIIIKE! The mirror ball approves.', 'All ten! Somebody call the DJ.', 'Cleared the floor. Literally.'],
      spare: ['Cleaned it up — smooth operator.', 'Spare! The bass drops for you.'],
      gutter: ['Gutter. The disco ball looked away.', 'That one danced right off the floor.'],
      split: ['Ooof, a split. The lights just dimmed.', 'A split. Even the fog machine gasped.'],
      open: ['Left some standing. They’re vogueing.', 'The pins survived the night.'],
    },
  },
  {
    id: 'lava',
    name: 'Lava Lanes',
    tagline: 'Bowl over a live magma flow. The gutters are… discouraged.',
    icon: '🌋',
    gravity: -9.81,
    fx: 'lava', // molten gutters pulse; gutter balls sizzle
    pit: 'volcano', // the lane dead-ends into a glowing volcano
    sweepStyle: 'drip', // basalt bar shedding glowing lava drips
    wood: true, // grained boards on the lane floor
    pin: { body: '#fff3e6', bands: [{ y: 0.66, c: '#e8481c' }, { y: 0.735, c: '#ffb52f' }] },
    hazards: ['lavapatch', 'boulder'],
    colors: {
      clear: '#160d0a',
      lane: '#3a2c22',
      laneEdgeA: '#ff7b2f',
      laneEdgeB: '#ffb52f',
      gutter: '#e8481c',
      gutterGlow: '#ff6a1f',
      backstop: '#0c0705',
      pin: '#fff3e6',
      pinStripe: '#e8481c',
      arrow: '#ffb52f',
      sweep: '#33241c',
      sweepGlow: '#ff6a1f',
    },
    sky: 'linear-gradient(160deg,#4a2430 0%,#160f12 100%)',
    lines: {
      strike: ['STRIKE! The volcano felt that.', 'Ten pins, straight into the magma chamber.', 'Eruption-grade. Magnificent.'],
      spare: ['Spare! Forged in fire.', 'Cleanup on lane one. With lava.'],
      gutter: ['Ssssizzle. That ball is lava now.', 'Gutter. The magma says thank you.'],
      split: ['A split?! Even the volcano winced.', 'That split is geologically unfair.'],
      open: ['Some pins survived the eruption.', 'The pins are fireproof, apparently.'],
    },
  },
  {
    id: 'zerog',
    name: 'Zero-G Lanes',
    tagline: 'Bowling on the space station. Pins fall slower. Egos fall the same.',
    icon: '🛸',
    gravity: -5.2, // floatier pin scatter — the signature gimmick
    fx: 'ufo', // a saucer buzzes the deck on strikes
    pit: 'open', // no backer — deep space behind the pins
    sweepStyle: 'laser', // stacked laser beams between emitter pods
    pin: { body: '#eef4ff', bands: [{ y: 0.66, c: '#4dff9d' }, { y: 0.735, c: '#4d9dff' }] },
    hazards: ['saucer', 'alien'],
    colors: {
      clear: '#050912',
      lane: '#152238',
      laneEdgeA: '#4dff9d',
      laneEdgeB: '#4d9dff',
      gutter: '#0b1322',
      backstop: '#030710',
      pin: '#eef4ff',
      pinStripe: '#4dff9d',
      arrow: '#4dff9d',
      sweep: '#1b2634',
      sweepGlow: '#4dff9d',
    },
    sky: 'linear-gradient(160deg,#12203c 0%,#050912 100%)',
    lines: {
      strike: ['STRIKE! Mission control is on their feet.', 'All ten, in glorious slow motion.', 'Houston, the pins are down.'],
      spare: ['Spare! Docking complete.', 'Orbital cleanup achieved.'],
      gutter: ['Gutter. Lost to the void.', 'That ball has achieved escape velocity. Sadly.'],
      split: ['A split, drifting apart. Poetic.', 'Split detected. Thrusters won’t help.'],
      open: ['Pins still standing. Gravity’s alibi.', 'The station keeps a few survivors.'],
    },
  },
  {
    id: 'tiki',
    name: 'Tiki Grove',
    tagline: 'Dusk in the jungle. Torches, totems, and the occasional coconut.',
    icon: '🗿',
    gravity: -9.81,
    fx: 'tiki', // torchlight flickers; strikes flare the flames
    pit: 'masks', // a row of glowing-eyed tiki masks above the pit
    sweepStyle: 'bamboo', // a thick cane with nodes and rope lashings
    wood: true, // grained boards on the lane floor
    pin: { body: '#c98d4e', bands: [{ y: 0.24, c: '#7a4a22' }, { y: 0.49, c: '#2e8b57' }, { y: 0.7, c: '#e8481c' }] },
    hazards: ['coconut', 'pineapple', 'tikidrink', 'fallentorch'],
    colors: {
      clear: '#1a1410',
      lane: '#4a3520',
      laneEdgeA: '#ff8a3a',
      laneEdgeB: '#59c26a',
      gutter: '#241a10',
      backstop: '#0e0a06',
      pin: '#c98d4e',
      pinStripe: '#7a4a22',
      arrow: '#ffb52f',
      sweep: '#8a6a3a',
      sweepGlow: '#ffab3a',
    },
    sky: 'linear-gradient(160deg,#43301c 0%,#150e08 100%)',
    lines: {
      strike: ['STRIKE! The totems approve.', 'All ten! The torches just flared.', 'The jungle goes quiet. Respect.'],
      spare: ['Spare! Smooth as coconut milk.', 'Cleaned up, island style.'],
      gutter: ['Gutter. The tiki gods frown.', 'That one rolled to the sea.'],
      split: ['A split. Somewhere, a drum stops.', 'The totems saw that split. Sorry.'],
      open: ['Pins left standing. The jungle waits.', 'The totems are unimpressed.'],
    },
  },
  {
    id: 'casino',
    name: 'High Roller',
    tagline: 'Velvet, gold, and terrible odds. The house always wins. Usually.',
    icon: '🎰',
    gravity: -9.81,
    fx: 'casino', // gold sparkle; strikes hit the jackpot
    pit: 'slot', // the backer is a slot machine; the pit is the payout tray
    sweepStyle: 'plush', // button-tufted leather bumper, gold hardware
    pin: { body: '#e8c86a', bands: [{ y: 0.66, c: '#a01a2e' }, { y: 0.735, c: '#7a1522' }] },
    hazards: ['die', 'chipstack', 'cocktail'],
    colors: {
      clear: '#160a0e',
      lane: '#3a1220',
      laneEdgeA: '#ffd23f',
      laneEdgeB: '#ff4a6a',
      gutter: '#1c0a10',
      backstop: '#0c0508',
      pin: '#e8c86a',
      pinStripe: '#a01a2e',
      arrow: '#ffd23f',
      sweep: '#4a1626',
      sweepGlow: '#ffd23f',
    },
    sky: 'linear-gradient(160deg,#4a1626 0%,#12060c 100%)',
    lines: {
      strike: ['JACKPOT! All ten pay out.', 'STRIKE! The pit boss is watching.', 'Ten for ten. House edge, erased.'],
      spare: ['Spare! Double or nothing next.', 'The comeback pays 2 to 1.'],
      gutter: ['Gutter. The house thanks you.', 'That roll was… a donation.'],
      split: ['A split. Snake eyes.', 'Ouch. The odds just moved.'],
      open: ['Pins stand. The house smiles.', 'Left some chips on the table.'],
    },
  },
  {
    id: 'pool',
    name: 'Poolside',
    tagline: 'Daylight bowling on the boardwalk. Mind the beach balls.',
    icon: '🏖️',
    gravity: -9.81,
    fx: 'poolside', // sunny; strikes splash
    bright: true, // full daylight rig
    pit: 'water', // no dark backstop — the deck ends over open pool water
    sweepStyle: 'noodle', // a candy-striped foam pool noodle
    wood: 'soft', // sun-bleached boards, blended close in tone
    pin: { body: '#ffffff', bands: [{ y: 0.66, c: '#29b5d8' }, { y: 0.735, c: '#ff8a5a' }] },
    hazards: ['beachball', 'floaty', 'sunglasses', 'towel', 'sandal'],
    colors: {
      clear: '#bfe4f5',
      lane: '#d8b078',
      laneEdgeA: '#29b5d8',
      laneEdgeB: '#ff8a5a',
      gutter: '#3aa0c8',
      backstop: '#7fb8d0',
      pin: '#ffffff',
      pinStripe: '#29b5d8',
      arrow: '#0a7ea4',
      sweep: '#f2ede4',
      sweepGlow: '#29b5d8',
    },
    sky: 'linear-gradient(160deg,#8fd0ea 0%,#4a9cc2 100%)',
    lines: {
      strike: ['STRIKE! Cannonball!', 'All ten! Somebody call the lifeguard.', 'Sunburn AND a strike. Big day.'],
      spare: ['Spare! Cool as a popsicle.', 'Cleaned it up before the tide.'],
      gutter: ['Gutter. Right into the pool.', 'That one needed floaties.'],
      split: ['A split. Sand in the gears.', 'The seagulls saw that. They talk.'],
      open: ['Pins survive. The pool party continues.', 'Left a few sunbathing.'],
    },
  },
  {
    id: 'park',
    name: 'Timberline',
    tagline: 'Night bowling in the national park. Keep one eye on the treeline.',
    icon: '🏕️',
    gravity: -9.81,
    fx: 'forest', // the first DEEP backdrop: forest, campfires… and a visitor
    pit: 'forest', // a log gate frames the open view into the woods
    sweepStyle: 'log', // a pine log on the pinsetter chains
    wood: true, // lodge boards on the lane floor
    pin: { body: '#f4ead8', bands: [{ y: 0.66, c: '#2e6b45' }, { y: 0.735, c: '#ffb46a' }] },
    hazards: ['pinecone', 'marshstick', 'canteen', 'bigfootprint'],
    colors: {
      clear: '#0b1410',
      lane: '#4a3826',
      laneEdgeA: '#ffb46a',
      laneEdgeB: '#6ade8a',
      gutter: '#1c150c',
      backstop: '#080c08',
      pin: '#f4ead8',
      pinStripe: '#2e6b45',
      arrow: '#ffc46a',
      sweep: '#4a3a26',
      sweepGlow: '#ffb46a',
    },
    sky: 'linear-gradient(160deg,#1d3a2a 0%,#0b1410 100%)',
    lines: {
      strike: ['STRIKE! It echoed off the mountains.', 'All ten! The owls are hooting.', 'Timber. All of it.'],
      spare: ['Spare! Leave no pin behind.', 'Cleaned the campsite. Ranger-approved.'],
      gutter: ['Gutter. Straight into the creek.', 'That one’s bear food now.'],
      split: ['A split. Rough trail ahead.', 'The forest heard that split. It’s whispering.'],
      open: ['Pins left standing, like old growth.', 'A few survivors around the fire.'],
    },
  },
  {
    id: 'carnival',
    name: 'The Midway',
    tagline: 'Step right up! Every roll’s a winner. Results may vary.',
    icon: '🎪',
    gravity: -9.81,
    fx: 'carnival', // ferris wheel, string lights, the occasional firework
    pit: 'ducks', // the backer is a shooting-gallery duck row
    sweepStyle: 'marquee', // a lightbulb marquee bar, bulbs chasing
    wood: true, // boardwalk planks
    edgeBulbs: true, // runway-style rows of little bulbs, not neon tubes
    pin: { body: '#fff4e8', bands: [{ y: 0.66, c: '#ff4a5e' }, { y: 0.735, c: '#ffd23f' }] },
    hazards: ['popcorn', 'cottoncandy', 'rubberduck', 'ticketroll'],
    colors: {
      clear: '#140a14',
      lane: '#4a2a1c',
      laneEdgeA: '#ff4a5e',
      laneEdgeB: '#ffd23f',
      gutter: '#20101a',
      backstop: '#0c060c',
      pin: '#fff4e8',
      pinStripe: '#ff4a5e',
      arrow: '#ffd23f',
      sweep: '#4a1626',
      sweepGlow: '#ffd23f',
    },
    sky: 'linear-gradient(160deg,#3a1440 0%,#140a14 100%)',
    lines: {
      strike: ['STRIKE! Winner winner — pick any prize on the top shelf.', 'All ten! Ring the bell!', 'The carny is speechless. That never happens.'],
      spare: ['Spare! Step right up and do it again.', 'Cleanup! You win the medium bear.'],
      gutter: ['Gutter. No prize. The ducks laugh.', 'That one rolled off to join the circus.'],
      split: ['A split! The house ALWAYS does that.', 'A split — classic midway hustle.'],
      open: ['Pins still up. Rigged? Probably rigged.', 'The ducks judge you silently.'],
    },
  },
  {
    id: 'arctic',
    name: 'Polar Nights',
    tagline: 'Bowling under the aurora. The lane is actual ice. You’ll be fine.',
    icon: '🧊',
    gravity: -9.81,
    fx: 'aurora', // ribbons overhead, snowfall, icebergs on the horizon
    pit: 'igloo', // the lane ends at a warm-windowed igloo
    sweepStyle: 'icicle', // a frosted bar fringed with icicles
    ice: true, // no wood — a polished ice slab with a hard gleam
    pin: { body: '#f4faff', bands: [{ y: 0.66, c: '#38b8d8' }, { y: 0.735, c: '#a88aff' }] },
    hazards: ['penguin', 'snowman', 'icepatch', 'frozenfish'],
    colors: {
      clear: '#0a1424',
      lane: '#b8d8ec',
      laneEdgeA: '#6ae8c8',
      laneEdgeB: '#a88aff',
      gutter: '#12233a',
      backstop: '#060d18',
      pin: '#f4faff',
      pinStripe: '#38b8d8',
      arrow: '#8ae8ff',
      sweep: '#1b2b3f',
      sweepGlow: '#6ae8c8',
    },
    sky: 'linear-gradient(160deg,#16305a 0%,#0a1424 100%)',
    lines: {
      strike: ['STRIKE! The aurora flared for you.', 'All ten! Heard clean across the ice shelf.', 'Subzero. Absolutely subzero.'],
      spare: ['Spare! Cool under pressure.', 'Swept clean, like fresh powder.'],
      gutter: ['Gutter. Straight into the crevasse.', 'The penguins saw. The penguins remember.'],
      split: ['A split — cracked like spring ice.', 'That split came with wind chill.'],
      open: ['Pins standing, frozen solid.', 'A few survived the cold snap.'],
    },
  },
  {
    id: 'west',
    name: 'Dry Gulch',
    tagline: 'High noon at midnight. This lane ain’t big enough for the ten of them.',
    icon: '🤠',
    gravity: -9.81,
    fx: 'west', // mesas, cacti, a sunset that never quits, tumbleweed
    pit: 'saloon', // the ball pushes through the batwing doors
    sweepStyle: 'lasso', // a rope bar, coiled ends, a loop swinging under it
    wood: true, // sun-dried planks
    pin: { body: '#f2e2c8', bands: [{ y: 0.66, c: '#8a4a22' }, { y: 0.735, c: '#ffb03a' }] },
    hazards: ['cactus', 'tumbleweed', 'horseshoe', 'cowboyhat'],
    colors: {
      clear: '#180d08',
      lane: '#5a3a22',
      laneEdgeA: '#ffb03a',
      laneEdgeB: '#ff5e3a',
      gutter: '#241408',
      backstop: '#0c0705',
      pin: '#f2e2c8',
      pinStripe: '#8a4a22',
      arrow: '#ffb03a',
      sweep: '#3a2414',
      sweepGlow: '#ffb03a',
    },
    sky: 'linear-gradient(160deg,#5a2418 0%,#180d08 100%)',
    lines: {
      strike: ['STRIKE! Fastest ball in the West.', 'All ten, kissin’ the dirt.', 'This town just got ten pins quieter.'],
      spare: ['Spare! Quick on the draw.', 'Rounded up the stragglers.'],
      gutter: ['Gutter. That ball rode off into the sunset.', 'Missed ’em by a country mile, partner.'],
      split: ['A split. A genuine standoff.', 'Two pins, ten paces apart.'],
      open: ['Pins still standing. Wanted: dead or down.', 'The tumbleweeds saw the whole thing.'],
    },
  },
]

export function alleyById(id) {
  return alleys.find((a) => a.id === id) || alleys[0]
}
